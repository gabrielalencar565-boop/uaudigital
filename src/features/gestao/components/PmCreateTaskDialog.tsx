import { useState } from "react";
import { FolderOpen, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { PM_ACTIVE_STAGES, stageLabel } from "../pm-constants";
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState(defaultStatus || "captacao");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [isExtra, setIsExtra] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setClientId("");
    setTitle("");
    setDescription("");
    setStage(defaultStatus || "captacao");
    setAssigneeId("");
    setDueDate("");
    setStartDate("");
    setIsExtra(false);
  };

  const handleCreate = async () => {
    if (!clientId) {
      toast.error("Selecione um cliente");
      return;
    }
    const client = clients.find(c => c.id === clientId);
    const finalTitle = title.trim() || `[${client?.name ?? ""}] Nova tarefa`;

    setSaving(true);
    try {
      const task = await createTask.mutateAsync({
        title: finalTitle,
        client_id: clientId,
        stage_current: stage as any,
        assignee_id: assigneeId || undefined,
        due_date: dueDate || undefined,
        description: description.trim() || undefined,
        is_extra_demand: isExtra,
      });

      toast.success("Tarefa criada!");
      reset();
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

  // Update title prefix when client changes
  const handleClientChange = (newClientId: string) => {
    setClientId(newClientId);
    const client = clients.find(c => c.id === newClientId);
    if (client && !title.trim()) {
      setTitle(`[${client.name}] `);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-sm">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          Nova Tarefa
        </DialogTitle>

        <div className="space-y-4 pt-2">
          {/* Cliente (obrigatório) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cliente *</Label>
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
          </div>

          {/* Título */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Título</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da tarefa..."
              className="h-9 text-sm"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional..."
              className="text-sm min-h-[60px] resize-none"
            />
          </div>

          {/* Etapa + Responsável */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Etapa</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
              <SelectContent>
                {PM_ACTIVE_STAGES.map(s => (
                  <SelectItem key={s.key} value={s.key} className="text-sm">{stageLabel(s.key)}</SelectItem>
                ))}
              </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Responsável</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => {
                    const info = membersMap?.[m.id];
                    return (
                      <SelectItem key={m.id} value={m.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={info?.avatar} />
                            <AvatarFallback className="text-[8px]">{initials(m.name)}</AvatarFallback>
                          </Avatar>
                          {m.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Data entrega</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          {/* Demanda Extra */}
          <div className="flex items-center gap-3 rounded-lg border border-border/40 p-3">
            <Switch checked={isExtra} onCheckedChange={setIsExtra} />
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs font-medium">Demanda Extra</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={!clientId || saving}>
              {saving ? "Criando..." : "Criar Tarefa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
