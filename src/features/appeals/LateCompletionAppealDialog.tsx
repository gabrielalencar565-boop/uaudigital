import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
  userId: string;
  /** Called when user confirms either path. Must perform the actual status update. */
  onConfirmComplete: () => Promise<void> | void;
}

export function LateCompletionAppealDialog({ open, onOpenChange, taskId, userId, onConfirmComplete }: Props) {
  const [step, setStep] = useState<"choose" | "form">("choose");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const reset = () => { setStep("choose"); setReason(""); setSubmitting(false); };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const completeOnly = async () => {
    setSubmitting(true);
    try {
      await onConfirmComplete();
      handleClose(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao concluir");
    } finally { setSubmitting(false); }
  };

  const submitAppeal = async () => {
    if (!taskId) return;
    if (reason.trim().length < 5) { toast.error("Descreva o motivo do atraso"); return; }
    setSubmitting(true);
    try {
      await onConfirmComplete();
      const { error } = await (supabase.from("task_appeals" as any) as any).upsert(
        { task_id: taskId, user_id: userId, reason: reason.trim(), status: "pendente", reviewed_by: null, reviewed_at: null, review_note: null },
        { onConflict: "task_id" },
      );
      if (error) throw error;
      toast.success("Recurso enviado para análise");
      qc.invalidateQueries({ queryKey: ["task_appeals"] });
      handleClose(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar recurso");
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        {step === "choose" ? (
          <>
            <DialogHeader>
              <DialogTitle>Tarefa concluída com atraso</DialogTitle>
              <DialogDescription className="space-y-2 pt-2 text-sm text-muted-foreground">
                <p>Essa tarefa foi marcada como concluída depois do prazo definido. Por isso, ela pode gerar perda de pontos no desempenho.</p>
                <p>Caso você tenha uma justificativa válida, pode abrir um recurso para que a situação seja analisada antes da pontuação ser descontada.</p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={completeOnly} disabled={submitting}>Concluir mesmo assim</Button>
              <Button onClick={() => setStep("form")} disabled={submitting}>Abrir recurso</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Justifique o motivo do atraso</DialogTitle>
              <DialogDescription className="pt-1 text-sm text-muted-foreground">
                Sua tarefa será concluída e o recurso ficará pendente até a análise do gestor.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explique o que aconteceu e por que essa tarefa foi entregue fora do prazo."
              className="min-h-[140px]"
              maxLength={1000}
            />
            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="outline" onClick={() => setStep("choose")} disabled={submitting}>Voltar</Button>
              <Button onClick={submitAppeal} disabled={submitting || reason.trim().length < 5}>
                {submitting ? "Enviando..." : "Enviar recurso"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
