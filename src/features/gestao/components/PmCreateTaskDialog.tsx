import { useState } from "react";
import { FolderOpen, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { toast } from "sonner";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

interface Props {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  members: { id: string; name: string }[];
  membersMap?: Record<string, { name: string; avatar?: string }>;
  defaultStatus?: string;
  onCreated?: (taskId: string) => void;
}

export function PmCreateTaskDialog({ open, onClose, clients, members, membersMap, defaultStatus, onCreated }: Props) {
  const createTask = useCreatePmTask();
  const [clientId, setClientId] = useState("");

  const reset = () => { setClientId(""); };

  const handleClientChange = async (newClientId: string) => {
    setClientId(newClientId);
    const client = clients.find(c => c.id === newClientId);
    if (!client) return;

    try {
      const task = await createTask.mutateAsync({
        title: `[${client.name}] Nova tarefa`,
        client_id: newClientId,
        stage_current: defaultStatus || "captacao",
      });

      toast.success("Tarefa criada!");
      reset();
      onClose();
      if (task?.id && onCreated) {
        onCreated(task.id);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar tarefa");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="flex items-center gap-2 text-sm">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Nova Tarefa — Selecione o cliente
        </DialogTitle>
        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Selecione o cliente para criar a tarefa. Você poderá editar todos os detalhes em seguida.
          </p>
          <Select value={clientId} onValueChange={handleClientChange}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione um cliente..." />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id} className="text-sm">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
