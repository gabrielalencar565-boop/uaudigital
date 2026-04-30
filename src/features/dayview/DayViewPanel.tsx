import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PmTaskDetailDialog } from "@/features/gestao/components/PmTaskDetailDialog";
import { usePmTasks } from "@/features/gestao/hooks/use-pm-data";
import { differenceInCalendarDays, format, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useClients, useFreelancerClient, useTasks, useTeamMembers } from "@/features/data/queries";
import { supabase } from "@/integrations/supabase/client";
import { useTaskAssigneesByMonth } from "@/features/data/task-assignees-queries";
import { Magic2Dashboard } from "@/features/magic2/components/Magic2Dashboard";
import { useMagic2Dashboard } from "@/features/magic2/hooks/use-magic2-dashboard";
import { MonthYearNav } from "@/features/magic2/components/MonthYearNav";
import { STAGES } from "@/lib/uau";
import { cn } from "@/lib/utils";
import { RefreshCw, Calendar, Target, RotateCcw, Trophy, ArrowUp, ArrowDown, SprayCan, CheckCircle2, Zap, Maximize, Minimize } from "lucide-react";
import { useNow } from "@/hooks/use-now";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import {
  useCleaningSchedules,
  useCleaningCategories,
  useCleaningCompletions,
  useToggleCleaningCompletion,
  DAYS_PT } from
"@/features/cleaning/hooks/use-cleaning";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

const STAGE_ABBR: Record<string, string> = {
  captacao: "CAP", planejamento: "PLAN", design: "DSG", edicao_videos: "VDO",
  revisao: "REV", alteracoes: "ALT", pdf: "PDF", agendamento: "AGN", entrega: "ENT"
};

const STAGE_BADGE_BG: Record<string, string> = {
  captacao: "bg-red-500", planejamento: "bg-blue-500", design: "bg-stage-design",
  edicao_videos: "bg-purple-500", revisao: "bg-pink-500", alteracoes: "bg-stage-alteracoes",
  pdf: "bg-indigo-500", agendamento: "bg-lime-500", entrega: "bg-emerald-500"
};

function getCleaningEmoji(categoryName: string) {
  const name = categoryName.toLowerCase();
  if (name.includes("varrer") || name.includes("vassoura") || name.includes("chão")) return "🧹";
  if (name.includes("pano") || name.includes("rodo") || name.includes("balde")) return "🪣";
  if (name.includes("móve") || name.includes("movel") || name.includes("moveis") || name.includes("móvel")) return "🧽";
  if (name.includes("banheir") || name.includes("wc") || name.includes("vaso")) return "🚽";
  return "🧼";
}
function statusTone(status: string, dueDate: string, todayKey: string) {
  if (status === "concluido") return "success" as const;
  if (dueDate < todayKey) return "destructive" as const;
  return "warning" as const;
}
export function DayViewPanel() {
  const [active, setActive] = useState<"magic" | "agenda" | "podio">("magic");
  const [autoRotate, setAutoRotate] = useState(true);
  const [isHoveringRotateBtn, setIsHoveringRotateBtn] = useState(false);
  const [rotateInterval, setRotateInterval] = useState(10_000); // 10s padrão
  const now = useNow({
    intervalMs: 30_000
  });
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedPmTaskId, setSelectedPmTaskId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Navegador de mês/ano
  const [selectedYear, setSelectedYear] = useState(() => now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => now.getMonth() + 1);
  const today = now;
  const todayKey = format(today, "yyyy-MM-dd");
  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  const freelancerClientQ = useFreelancerClient();
  const freelancerClientId = freelancerClientQ.data?.id ?? null;
  const clientsQ = useClients();
  const teamQ = useTeamMembers();
  const tasksQ = useTasks({
    month: monthKey
  });
  const magic2 = useMagic2Dashboard(selectedYear, selectedMonth);
  const assigneesQ = useTaskAssigneesByMonth(monthKey);
  const { user: sessionUser } = useSession();

  // ─── PM tasks (Gestão) for agenda sync ───
  const pmTasksQ = useQuery({
    queryKey: ["pm_tasks_for_dayview", monthKey],
    queryFn: async () => {
      const startDate = `${monthKey}-01`;
      // Compute last day of month correctly to avoid invalid dates (e.g. Apr 31)
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("pm_tasks")
        .select("id, title, client_id, assignee_id, watchers, due_date, stage_current, status_global, is_extra_demand, parent_task_id, updated_at")
        .is("parent_task_id", null)
        .is("deleted_at", null)
        .gte("due_date", startDate)
        .lte("due_date", endDate);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ─── PM subtasks for podium totals (fetch by parent task in the month) ───
  const pmSubtasksQ = useQuery({
    queryKey: ["pm_subtasks_for_podium", monthKey, pmTasksQ.data],
    queryFn: async () => {
      const parentIds = (pmTasksQ.data ?? []).map(t => t.id);
      if (!parentIds.length) return [];
      const { data, error } = await supabase
        .from("pm_subtasks")
        .select("id, task_id, assignee_id, status, due_date")
        .in("task_id", parentIds);
      if (error) throw error;
      return data ?? [];
    },
    enabled: (pmTasksQ.data ?? []).length > 0,
  });

  // ─── PM child tasks per parent (count + post_types for gradient detection) ───
  const pmChildCountQ = useQuery({
    queryKey: ["pm_child_count_for_dayview", monthKey],
    queryFn: async () => {
      const parentIds = (pmTasksQ.data ?? []).map(t => t.id);
      if (!parentIds.length) return { counts: new Map<string, number>(), postTypes: new Map<string, Set<string>>() };
      const { data, error } = await supabase
        .from("pm_tasks")
        .select("parent_task_id, post_type")
        .in("parent_task_id", parentIds);
      if (error) throw error;
      const counts = new Map<string, number>();
      const postTypes = new Map<string, Set<string>>();
      for (const row of data ?? []) {
        if (row.parent_task_id) {
          counts.set(row.parent_task_id, (counts.get(row.parent_task_id) ?? 0) + 1);
          if (row.post_type) {
            const set = postTypes.get(row.parent_task_id) ?? new Set<string>();
            set.add(row.post_type);
            postTypes.set(row.parent_task_id, set);
          }
        }
      }
      return { counts, postTypes };
    },
    enabled: (pmTasksQ.data ?? []).length > 0,
  });

  // ─── All pending tasks per user (across all months) for "Pend." column ───
  const allPendingTasksQ = useQuery({
    queryKey: ["all_pending_tasks_for_podium"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, assigned_user_id, status")
        .neq("status", "concluido")
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allPendingPmTasksQ = useQuery({
    queryKey: ["all_pending_pm_tasks_for_podium"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pm_tasks")
        .select("id, assignee_id, status_global")
        .is("parent_task_id", null)
        .is("deleted_at", null)
        .neq("status_global", "concluido")
        .neq("status_global", "cancelado");
      if (error) throw error;
      return data ?? [];
    },
  });

  const allPendingByUser = useMemo(() => {
    const map = new Map<string, number>();
    const add = (userId: string) => map.set(userId, (map.get(userId) ?? 0) + 1);

    for (const t of allPendingTasksQ.data ?? []) {
      add(t.assigned_user_id);
    }
    for (const t of allPendingPmTasksQ.data ?? []) {
      if (t.assignee_id) add(t.assignee_id);
    }
    return map;
  }, [allPendingTasksQ.data, allPendingPmTasksQ.data]);

  const cleaningSchedulesQ = useCleaningSchedules();
  const cleaningCategoriesQ = useCleaningCategories();
  const cleaningCompletionsQ = useCleaningCompletions(todayKey);
  const toggleCleaning = useToggleCleaningCompletion();

  // ─── Realtime sync para agenda do dia ───
  useRealtimeSync([
  "tasks",
  "task_assignees",
  "cleaning_completions",
  "cleaning_schedules",
  "cleaning_categories",
  "performance_scores",
  "clients",
  "client_cycles",
  "client_cycle_stages",
  "magic2_cycles",
  "magic2_cycle_stages",
  "team_members",
  "profiles",
  "pm_tasks",
  "pm_subtasks"]
  );

  const todayDow = getDay(today); // 0=dom, 6=sab

  // Performance scores for podium
  type ScoreRow = {
    user_id: string;
    year: number;
    month: number;
    aprendizado_continuo: number;
    padrao_qualidade_uau: number;
    metas_prazos: number;
    ambiente_organizado: number;
    comprometimento: number;
  };

  const scoresQ = useQuery({
    queryKey: ["performance_scores", selectedYear, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.
      from("performance_scores").
      select("*").
      eq("year", selectedYear).
      eq("month", selectedMonth).
      order("user_id");
      if (error) throw error;
      return (data ?? []) as ScoreRow[];
    }
  });

  // Track previous ranking positions in real-time
  const prevRankRef = useRef<Map<string, number>>(new Map());

  // Task completion stats per user (total assigned vs completed) — counts unique main tasks + subtasks
  const taskStatsByUser = useMemo(() => {
    const tasks = tasksQ.data ?? [];
    const subtasks = pmSubtasksQ.data ?? [];
    const pmTasks = pmTasksQ.data ?? [];
    const stats = new Map<string, { total: number; completed: number }>();
    const assigneesByTaskId = new Map<string, string[]>();

    for (const a of assigneesQ.data ?? []) {
      const current = assigneesByTaskId.get(a.task_id) ?? [];
      current.push(a.user_id);
      assigneesByTaskId.set(a.task_id, current);
    }

    const addItem = (userId: string | null | undefined, isCompleted: boolean) => {
      if (!userId) return;
      const prev = stats.get(userId) ?? { total: 0, completed: 0 };
      prev.total += 1;
      if (isCompleted) prev.completed += 1;
      stats.set(userId, prev);
    };

    const isPmSnapshotTask = (description: string | null | undefined) => {
      if (!description?.startsWith("pm:")) return false;
      return description.split(":").length >= 4;
    };

    // Legacy agenda tasks only (exclude PM snapshots to avoid double counting)
    for (const t of tasks) {
      if (isPmSnapshotTask(t.description)) continue;

      const taskAssignees = assigneesByTaskId.get(t.id) ?? [];
      if (taskAssignees.length > 0) {
        for (const userId of taskAssignees) {
          addItem(userId, t.status === "concluido");
        }
      } else {
        addItem(t.assigned_user_id, t.status === "concluido");
      }
    }

    // PM main tasks (count once here; snapshots were skipped above)
    for (const t of pmTasks) {
      addItem(t.assignee_id, t.status_global === "concluido");
    }

    // PM subtasks
    for (const st of subtasks) {
      addItem(st.assignee_id, st.status === "concluido");
    }

    return stats;
  }, [tasksQ.data, assigneesQ.data, pmSubtasksQ.data, pmTasksQ.data]);

  const monthlyRank = useMemo(() => {
    const scores = scoresQ.data ?? [];
    const byUser = new Map(scores.map((s) => [s.user_id, s]));
    const members = teamQ.data ?? [];
    const base = members.map((m) => {
      const s = byUser.get(m.user_id);
      const total =
      (s?.aprendizado_continuo ?? 0) + (
      s?.padrao_qualidade_uau ?? 0) + (
      s?.metas_prazos ?? 0) + (
      s?.ambiente_organizado ?? 0) + (
      s?.comprometimento ?? 0);
      const taskStats = taskStatsByUser.get(m.user_id) ?? { total: 0, completed: 0 };
      const completionPct = taskStats.total > 0 ? Math.round(taskStats.completed / taskStats.total * 100) : 0;
      return { user_id: m.user_id, total, taskTotal: taskStats.total, taskCompleted: taskStats.completed, completionPct };
    });
    base.sort((a, b) => b.total - a.total);
    return base;
  }, [scoresQ.data, teamQ.data, taskStatsByUser]);

  // Update previous rank ref after monthlyRank changes
  const currentRankMap = useMemo(() => {
    const map = new Map<string, number>();
    monthlyRank.forEach((r, i) => map.set(r.user_id, i));
    return map;
  }, [monthlyRank]);

  // Compute variation from previously stored positions
  const rankVariation = useMemo(() => {
    const prev = prevRankRef.current;
    const map = new Map<string, number>();
    if (prev.size > 0) {
      monthlyRank.forEach((r, idx) => {
        const prevIdx = prev.get(r.user_id);
        if (prevIdx !== undefined) {
          map.set(r.user_id, prevIdx - idx); // positive = moved up
        }
      });
    }
    return map;
  }, [monthlyRank]);

  // Store current positions for next comparison
  useEffect(() => {
    if (monthlyRank.length > 0) {
      const map = new Map<string, number>();
      monthlyRank.forEach((r, i) => map.set(r.user_id, i));
      prevRankRef.current = map;
    }
  }, [monthlyRank]);


  // Ranking com todos os membros (sem filtro)
  const filteredRank = monthlyRank;




  const clientsById = useMemo(() => new Map((clientsQ.data ?? []).map((c) => [c.id, c] as const)), [clientsQ.data]);
  const teamByUserId = useMemo(() => new Map((teamQ.data ?? []).map((m) => [m.user_id, m] as const)), [teamQ.data]);

  /** Resolve client name: freelancer tasks show title instead */
  const resolveClientName = (t: {client_id: string;title: string | null;}) => {
    if (freelancerClientId && t.client_id === freelancerClientId && t.title) {
      return t.title;
    }
    return clientsById.get(t.client_id)?.name ?? "—";
  };

  // Mapa de múltiplos assignees por tarefa
  const assigneesByTaskId = useMemo(() => {
    const map = new Map<string, {
      user_id: string;
      display_name: string;
      avatar_url?: string | null;
    }[]>();
    // Legacy task_assignees
    for (const a of assigneesQ.data ?? []) {
      const member = teamByUserId.get(a.user_id);
      if (!member) continue;
      const prev = map.get(a.task_id) ?? [];
      prev.push({
        user_id: a.user_id,
        display_name: member.display_name,
        avatar_url: member.avatar_url
      });
      map.set(a.task_id, prev);
    }
    // PM tasks: assignee + watchers
    for (const t of pmTasksQ.data ?? []) {
      const key = `pm_${t.id}`;
      const members: { user_id: string; display_name: string; avatar_url?: string | null }[] = [];
      const seen = new Set<string>();
      if (t.assignee_id) {
        const m = teamByUserId.get(t.assignee_id);
        if (m) { members.push({ user_id: m.user_id, display_name: m.display_name, avatar_url: m.avatar_url }); seen.add(m.user_id); }
      }
      for (const wId of t.watchers ?? []) {
        if (seen.has(wId)) continue;
        const m = teamByUserId.get(wId);
        if (m) { members.push({ user_id: m.user_id, display_name: m.display_name, avatar_url: m.avatar_url }); seen.add(m.user_id); }
      }
      if (members.length > 0) map.set(key, members);
    }
    return map;
  }, [assigneesQ.data, teamByUserId, pmTasksQ.data]);

  // Se estamos visualizando o mês atual, mostrar tarefas de hoje
  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  // ─── Cleaning memos ───
  const todayCleaningTasks = useMemo(() => {
    if (!isCurrentMonth) return [];
    const schedules = cleaningSchedulesQ.data ?? [];
    return schedules.filter((s) => s.day_of_week === todayDow);
  }, [cleaningSchedulesQ.data, todayDow, isCurrentMonth]);

  const cleaningCategoryById = useMemo(
    () => new Map((cleaningCategoriesQ.data ?? []).map((c) => [c.id, c])),
    [cleaningCategoriesQ.data]
  );

  const completedScheduleIds = useMemo(
    () => new Set((cleaningCompletionsQ.data ?? []).map((c) => c.schedule_id)),
    [cleaningCompletionsQ.data]
  );

  // ─── Normalize pm_tasks into a compatible shape for display ───
  type UnifiedTask = {
    id: string;
    client_id: string;
    assigned_user_id: string;
    due_date: string;
    status: string;
    stage: string;
    title: string | null;
    is_extra_demand: boolean;
    completed_at: string | null;
    source: "agenda" | "pm";
    subtaskCount?: number;
    post_type?: string | null;
    parent_task_id?: string | null;
    childPostTypes?: Set<string>;
  };

  const unifiedTasks = useMemo(() => {
    // Group pm scoring snapshots (pm:taskId:stage:userId) into a single entry
    const rawAgenda = tasksQ.data ?? [];
    const pmSnapshotGroups = new Map<string, typeof rawAgenda>();
    const nonSnapshotTasks: typeof rawAgenda = [];

    for (const t of rawAgenda) {
      const desc = t.description ?? "";
      // Match pm:<taskId>:<stage>:<userId> pattern (4-part)
      const parts = desc.startsWith("pm:") ? desc.split(":") : null;
      if (parts && parts.length >= 4) {
        // Group key = pm:<taskId>:<stage>
        const groupKey = `${parts[0]}:${parts[1]}:${parts[2]}`;
        const group = pmSnapshotGroups.get(groupKey) ?? [];
        group.push(t);
        pmSnapshotGroups.set(groupKey, group);
      } else {
        nonSnapshotTasks.push(t);
      }
    }

    // Build unified tasks from non-snapshot tasks
    const agendaTasks: UnifiedTask[] = nonSnapshotTasks.map(t => ({
      ...t,
      source: "agenda" as const,
    }));

    // Merge each pm snapshot group into a single unified task
    for (const [groupKey, group] of pmSnapshotGroups) {
      const first = group[0];
      // Use group key as ID to avoid duplicates
      const mergedId = `agenda_pm_${groupKey}`;
      agendaTasks.push({
        id: mergedId,
        client_id: first.client_id,
        assigned_user_id: first.assigned_user_id,
        due_date: first.due_date,
        status: first.status,
        stage: first.stage,
        title: first.title,
        is_extra_demand: first.is_extra_demand,
        completed_at: first.completed_at,
        source: "agenda" as const,
      });
    }

    // pm_tasks that DON'T have a snapshot in the agenda tasks (avoid duplicates)
    const childData = pmChildCountQ.data ?? { counts: new Map<string, number>(), postTypes: new Map<string, Set<string>>() };
    const childCounts = childData.counts;
    const childPostTypes = childData.postTypes;
    // Collect all pm task IDs that already have snapshots
    const snapshotPmIds = new Set<string>();
    for (const key of pmSnapshotGroups.keys()) {
      const parts = key.split(":");
      if (parts[1]) snapshotPmIds.add(parts[1]);
    }
    
    const pmTasks: UnifiedTask[] = (pmTasksQ.data ?? [])
      .filter(t => {
        // Skip if there's already an agenda snapshot for this pm_task
        return !snapshotPmIds.has(t.id);
      })
      .map(t => ({
        id: `pm_${t.id}`,
        client_id: t.client_id,
        assigned_user_id: t.assignee_id ?? "",
        due_date: t.due_date ?? "",
        status: (t.status_global === "concluido" || t.stage_current === "entrega" || t.stage_current === "agendamento") ? "concluido" : "pendente",
        stage: t.stage_current,
        title: t.title,
        is_extra_demand: t.is_extra_demand,
        completed_at: (t.status_global === "concluido" || t.stage_current === "entrega" || t.stage_current === "agendamento") ? (t.updated_at ?? null) : null,
        source: "pm" as const,
        subtaskCount: childCounts.get(t.id) ?? 0,
        post_type: t.post_type ?? null,
        parent_task_id: t.parent_task_id ?? null,
        childPostTypes: childPostTypes.get(t.id),
      }));

    return { tasks: [...agendaTasks, ...pmTasks], pmSnapshotGroups };
  }, [tasksQ.data, pmTasksQ.data, pmChildCountQ.data]);

  // Build merged assignees for pm snapshot groups
  const mergedSnapshotAssignees = useMemo(() => {
    const map = new Map<string, { user_id: string; display_name: string; avatar_url?: string | null }[]>();
    for (const [groupKey, group] of unifiedTasks.pmSnapshotGroups) {
      const mergedId = `agenda_pm_${groupKey}`;
      const members: { user_id: string; display_name: string; avatar_url?: string | null }[] = [];
      const seen = new Set<string>();
      for (const t of group) {
        if (!seen.has(t.assigned_user_id)) {
          const m = teamByUserId.get(t.assigned_user_id);
          if (m) {
            members.push({ user_id: m.user_id, display_name: m.display_name, avatar_url: m.avatar_url });
          }
          seen.add(t.assigned_user_id);
        }
      }
      if (members.length > 0) map.set(mergedId, members);
    }
    return map;
  }, [unifiedTasks.pmSnapshotGroups, teamByUserId]);

  // Combined assignees map: base + merged snapshot assignees
  const allAssigneesByTaskId = useMemo(() => {
    const combined = new Map(assigneesByTaskId);
    for (const [k, v] of mergedSnapshotAssignees) {
      combined.set(k, v);
    }
    return combined;
  }, [assigneesByTaskId, mergedSnapshotAssignees]);

  /** Extract real pm_task UUID from unified task id */
  const extractPmTaskId = useCallback((unifiedId: string): string | null => {
    if (unifiedId.startsWith("pm_")) return unifiedId.slice(3);
    const agendaMatch = unifiedId.match(/^agenda_pm_pm:([^:]+):/);
    if (agendaMatch) return agendaMatch[1];
    return null;
  }, []);

  const handleTaskClick = useCallback((t: { id: string; source: string }) => {
    const pmId = extractPmTaskId(t.id);
    if (pmId) setSelectedPmTaskId(pmId);
  }, [extractPmTaskId]);

  // Tarefas de hoje (exceto concluídas - elas vão separadas)
  const todayPendingTasks = useMemo(() => {
    const tasks = unifiedTasks.tasks.filter((t) => {
      if (!t.due_date) return false;
      if (t.status === "concluido") return false;
      if (!isCurrentMonth) return true;
      return t.due_date === todayKey;
    });
    return tasks.sort((a, b) => {
      const w = (s: string) => s === "em_andamento" ? 0 : 1;
      const dw = w(a.status) - w(b.status);
      if (dw !== 0) return dw;
      const na = teamByUserId.get(a.assigned_user_id)?.display_name ?? "";
      const nb = teamByUserId.get(b.assigned_user_id)?.display_name ?? "";
      return na.localeCompare(nb);
    });
  }, [unifiedTasks, todayKey, teamByUserId, isCurrentMonth]);

  // Tarefas concluídas de hoje
  const todayCompletedTasks = useMemo(() => {
    const tasks = unifiedTasks.tasks.filter((t) => {
      if (t.status !== "concluido") return false;
      if (!isCurrentMonth) return true;
      // For today view, only show tasks actually completed today (by completed_at date in Brazil TZ)
      if (t.completed_at) {
        const completedBR = new Date(t.completed_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
        return completedBR === todayKey;
      }
      // Fallback: if no completed_at, use due_date
      return t.due_date === todayKey;
    });
    return tasks.sort((a, b) => {
      const na = teamByUserId.get(a.assigned_user_id)?.display_name ?? "";
      const nb = teamByUserId.get(b.assigned_user_id)?.display_name ?? "";
      return na.localeCompare(nb);
    });
  }, [unifiedTasks, todayKey, teamByUserId, isCurrentMonth]);
  const overdueTasks = useMemo(() => {
    return unifiedTasks.tasks.filter((t) => t.status !== "concluido" && t.due_date && t.due_date < todayKey).sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [unifiedTasks.tasks, todayKey]);
  const completedTasksCount = useMemo(() => unifiedTasks.tasks.filter((t) => t.status === "concluido").length, [unifiedTasks.tasks]);
  const totalTasks = unifiedTasks.tasks.length + (pmChildCountQ.data ? Array.from(pmChildCountQ.data.values()).reduce((a, b) => a + b, 0) : 0);

  // Navegação rápida para hoje
  const goToToday = () => {
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth() + 1);
  };
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([queryClient.invalidateQueries({
      queryKey: ["magic2"]
    }), queryClient.invalidateQueries({
      queryKey: ["tasks"]
    }), queryClient.invalidateQueries({
      queryKey: ["clients"]
    }), queryClient.invalidateQueries({
      queryKey: ["team_members"]
    }), queryClient.invalidateQueries({
      queryKey: ["cleaning_schedules"]
    }), queryClient.invalidateQueries({
      queryKey: ["cleaning_completions"]
    }), queryClient.invalidateQueries({
      queryKey: ["cleaning_categories"]
    })]);
    setIsRefreshing(false);
    toast.success("Dados atualizados!");
  };

  // Auto-alternância com intervalo configurável
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setActive((v) => v === "magic" ? "agenda" : v === "agenda" ? "podio" : "magic");
    }, rotateInterval);
    return () => clearInterval(interval);
  }, [autoRotate, rotateInterval]);

  // Parar auto-rotate quando clicar manualmente
  const handleManualTabChange = () => {
    setActive((v) => v === "magic" ? "agenda" : v === "agenda" ? "podio" : "magic");
  };
  // Calcular dias restantes até o prazo final (dia 27 do mês selecionado)
  const deadlineDate = new Date(selectedYear, selectedMonth - 1, 27);
  const daysUntilDeadline = differenceInCalendarDays(deadlineDate, today);

  return <div ref={containerRef} className={cn("space-y-6", isFullscreen && "bg-background px-4 py-2 overflow-hidden h-screen flex flex-col gap-3 space-y-0")}>
      {/* Header */}
      <div className={cn("flex flex-col gap-3 opacity-0", isFullscreen && "shrink-0")} style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <div className="flex items-center justify-between">
          <h2 className={cn("font-semibold tracking-tight text-xl sm:text-3xl", isFullscreen && "text-xl")}>Visão do Dia</h2>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing} className="h-8 w-8 sm:h-9 sm:w-9">
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <Button variant="outline" size="icon" onClick={toggleFullscreen} className="h-8 w-8 sm:h-9 sm:w-9 hidden sm:inline-flex">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            variant={autoRotate ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRotate(!autoRotate)}
            onMouseEnter={() => setIsHoveringRotateBtn(true)}
            onMouseLeave={() => setIsHoveringRotateBtn(false)}
            className={cn(
              "h-8 sm:h-9 text-xs sm:text-sm min-w-[70px] sm:min-w-[90px]",
              autoRotate && "bg-success hover:bg-success/90 text-success-foreground"
            )}>
            {autoRotate ? (isHoveringRotateBtn ? "Pausado" : "Rodando") : (isHoveringRotateBtn ? "Rodando" : "Pausado")}
          </Button>
          <Button variant="outline" size="sm" onClick={handleManualTabChange} className="h-8 sm:h-9 text-xs sm:text-sm">
            {active === "magic" ? "Agenda" : active === "agenda" ? "Pódio" : "Magic"}
          </Button>
          <select value={String(rotateInterval)} onChange={(e) => setRotateInterval(Number(e.target.value))} className="h-8 sm:h-9 rounded-md border border-input bg-background px-2 sm:px-3 text-xs sm:text-sm">
            <option value="5000">5s</option>
            <option value="10000">10s</option>
            <option value="15000">15s</option>
            <option value="30000">30s</option>
          </select>
          <select value={String(selectedMonth)} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="h-8 sm:h-9 rounded-md border border-input bg-background px-2 sm:px-3 text-xs sm:text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{format(new Date(selectedYear, m - 1, 1), "MMM", { locale: ptBR }).replace(/^./, (c) => c.toUpperCase())}</option>
            ))}
          </select>
          <select value={String(selectedYear)} onChange={(e) => setSelectedYear(Number(e.target.value))} className="h-8 sm:h-9 rounded-md border border-input bg-background px-2 sm:px-3 text-xs sm:text-sm">
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Conteúdo */}
      {active === "magic" ? <div className={cn("space-y-4", isFullscreen && "flex-1 flex flex-col")}>
          
          {magic2.query.isLoading ? <Card>
              <CardHeader>
                <CardTitle>Carregando…</CardTitle>
                <CardDescription>Buscando dados do mês selecionado.</CardDescription>
              </CardHeader>
            </Card> : magic2.cycles.length ? <div className={cn(isFullscreen && "flex-1 flex flex-col")}><Magic2Dashboard dashboard={magic2.dashboard} year={selectedYear} month={selectedMonth} fullscreen={isFullscreen} /></div> : <Card className="border-dashed">
              <CardHeader className="text-center">
                <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-muted/50 grid place-items-center">
                  <Target className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardTitle className="text-lg">Magic Number não configurado</CardTitle>
                <CardDescription>
                  Não há ciclos ativos para {String(selectedMonth).padStart(2, "0")}/{selectedYear}.
                  <br />
                  Vá até o <strong>Magic Number</strong> para adicionar clientes ao ciclo.
                </CardDescription>
              </CardHeader>
            </Card>}
        </div> : active === "agenda" ? <Card className={cn(isFullscreen && "flex-1 flex flex-col")}>
          <CardHeader>
            <CardTitle>
              {isCurrentMonth ? "Agenda de Hoje" : `Agenda de ${format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM", {
            locale: ptBR
          })}`}
            </CardTitle>
            <CardDescription>
              {overdueTasks.length ? `${overdueTasks.length} atrasada(s) • ` : ""}
              {completedTasksCount}/{totalTasks} concluída(s)
            </CardDescription>
          </CardHeader>
          <CardContent className={cn("space-y-4", isFullscreen && "flex-1 overflow-auto")}>
            {/* ─── Limpeza – Widget compacto horizontal (TOPO) ─── */}
            {isCurrentMonth && todayCleaningTasks.length > 0 &&
        <div className="flex flex-wrap items-center gap-2">
                {todayCleaningTasks.map((schedule) => {
            const cat = cleaningCategoryById.get(schedule.category_id);
            const member = teamByUserId.get(schedule.user_id);
            const isDone = completedScheduleIds.has(schedule.id);
            const dueTimeStr = schedule.due_time?.slice(0, 5) ?? "18:00";
            const [dueH, dueM] = dueTimeStr.split(":").map(Number);
            const isOverdue = !isDone && (now.getHours() > dueH || now.getHours() === dueH && now.getMinutes() >= dueM);
            const emoji = getCleaningEmoji(cat?.name ?? "");
            return (
              <Tooltip key={schedule.id}>
                      <TooltipTrigger asChild>
                        <button
                    type="button"
                    disabled={toggleCleaning.isPending}
                    onClick={() => {
                      if (!sessionUser) return;
                      toggleCleaning.mutate({
                        scheduleId: schedule.id,
                        date: todayKey,
                        userId: sessionUser.id,
                        isCompleted: isDone
                      });
                    }}
                    className={cn("flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition border-4",

                    isDone && "border-success bg-success/10",
                    isOverdue && "border-destructive bg-destructive/10",
                    !isDone && !isOverdue && "border-border bg-card"
                    )}>

                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[8px]">{initials(member?.display_name ?? "?")}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium leading-none">{member?.display_name?.split(" ")[0]}</span>
                          <span className="text-base leading-none">{emoji}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{member?.display_name} • {cat?.name} • até {dueTimeStr}</TooltipContent>
                    </Tooltip>);

          })}
              </div>
        }

            {/* Tarefas Atrasadas - Widget Vermelho */}
            {overdueTasks.length > 0 && <div className="space-y-2">
                <p className="text-xs font-medium text-destructive uppercase tracking-wide">Atrasadas</p>
                {overdueTasks.map((t) => {
            const members = allAssigneesByTaskId.get(t.id) ?? [];
            const person = teamByUserId.get(t.assigned_user_id);
            const client = clientsById.get(t.client_id);
            const stageLabel = STAGES.find((s) => s.key === t.stage)?.label ?? t.stage;
            const daysLate = differenceInCalendarDays(today, new Date(`${t.due_date}T00:00:00`));
            const displayMembers = members.length > 0 ? members : person ? [{
              user_id: person.user_id,
              display_name: person.display_name,
              avatar_url: person.avatar_url
            }] : [];
            const primaryDisplayMember = displayMembers[0];
            return <div key={t.id} onClick={() => handleTaskClick(t)} className="flex items-center gap-3 rounded-lg bg-destructive px-3 py-2 cursor-pointer hover:opacity-90 transition-opacity">
                      {displayMembers.length > 1 ? <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex -space-x-2 shrink-0">
                              {displayMembers.slice(0, 3).map((m) => <Avatar key={m.user_id} className="h-8 w-8 border-2 border-destructive-foreground/30">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px] bg-destructive-foreground/20 text-destructive-foreground">{initials(m.display_name)}</AvatarFallback>
                                </Avatar>)}
                              {displayMembers.length > 3 && <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-destructive-foreground/30 bg-destructive-foreground/20 text-destructive-foreground text-xs">
                                  +{displayMembers.length - 3}
                                </div>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="space-y-1">
                              {displayMembers.map((m) => <div key={m.user_id} className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={m.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[8px]">{initials(m.display_name)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs">{m.display_name}</span>
                                </div>)}
                            </div>
                          </TooltipContent>
                        </Tooltip> : <Avatar className="h-8 w-8 border-2 border-destructive-foreground/30">
                          <AvatarImage src={primaryDisplayMember?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-destructive-foreground/20 text-destructive-foreground">{initials(primaryDisplayMember?.display_name ?? person?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-destructive-foreground leading-5">
                          <span className="block sm:inline truncate">{displayMembers.length > 1 ? displayMembers.map((m) => m.display_name).join(", ") : primaryDisplayMember?.display_name ?? person?.display_name}</span>
                          <span className="hidden sm:inline">{" "}•{" "}</span>
                          <span className="block sm:inline text-xs sm:text-sm opacity-90 truncate">({resolveClientName(t)}) • {stageLabel}</span>
                        </p>
                      </div>
                      <span className="text-sm font-bold text-destructive-foreground shrink-0">
                        {daysLate} {daysLate === 1 ? "dia" : "dias"}
                      </span>
                    </div>;
          })}
              </div>}

            {/* Tarefas de Hoje (Pendentes/Em Andamento) - Widget Branco */}
            {todayPendingTasks.length > 0 && (() => {
              // Agrupar tarefas por pessoa (cada tarefa pode aparecer em múltiplas colunas se tiver múltiplos responsáveis)
              type PersonGroup = {
                user_id: string;
                display_name: string;
                avatar_url: string | null;
                tasks: typeof todayPendingTasks;
              };
              const groupsMap = new Map<string, PersonGroup>();
              const unassigned: typeof todayPendingTasks = [];
              for (const t of todayPendingTasks) {
                const members = allAssigneesByTaskId.get(t.id) ?? [];
                const person = teamByUserId.get(t.assigned_user_id);
                const displayMembers = members.length > 0 ? members : person ? [{
                  user_id: person.user_id,
                  display_name: person.display_name,
                  avatar_url: person.avatar_url
                }] : [];
                if (displayMembers.length === 0) {
                  unassigned.push(t);
                  continue;
                }
                for (const m of displayMembers) {
                  const existing = groupsMap.get(m.user_id);
                  if (existing) {
                    existing.tasks.push(t);
                  } else {
                    groupsMap.set(m.user_id, {
                      user_id: m.user_id,
                      display_name: m.display_name,
                      avatar_url: m.avatar_url,
                      tasks: [t]
                    });
                  }
                }
              }
              const groups = Array.from(groupsMap.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
              if (unassigned.length > 0) {
                groups.push({ user_id: "__unassigned__", display_name: "Sem responsável", avatar_url: null, tasks: unassigned });
              }
              const colCount = groups.length;
              const gridColsClass = colCount <= 1
                ? "grid-cols-1"
                : colCount === 2
                ? "grid-cols-1 md:grid-cols-2"
                : colCount === 3
                ? "grid-cols-1 md:grid-cols-3"
                : colCount === 4
                ? "grid-cols-2 md:grid-cols-4"
                : colCount === 5
                ? "grid-cols-2 md:grid-cols-5"
                : "grid-cols-2 md:grid-cols-3 xl:grid-cols-6";
              const dense = colCount >= 4;
              const veryDense = colCount >= 6;
              return <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isCurrentMonth ? "Hoje" : "Pendentes"}
                </p>
                <div className={cn("grid gap-3", gridColsClass)}>
                  {groups.map((g) => (
                    <div key={g.user_id} className="rounded-xl border border-border bg-card/50 p-3 min-w-0 flex flex-col">
                      {/* Header com foto ao lado do nome */}
                      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-border">
                        <Avatar className={cn("shrink-0", veryDense ? "h-10 w-10" : dense ? "h-12 w-12" : "h-14 w-14")}>
                          <AvatarImage src={g.avatar_url ?? undefined} />
                          <AvatarFallback>{initials(g.display_name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className={cn("font-bold truncate", veryDense ? "text-sm" : dense ? "text-base" : "text-lg")}>
                            {g.display_name}
                          </p>
                          <span className="text-xs text-muted-foreground">{g.tasks.length} {g.tasks.length === 1 ? "tarefa" : "tarefas"}</span>
                        </div>
                      </div>
                      {/* Tarefas da pessoa */}
                      <div className="flex flex-col gap-2.5 flex-1">
                        {g.tasks.map((t) => {
                          const stageAbbr = STAGE_ABBR[t.stage] ?? t.stage.toUpperCase().slice(0, 4);
                          const stageBg = STAGE_BADGE_BG[t.stage] ?? "bg-muted";
                          return (
                            <div
                              key={t.id}
                              onClick={() => handleTaskClick(t)}
                              className={cn(
                                "flex items-center gap-2 rounded-lg border border-border bg-card cursor-pointer hover:bg-accent/50 transition-colors min-w-0",
                                veryDense ? "px-2.5 py-2" : dense ? "px-3 py-2.5" : "px-4 py-3"
                              )}
                            >
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center rounded-md font-bold tracking-wide text-white shrink-0",
                                  stageBg,
                                  veryDense ? "h-6 px-2 text-[10px]" : dense ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm"
                                )}
                              >
                                {stageAbbr}
                              </span>
                              <p className={cn("font-semibold leading-tight truncate flex-1 min-w-0", veryDense ? "text-sm" : dense ? "text-base" : "text-lg")}>
                                {resolveClientName(t)}
                              </p>
                              {t.status === "em_andamento" && !veryDense && (
                                <Badge variant="warning" className={cn("shrink-0", dense ? "text-[10px] px-1.5 py-0 h-4" : "text-xs px-2 py-0.5 h-5")}>
                                  Em and.
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>;
            })()}

            {/* Tarefas Concluídas - Widget Verde */}
            {todayCompletedTasks.length > 0 && <div className="space-y-2">
                <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Concluídas</p>
                {todayCompletedTasks.map((t) => {
            const members = allAssigneesByTaskId.get(t.id) ?? [];
            const person = teamByUserId.get(t.assigned_user_id);
            const client = clientsById.get(t.client_id);
            const stageLabel = STAGES.find((s) => s.key === t.stage)?.label ?? t.stage;
            const displayMembers = members.length > 0 ? members : person ? [{
              user_id: person.user_id,
              display_name: person.display_name,
              avatar_url: person.avatar_url
            }] : [];
            const primaryDisplayMember = displayMembers[0];
            return <div key={t.id} onClick={() => handleTaskClick(t)} className="flex items-center gap-3 rounded-lg bg-success px-3 py-2 cursor-pointer hover:opacity-90 transition-opacity">
                      {displayMembers.length > 1 ? <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex -space-x-2 shrink-0">
                              {displayMembers.slice(0, 3).map((m) => <Avatar key={m.user_id} className="h-8 w-8 border-2 border-success-foreground/30">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px] bg-success-foreground/20 text-success-foreground">{initials(m.display_name)}</AvatarFallback>
                                </Avatar>)}
                              {displayMembers.length > 3 && <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-success-foreground/30 bg-success-foreground/20 text-success-foreground text-xs">
                                  +{displayMembers.length - 3}
                                </div>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <div className="space-y-1">
                              {displayMembers.map((m) => <div key={m.user_id} className="flex items-center gap-2">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={m.avatar_url ?? undefined} />
                                    <AvatarFallback className="text-[8px]">{initials(m.display_name)}</AvatarFallback>
                                  </Avatar>
                                  <span className="text-xs">{m.display_name}</span>
                                </div>)}
                            </div>
                          </TooltipContent>
                        </Tooltip> : <Avatar className="h-8 w-8 border-2 border-success-foreground/30">
                          <AvatarImage src={primaryDisplayMember?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-success-foreground/20 text-success-foreground">{initials(primaryDisplayMember?.display_name ?? person?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-success-foreground leading-5">
                          <span className="block sm:inline truncate">{displayMembers.length > 1 ? displayMembers.map((m) => m.display_name).join(", ") : primaryDisplayMember?.display_name ?? person?.display_name}</span>
                          <span className="hidden sm:inline">{" "}•{" "}</span>
                          <span className="block sm:inline text-xs sm:text-sm opacity-90 truncate">({resolveClientName(t)}) • {stageLabel}</span>
                        </p>
                      </div>
                      <span className="text-sm font-bold text-success-foreground shrink-0">
                        ✓
                      </span>
                    </div>;
          })}
              </div>}

            {/* Mensagem quando não há tarefas */}
            {todayPendingTasks.length === 0 && todayCompletedTasks.length === 0 && overdueTasks.length === 0 && todayCleaningTasks.length === 0 && <p className="text-muted-foreground text-center py-4">
                {isCurrentMonth ? "Nenhuma tarefa para hoje 🎉" : "Nenhuma tarefa neste mês"}
              </p>}
           </CardContent>
         </Card> : (
    /* ─── Conclusão de Tarefas ─── */
    <Card className={cn(isFullscreen && "flex flex-col flex-1 min-h-[calc(100vh-140px)]")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                The Best Uau
              </CardTitle>
              <CardDescription>
                {format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", { locale: ptBR })}
              </CardDescription>
            </CardHeader>
            <CardContent className={cn("space-y-3", isFullscreen && "flex-1")}>
              {/* Header das colunas — hidden on mobile */}
              <div className="hidden sm:flex items-center gap-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="w-8 text-center shrink-0">#</span>
                <span className="w-8 shrink-0" />
                <span className="w-20 shrink-0">Nome</span>
                <span className="w-14 text-center shrink-0">Total</span>
                <span className="w-14 text-center shrink-0">Feitos</span>
                <span className="w-14 text-center shrink-0">Pend.</span>
                <div className="flex-1 min-w-0 text-center">% Conclusão</div>
                <span className="w-14 text-center shrink-0">Pts</span>
                
              </div>
              {filteredRank.map((row, idx) => {
          const member = teamByUserId.get(row.user_id);
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`;
          const pending = allPendingByUser.get(row.user_id) ?? 0;
          const posChange = rankVariation.get(row.user_id) ?? 0;
          const hasChange = rankVariation.has(row.user_id);
          return (
            <div key={row.user_id} className={cn("rounded-lg sm:rounded-none border sm:border-0 border-border/40 p-2.5 sm:p-0", isFullscreen ? "py-3" : "sm:py-1")}>
                      {/* Desktop layout */}
                      <div className="hidden sm:flex items-center gap-3">
                        <span className={cn("w-8 text-center font-semibold shrink-0", isFullscreen ? "text-lg" : "text-sm")}>{medal}</span>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={member?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[10px]">{initials(member?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <span className="w-20 truncate shrink-0 text-sm font-medium">{member?.display_name?.split(" ")[0] ?? "—"}</span>
                        <span className="w-14 text-center shrink-0 text-sm font-medium">{row.taskTotal}</span>
                        <span className="w-14 text-center shrink-0 text-sm font-semibold text-success">{row.taskCompleted}</span>
                        <span className="w-14 text-center shrink-0 text-sm font-semibold text-warning">{pending}</span>
                        <div className="flex-1 min-w-0">
                          <div className="relative w-full rounded-full bg-muted/50 overflow-hidden h-6">
                            <div className="absolute inset-y-0 left-0 rounded-full bg-success transition-all duration-500" style={{ width: `${row.completionPct}%` }} />
                            <div className="absolute inset-0 flex items-center justify-end pr-3">
                              <span className="font-bold tabular-nums text-foreground text-xs">{row.completionPct}%</span>
                            </div>
                          </div>
                        </div>
                        <span className="w-14 text-center shrink-0 text-sm font-bold">{row.total}</span>
                      </div>
                      {/* Mobile layout */}
                      <div className="flex sm:hidden items-center gap-2.5">
                        <span className="text-sm font-semibold shrink-0">{medal}</span>
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarImage src={member?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px]">{initials(member?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{member?.display_name?.split(" ")[0] ?? "—"}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className="text-success font-semibold">{row.taskCompleted}/{row.taskTotal}</span>
                            <span>•</span>
                            <span>{row.completionPct}%</span>
                            <span>•</span>
                            <span className="font-bold text-foreground">{row.total}pts</span>
                          </div>
                        </div>
                        <div className="relative w-10 h-10 shrink-0">
                          <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                            <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                            <circle cx="18" cy="18" r="15" fill="none" stroke="hsl(var(--success))" strokeWidth="3" strokeDasharray={`${row.completionPct * 0.9425} 94.25`} strokeLinecap="round" />
                          </svg>
                          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold">{row.completionPct}%</span>
                        </div>
                      </div>
                    </div>);

        })}

              {monthlyRank.length === 0 &&
        <p className="text-muted-foreground text-center py-4">Nenhum dado de performance para este mês</p>
        }
            </CardContent>
          </Card>)
    }
     {selectedPmTaskId && <PmTaskDetailDialogDayView taskId={selectedPmTaskId} onClose={() => setSelectedPmTaskId(null)} />}
    </div>;
}

function PmTaskDetailDialogDayView({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const pmTasksQ = usePmTasks();
  const allTasks = pmTasksQ.data ?? [];
  const task = useMemo(() => allTasks.find((t) => t.id === taskId) ?? null, [taskId, allTasks]);
  const teamQ = useTeamMembers();
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
  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    (teamQ.data ?? []).forEach((tm) => { m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined }; });
    return m;
  }, [teamQ.data]);
  const membersList = useMemo(() => (teamQ.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name })), [teamQ.data]);

  const { data: roleData } = useQuery({
    queryKey: ["my_role_dayview"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });
  const isAdmin = roleData?.role === "admin";

  return (
    <PmTaskDetailDialog task={task} open={!!task} onClose={onClose} clientsMap={clientsMap} membersMap={membersMap} members={membersList} isAdmin={isAdmin} />
  );
}