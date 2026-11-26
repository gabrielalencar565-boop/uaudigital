import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const CAPTION_LIMIT = 2200; // limite do Instagram
const sb = supabase as any;

/**
 * Legenda do post, escrita dentro da tarefa. Texto simples de propósito: é o que vai para o Instagram.
 * É UMA legenda só: se o post já está no Cronograma, este campo mostra e grava a própria legenda de lá; senão, grava na tarefa.
 * O banco mantém iguais as cópias do post nas etapas e o Cronograma (ver migration pm_tasks_post_caption_follows).
 * Só vira campo depois de "Escrever legenda" / "Editar legenda". Salva sozinha (1s sem digitar, ao sair do campo, ao fechar e ao esconder a aba).
 */
export function PostCaptionField({ taskId, readOnly = false }: { taskId: string; readOnly?: boolean }) {
  const qc = useQueryClient();
  const queryKey = ["pm_post_caption", taskId];
  const captionQ = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await sb.from("pm_tasks").select("caption, post_key").eq("id", taskId).maybeSingle();
      if (error) throw error;
      const key: string = data?.post_key ?? taskId;
      const { data: copies } = await sb.from("pm_tasks").select("id").is("deleted_at", null).or(`id.eq.${key},post_key.eq.${key}`);
      const ids = [...new Set([taskId, ...(copies ?? []).map((c: { id: string }) => c.id)])];
      const { data: pubs, error: pubsError } = await sb
        .from("calendar_publications")
        .select("id, caption, instagram_status")
        .in("task_id", ids)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (pubsError) throw pubsError;
      const pub = (pubs ?? [])[0] as { id: string; caption: string | null; instagram_status: string } | undefined;
      return {
        caption: (pub ? pub.caption : data?.caption) ?? "",
        publicationId: pub?.id ?? null,
        published: pub?.instagram_status === "published" || pub?.instagram_status === "publishing",
      };
    },
    refetchOnMount: "always", // pode ter sido editada no Cronograma
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const draftRef = useRef("");
  const savedRef = useRef("");
  const editingRef = useRef(false);
  const publicationRef = useRef<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const persist = async () => {
    window.clearTimeout(timer.current);
    if (!editingRef.current) return;
    const text = draftRef.current;
    if (text === savedRef.current) return;
    const previous = savedRef.current;
    savedRef.current = text;
    setStatus("saving");
    const publicationId = publicationRef.current;
    const { data, error } = publicationId
      ? await sb.from("calendar_publications").update({ caption: text || null }).eq("id", publicationId).select("id")
      : await sb.from("pm_tasks").update({ caption: text || null }).eq("id", taskId).select("id");
    if (error || !data?.length) {
      savedRef.current = previous;
      setStatus("idle");
      toast.error("Não foi possível salvar a legenda. Tente de novo.");
      return;
    }
    setStatus("saved");
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["calendar_publications"] });
    qc.invalidateQueries({ queryKey: ["calendar_publication"] });
  };
  const persistRef = useRef(persist);
  persistRef.current = persist;

  // trocar de post ou fechar a tarefa grava o que ficou pendente
  useEffect(() => {
    editingRef.current = false;
    setEditing(false);
    setStatus("idle");
    const flush = () => { void persistRef.current(); };
    const onVisibility = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [taskId]);

  const saved = captionQ.data?.caption ?? "";
  const published = captionQ.data?.published ?? false;
  const locked = readOnly || published;
  const startEditing = () => {
    publicationRef.current = captionQ.data?.publicationId ?? null;
    draftRef.current = saved;
    savedRef.current = saved;
    editingRef.current = true;
    setDraft(saved);
    setStatus("idle");
    setEditing(true);
  };
  const finish = async () => {
    await persistRef.current();
    editingRef.current = false;
    setEditing(false);
  };

  // Visual minimalista: sem caixa nem título quando está vazio; com texto, só o rótulo, o lápis e a legenda.
  return (
    <div className="border-t border-border/20 pt-4">
      {editing ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Legenda</span>
            <span>{status === "saving" ? "Salvando… · " : status === "saved" ? "Salva · " : ""}{draft.length}/{CAPTION_LIMIT}</span>
          </div>
          <Textarea
            autoFocus
            value={draft}
            maxLength={CAPTION_LIMIT}
            rows={5}
            aria-label="Legenda do post"
            className="bg-transparent text-sm leading-relaxed"
            placeholder="Escreva a legenda deste post..."
            onChange={(e) => {
              setDraft(e.target.value);
              draftRef.current = e.target.value;
              window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => void persistRef.current(), 1000);
            }}
            onBlur={() => void persistRef.current()}
          />
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void finish()}>Concluir</Button>
          </div>
        </div>
      ) : saved ? (
        <div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Legenda</span>
            {!locked && (
              <button type="button" onClick={startEditing} className="rounded p-1 transition-colors hover:text-foreground" aria-label="Editar legenda" title="Editar legenda">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{saved}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          disabled={locked || !captionQ.data}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Escrever legenda
        </button>
      )}

      {published && <p className="mt-2 text-xs text-muted-foreground">Este post já foi publicado: a legenda não muda mais.</p>}
    </div>
  );
}
