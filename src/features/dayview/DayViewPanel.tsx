import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      const endDate = `${monthKey}-31`;
      const { data, error } = await supabase
        .from("pm_tasks")
        .select("id, title, client_id, assignee_id, watchers, due_date, stage_current, status_global, is_extra_demand, parent_task_id")
        .is("parent_task_id", null)
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

  // ─── PM child tasks count per parent ───
  const pmChildCountQ = useQuery({
    queryKey: ["pm_child_count_for_dayview", monthKey],
    queryFn: async () => {
      const parentIds = (pmTasksQ.data ?? []).map(t => t.id);
      if (!parentIds.length) return new Map<string, number>();
      const { data, error } = await supabase
        .from("pm_tasks")
        .select("parent_task_id")
        .in("parent_task_id", parentIds);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        if (row.parent_task_id) {
          counts.set(row.parent_task_id, (counts.get(row.parent_task_id) ?? 0) + 1);
        }
      }
      return counts;
    },
    enabled: (pmTasksQ.data ?? []).length > 0,
  });

  // ─── Cleaning ───
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
  "profiles"]
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

  // Task completion stats per user (total assigned vs completed) — includes subtasks
  const taskStatsByUser = useMemo(() => {
    const tasks = tasksQ.data ?? [];
    const assignees = assigneesQ.data ?? [];
    const subtasks = pmSubtasksQ.data ?? [];
    const stats = new Map<string, {total: number;completed: number;}>();

    const addItem = (userId: string, isCompleted: boolean) => {
      const prev = stats.get(userId) ?? { total: 0, completed: 0 };
      prev.total += 1;
      if (isCompleted) prev.completed += 1;
      stats.set(userId, prev);
    };

    for (const t of tasks) {
      const taskAssignees = assignees.filter((a) => a.task_id === t.id);
      if (taskAssignees.length > 0) {
        for (const a of taskAssignees) {
          addItem(a.user_id, t.status === "concluido");
        }
      } else {
        addItem(t.assigned_user_id, t.status === "concluido");
      }
    }

    // Add pm_subtasks
    for (const st of subtasks) {
      if (!st.assignee_id) continue;
      addItem(st.assignee_id, st.status === "concluido");
    }

    return stats;
  }, [tasksQ.data, assigneesQ.data, pmSubtasksQ.data]);

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

  // ─── Streak: dias consecutivos concluindo tarefas dentro do prazo ───
  const streakByUser = useMemo(() => {
    const tasks = tasksQ.data ?? [];
    const assignees = assigneesQ.data ?? [];
    const map = new Map<string, number>();

    // Agrupa tarefas concluídas por user+date
    const userDays = new Map<string, Set<string>>();
    // Agrupa tarefas atrasadas (concluídas após due_date) por user+date
    const userLateDays = new Map<string, Set<string>>();

    const addTaskForUser = (userId: string, t: typeof tasks[0]) => {
      if (t.status !== "concluido") return;
      const completedDate = t.completed_at ? format(new Date(t.completed_at), "yyyy-MM-dd") : t.due_date;
      const isOnTime = completedDate <= t.due_date;

      if (!userDays.has(userId)) userDays.set(userId, new Set());
      userDays.get(userId)!.add(t.due_date);

      if (!isOnTime) {
        if (!userLateDays.has(userId)) userLateDays.set(userId, new Set());
        userLateDays.get(userId)!.add(t.due_date);
      }
    };

    for (const t of tasks) {
      const taskAssignees = assignees.filter((a) => a.task_id === t.id);
      if (taskAssignees.length > 0) {
        for (const a of taskAssignees) addTaskForUser(a.user_id, t);
      } else {
        addTaskForUser(t.assigned_user_id, t);
      }
    }

    // Para cada user, conta dias consecutivos até hoje sem atraso
    for (const [userId, days] of userDays) {
      const lateDays = userLateDays.get(userId) ?? new Set();
      let streak = 0;
      const d = new Date(todayKey + "T12:00:00");
      for (let i = 0; i < 60; i++) {
        const key = format(d, "yyyy-MM-dd");
        if (days.has(key) && !lateDays.has(key)) {
          streak++;
        } else if (days.has(key) && lateDays.has(key)) {
          break;
        }
        d.setDate(d.getDate() - 1);
      }
      map.set(userId, streak);
    }

    return map;
  }, [tasksQ.data, assigneesQ.data, todayKey]);

  // Ranking com todos os membros (sem filtro)
  const filteredRank = monthlyRank;

  // Rastreia posição anterior para mostrar setas de subida/descida
  const prevRankMap = useRef(new Map<string, number>());
  useEffect(() => {
    // Atualiza o mapa anterior após a renderização
    const timer = setTimeout(() => {
      const map = new Map<string, number>();
      filteredRank.forEach((r, i) => map.set(r.user_id, i));
      prevRankMap.current = map;
    }, 2000); // Delay para permitir visualização das setas
    return () => clearTimeout(timer);
  }, [filteredRank]);

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
    return map;
  }, [assigneesQ.data, teamByUserId]);

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
  };

  const unifiedTasks = useMemo(() => {
    const agendaTasks: UnifiedTask[] = (tasksQ.data ?? []).map(t => ({
      ...t,
      source: "agenda" as const,
    }));

    // pm_tasks that DON'T have a snapshot in the agenda tasks (avoid duplicates)
    const agendaDescriptions = new Set(agendaTasks.map(t => t.title).filter(Boolean));
    const childCounts = pmChildCountQ.data ?? new Map<string, number>();
    
    const pmTasks: UnifiedTask[] = (pmTasksQ.data ?? [])
      .filter(t => {
        // Skip if there's already an agenda snapshot for this pm_task
        const pmDesc = `pm:${t.id}:`;
        return !(tasksQ.data ?? []).some(at => at.description?.startsWith(pmDesc));
      })
      .map(t => ({
        id: `pm_${t.id}`,
        client_id: t.client_id,
        assigned_user_id: t.assignee_id ?? "",
        due_date: t.due_date ?? "",
        status: t.status_global === "concluido" ? "concluido" : "pendente",
        stage: t.stage_current,
        title: t.title,
        is_extra_demand: t.is_extra_demand,
        completed_at: null,
        source: "pm" as const,
        subtaskCount: childCounts.get(t.id) ?? 0,
      }));

    return [...agendaTasks, ...pmTasks];
  }, [tasksQ.data, pmTasksQ.data, pmChildCountQ.data]);

  // Tarefas de hoje (exceto concluídas - elas vão separadas)
  const todayPendingTasks = useMemo(() => {
    const tasks = unifiedTasks.filter((t) => {
      if (!t.due_date) return false;
      if (!isCurrentMonth) return t.status !== "concluido";
      return t.due_date === todayKey && t.status !== "concluido";
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
    const tasks = unifiedTasks.filter((t) => {
      if (!t.due_date) return false;
      if (!isCurrentMonth) return t.status === "concluido";
      return t.due_date === todayKey && t.status === "concluido";
    });
    return tasks.sort((a, b) => {
      const na = teamByUserId.get(a.assigned_user_id)?.display_name ?? "";
      const nb = teamByUserId.get(b.assigned_user_id)?.display_name ?? "";
      return na.localeCompare(nb);
    });
  }, [unifiedTasks, todayKey, teamByUserId, isCurrentMonth]);
  const overdueTasks = useMemo(() => {
    return unifiedTasks.filter((t) => t.status !== "concluido" && t.due_date && t.due_date < todayKey).sort((a, b) => a.due_date.localeCompare(b.due_date));
  }, [unifiedTasks, todayKey]);
  const completedTasksCount = useMemo(() => unifiedTasks.filter((t) => t.status === "concluido").length, [unifiedTasks]);
  const totalTasks = unifiedTasks.length + (pmChildCountQ.data ? Array.from(pmChildCountQ.data.values()).reduce((a, b) => a + b, 0) : 0);

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
            const members = assigneesByTaskId.get(t.id) ?? [];
            const person = teamByUserId.get(t.assigned_user_id);
            const client = clientsById.get(t.client_id);
            const stageLabel = STAGES.find((s) => s.key === t.stage)?.label ?? t.stage;
            const daysLate = differenceInCalendarDays(today, new Date(`${t.due_date}T00:00:00`));
            const displayMembers = members.length > 0 ? members : person ? [{
              user_id: person.user_id,
              display_name: person.display_name,
              avatar_url: person.avatar_url
            }] : [];
            return <div key={t.id} className="flex items-center gap-3 rounded-lg bg-destructive px-3 py-2">
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
                          <AvatarImage src={person?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-destructive-foreground/20 text-destructive-foreground">{initials(person?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-destructive-foreground leading-5">
                          <span className="block sm:inline truncate">{displayMembers.length > 1 ? displayMembers.map((m) => m.display_name).join(", ") : person?.display_name}</span>
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
            {todayPendingTasks.length > 0 && <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {isCurrentMonth ? "Hoje" : "Pendentes"}
                </p>
                {todayPendingTasks.map((t) => {
            const members = assigneesByTaskId.get(t.id) ?? [];
            const person = teamByUserId.get(t.assigned_user_id);
            const client = clientsById.get(t.client_id);
            const stageLabel = STAGES.find((s) => s.key === t.stage)?.label ?? t.stage;
            const displayMembers = members.length > 0 ? members : person ? [{
              user_id: person.user_id,
              display_name: person.display_name,
              avatar_url: person.avatar_url
            }] : [];
            return <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      {displayMembers.length > 1 ? <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex -space-x-2 shrink-0">
                              {displayMembers.slice(0, 3).map((m) => <Avatar key={m.user_id} className="h-8 w-8 border-2 border-background">
                                  <AvatarImage src={m.avatar_url ?? undefined} />
                                  <AvatarFallback className="text-[10px]">{initials(m.display_name)}</AvatarFallback>
                                </Avatar>)}
                              {displayMembers.length > 3 && <div className="h-8 w-8 flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground text-xs">
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
                        </Tooltip> : <Avatar className="h-8 w-8">
                          <AvatarImage src={person?.avatar_url ?? undefined} />
                          <AvatarFallback>{initials(person?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-5">
                          <span className="block sm:inline truncate">{displayMembers.length > 1 ? displayMembers.map((m) => m.display_name).join(", ") : person?.display_name}</span>
                          <span className="hidden sm:inline">{" "}•{" "}</span>
                          <span className="block sm:inline text-xs sm:text-sm text-muted-foreground truncate">({resolveClientName(t)}) • {stageLabel}</span>
                        </p>
                      </div>
                      <Badge variant={t.status === "em_andamento" ? "warning" : "secondary"} className="text-xs shrink-0">
                        {t.status === "em_andamento" ? "Em andamento" : "Pendente"}
                      </Badge>
                    </div>;
          })}
              </div>}

            {/* Tarefas Concluídas - Widget Verde */}
            {todayCompletedTasks.length > 0 && <div className="space-y-2">
                <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">Concluídas</p>
                {todayCompletedTasks.map((t) => {
            const members = assigneesByTaskId.get(t.id) ?? [];
            const person = teamByUserId.get(t.assigned_user_id);
            const client = clientsById.get(t.client_id);
            const stageLabel = STAGES.find((s) => s.key === t.stage)?.label ?? t.stage;
            const displayMembers = members.length > 0 ? members : person ? [{
              user_id: person.user_id,
              display_name: person.display_name,
              avatar_url: person.avatar_url
            }] : [];
            return <div key={t.id} className="flex items-center gap-3 rounded-lg bg-success px-3 py-2">
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
                          <AvatarImage src={person?.avatar_url ?? undefined} />
                          <AvatarFallback className="bg-success-foreground/20 text-success-foreground">{initials(person?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-success-foreground leading-5">
                          <span className="block sm:inline truncate">{displayMembers.length > 1 ? displayMembers.map((m) => m.display_name).join(", ") : person?.display_name}</span>
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
                <span className="w-5 shrink-0" />
              </div>
              {filteredRank.map((row, idx) => {
          const member = teamByUserId.get(row.user_id);
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}º`;
          const pending = row.taskTotal - row.taskCompleted;
          const prevPos = prevRankMap.current.get(row.user_id);
          const posChange = prevPos !== undefined ? prevPos - idx : 0;
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
                        <div className="w-10 shrink-0 flex items-center justify-center gap-0.5">
                          {posChange > 0 ? <ArrowUp className="h-3.5 w-3.5 text-success" /> :
                  posChange < 0 ? <ArrowDown className="h-3.5 w-3.5 text-destructive" /> :
                  (streakByUser.get(row.user_id) ?? 0) >= 1 ?
                  <Tooltip>
                    <TooltipTrigger asChild><span className="text-base leading-none cursor-default">⚡</span></TooltipTrigger>
                    <TooltipContent side="top">🔥 {streakByUser.get(row.user_id)} dias consecutivos no prazo!</TooltipContent>
                  </Tooltip> :
                  <span className="text-muted-foreground text-[10px]">–</span>}
                        </div>
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
    </div>;
}