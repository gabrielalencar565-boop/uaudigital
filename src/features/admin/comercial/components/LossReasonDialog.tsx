import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LOSS_REASONS, type CrmLossReason } from "../crm-constants";

interface Props {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reason: CrmLossReason) => void;
}

export function LossReasonDialog({ open, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState<CrmLossReason | "">("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Motivo da perda</DialogTitle>
          <DialogDescription>Selecione o motivo para mover este lead para Perdido.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason} onValueChange={(v) => setReason(v as CrmLossReason)} className="space-y-2">
          {LOSS_REASONS.map((r) => (
            <div key={r.value} className="flex items-center gap-2 rounded-md border border-border/50 p-3 hover:bg-muted/40">
              <RadioGroupItem id={`r-${r.value}`} value={r.value} />
              <Label htmlFor={`r-${r.value}`} className="cursor-pointer flex-1">{r.label}</Label>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button disabled={!reason} onClick={() => reason && onConfirm(reason as CrmLossReason)}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
