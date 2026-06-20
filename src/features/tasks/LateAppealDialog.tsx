import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  taskId: string | null;
  taskTitle?: string;
  dueDate?: string;
  userId: string;
  onClose: () => void;
  /** Called after user picks an option (with/without justification) — should perform the actual completion. */
  onConfirm: () => Promise<void> | void;
}

/**
 * Shown when a user marks a LATE task as completed.
 * Lets them request a justification analysis (saved to task_appeals) or
 * proceed without justification.
 */
export function LateAppealDialog({ open, taskId, taskTitle, dueDate, userId, onClose, onConfirm }: Props) {
  const [mode, setMode] = useState<"choose" | "justify">("choose");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setMode("choose"); setReason(""); setSaving(false); };

  const handleClose = () => { reset(); onClose(); };

  const completeWithoutAppeal = async () => {
    setSaving(true);
    try {
      await onConfirm();
      handleClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao concluir tarefa");
      setSaving(false);
    }
  };

  const submitAppeal = async () => {
    if (!taskId) return;
    if (!reason.trim()) { toast.error("Descreva o motivo do atraso"); return; }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("task_appeals")
        .upsert(
          { task_id: taskId, user_id: userId, reason: reason.trim(), status: "pendente", reviewed_at: null, reviewed_by: null, review_note: null },
          { onConflict: "task_id,user_id" },
        );
      if (error) throw error;
      await onConfirm();
      toast.success("Justificativa enviada para análise");
      handleClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar justificativa");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" /> Tarefa atrasada
          </DialogTitle>
          <DialogDescription>
            {taskTitle ? <span className="font-medium text-foreground">{taskTitle}</span> : "Esta tarefa"} foi concluída após o prazo
            {dueDate && <> ({(() => { const [y, m, d] = dueDate.split("-"); return `${d}/${m}/${y}`; })()})</>}.
            Você quer solicitar análise de justificativa?
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" ? (
          <div className="space-y-2 pt-2">
            <Button
              className="w-full justify-start"
              variant="default"
              onClick={() => setMode("justify")}
              disabled={saving}
            >
              Justificar atraso
            </Button>
            <Button
              className="w-full justify-start"
              variant="outline"
              onClick={completeWithoutAppeal}
              disabled={saving}
            >
              Sem justificativa
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <Textarea
              autoFocus
              placeholder="Descreva o motivo do atraso para o admin analisar…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
            />
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setMode("choose")} disabled={saving}>Voltar</Button>
              <Button onClick={submitAppeal} disabled={saving || !reason.trim()}>
                {saving ? "Enviando…" : "Enviar para análise"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
