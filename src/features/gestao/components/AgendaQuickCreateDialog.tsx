import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/date-picker";
import { PM_STAGES } from "../pm-constants";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STAGE_OPTIONS = PM_STAGES.filter(s => !["roteiro", "edicao", "alteracoes"].includes(s.key));

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

interface Props {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  members: { id: string; name: string; avatar?: string }[];
  defaultDate?: string;
}

export function AgendaQuickCreateDialog({ open, onClose, clients, members, defaultDate }: Props) {
  const createTask = useCreatePmTask();
  const [clientId, setClientId] = useState("");
  const [stage, setStage] = useState("planejamento");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(defaultDate ?? format(new Date(), "yyyy-MM-dd"));
  const [isExtra, setIsExtra] = useState(false);

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!clientId) { toast.error("Selecione um cliente"); return; }
    const clientName = clients.find(c => c.id === clientId)?.name ?? "";
    const stageLabel = STAGE_OPTIONS.find(s => s.key === stage)?.label ?? stage;
    const mainAssignee = selectedMemberIds[0] ?? undefined;
    
    createTask.mutate({
      client_id: clientId,
      title: `[${clientName}] - ${stageLabel}`,
      stage_current: stage,
      due_date: dueDate,
      assignee_id: mainAssignee,
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
    setSelectedMemberIds([]);
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

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Membros da tarefa</Label>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const selected = selectedMemberIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 transition",
                      selected
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={m.avatar ?? undefined} />
                      <AvatarFallback className="text-[10px]">
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{m.name}</span>
                  </button>
                );
              })}
            </div>
            {selectedMemberIds.length === 0 && (
              <p className="text-xs text-muted-foreground">Selecione ao menos um membro</p>
            )}
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
