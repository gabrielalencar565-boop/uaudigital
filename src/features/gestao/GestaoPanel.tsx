import { useMemo, useState } from "react";
import { Plus, Search, LayoutGrid, CalendarDays, FolderOpen, Settings2, CheckCircle2, FileSpreadsheet, Trash2, Users } from "lucide-react";
import { addDays, addMonths, subMonths, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePmTasks, usePmAllChildTasks, useUpdatePmTask, useDeletePmTask } from "./hooks/use-pm-data";
import { PmKanbanBoard } from "./components/PmKanbanBoard";
import { PmClientView } from "./components/PmClientView";
import { PmTaskDetailDialog } from "./components/PmTaskDetailDialog";
import { PmCreateTaskDialog } from "./components/PmCreateTaskDialog";
import { PmStageFlowConfig, useStageFlows } from "./components/PmStageFlowConfig";
import { PmAssigneeFlowConfig } from "./components/PmAssigneeFlowConfig";
import type { StageAssignees } from "./components/PmStageFlowConfig";
import { PmPautaView } from "./components/PmPautaView";
import { stageLabel, getStageCircleColor, tagColor, tagDisplay } from "./pm-constants";
import { cn } from "@/lib/utils";
import type { PmTask } from "./pm-types";
import { toast } from "sonner";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

const STAGE_ABBR: Record<string, string> = {
  captacao: "CAP", planejamento: "PLAN", design: "DSG", edicao_videos: "VDO",
  revisao: "REV", pdf: "PDF", agendamento: "AGN", entrega: "OK",
};

const STAGE_BADGE_BG: Record<string, string> = {
  captacao: "bg-red-500", planejamento: "bg-blue-500", design: "bg-yellow-500",
  edicao_videos: "bg-purple-500", revisao: "bg-pink-500", pdf: "bg-indigo-500",
  agendamento: "bg-violet-500", entrega: "bg-emerald-500",
};

export function GestaoPanel() {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);

  const [view, setView] = useState<"kanban" | "agenda" | "clientes" | "pauta" | "fluxo" | "responsaveis">("kanban");
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("__all__");
  const [filterAssignee, setFilterAssignee] = useState(user?.id ?? "__all__");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<string | undefined>();

  // Agenda calendar state
  const [agendaCursor, setAgendaCursor] = useState(() => startOfMonth(new Date()));

  // Data
  const tasksQ = usePmTasks();
  const allTasks = tasksQ.data ?? [];
  const tasks = useMemo(() => allTasks.filter(t => !(t as any).is_draft), [allTasks]);

  // Load stage assignees to expand filter by fixed assignee
  const flowsQ = useStageFlows();
  const stageAssignees = useMemo(() => {
    const flows = flowsQ.data ?? [];
    const defaultFlow = flows.find(f => f.is_default) ?? flows[0];
    return (defaultFlow?.stage_assignees ?? {}) as StageAssignees;
  }, [flowsQ.data]);

  // Get client IDs where the filtered assignee is a fixed assignee in any stage
  const fixedAssigneeClientIds = useMemo(() => {
    if (filterAssignee === "__all__") return new Set<string>();
    const clientIds = new Set<string>();
    for (const stageKey of Object.keys(stageAssignees)) {
      const stageMap = stageAssignees[stageKey];
      if (!stageMap) continue;
      for (const [clientId, userId] of Object.entries(stageMap)) {
        if (userId === filterAssignee) clientIds.add(clientId);
      }
    }
    return clientIds;
  }, [filterAssignee, stageAssignees]);

  const allChildTasksQ = usePmAllChildTasks();
  const childTasksMap = useMemo(() => {
    const map: Record<string, PmTask[]> = {};
    (allChildTasksQ.data ?? []).forEach((t) => {
      const pid = t.parent_task_id!;
      if (!map[pid]) map[pid] = [];
      map[pid].push(t);
    });
    return map;
  }, [allChildTasksQ.data]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return allTasks.find(t => t.id === selectedTaskId) ?? null;
  }, [selectedTaskId, allTasks]);

  // Clients
  const clientsQ = useQuery({
    queryKey: ["clients_all"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });
  const clientsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientsQ.data ?? []).forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [clientsQ.data]);

  // Team members
  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url").eq("is_active", true);
      return data ?? [];
    },
  });
  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    (membersQ.data ?? []).forEach((tm) => { m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined }; });
    return m;
  }, [membersQ.data]);
  const membersList = useMemo(() => (membersQ.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name })), [membersQ.data]);

  const filters = { clientId: filterClient === "__all__" ? undefined : filterClient, assigneeId: filterAssignee === "__all__" ? undefined : filterAssignee, search: search || undefined, fixedAssigneeClientIds };

  const openCreate = (status?: string) => {
    setCreateDefaultStatus(status);
    setCreateOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Gestão de Tarefas</h2>
          <p className="text-xs text-muted-foreground">Gerencie projetos e tarefas da agência</p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/30 pb-3">
        <div className="relative w-52">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tarefas..." className="pl-8 h-8 text-xs" />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os clientes</SelectItem>
            {(clientsQ.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {membersList.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* View tabs */}
      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList className="bg-card/30 h-8">
          <TabsTrigger value="kanban" className="gap-1.5 text-xs h-7">
            <LayoutGrid className="h-3 w-3" /> Kanban
          </TabsTrigger>
          <TabsTrigger value="agenda" className="gap-1.5 text-xs h-7">
            <CalendarDays className="h-3 w-3" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="clientes" className="gap-1.5 text-xs h-7">
            <FolderOpen className="h-3 w-3" /> Por Cliente
          </TabsTrigger>
          <TabsTrigger value="pauta" className="gap-1.5 text-xs h-7">
            <FileSpreadsheet className="h-3 w-3" /> Montagem de Pauta
          </TabsTrigger>
          <TabsTrigger value="fluxo" className="gap-1.5 text-xs h-7">
            <Settings2 className="h-3 w-3" /> Fluxo
          </TabsTrigger>
          <TabsTrigger value="responsaveis" className="gap-1.5 text-xs h-7">
            <Users className="h-3 w-3" /> Responsáveis
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <PmKanbanBoard
            tasks={tasks}
            childTasksMap={childTasksMap}
            clientsMap={clientsMap}
            membersMap={membersMap}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
            onCreateClick={openCreate}
            filters={filters}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="agenda" className="mt-4">
          <AgendaCalendarView
            tasks={tasks}
            clientsMap={clientsMap}
            membersMap={membersMap}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
            filterClient={filterClient}
            filterAssignee={filterAssignee}
            search={search}
            cursor={agendaCursor}
            setCursor={setAgendaCursor}
            fixedAssigneeClientIds={fixedAssigneeClientIds}
          />
        </TabsContent>

        <TabsContent value="clientes" className="mt-4">
          <PmClientView
            tasks={tasks}
            childTasksMap={childTasksMap}
            clientsMap={clientsMap}
            membersMap={membersMap}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
          />
        </TabsContent>

        <TabsContent value="pauta" className="mt-4">
          <PmPautaView
            tasks={allTasks}
            clientsMap={clientsMap}
            membersMap={membersMap}
            members={membersList}
            clients={(clientsQ.data ?? []).map(c => ({ id: c.id, name: c.name }))}
            isAdmin={isAdmin}
            onTaskClick={(t) => setSelectedTaskId(t.id)}
          />
        </TabsContent>

        <TabsContent value="fluxo" className="mt-4">
          <PmStageFlowConfig />
        </TabsContent>

        <TabsContent value="responsaveis" className="mt-4">
          <PmAssigneeFlowConfig />
        </TabsContent>
      </Tabs>

      {/* Task detail */}
      <PmTaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTaskId(null)}
        clientsMap={clientsMap}
        membersMap={membersMap}
        members={membersList}
        isAdmin={isAdmin}
      />

      {/* Create task dialog */}
      <PmCreateTaskDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        clients={(clientsQ.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
        members={membersList}
        membersMap={membersMap}
        defaultStatus={createDefaultStatus}
        onCreated={(taskId) => {
          setCreateOpen(false);
          setSelectedTaskId(taskId);
        }}
      />
    </div>
  );
}

// ─── Agenda Calendar View (matches main Agenda module) ───
function AgendaCalendarView({ tasks, clientsMap, membersMap, onTaskClick, filterClient, filterAssignee, search, cursor, setCursor, fixedAssigneeClientIds }: {
  tasks: PmTask[];
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (t: PmTask) => void;
  filterClient: string;
  filterAssignee: string;
  search: string;
  cursor: Date;
  setCursor: React.Dispatch<React.SetStateAction<Date>>;
  fixedAssigneeClientIds: Set<string>;
}) {
  const updateTask = useUpdatePmTask();
  const deleteTask = useDeletePmTask();
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreDayKey, setMoreDayKey] = useState<string | null>(null);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (filterClient && filterClient !== "__all__") list = list.filter(t => t.client_id === filterClient);
    if (filterAssignee && filterAssignee !== "__all__") {
      list = list.filter(t => t.assignee_id === filterAssignee || fixedAssigneeClientIds.has(t.client_id));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.title.toLowerCase().includes(q) || (clientsMap[t.client_id] ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [tasks, filterClient, filterAssignee, search, clientsMap]);

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

  const handleMarkDone = (task: PmTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStage = task.stage_current === "entrega" ? "captacao" : "entrega";
    updateTask.mutate({ id: task.id, stage_current: newStage as any });
  };

  const handleDelete = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask.mutate(taskId);
    toast.success("Tarefa removida");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-lg font-semibold">
          {format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setCursor(d => startOfMonth(subMonths(d, 1)))}>←</Button>
        <Button variant="ghost" size="sm" onClick={() => setCursor(d => startOfMonth(addMonths(d, 1)))}>→</Button>
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
              <div className="flex items-center justify-between mb-1.5">
                <div className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-xs font-medium",
                  isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                )}>
                  {format(d, "d")}
                </div>
              </div>

              <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
                {dayTasks.slice(0, 5).map(t => {
                  const isDone = t.stage_current === "entrega";
                  const stageBg = STAGE_BADGE_BG[t.stage_current] ?? "bg-muted";
                  const abbr = STAGE_ABBR[t.stage_current] ?? t.stage_current.toUpperCase().slice(0, 4);
                  const member = t.assignee_id ? membersMap[t.assignee_id] : undefined;
                  const clientName = clientsMap[t.client_id] ?? "—";

                  return (
                    <div
                      key={t.id}
                      className={cn(
                        "w-full rounded-lg border border-border/40 bg-card/30 p-2 text-left transition hover:bg-card/50 cursor-pointer",
                        isDone && "opacity-50"
                      )}
                      onClick={() => onTaskClick(t)}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className={cn("inline-flex h-5 items-center rounded px-2 text-[10px] font-bold text-white", stageBg)}>
                          {abbr}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className={cn("h-4 w-4 rounded border transition", isDone ? "bg-emerald-500 border-emerald-500" : "border-border/60 hover:border-primary")}
                            onClick={(e) => handleMarkDone(t, e)}
                            title={isDone ? "Desmarcar" : "Marcar concluído"}
                          >
                            {isDone && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </button>
                          <button
                            type="button"
                            className="h-4 w-4 grid place-items-center text-muted-foreground hover:text-destructive transition"
                            onClick={(e) => handleDelete(t.id, e)}
                            title="Remover"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {t.is_extra_demand && (
                        <Badge variant="secondary" className="text-[8px] h-4 px-1 gap-0.5 mt-1">★ Extra</Badge>
                      )}
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
                    </div>
                  );
                })}
                {dayTasks.length > 5 && (
                  <button
                    type="button"
                    className="w-full rounded-md border border-border/60 bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent transition"
                    onClick={() => { setMoreDayKey(key); setMoreOpen(true); }}
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
            {(moreDayKey ? tasksByDay.get(moreDayKey) ?? [] : []).map(t => {
              const member = t.assignee_id ? membersMap[t.assignee_id] : undefined;
              return (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/40 cursor-pointer hover:bg-card/40" onClick={() => { setMoreOpen(false); onTaskClick(t); }}>
                  <div className={cn("inline-flex h-5 items-center rounded px-2 text-[10px] font-bold text-white", STAGE_BADGE_BG[t.stage_current] ?? "bg-muted")}>
                    {STAGE_ABBR[t.stage_current] ?? t.stage_current.slice(0, 4).toUpperCase()}
                  </div>
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarImage src={member?.avatar} />
                    <AvatarFallback className="text-[8px]">{member ? initials(member.name) : "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{member?.name ?? "—"}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{clientsMap[t.client_id] ?? "—"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
