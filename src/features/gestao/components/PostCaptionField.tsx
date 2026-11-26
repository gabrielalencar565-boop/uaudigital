import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquareText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

const CAPTION_LIMIT = 2200; // limite do Instagram
const sb = supabase as any;

/**
 * Legenda do post, escrita dentro da tarefa. Texto simples de propósito: é o que vai para o Instagram.
 * O banco leva a legenda para as cópias do post nas outras etapas e para o Cronograma (ver migration pm_tasks_post_caption_follows).
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
      const { data: pubs } = await sb.from("calendar_publications").select("caption").in("task_id", ids).is("deleted_at", null);
      const saved: string = data?.caption ?? "";
      // texto que alguém ajustou no Cronograma: lá é o que vale
      const inCalendar: string | null = (pubs ?? []).map((p: { caption: string | null }) => p.caption ?? "").find((c: string) => c !== "" && c !== saved) ?? null;
      return { caption: saved, inCalendar };
    },
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const draftRef = useRef("");
  const savedRef = useRef("");
  const editingRef = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const persist = async () => {
    window.clearTimeout(timer.current);
    if (!editingRef.current) return;
    const text = draftRef.current;
    if (text === savedRef.current) return;
    const previous = savedRef.current;
    savedRef.current = text;
    setStatus("saving");
    const { data, error } = await sb.from("pm_tasks").update({ caption: text || null }).eq("id", taskId).select("id");
    if (error || !data?.length) {
      savedRef.current = previous;
      setStatus("idle");
      toast.error("Não foi possível salvar a legenda. Tente de novo.");
      return;
    }
    setStatus("saved");
    qc.invalidateQueries({ queryKey });
    qc.invalidateQueries({ queryKey: ["calendar_publications"] });
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
  const startEditing = () => {
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

  return (
    <div className="border-t border-border/20 pt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-bold">Legenda do post</h3>
        </div>
        {editing && (
          <span className="text-xs text-muted-foreground">
            {status === "saving" ? "Salvando… · " : status === "saved" ? "Salva · " : ""}{draft.length}/{CAPTION_LIMIT}
          </span>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            autoFocus
            value={draft}
            maxLength={CAPTION_LIMIT}
            rows={5}
            placeholder="Escreva a legenda deste post..."
            onChange={(e) => {
              setDraft(e.target.value);
              draftRef.current = e.target.value;
              window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => void persistRef.current(), 1000);
            }}
            onBlur={() => void persistRef.current()}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Salva sozinha e vai junto para o Cronograma.</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => void finish()}>Concluir</Button>
          </div>
        </div>
      ) : saved ? (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap break-words rounded-lg border border-border/40 bg-card/30 px-3 py-2 text-sm">{saved}</p>
          {!readOnly && (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={startEditing}>
              <Pencil className="h-3.5 w-3.5" /> Editar legenda
            </Button>
          )}
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={readOnly || !captionQ.data} onClick={startEditing}>
          <MessageSquareText className="h-3.5 w-3.5" /> Escrever legenda
        </Button>
      )}

      {captionQ.data?.inCalendar && (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          No Cronograma este post está com outra legenda, e é ela que vale. Para mudar o que será publicado, edite por lá.
        </p>
      )}
    </div>
  );
}
