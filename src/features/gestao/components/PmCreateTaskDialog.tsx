import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { toast } from "sonner";

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

  const handleClientSelect = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    setSaving(true);
    try {
      const task = await createTask.mutateAsync({
        title: `[${client.name}]`,
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2 text-sm">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Nova Tarefa — Selecione o cliente
        </DialogTitle>

        <div className="pt-2">
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
      </DialogContent>
    </Dialog>
  );
}
