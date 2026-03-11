import { useMemo, useState } from "react";
import { addDays, addMonths, subMonths, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PM_ACTIVE_STAGES, getStageCircleColor, stageLabel } from "../pm-constants";
import { useCreatePmTask, useDeletePmTask } from "../hooks/use-pm-data";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

const STAGE_ABBR: Record<string, string> = {
  captacao: "CAP",
  planejamento: "PLAN",
  design: "DSG",
  edicao_videos: "VDO",
  revisao: "REV",
  pdf: "PDF",
  agendamento: "AGN",
  entrega: "OK",
};

const STAGE_BADGE_BG: Record<string, string> = {
  captacao: "bg-red-500",
  planejamento: "bg-blue-500",
  design: "bg-yellow-500",
  edicao_videos: "bg-purple-500",
  revisao: "bg-pink-500",
  pdf: "bg-indigo-500",
  agendamento: "bg-violet-500",
  entrega: "bg-emerald-500",
};

interface Props {
  tasks: PmTask[];
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  members: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  isAdmin: boolean;
  onTaskClick: (t: PmTask) => void;
}

export function PmPautaView({ tasks, clientsMap, membersMap, members, clients, isAdmin, onTaskClick }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [filterClientId, setFilterClientId] = useState<string | "all">("all");
  const [filterUserId, setFilterUserId] = useState<string | "all">("all");
  const [filterStage, setFilterStage] = useState<string | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createDayKey, setCreateDayKey] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreDayKey, setMoreDayKey] = useState<string | null>(null);

  const createTask = useCreatePmTask();
  const deleteTask = useDeletePmTask();

  const todayKey = format(new Date(), "yyyy-MM-dd");

  // Only show draft tasks in pauta
  const draftTasks = useMemo(() => tasks.filter(t => (t as any).is_draft === true), [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let list = draftTasks;
    if (filterClientId !== "all") list = list.filter(t => t.client_id === filterClientId);
    if (filterUserId !== "all") list = list.filter(t => t.assignee_id === filterUserId || (t.watchers ?? []).includes(filterUserId));
    if (filterStage !== "all") list = list.filter(t => t.stage_current === filterStage);
    return list;
  }, [draftTasks, filterClientId, filterUserId, filterStage]);

  // Calendar days
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfMonth(cursor);
    const out: Date[] = [];
    let d = start;
    while (d <= end || out.length % 7 !== 0) {
      out.push(d);
      d = addDays(d, 1);
      if (out.length >= 42) break;
    }
    return out;
  }, [cursor]);

  // Tasks by day
  const tasksByDay = useMemo(() => {
    const map = new Map<string, PmTask[]>();
    for (const t of filteredTasks) {
      const key = t.due_date ?? "";
      if (!key) continue;
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, t]);
    }
    return map;
  }, [filteredTasks]);

  const openCreateForDay = (dayKey: string) => {
    setCreateDayKey(dayKey);
    setCreateOpen(true);
  };

  const openMoreForDay = (dayKey: string) => {
    setMoreDayKey(dayKey);
    setMoreOpen(true);
  };

  const handleDeleteDraft = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask.mutate(taskId);
    toast.success("Rascunho removido");
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
          </h3>
          <p className="text-[10px] text-muted-foreground">Rascunhos de pauta — não são tarefas definitivas</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setCursor(d => startOfMonth(subMonths(d, 1)))}>←</Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(d => startOfMonth(addMonths(d, 1)))}>→</Button>

          <Select value={filterClientId} onValueChange={v => setFilterClientId(v)}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Todos os clientes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterUserId} onValueChange={v => setFilterUserId(v)}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Toda a equipe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toda a equipe</SelectItem>
              {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterStage} onValueChange={v => setFilterStage(v)}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Todas as etapas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {PM_ACTIVE_STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
          <div key={d} className="px-2 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map(d => {
          const key = format(d, "yyyy-MM-dd");
          const inMonth = d.getMonth() === cursor.getMonth();
          const dayTasks = tasksByDay.get(key) ?? [];
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              className={cn(
                "relative min-h-28 rounded-xl border border-border/60 bg-card/20 p-2 transition",
                inMonth ? "opacity-100" : "opacity-40",
                isToday && "border-primary ring-1 ring-primary/30"
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-xs font-medium",
                  isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}>
                  {format(d, "d")}
                </div>
                <button
                  type="button"
                  className="grid h-5 w-5 place-items-center rounded border border-border/60 bg-background/80 text-[10px] text-foreground hover:bg-accent transition"
                  onClick={() => openCreateForDay(key)}
                  title="Adicionar rascunho"
                >+</button>
              </div>

              <div className="mt-1.5 space-y-1.5 max-h-[520px] overflow-y-auto">
                {dayTasks.slice(0, 5).map(t => (
                  <PautaTaskCard
                    key={t.id}
                    task={t}
                    clientsMap={clientsMap}
                    membersMap={membersMap}
                    onTaskClick={onTaskClick}
                    onDelete={handleDeleteDraft}
                  />
                ))}
                {dayTasks.length > 5 && (
                  <button
                    type="button"
                    className="w-full rounded-md border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent transition"
                    onClick={() => openMoreForDay(key)}
                  >
                    +{dayTasks.length - 5} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* More tasks dialog */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>
            {moreDayKey ? format(new Date(`${moreDayKey}T12:00:00`), "dd/MM · EEEE", { locale: ptBR }) : "Tarefas"}
          </DialogTitle>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {(moreDayKey ? tasksByDay.get(moreDayKey) ?? [] : []).map(t => (
              <PautaTaskCard key={t.id} task={t} clientsMap={clientsMap} membersMap={membersMap} onTaskClick={onTaskClick} onDelete={handleDeleteDraft} expanded />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick create dialog (creates DRAFT) */}
      <PautaCreateDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        dayKey={createDayKey}
        clients={clients}
        members={members}
        membersMap={membersMap}
      />
    </div>
  );
}

// ─── Task card for pauta grid ───
function PautaTaskCard({ task, clientsMap, membersMap, onTaskClick, onDelete, expanded }: {
  task: PmTask;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (t: PmTask) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  expanded?: boolean;
}) {
  const isDone = task.stage_current === "entrega";
  const stageBg = STAGE_BADGE_BG[task.stage_current] ?? "bg-muted";
  const abbr = STAGE_ABBR[task.stage_current] ?? task.stage_current.toUpperCase().slice(0, 4);
  const member = task.assignee_id ? membersMap[task.assignee_id] : undefined;
  const clientName = clientsMap[task.client_id] ?? "—";

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-dashed border-border/60 bg-card/20 p-2 text-left transition hover:bg-card/40",
        isDone && "opacity-50"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <div className={cn("inline-flex h-5 items-center rounded px-2 text-[10px] font-bold text-white", stageBg)}>
          {abbr}
        </div>
        <div className="flex items-center gap-1">
          {task.is_extra_demand && (
            <Badge variant="secondary" className="text-[8px] h-4 px-1 gap-0.5">★ Extra</Badge>
          )}
          <button
            type="button"
            className="h-4 w-4 grid place-items-center rounded text-muted-foreground hover:text-destructive transition"
            onClick={(e) => onDelete(task.id, e)}
            title="Remover rascunho"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <button type="button" className="w-full text-left" onClick={() => onTaskClick(task)}>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarImage src={member?.avatar} />
            <AvatarFallback className="text-[8px]">{member ? initials(member.name) : "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-4">{member?.name ?? "—"}</p>
            <p className="truncate text-[10px] text-muted-foreground leading-3">{clientName}</p>
          </div>
        </div>
      </button>
    </div>
  );
}

// ─── Quick create dialog for pauta (creates DRAFT) ───
function PautaCreateDialog({ open, onClose, dayKey, clients, members, membersMap }: {
  open: boolean;
  onClose: () => void;
  dayKey: string;
  clients: { id: string; name: string }[];
  members: { id: string; name: string }[];
  membersMap: Record<string, { name: string; avatar?: string }>;
}) {
  const createTask = useCreatePmTask();
  const [clientId, setClientId] = useState("");
  const [stage, setStage] = useState("captacao");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState(dayKey);

  const effectiveDueDate = dueDate || dayKey;

  const reset = () => { setClientId(""); setStage("captacao"); setAssigneeId(""); setDueDate(dayKey); };

  const handleCreate = async () => {
    if (!clientId) { toast.error("Selecione um cliente"); return; }
    const clientName = clients.find(c => c.id === clientId)?.name ?? "";
    try {
      await createTask.mutateAsync({
        title: `[${clientName}] ${stageLabel(stage)}`,
        client_id: clientId,
        stage_current: stage,
        assignee_id: assigneeId || undefined,
        due_date: effectiveDueDate,
        is_draft: true,
      } as any);
      toast.success("Rascunho criado!");
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Rascunho — {dayKey ? format(new Date(`${dayKey}T12:00:00`), "dd/MM/yyyy") : ""}</DialogTitle>
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <label className="text-xs font-medium">Cliente *</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Etapa</label>
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 h-8 w-full border rounded-md px-3 text-xs hover:bg-accent transition">
                  <span className={cn("h-3 w-3 rounded-full", STAGE_BADGE_BG[stage] ?? "bg-muted")} />
                  {stageLabel(stage)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {PM_ACTIVE_STAGES.map(s => {
                  const color = getStageCircleColor(s.key);
                  return (
                    <button key={s.key} className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition", stage === s.key && "bg-accent")} onClick={() => setStage(s.key)}>
                      <span className={cn("h-3 w-3 rounded-full border-2", color.border, s.key === "entrega" && color.bg)} />
                      {s.label}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Responsável</label>
            <Select value={assigneeId || "__none__"} onValueChange={v => setAssigneeId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Ninguém" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Ninguém</SelectItem>
                {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Data</label>
            <DatePicker value={effectiveDueDate} onChange={(v) => setDueDate(v)} className="h-8 text-xs w-full" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={createTask.isPending}>Criar Rascunho</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
