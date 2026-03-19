import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { PM_STAGES } from "../pm-constants";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { toast } from "sonner";
import { format } from "date-fns";

const STAGE_OPTIONS = PM_STAGES.filter(s => !["roteiro", "edicao", "alteracoes"].includes(s.key));

interface Props {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  members: { id: string; name: string }[];
  defaultDate?: string;
}

export function AgendaQuickCreateDialog({ open, onClose, clients, members, defaultDate }: Props) {
  const createTask = useCreatePmTask();
  const [clientId, setClientId] = useState("");
  const [stage, setStage] = useState("planejamento");
  const [assigneeId, setAssigneeId] = useState("__none__");
  const [dueDate, setDueDate] = useState(defaultDate ?? format(new Date(), "yyyy-MM-dd"));
  const [isExtra, setIsExtra] = useState(false);

  const handleCreate = async () => {
    if (!clientId) { toast.error("Selecione um cliente"); return; }
    const clientName = clients.find(c => c.id === clientId)?.name ?? "";
    const stageLabel = STAGE_OPTIONS.find(s => s.key === stage)?.label ?? stage;
    
    createTask.mutate({
      client_id: clientId,
      title: `[${clientName}] - ${stageLabel}`,
      stage_current: stage,
      due_date: dueDate,
      assignee_id: assigneeId === "__none__" ? undefined : assigneeId,
      is_extra_demand: isExtra,
      status_global: "backlog",
    }, {
      onSuccess: () => {
        toast.success("Tarefa criada!");
        onClose();
        resetForm();
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao criar"),
    });
  };

  const resetForm = () => {
    setClientId("");
    setStage("planejamento");
    setAssigneeId("__none__");
    setIsExtra(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogTitle className="text-lg font-bold">Nova tarefa rápida</DialogTitle>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Cliente *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Etapa</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Responsável</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">Data</Label>
            <DatePicker value={dueDate} onChange={(v) => setDueDate(v ?? format(new Date(), "yyyy-MM-dd"))} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="is_extra" checked={isExtra} onCheckedChange={(v) => setIsExtra(!!v)} />
            <Label htmlFor="is_extra" className="text-sm cursor-pointer">Demanda extra</Label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleCreate} disabled={createTask.isPending} className="rounded-xl">
              {createTask.isPending ? "Criando..." : "Criar tarefa"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
