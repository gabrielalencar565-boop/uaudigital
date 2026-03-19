import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { toast } from "sonner";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  members: { id: string; name: string }[];
  membersMap?: Record<string, { name: string; avatar?: string }>;
  defaultStatus?: string;
  onCreated?: (taskId: string) => void;
}

export function PmCreateTaskDialog({ open, onClose, clients, defaultStatus, onCreated }: Props) {
  const createTask = useCreatePmTask();
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const [monthRef, setMonthRef] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

  const handleClientSelect = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    const [y, m] = monthRef.split("-").map(Number);
    const monthLabel = MONTH_LABELS[m - 1] ?? "";
    const title = `[${client.name}] - ${monthLabel}`;

    setSaving(true);
    try {
      const task = await createTask.mutateAsync({
        title,
        client_id: clientId,
        stage_current: (defaultStatus || "captacao") as any,
      });

      onClose();
      if (task?.id && onCreated) {
        onCreated(task.id);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar tarefa");
    } finally {
      setSaving(false);
    }
  };

  // Generate month options (current month ± 6 months)
  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 3 + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
    return { val, label };
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2 text-sm">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Nova Tarefa
        </DialogTitle>

        <div className="space-y-3 pt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Mês referente</Label>
            <Select value={monthRef} onValueChange={setMonthRef}>
              <SelectTrigger className="h-9 text-sm mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => (
                  <SelectItem key={o.val} value={o.val} className="text-sm">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Cliente *</Label>
            <Select disabled={saving} onValueChange={handleClientSelect}>
              <SelectTrigger className="h-9 text-sm mt-1.5">
                <SelectValue placeholder={saving ? "Criando..." : "Selecione um cliente..."} />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
