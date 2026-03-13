import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, Search, LayoutGrid, CalendarDays, FolderOpen, Settings2, CheckCircle2, FileSpreadsheet, Trash2, Users, ChevronLeft, ChevronRight, CalendarRange, Cake, Star } from "lucide-react";
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
import { useAgendaSpecialDates } from "@/features/agenda/hooks/use-agenda-dates";
import { getIconById } from "@/features/agenda/components/IconPicker";
function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

const STAGE_ABBR: Record<string, string> = {
  captacao: "CAP", planejamento: "PLAN", design: "DSG", edicao_videos: "VDO",
  revisao: "REV", pdf: "PDF", agendamento: "AGN", entrega: "ENT"
};

const STAGE_BADGE_BG: Record<string, string> = {
  captacao: "bg-red-500", planejamento: "bg-blue-500", design: "bg-yellow-500",
  edicao_videos: "bg-purple-500", revisao: "bg-pink-500", pdf: "bg-indigo-500",
  agendamento: "bg-violet-500", entrega: "bg-emerald-500"
};

const VIEW_TITLES: Record<string, string> = {
  kanban: "Kanban de tarefas",
  agenda: "Agenda de tarefas",
  clientes: "Tarefas por cliente",
  pauta: "Montagem de pauta",
  cronograma: "Cronograma",
  fluxo: "Configuração de fluxos",
  responsaveis: "Responsáveis por etapa"
};

export function GestaoPanel({ forcedView }: {forcedView?: string;} = {}) {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);

  const [view, setView] = useState<"kanban" | "agenda" | "clientes" | "pauta" | "cronograma" | "fluxo" | "responsaveis">(
    forcedView as any ?? "kanban"
  );
  const effectiveView = forcedView ? forcedView === "fluxo" ? "fluxo" : forcedView as any : view;
  const hideViewTabs = !!forcedView;
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
  const tasks = useMemo(() => allTasks.filter((t) => !(t as any).is_draft), [allTasks]);

  // Load stage assignees to expand filter by fixed assignee
  const flowsQ = useStageFlows();
  const stageAssignees = useMemo(() => {
    const flows = flowsQ.data ?? [];
    const defaultFlow = flows.find((f) => f.is_default) ?? flows[0];
    return (defaultFlow?.stage_assignees ?? {}) as StageAssignees;
  }, [flowsQ.data]);

  // Get client IDs where the filtered assignee is the fixed PLANEJAMENTO assignee only
  const fixedAssigneeClientIds = useMemo(() => {
    if (filterAssignee === "__all__") return new Set<string>();
    const clientIds = new Set<string>();
    const planejamentoMap = stageAssignees["planejamento"];
    if (planejamentoMap) {
      for (const [clientId, userId] of Object.entries(planejamentoMap)) {
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
    return allTasks.find((t) => t.id === selectedTaskId) ?? null;
  }, [selectedTaskId, allTasks]);

  // Clients
  const clientsQ = useQuery({
    queryKey: ["clients_all"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    }
  });
  const clientsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientsQ.data ?? []).forEach((c) => {m[c.id] = c.name;});
    return m;
  }, [clientsQ.data]);

  // Team members
  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url, birth_date").eq("is_active", true);
      return data ?? [];
    }
  });
  const membersMap = useMemo(() => {
    const m: Record<string, {name: string;avatar?: string;}> = {};
    (membersQ.data ?? []).forEach((tm) => {m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined };});
    return m;
  }, [membersQ.data]);
  const membersList = useMemo(() => (membersQ.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name })), [membersQ.data]);
  const membersForSpecialDates = useMemo(
    () => (membersQ.data ?? []).map((m) => ({ user_id: m.user_id, display_name: m.display_name, birth_date: m.birth_date ?? null })),
    [membersQ.data]
  );

  const filters = { clientId: filterClient === "__all__" ? undefined : filterClient, assigneeId: filterAssignee === "__all__" ? undefined : filterAssignee, search: search || undefined, fixedAssigneeClientIds };

  const openCreate = (status?: string) => {
    setCreateDefaultStatus(status);
    setCreateOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Header — dynamic title per view */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <h2 className="font-bold tracking-tight text-2xl sm:text-4xl">{VIEW_TITLES[effectiveView] ?? "Tarefas"}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[140px] sm:flex-none">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar tarefa..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-full sm:w-48 pl-9 rounded-xl text-sm" />
          </div>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="h-9 flex-1 min-w-[120px] sm:flex-none sm:w-52 rounded-xl text-sm border-primary/30 bg-background/80">
              <SelectValue placeholder="Todos os clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os clientes</SelectItem>
              {(clientsQ.data ?? []).map((c) =>
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="h-9 flex-1 min-w-[120px] sm:flex-none sm:w-52 rounded-xl text-sm bg-background/80 border-border/30">
              <SelectValue placeholder="Todos os responsáveis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os responsáveis</SelectItem>
              {(membersQ.data ?? []).map((m) =>
              <SelectItem key={m.user_id} value={m.user_id}>
                  <span className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(m.display_name)}</AvatarFallback>
                    </Avatar>
                    {m.display_name}
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>















































      

      {/* View tabs — hidden when sidebar drives the view */}
      {!hideViewTabs &&
      <Tabs value={effectiveView} onValueChange={(v) => setView(v as any)}>
          <TabsList className="bg-muted/40 h-10 p-1 rounded-xl gap-0.5">
            <TabsTrigger value="kanban" className="gap-1.5 text-xs h-8 rounded-lg data-[state=active]:shadow-sm">
              <LayoutGrid className="h-3.5 w-3.5" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="agenda" className="gap-1.5 text-xs h-8 rounded-lg data-[state=active]:shadow-sm">
              <CalendarDays className="h-3.5 w-3.5" /> Agenda
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-1.5 text-xs h-8 rounded-lg data-[state=active]:shadow-sm">
              <FolderOpen className="h-3.5 w-3.5" /> Por Cliente
            </TabsTrigger>
            <TabsTrigger value="pauta" className="gap-1.5 text-xs h-8 rounded-lg data-[state=active]:shadow-sm">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Montagem de Pauta
            </TabsTrigger>
            <TabsTrigger value="cronograma" className="gap-1.5 text-xs h-8 rounded-lg data-[state=active]:shadow-sm">
              <CalendarRange className="h-3.5 w-3.5" /> Cronograma
            </TabsTrigger>
            <TabsTrigger value="fluxo" className="gap-1.5 text-xs h-8 rounded-lg data-[state=active]:shadow-sm">
              <Settings2 className="h-3.5 w-3.5" /> Fluxo
            </TabsTrigger>
            <TabsTrigger value="responsaveis" className="gap-1.5 text-xs h-8 rounded-lg data-[state=active]:shadow-sm">
              <Users className="h-3.5 w-3.5" /> Responsáveis
            </TabsTrigger>
          </TabsList>
        </Tabs>
      }

      {/* View content */}
      <div className="mt-4">
        {effectiveView === "kanban" &&
        <PmKanbanBoard
          tasks={tasks}
          childTasksMap={childTasksMap}
          clientsMap={clientsMap}
          membersMap={membersMap}
          onTaskClick={(t) => setSelectedTaskId(t.id)}
          onCreateClick={openCreate}
          filters={filters}
          isAdmin={isAdmin} />

        }
        {effectiveView === "agenda" &&
        <AgendaCalendarView
          tasks={tasks}
          clientsMap={clientsMap}
          membersMap={membersMap}
          teamMembers={membersForSpecialDates}
          onTaskClick={(t) => setSelectedTaskId(t.id)}
          filterClient={filterClient}
          filterAssignee={filterAssignee}
          search={search}
          cursor={agendaCursor}
          setCursor={setAgendaCursor}
          fixedAssigneeClientIds={fixedAssigneeClientIds} />

        }
        {effectiveView === "clientes" &&
        <PmClientView
          tasks={tasks}
          childTasksMap={childTasksMap}
          clientsMap={clientsMap}
          membersMap={membersMap}
          onTaskClick={(t) => setSelectedTaskId(t.id)} />

        }
        {effectiveView === "pauta" &&
        <PmPautaView
          tasks={allTasks}
          clientsMap={clientsMap}
          membersMap={membersMap}
          members={membersList}
          clients={(clientsQ.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
          isAdmin={isAdmin}
          onTaskClick={(t) => setSelectedTaskId(t.id)} />

        }
        {effectiveView === "cronograma" &&
        <CronogramaGlobalView
          tasks={tasks}
          childTasksMap={childTasksMap}
          clientsMap={clientsMap}
          membersMap={membersMap}
          filterClient={filterClient}
          onTaskClick={(t) => setSelectedTaskId(t.id)} />

        }
        {effectiveView === "fluxo" &&
        <div className="space-y-8">
            <PmStageFlowConfig />
            <PmAssigneeFlowConfig />
          </div>
        }
        {effectiveView === "responsaveis" &&
        <PmAssigneeFlowConfig />
        }
      </div>

      {/* Task detail */}
      <PmTaskDetailDialog
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTaskId(null)}
        clientsMap={clientsMap}
        membersMap={membersMap}
        members={membersList}
        isAdmin={isAdmin} />
      

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
        }} />
      
    </div>);

}

// ─── Agenda Calendar View (matches main Agenda module) ───
function AgendaCalendarView({ tasks, clientsMap, membersMap, teamMembers, onTaskClick, filterClient, filterAssignee, search, cursor, setCursor, fixedAssigneeClientIds }: {
  tasks: PmTask[];
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  teamMembers: Array<{ user_id: string; display_name: string; birth_date: string | null }>;
  onTaskClick: (t: PmTask) => void;
  filterClient: string;
  filterAssignee: string;
  search: string;
  cursor: Date;
  setCursor: React.Dispatch<React.SetStateAction<Date>>;
  fixedAssigneeClientIds: Set<string>;
}) {
  const isMobile = useIsMobile();
  const deleteTask = useDeletePmTask();
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreDayKey, setMoreDayKey] = useState<string | null>(null);
  const [agendaView, setAgendaView] = useState<"month" | "week">("month");

  const todayKey = format(new Date(), "yyyy-MM-dd");

  const prevMonth = subMonths(startOfMonth(cursor), 1);
  const nextMonth = addMonths(startOfMonth(cursor), 1);

  const specialDatesPrev = useAgendaSpecialDates(prevMonth.getFullYear(), prevMonth.getMonth() + 1, teamMembers);
  const specialDatesCurrent = useAgendaSpecialDates(cursor.getFullYear(), cursor.getMonth() + 1, teamMembers);
  const specialDatesNext = useAgendaSpecialDates(nextMonth.getFullYear(), nextMonth.getMonth() + 1, teamMembers);

  const specialDatesMap = useMemo(() => {
    const merged = new Map<string, import("@/features/agenda/hooks/use-agenda-dates").SpecialDate[]>();

    const append = (source: Map<string, import("@/features/agenda/hooks/use-agenda-dates").SpecialDate[]>) => {
      source.forEach((items, key) => {
        const prev = merged.get(key) ?? [];
        const combined = [...prev, ...items];
        const deduped = combined.filter((item, idx, arr) => {
          const id = `${item.type}|${item.label}|${item.personName ?? ""}|${item.icon ?? ""}`;
          return arr.findIndex((x) => `${x.type}|${x.label}|${x.personName ?? ""}|${x.icon ?? ""}` === id) === idx;
        });
        merged.set(key, deduped);
      });
    };

    append(specialDatesPrev);
    append(specialDatesCurrent);
    append(specialDatesNext);

    return merged;
  }, [specialDatesPrev, specialDatesCurrent, specialDatesNext]);

  const handleDelete = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTask.mutate(taskId);
    toast.success("Tarefa removida");
  };

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (filterClient && filterClient !== "__all__") list = list.filter((t) => t.client_id === filterClient);
    if (filterAssignee && filterAssignee !== "__all__") {
      list = list.filter((t) => t.assignee_id === filterAssignee || fixedAssigneeClientIds.has(t.client_id));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (clientsMap[t.client_id] ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [tasks, filterClient, filterAssignee, search, clientsMap, fixedAssigneeClientIds]);

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

  const weekStart = useMemo(() => startOfWeek(cursor, { weekStartsOn: 0 }), [cursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

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

  const daySpecialDates = (dayKey: string) => specialDatesMap.get(dayKey) ?? [];

  const renderSpecialDates = (dayKey: string, compact = false) => {
    const items = daySpecialDates(dayKey);
    if (!items.length) return null;

    return (
      <div className={cn("space-y-1", compact && "space-y-0.5")}>
        {items.map((sd, idx) => {
          const isBirthday = sd.type === "birthday";
          const isHoliday = sd.type === "holiday";
          const label = isBirthday ? sd.personName ?? sd.label : sd.label;
          const IconComp = isBirthday ? Cake : sd.icon ? getIconById(sd.icon) : Star;
          const style = sd.type === "internal" && sd.color
            ? { backgroundColor: `${sd.color}1F`, color: sd.color }
            : undefined;

          return (
            <div key={`${dayKey}-${sd.type}-${idx}`} className={cn("w-full rounded-lg bg-primary/5 px-2 py-1 text-primary flex items-center gap-1.5", compact && "px-2 py-1 text-[10px]")} style={style}>
              <IconComp className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", "shrink-0")} />
              <span className={cn("truncate font-medium", compact ? "text-[10px]" : "text-xs")}>{label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTaskCard = (t: PmTask) => {
    const isDone = t.status_global === "concluido";
    const stageBg = STAGE_BADGE_BG[t.stage_current] ?? "bg-muted";
    const abbr = STAGE_ABBR[t.stage_current] ?? t.stage_current.toUpperCase().slice(0, 4);
    const member = t.assignee_id ? membersMap[t.assignee_id] : undefined;
    const clientName = clientsMap[t.client_id] ?? "—";

    return (
      <div
        key={t.id}
        className="w-full rounded-xl border border-border/20 bg-card/60 backdrop-blur-sm p-2 text-left transition-all hover:bg-card hover:shadow-sm hover:-translate-y-0.5 cursor-pointer group/card"
        onClick={() => onTaskClick(t)}>
        <div className="flex items-center justify-between gap-1">
          <div className={cn("inline-flex h-5 items-center rounded-md px-2 text-[9px] font-bold text-white tracking-wide", stageBg)}>
            {abbr}
          </div>
          <div className="flex items-center gap-0.5">
            <div
              className={cn("h-5 w-5 rounded-full flex items-center justify-center",
                isDone ? "bg-success text-success-foreground" : "border border-muted-foreground/25"
              )}
              title={isDone ? "Concluído" : "Pendente"}>
              {isDone && <CheckCircle2 className="h-3.5 w-3.5" />}
            </div>
            <button
              type="button"
              className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
              onClick={(e) => handleDelete(t.id, e)}
              title="Remover">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        {t.is_extra_demand &&
          <Badge variant="secondary" className="text-[8px] h-4 px-1.5 gap-0.5 mt-1 rounded-md">★ Extra</Badge>
        }
        <div className="mt-1.5 flex items-center gap-1.5">
          <Avatar className="h-5 w-5 shrink-0 ring-1 ring-background">
            <AvatarImage src={member?.avatar} />
            <AvatarFallback className="text-[7px] font-bold bg-primary/10 text-primary">{member ? initials(member.name) : "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold leading-4">{member?.name?.split(" ")[0] ?? "—"}</p>
            <p className="truncate text-[10px] text-muted-foreground/60 leading-3">{clientName}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards" }}>
      {/* Header: pill toggle + month nav */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs value={agendaView} onValueChange={(v) => setAgendaView(v as any)}>
          <TabsList className="bg-muted/40 h-10 p-1 rounded-full gap-1">
            <TabsTrigger value="month" className="h-8 rounded-full text-sm data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md px-5 transition-all">Mês</TabsTrigger>
            <TabsTrigger value="week" className="h-8 rounded-full text-sm data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md px-5 transition-all">Semana</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor((d) => agendaView === "week" ? addDays(d, -7) : startOfMonth(subMonths(d, 1)))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-bold capitalize min-w-[160px] text-center">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor((d) => agendaView === "week" ? addDays(d, 7) : startOfMonth(addMonths(d, 1)))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {agendaView === "week" ? (
        /* ── WEEK VIEW ── */
        isMobile ? (
          <div className="space-y-2">
            {weekDays.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const dayTasks = tasksByDay.get(key) ?? [];
              const dow = format(d, "EEEE", { locale: ptBR });
              const dowTitle = dow.charAt(0).toUpperCase() + dow.slice(1);
              const isToday = key === todayKey;
              const doneCount = dayTasks.filter((t) => t.status_global === "concluido").length;

              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border p-3 transition",
                    isToday ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/20"
                  )}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg text-xs font-bold",
                      isToday ? "bg-sidebar text-sidebar-foreground shadow-sm" : "text-muted-foreground/70"
                    )}>
                      {format(d, "dd")}
                    </div>
                    <span className={cn("text-xs capitalize", isToday && "text-primary font-medium")}>{dowTitle}</span>
                    {dayTasks.length > 0 && (
                      <Badge variant="secondary" className="ml-auto text-[10px]">{doneCount}/{dayTasks.length}</Badge>
                    )}
                  </div>
                  {renderSpecialDates(key, true)}
                  <div className="space-y-1.5">
                    {dayTasks.length ? dayTasks.map(renderTaskCard) : daySpecialDates(key).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Sem tarefas</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {weekDays.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const dayTasks = tasksByDay.get(key) ?? [];
                const dow = format(d, "EEEE", { locale: ptBR });
                const dowTitle = dow.charAt(0).toUpperCase() + dow.slice(1);
                const isToday = key === todayKey;
                const doneCount = dayTasks.filter((t) => t.status_global === "concluido").length;

                return (
                  <div
                    key={key}
                    className={cn(
                      "w-[280px] flex-shrink-0 rounded-xl border bg-card/10 p-4 transition",
                      isToday ? "border-primary ring-2 ring-primary/40" : "border-border/60"
                    )}>
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="min-w-0">
                        <p className={cn("text-sm font-medium", isToday && "text-primary")}>{dowTitle}</p>
                        <p className={cn("mt-1 text-3xl font-semibold leading-none tracking-tight", isToday && "text-primary")}>
                          {format(d, "dd")}
                        </p>
                        {dayTasks.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {doneCount}/{dayTasks.length} concluída(s)
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2.5 max-h-[500px] overflow-y-auto">
                      {renderSpecialDates(key)}
                      {dayTasks.length ? dayTasks.map(renderTaskCard) : daySpecialDates(key).length === 0 ? (
                        <div className="grid min-h-[120px] place-items-center rounded-lg border border-dashed border-border/60 bg-card/5 p-4">
                          <p className="text-sm text-muted-foreground">Sem tarefas</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : isMobile ? (
        /* ── MOBILE MONTH LIST VIEW ── */
        <div className="space-y-2">
          {days.filter(d => d.getMonth() === cursor.getMonth()).map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) ?? [];
            const daySpecialCount = daySpecialDates(key).length;
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={cn(
                  "rounded-xl border p-3 space-y-2",
                  isToday ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/20"
                )}>
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "grid h-7 w-7 place-items-center rounded-lg text-xs font-bold",
                    isToday ? "bg-sidebar text-sidebar-foreground shadow-sm" : "text-muted-foreground/70"
                  )}>
                    {format(d, "d")}
                  </div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {format(d, "EEEE", { locale: ptBR })}
                  </span>
                  {dayTasks.length > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px]">{dayTasks.length}</Badge>
                  )}
                </div>
                {renderSpecialDates(key, true)}
                <div className="space-y-1.5">
                  {dayTasks.map(renderTaskCard)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── DESKTOP MONTH GRID VIEW ── */
        <>
          <div className="grid grid-cols-7 gap-2">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) =>
              <div key={d} className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-center text-primary">{d}</div>
            )}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const inMonth = d.getMonth() === cursor.getMonth();
              const dayTasks = tasksByDay.get(key) ?? [];
              const isToday = key === todayKey;

              return (
                <div
                  key={key}
                  className={cn("relative min-h-28 rounded-2xl border border-[#d9d9d9] bg-card/30 backdrop-blur-sm p-2.5 transition-all calendar-card-hover",
                    inMonth ? "opacity-100" : "opacity-30 border-transparent",
                    isToday && "border-primary/50 ring-2 ring-primary/15 bg-primary/5"
                  )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg text-xs font-bold",
                      isToday ? "bg-sidebar text-sidebar-foreground shadow-sm" : "text-muted-foreground/70"
                    )}>
                      {format(d, "d")}
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-[520px] overflow-y-auto">
                    {renderSpecialDates(key, true)}
                    {dayTasks.slice(0, 5).map(renderTaskCard)}
                    {dayTasks.length > 5 &&
                      <button
                        type="button"
                        className="w-full rounded-lg bg-foreground/5 px-2 py-1 text-[10px] font-medium text-muted-foreground/60 hover:bg-foreground/10 hover:text-muted-foreground transition"
                        onClick={() => { setMoreDayKey(key); setMoreOpen(true); }}>
                        +{dayTasks.length - 5} mais
                      </button>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* More tasks dialog */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogTitle>
            {moreDayKey ? format(new Date(`${moreDayKey}T12:00:00`), "dd/MM · EEEE", { locale: ptBR }) : "Tarefas"}
          </DialogTitle>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {(moreDayKey ? tasksByDay.get(moreDayKey) ?? [] : []).map((t) => {
              const member = t.assignee_id ? membersMap[t.assignee_id] : undefined;
              return (
                <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/20 cursor-pointer hover:bg-muted/40 transition" onClick={() => { setMoreOpen(false); onTaskClick(t); }}>
                  <div className={cn("inline-flex h-5 items-center rounded-md px-2 text-[9px] font-bold text-white", STAGE_BADGE_BG[t.stage_current] ?? "bg-muted")}>
                    {STAGE_ABBR[t.stage_current] ?? t.stage_current.slice(0, 4).toUpperCase()}
                  </div>
                  <Avatar className="h-5 w-5 shrink-0 ring-1 ring-background">
                    <AvatarImage src={member?.avatar} />
                    <AvatarFallback className="text-[7px] font-bold">{member ? initials(member.name) : "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{member?.name ?? "—"}</p>
                    <p className="truncate text-[10px] text-muted-foreground/60">{clientsMap[t.client_id] ?? "—"}</p>
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

// ─── Cronograma Global View ───
import { CronogramaClientBrowser } from "./components/cronograma/CronogramaClientBrowser";

function CronogramaGlobalView({ tasks, childTasksMap, clientsMap, membersMap, onTaskClick, filterClient
}: {tasks: PmTask[];childTasksMap: Record<string, PmTask[]>;clientsMap: Record<string, string>;membersMap: Record<string, {name: string;avatar?: string;}>;onTaskClick: (t: PmTask) => void;filterClient: string;}) {
  return (
    <CronogramaClientBrowser
      tasks={tasks}
      childTasksMap={childTasksMap}
      clientsMap={clientsMap}
      membersMap={membersMap}
      onTaskClick={onTaskClick}
      filterClient={filterClient} />);
}