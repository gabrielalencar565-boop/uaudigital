import { useEffect, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DatePicker } from "@/components/ui/date-picker";
import { PM_ACTIVE_STAGES } from "../pm-constants";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { useDefaultFlowWithDates, getFixedAssignee, getFixedWatchers } from "./PmStageFlowConfig";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

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
  const { stageAssignees } = useDefaultFlowWithDates();
  const [clientId, setClientId] = useState("");
  const [stage, setStage] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState(defaultDate ?? format(new Date(), "yyyy-MM-dd"));
  const [isExtra, setIsExtra] = useState(false);
  const [customTitle, setCustomTitle] = useState("");

  // Reference month defaults from the due date (month only, no year)
  const dueDateObj = dueDate ? new Date(`${dueDate}T12:00:00`) : new Date();
  const defaultMonthRef = String(dueDateObj.getMonth() + 1).padStart(2, "0");
  const [monthRef, setMonthRef] = useState(defaultMonthRef);

  useEffect(() => {
    if (!open) return;
    const dd = defaultDate ?? format(new Date(), "yyyy-MM-dd");
    setDueDate(dd);
    const d = new Date(`${dd}T12:00:00`);
    setMonthRef(String(d.getMonth() + 1).padStart(2, "0"));
    setIsExtra(false);
    setCustomTitle("");
    setClientId("");
    setStage("");
    setSelectedMemberIds([]);
  }, [open, defaultDate]);

  // Auto-assign when stage + client change
  useEffect(() => {
    if (!stage || !clientId) return;
    const fixedAssignee = getFixedAssignee(stageAssignees, stage, clientId);
    const fixedWatchers = getFixedWatchers(stageAssignees, stage, clientId);
    const autoIds: string[] = [];
    if (fixedAssignee) autoIds.push(fixedAssignee);
    fixedWatchers.forEach(w => { if (w && !autoIds.includes(w)) autoIds.push(w); });
    if (autoIds.length > 0) setSelectedMemberIds(autoIds);
    else setSelectedMemberIds([]);
  }, [stage, clientId, stageAssignees]);

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const sortedMembers = useMemo(() =>
    [...members].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [members]
  );

  const handleCreate = async () => {
    if (!clientId) { toast.error("Selecione um cliente"); return; }
    if (!stage) { toast.error("Selecione uma etapa"); return; }
    const clientName = clients.find(c => c.id === clientId)?.name ?? "";
    const stageLabel = PM_ACTIVE_STAGES.find(s => s.key === stage)?.label ?? stage;
    const mainAssignee = selectedMemberIds[0] ?? undefined;

    // Build title
    let title: string;
    if (isExtra) {
      title = customTitle.trim() || `[${clientName}] - ${stageLabel} - Extra`;
    } else {
      const m = parseInt(monthRef, 10);
      const monthLabel = MONTH_LABELS[m - 1] ?? "";
      title = `[${clientName}] - ${stageLabel} - ${monthLabel}`;
    }

    createTask.mutate({
      client_id: clientId,
      title,
      stage_current: stage,
      due_date: dueDate,
      assignee_id: mainAssignee,
      is_extra_demand: isExtra,
      status_global: "backlog",
    }, {
      onSuccess: () => {
        toast.success("Tarefa criada!");
        onClose();
      },
      onError: (err: any) => toast.error(err?.message ?? "Erro ao criar"),
    });
  };

  // Generate month options (no year)
  const monthOptions = MONTH_LABELS.map((label, i) => ({
    val: String(i + 1).padStart(2, "0"),
    label,
  }));

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
            <Label className="text-xs font-semibold text-muted-foreground">Etapa *</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecionar etapa" /></SelectTrigger>
              <SelectContent>
                {PM_ACTIVE_STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!isExtra && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Mês referente</Label>
              <Select value={monthRef} onValueChange={setMonthRef}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map(o => (
                    <SelectItem key={o.val} value={o.val}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground">Membros da tarefa</Label>
            <div className="flex flex-wrap gap-2">
              {sortedMembers.map((m) => {
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

          {isExtra && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Título personalizado</Label>
              <Input
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Ex: [Cliente] - Demanda especial"
                className="rounded-xl"
              />
            </div>
          )}

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
