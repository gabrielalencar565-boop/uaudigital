import { useEffect, useMemo, useState } from "react";
import { PM_STAGES } from "./pm-constants";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus, Search, LayoutGrid, CalendarDays, FolderOpen, Settings2, CheckCircle2, FileSpreadsheet, Trash2, FileText, Users, ChevronLeft, ChevronRight, CalendarRange, Cake, Star, Calendar, TriangleAlert } from "lucide-react";
import { addDays, addMonths, subMonths, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";


import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePmTasks, usePmAllChildTasks, useUpdatePmTask, useDeletePmTask } from "./hooks/use-pm-data";
import { useDeleteTask, useTasks, useTeamMembers } from "@/features/data/queries";
import { useTaskAssigneesByMonth } from "@/features/data/task-assignees-queries";
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
import { AgendaQuickCreateDialog } from "./components/AgendaQuickCreateDialog";
import { useAgendaSpecialDates } from "@/features/agenda/hooks/use-agenda-dates";
import { getIconById } from "@/features/agenda/components/IconPicker";
import { AgendaReportsPanel } from "@/features/agenda/components/AgendaReportsPanel";
import { TaskTrashPanel } from "@/features/agenda/components/TaskTrashPanel";
import { useAvatarDirectory } from "@/hooks/use-avatar-directory";

const STAGE_ABBR: Record<string, string> = {
  captacao: "CAP", planejamento: "PLAN", design: "DSG", edicao_videos: "VDO",
  revisao: "REV", alteracoes: "ALT", pdf: "PDF", agendamento: "AGN", entrega: "ENT"
};

const STAGE_BADGE_BG: Record<string, string> = {
  captacao: "bg-red-500", planejamento: "bg-blue-500", design: "bg-stage-design",
  edicao_videos: "bg-purple-500", revisao: "bg-pink-500", alteracoes: "bg-stage-alteracoes", pdf: "bg-indigo-500",
  agendamento: "bg-lime-500", entrega: "bg-emerald-500"
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
  // Kanban defaults to logged-in user; Agenda defaults to all
  const initialFilter = (forcedView ?? "kanban") === "agenda" ? "__all__" : (user?.id ?? "__all__");
  const [filterAssignee, setFilterAssignee] = useState(initialFilter);
  const [filterStage, setFilterStage] = useState("__all__");

  useEffect(() => {
    if (effectiveView === "kanban" && user?.id) {
      setFilterAssignee(user.id);
    } else if (effectiveView === "agenda") {
      setFilterAssignee("__all__");
    }
  }, [user?.id, effectiveView]);

  // When switching views, adjust filter default
  const handleViewChange = (newView: typeof view) => {
    setView(newView);
    if (newView === "agenda") {
      setFilterAssignee("__all__");
    } else if (newView === "kanban" && user?.id) {
      setFilterAssignee(user.id);
    }
  };

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
  const membersQ = useTeamMembers();
  const avatarDirectory = useAvatarDirectory({ includeProfiles: false });
  const avatarsPrimed = avatarDirectory.isReady;
  const membersMap = useMemo(() => {
    const m: Record<string, {name: string;avatar?: string;}> = {};
    (membersQ.data ?? []).forEach((tm) => {m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined };});
    return m;
  }, [membersQ.data]);
  const membersList = useMemo(() => (membersQ.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name, avatar: m.avatar_url ?? undefined })), [membersQ.data]);
  const membersForSpecialDates = useMemo(
    () => (membersQ.data ?? []).map((m) => ({ user_id: m.user_id, display_name: m.display_name, birth_date: m.birth_date ?? null })),
    [membersQ.data]
  );

  const filters = { clientId: filterClient === "__all__" ? undefined : filterClient, assigneeId: filterAssignee === "__all__" ? undefined : filterAssignee, search: search || undefined, fixedAssigneeClientIds, stage: filterStage === "__all__" ? undefined : filterStage };

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
                    <UserAvatar avatarUrl={m.avatar_url ?? undefined} name={m.display_name} loading={!avatarsPrimed && !!m.avatar_url} className="h-5 w-5" fallbackClassName="text-[9px] bg-primary/10 text-primary" />
                    {m.display_name}
                  </span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={filterStage} onValueChange={setFilterStage}>
            <SelectTrigger className="h-9 flex-1 min-w-[120px] sm:flex-none sm:w-44 rounded-xl text-sm bg-background/80 border-border/30">
              <SelectValue placeholder="Todas as etapas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas as etapas</SelectItem>
              {PM_STAGES.filter(s => !["roteiro", "edicao"].includes(s.key)).map((s) =>
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>














































      

      {/* View tabs — hidden when sidebar drives the view */}
      {!hideViewTabs &&
      <Tabs value={effectiveView} onValueChange={(v) => handleViewChange(v as any)}>
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
          avatarsPrimed={avatarsPrimed}
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
          userId={user?.id ?? null}
          onTaskClick={(t) => setSelectedTaskId(t.id)}
          filterClient={filterClient}
          filterAssignee={filterAssignee}
          search={search}
          cursor={agendaCursor}
          setCursor={setAgendaCursor}
          fixedAssigneeClientIds={fixedAssigneeClientIds}
          clients={(clientsQ.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
          members={membersList}
          avatarsPrimed={avatarsPrimed}
          isAdmin={isAdmin}
          filterStage={filterStage} />

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
function AgendaCalendarView({ tasks, clientsMap, membersMap, teamMembers, userId, onTaskClick, filterClient, filterAssignee, search, cursor, setCursor, fixedAssigneeClientIds, clients, members, avatarsPrimed, isAdmin, filterStage }: {
  tasks: PmTask[];
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  teamMembers: Array<{ user_id: string; display_name: string; birth_date: string | null }>;
  userId: string | null;
  onTaskClick: (t: PmTask) => void;
  filterClient: string;
  filterAssignee: string;
  search: string;
  cursor: Date;
  setCursor: React.Dispatch<React.SetStateAction<Date>>;
  fixedAssigneeClientIds: Set<string>;
  clients: { id: string; name: string }[];
  members: { id: string; name: string; avatar?: string }[];
  avatarsPrimed: boolean;
  isAdmin: boolean;
  filterStage: string;
}) {
  const isMobile = useIsMobile();
  const deleteTask = useDeletePmTask();
  const deleteLegacyTask = useDeleteTask();
  const updateTask = useUpdatePmTask();
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreDayKey, setMoreDayKey] = useState<string | null>(null);
  const [agendaView, setAgendaView] = useState<"month" | "week">("month");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickCreateDate, setQuickCreateDate] = useState<string | undefined>();
  const [reportOpen, setReportOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<PmTask | null>(null);
  const [highlightOverdue, setHighlightOverdue] = useState(false);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  const isOverdue = (t: PmTask) =>
    (t.due_date ?? "") < todayKey && t.status_global !== "concluido" && t.stage_current !== "entrega";

  const dayHasOverdue = (dayKey: string) =>
    dayKey < todayKey && (tasksByDay.get(dayKey) ?? []).some((t) => t.status_global !== "concluido" && t.stage_current !== "entrega");

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
    setPendingDeleteId(taskId);
  };

  const confirmDeleteCronograma = async () => {
    if (!pendingDeleteId) return;
    try {
      if (pendingDeleteId.startsWith("legacy_")) {
        const legacyId = pendingDeleteId.replace("legacy_", "");
        if (!userId) {
          throw new Error("Sessão inválida para remover tarefa");
        }
        await deleteLegacyTask.mutateAsync({ taskId: legacyId, userId });
      } else {
        await deleteTask.mutateAsync(pendingDeleteId);
      }
      
      toast.success("Tarefa removida");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir");
    }
    setPendingDeleteId(null);
  };

  const filteredTasks = useMemo(() => {
    let list = tasks.filter((t) => t.status_global !== "pausado");
    if (filterClient && filterClient !== "__all__") list = list.filter((t) => t.client_id === filterClient);
    if (filterAssignee && filterAssignee !== "__all__") {
      list = list.filter((t) => t.assignee_id === filterAssignee || fixedAssigneeClientIds.has(t.client_id));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (clientsMap[t.client_id] ?? "").toLowerCase().includes(q));
    }
    if (filterStage && filterStage !== "__all__") {
      list = list.filter((t) => t.stage_current === filterStage);
    }
    return list;
  }, [tasks, filterClient, filterAssignee, search, clientsMap, fixedAssigneeClientIds, filterStage]);

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

  // Fetch legacy tasks from `tasks` table for the visible month range
  const legacyMonth = format(cursor, "yyyy-MM");
  const legacyTasksQ = useTasks({ month: legacyMonth });
  const legacyAssigneesQ = useTaskAssigneesByMonth(legacyMonth);

  const legacyAssigneesByTaskId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of legacyAssigneesQ.data ?? []) {
      const prev = map.get(row.task_id) ?? [];
      if (!prev.includes(row.user_id)) {
        prev.push(row.user_id);
      }
      map.set(row.task_id, prev);
    }
    return map;
  }, [legacyAssigneesQ.data]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, PmTask[]>();
    // Add pm_tasks
    for (const t of filteredTasks) {
      const key = t.due_date ?? "";
      if (!key) continue;
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, t]);
    }
    // Add legacy tasks converted to PmTask shape (skip pm_sync snapshots)
    for (const lt of legacyTasksQ.data ?? []) {
      if (lt.description?.startsWith("pm:")) continue;
      const key = lt.due_date ?? "";
      if (!key) continue;

      // Apply same filters as pm_tasks
      const legacyExtraAssignees = legacyAssigneesByTaskId.get(lt.id) ?? [];
      const allAssignees = [lt.assigned_user_id, ...legacyExtraAssignees];

      if (filterClient !== "__all__" && lt.client_id !== filterClient) continue;
      if (filterAssignee !== "__all__" && !allAssignees.includes(filterAssignee)) continue;
      if (filterStage !== "__all__" && lt.stage !== filterStage) continue;
      if (search) {
        const s = search.toLowerCase();
        const clientName = clientsMap[lt.client_id] ?? "";
        const titleMatch = (lt.title ?? "").toLowerCase().includes(s);
        const clientMatch = clientName.toLowerCase().includes(s);
        if (!titleMatch && !clientMatch) continue;
      }
      const legacyWatchers = legacyExtraAssignees.filter((id) => id !== lt.assigned_user_id);

      const asPm: PmTask = {
        id: `legacy_${lt.id}`,
        project_id: null,
        client_id: lt.client_id,
        title: lt.title ?? lt.stage,
        description: lt.description ?? null,
        priority: "media",
        status_global: lt.status === "concluido" ? "concluido" : lt.status === "em_andamento" ? "em_andamento" : "backlog",
        stage_current: lt.stage,
        start_date: null,
        due_date: lt.due_date,
        created_by: lt.created_by,
        assignee_id: lt.assigned_user_id,
        watchers: legacyWatchers,
        tags: [],
        created_at: "",
        updated_at: "",
        parent_task_id: null,
        cover_url: null,
        is_extra_demand: lt.is_extra_demand ?? false,
        post_type: null,
        posting_date: null,
        posting_time: null,
        caption: null,
      };
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, asPm]);
    }

    // Ordem fixa em todas as listas da Agenda: não concluídas primeiro, concluídas por último
    for (const [dayKey, dayTasks] of map) {
      const ordered = dayTasks.slice().sort((a, b) => {
        const aDone = a.status_global === "concluido";
        const bDone = b.status_global === "concluido";
        if (aDone !== bDone) return aDone ? 1 : -1;
        return 0;
      });
      map.set(dayKey, ordered);
    }

    return map;
  }, [filteredTasks, legacyTasksQ.data, legacyAssigneesByTaskId, filterClient, filterAssignee, filterStage, search, clientsMap]);

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
            <div key={`${dayKey}-${sd.type}-${idx}`} className={cn("w-full rounded-md bg-background/60 border border-border/10 px-1.5 py-0.5 flex items-center gap-1 opacity-40", compact && "px-1 py-0.5")} style={style}>
              <IconComp className={cn(compact ? "h-2.5 w-2.5" : "h-3 w-3", "shrink-0")} />
              <span className={cn("truncate font-medium", compact ? "text-[9px]" : "text-[10px]")}>{label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const getTaskAssignees = (task: PmTask) => {
    const assigneeIds = Array.from(
      new Set([task.assignee_id, ...(task.watchers ?? [])].filter((id): id is string => Boolean(id))),
    );

    return assigneeIds
      .map((id) => ({ id, ...membersMap[id] }))
      .filter((member): member is { id: string; name: string; avatar?: string } => Boolean(member.name));
  };

  const renderTaskCard = (t: PmTask) => {
    const isLegacy = t.id.startsWith("legacy_");
    const isDone = t.parent_task_id ? t.status_global === "concluido" : (t.status_global === "concluido" || t.stage_current === "entrega");
    const isAlteracaoWithOrigin = t.stage_current === "alteracoes" && !!t.post_type;
    const isRevisaoWithOrigin = t.stage_current === "revisao" && !!t.post_type;
    const hasGradient = isAlteracaoWithOrigin || isRevisaoWithOrigin;
    const gradientClass = isAlteracaoWithOrigin
      ? (t.post_type === "video"
        ? "bg-gradient-to-r from-stage-alteracoes to-stage-edicao_videos"
        : "bg-gradient-to-r from-stage-alteracoes to-stage-design")
      : isRevisaoWithOrigin
      ? (t.post_type === "video"
        ? "bg-gradient-to-r from-pink-400 to-stage-edicao_videos"
        : "bg-gradient-to-r from-pink-400 to-stage-design")
      : undefined;
    const gradientAbbr = isAlteracaoWithOrigin
      ? (t.post_type === "video" ? "ALT/VDO" : "ALT/DSG")
      : isRevisaoWithOrigin
        ? (t.post_type === "video" ? "REV/VDO" : "REV/DSG")
        : undefined;
    const stageBg = gradientClass ?? (STAGE_BADGE_BG[t.stage_current] ?? "bg-muted");
    const abbr = gradientAbbr ?? (STAGE_ABBR[t.stage_current] ?? t.stage_current.toUpperCase().slice(0, 4));
    const assignees = getTaskAssignees(t);
    const visibleAssignees = assignees.slice(0, 2);
    const extraAssignees = Math.max(assignees.length - 2, 0);
    const mainAssignee = assignees[0];
    const clientName = clientsMap[t.client_id] ?? "—";

    return (
      <div
        key={t.id}
        draggable={!isLegacy}
        onDragStart={isLegacy ? undefined : (e) => {
          e.dataTransfer.setData("text/plain", t.id);
          setDraggedTask(t);
        }}
        onDragEnd={isLegacy ? undefined : () => setDraggedTask(null)}
        className={cn("w-full rounded-xl border backdrop-blur-sm p-2 text-left transition-all hover:shadow-sm hover:-translate-y-0.5 group/card shadow-[0_1px_3px_0_hsl(var(--foreground)/0.06)]",
          isAlteracaoWithOrigin ? "border-[#f5b800]/40" : "bg-card/60 hover:bg-card border-border/30",
          isLegacy ? "cursor-default border-border/40 border-dashed" : "cursor-grab active:cursor-grabbing",
          highlightOverdue && isOverdue(t) && "bg-destructive/10 border-destructive/40 ring-1 ring-destructive/30"
        )}
        style={isAlteracaoWithOrigin && !(highlightOverdue && isOverdue(t)) ? { background: 'linear-gradient(135deg, #FED404 0%, #FF9A02 100%)' } : undefined}
        onClick={isLegacy ? undefined : () => onTaskClick(t)}>
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
        <div className="mt-2 flex items-center gap-2">
          {visibleAssignees.length > 0 ? (
            <div className="flex flex-col -space-y-1.5 shrink-0">
              {visibleAssignees.map((member) => (
                <UserAvatar
                  key={member.id}
                  avatarUrl={member.avatar}
                  name={member.name}
                  loading={!avatarsPrimed && !!member.avatar}
                  className="h-7 w-7 ring-2 ring-background"
                  fallbackClassName="text-[8px] font-bold bg-primary/10 text-primary"
                />
              ))}
              {extraAssignees > 0 && (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-semibold text-muted-foreground ring-2 ring-background">
                  +{extraAssignees}
                </span>
              )}
            </div>
          ) : (
            <div className="h-7 w-7 shrink-0 rounded-full ring-2 ring-background bg-muted" />
          )}
          <div className="min-w-0">
            {assignees.length === 1 && mainAssignee ? (
              <>
                <p className="truncate text-xs font-semibold leading-4">{mainAssignee.name.split(" ")[0]}</p>
                <p className="truncate text-[11px] text-muted-foreground/60 leading-3">{clientName}</p>
              </>
            ) : (
              <p className="truncate text-xs font-semibold leading-4">{clientName}</p>
            )}
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
          <Select
            value={String(cursor.getMonth())}
            onValueChange={(v) => {
              const newMonth = Number(v);
              setCursor(d => new Date(d.getFullYear(), newMonth, 1));
            }}
          >
            <SelectTrigger className="h-9 w-[130px] rounded-xl text-sm font-semibold bg-muted/30 border-border/30 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i} value={String(i)} className="capitalize">
                  {format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(cursor.getFullYear())}
            onValueChange={(v) => {
              const newYear = Number(v);
              setCursor(d => new Date(newYear, d.getMonth(), 1));
            }}
          >
            <SelectTrigger className="h-9 w-[100px] rounded-xl text-sm font-semibold bg-muted/30 border-border/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {Array.from({ length: 5 }, (_, i) => {
                const y = new Date().getFullYear() - 1 + i;
                return <SelectItem key={y} value={String(y)}>{y}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {(() => {
            const todayCount = Array.from(tasksByDay.entries())
              .filter(([k]) => k === todayKey)
              .reduce((sum, [, ts]) => sum + ts.filter(t => t.status_global !== "concluido").length, 0);
            return todayCount > 0 ? (
              <Badge variant="secondary" className="gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold">
                <Calendar className="h-3.5 w-3.5" />
                {todayCount} hoje
              </Badge>
            ) : null;
          })()}
          {(() => {
            const overdueCount = Array.from(tasksByDay.entries())
              .filter(([k]) => k < todayKey)
              .reduce((sum, [, ts]) => sum + ts.filter(t => t.status_global !== "concluido").length, 0);
            return overdueCount > 0 ? (
              <button
                type="button"
                onClick={() => setHighlightOverdue((v) => !v)}
                className="focus:outline-none"
              >
                <Badge variant="destructive" className={cn("gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold cursor-pointer transition-all", highlightOverdue && "ring-2 ring-destructive/60 ring-offset-2 ring-offset-background shadow-md")}>
                  <TriangleAlert className="h-3.5 w-3.5" />
                  {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
                </Badge>
              </button>
            ) : null;
          })()}
          {isAdmin && (
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setReportOpen(true)} title="Relatório">
              <FileText className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setTrashOpen(true)} title="Lixeira">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dialog de relatórios (admin only) */}
      {isAdmin && (
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
            <AgendaReportsPanel onClose={() => setReportOpen(false)} isAdmin={isAdmin} />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog de lixeira */}
      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
          <TaskTrashPanel onClose={() => setTrashOpen(false)} isAdmin={isAdmin} />
        </DialogContent>
      </Dialog>

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
                    isToday ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/20",
                    !isToday && dayHasOverdue(key) && "border-destructive/50 border-2"
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
                    {dayTasks.length ? (
                      <>
                        {dayTasks.slice(0, 5).map(renderTaskCard)}
                        {dayTasks.length > 5 && (
                          <button
                            type="button"
                            className="w-full rounded-lg bg-foreground/5 px-2 py-1 text-[10px] font-medium text-muted-foreground/60 hover:bg-foreground/10 hover:text-muted-foreground transition"
                            onClick={() => { setMoreDayKey(key); setMoreOpen(true); }}>
                            +{dayTasks.length - 5} mais
                          </button>
                        )}
                      </>
                    ) : daySpecialDates(key).length === 0 ? (
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
                      isToday ? "border-primary ring-2 ring-primary/40" : "border-border/60",
                      !isToday && dayHasOverdue(key) && "border-destructive/50 border-2"
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
                      {dayTasks.length ? (
                        <>
                          {dayTasks.slice(0, 5).map(renderTaskCard)}
                          {dayTasks.length > 5 && (
                            <button
                              type="button"
                              className="w-full rounded-lg bg-foreground/5 px-2 py-1.5 text-[10px] font-medium text-muted-foreground/60 hover:bg-foreground/10 hover:text-muted-foreground transition"
                              onClick={() => { setMoreDayKey(key); setMoreOpen(true); }}>
                              +{dayTasks.length - 5} mais
                            </button>
                          )}
                        </>
                      ) : daySpecialDates(key).length === 0 ? (
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
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2", "ring-primary/40"); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove("ring-2", "ring-primary/40"); }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("ring-2", "ring-primary/40");
                    const taskId = e.dataTransfer.getData("text/plain");
                    if (!taskId || !inMonth || taskId.startsWith("legacy_")) return;
                    try {
                      await updateTask.mutateAsync({ id: taskId, due_date: key });
                      toast.success("Tarefa movida para " + format(d, "dd/MM", { locale: ptBR }));
                    } catch (err: any) {
                      toast.error(err?.message ?? "Erro ao mover tarefa");
                    }
                    setDraggedTask(null);
                  }}
                  className={cn("group/cell relative min-h-28 rounded-2xl border border-[#d9d9d9] bg-card/30 backdrop-blur-sm p-2.5 transition-all calendar-card-hover",
                    inMonth ? "opacity-100" : "opacity-30 border-transparent",
                    isToday && "border-primary/50 ring-2 ring-primary/15 bg-primary/5",
                    !isToday && inMonth && dayHasOverdue(key) && "border-destructive/50 border-2"
                  )}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={cn(
                      "grid h-7 w-7 place-items-center rounded-lg text-xs font-bold",
                      isToday ? "bg-sidebar text-sidebar-foreground shadow-sm" : "text-muted-foreground/70"
                    )}>
                      {format(d, "d")}
                    </div>
                    {inMonth && (
                      <button
                        type="button"
                        className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition opacity-0 group-hover/cell:opacity-100"
                        onClick={() => { setQuickCreateDate(key); setQuickCreateOpen(true); }}
                        title="Nova tarefa">
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
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
          <div className="max-h-[60vh] space-y-2.5 overflow-y-auto">
            {(moreDayKey ? tasksByDay.get(moreDayKey) ?? [] : []).map((t) => {
              const isLegacy = t.id.startsWith("legacy_");
              const isDone = t.parent_task_id ? t.status_global === "concluido" : (t.status_global === "concluido" || t.stage_current === "entrega");
              const assignees = getTaskAssignees(t);
              const visibleAssignees = assignees.slice(0, 2);
              const extraAssignees = Math.max(assignees.length - 2, 0);
              const mainAssignee = assignees[0];
              const clientName = clientsMap[t.client_id] ?? "—";
              return (
                <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/60 shadow-[0_1px_3px_0_hsl(var(--foreground)/0.06)] cursor-pointer hover:bg-muted/40 transition" onClick={() => { if (!isLegacy) { setMoreOpen(false); onTaskClick(t); } }}>
                  <div className={cn("inline-flex h-6 items-center rounded-md px-2.5 text-[10px] font-bold text-white shrink-0", STAGE_BADGE_BG[t.stage_current] ?? "bg-muted")}>
                    {STAGE_ABBR[t.stage_current] ?? t.stage_current.slice(0, 4).toUpperCase()}
                  </div>
                  {visibleAssignees.length > 0 ? (
                    <div className="flex flex-col -space-y-1.5 shrink-0">
                      {visibleAssignees.map((member) => (
                        <UserAvatar
                          key={member.id}
                          avatarUrl={member.avatar}
                          name={member.name}
                          loading={!avatarsPrimed && !!member.avatar}
                          className="h-7 w-7 shrink-0 ring-2 ring-background"
                          fallbackClassName="text-[8px] font-bold bg-primary/10 text-primary"
                        />
                      ))}
                      {extraAssignees > 0 && (
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-semibold text-muted-foreground ring-2 ring-background">
                          +{extraAssignees}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="h-7 w-7 shrink-0 rounded-full ring-2 ring-background bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {assignees.length === 1 && mainAssignee
                        ? mainAssignee.name
                        : assignees.length > 1
                          ? `${assignees.length} responsáveis`
                          : "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground/60">{clientName}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className={cn("h-6 w-6 rounded-full flex items-center justify-center transition",
                        isDone ? "bg-success text-success-foreground" : "border border-muted-foreground/25 hover:border-success hover:bg-success/10"
                      )}
                      title={isDone ? "Concluído" : "Marcar como concluído"}
                      onClick={(e) => { e.stopPropagation(); }}>
                      {isDone && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      className="h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                      onClick={(e) => { e.stopPropagation(); handleDelete(t.id, e); }}
                      title="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      {/* Delete confirmation */}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Tem certeza que deseja excluir esta tarefa?</span>
              <span className="block text-destructive font-medium">
                ⚠️ Os pontos de performance não serão contabilizados e a etapa será desmarcada no Magic Number.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteCronograma} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AgendaQuickCreateDialog
        open={quickCreateOpen}
        onClose={() => setQuickCreateOpen(false)}
        clients={clients}
        members={members}
        defaultDate={quickCreateDate}
      />
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