import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Plus } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const CAPTION_LIMIT = 2200; // limite do Instagram
const sb = supabase as any;

/**
 * Legenda do post, escrita dentro da tarefa. Texto simples de propósito: é o que vai para o Instagram.
 * É UMA legenda só: se o post já está no Cronograma, este campo mostra e grava a própria legenda de lá; senão, grava na tarefa.
 * O banco mantém iguais as cópias do post nas etapas e o Cronograma (ver migration pm_tasks_post_caption_follows).
 * Vazia, só vira campo depois de "Escrever legenda"; com texto, é só clicar e digitar (como a Descrição). Salva sozinha (1s sem digitar, ao sair do campo, ao fechar e ao esconder a aba).
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
    qc.setQueryData(queryKey, (old: any) => (old ? { ...old, caption: text } : old)); // sem piscar o texto antigo ao sair do campo
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
    if (editingRef.current || locked) return; // voltar o foco não pode descartar o que está sendo digitado
    publicationRef.current = captionQ.data?.publicationId ?? null;
    draftRef.current = saved;
    savedRef.current = saved;
    editingRef.current = true;
    setDraft(saved);
    setStatus("idle");
    setEditing(true);
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const finish = async () => {
    await persistRef.current();
    if (document.activeElement === textareaRef.current) return; // voltou a clicar enquanto salvava
    if (draftRef.current !== savedRef.current) return; // não salvou: o texto fica no campo
    editingRef.current = false;
    setEditing(false);
  };
  const value = editing ? draft : saved;
  const showField = editing || !!saved;
  // a caixa cresce com o texto, como a da Descrição
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    if (el.scrollHeight) el.style.height = `${el.scrollHeight + 2}px`;
  }, [value, showField]);

  // Mesmo visual e mesmo jeito da Descrição (título com ícone + caixa que edita ao clicar). Vazia, mostra só o "Escrever legenda".
  return (
    <div className="border-t border-border/20 pt-4">
      {showField ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Legenda</h3>
            {editing && (
              <span className="ml-auto text-xs text-muted-foreground">{status === "saving" ? "Salvando… · " : status === "saved" ? "Salva · " : ""}{draft.length}/{CAPTION_LIMIT}</span>
            )}
          </div>
          <Textarea
            ref={textareaRef}
            autoFocus={!saved} // só quando acabou de clicar em "Escrever legenda"
            value={value}
            readOnly={locked}
            maxLength={CAPTION_LIMIT}
            aria-label="Legenda do post"
            className="min-h-[100px] w-full resize-none overflow-hidden rounded-lg border-border/40 bg-background px-3 py-2 text-sm leading-relaxed text-foreground focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:ring-offset-0"
            placeholder="Escreva a legenda deste post..."
            onFocus={startEditing}
            onChange={(e) => {
              setDraft(e.target.value);
              draftRef.current = e.target.value;
              window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => void persistRef.current(), 1000);
            }}
            onBlur={() => void finish()}
          />
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
