import { useEffect, useMemo, useRef, useState } from "react";
import { endOfMonth, format, getDay, addMonths, subMonths, isSameMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ListChecks, CheckCircle2, Clock, AlertTriangle, Activity, Trophy, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/avatar/UserAvatar";

import { useClients, useSetTaskStatus, useTasks, useTeamMembers } from "@/features/data/queries";
import { STAGES } from "@/lib/uau";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MeuPainelTasksGroupedCard, type MeuPainelTaskVM } from "@/features/meu-painel/components/MeuPainelTasksGroupedCard";
import { useMyMonthlyPerformanceRank } from "@/features/meu-painel/hooks/use-my-monthly-performance-rank";
import { MeuPainelPerformanceRankCard } from "@/features/meu-painel/components/MeuPainelPerformanceRankCard";
import { MeuPainelMagicNumberCard } from "@/features/meu-painel/components/MeuPainelMagicNumberCard";
import { useNow } from "@/hooks/use-now";
import { NotesWidget } from "@/features/meu-painel/components/NotesWidget";
import { TodayInstagramLoopWidget } from "@/features/meu-painel/components/TodayInstagramLoopWidget";
import { MyPmTasksWidget } from "@/features/meu-painel/components/MyPmTasksWidget";
import { PmTaskDetailDialog } from "@/features/gestao/components/PmTaskDetailDialog";
import { openTaskInCalendario } from "@/features/calendario/open-in-calendario";
import { usePmTasks } from "@/features/gestao/hooks/use-pm-data";
import { useQuery } from "@tanstack/react-query";
import { ProductivityWidget } from "@/features/meu-painel/components/ProductivityWidget";
import { WorkBreakdownWidget } from "@/features/meu-painel/components/WorkBreakdownWidget";
import { SmartFeedbackWidget } from "@/features/meu-painel/components/SmartFeedbackWidget";
import { DayQuickView } from "@/features/meu-painel/components/DayQuickView";
import { BottleneckWidget } from "@/features/meu-painel/components/BottleneckWidget";
import { MetricSparkCard } from "@/features/meu-painel/components/MetricSparkCard";
import { MetricTaskListSheet } from "@/features/meu-painel/components/MetricTaskListSheet";
import { LateAppealDialog } from "@/features/tasks/LateAppealDialog";
import { isTaskLate } from "@/features/tasks/is-task-late";

import {
  useCleaningSchedules,
  useCleaningCategories,
  useCleaningCompletions,
  useToggleCleaningCompletion,
} from "@/features/cleaning/hooks/use-cleaning";
import { useMyProfile } from "@/hooks/use-my-profile";
import { useMyDashboardLayout, type BlockWidth, type DashboardBlockKey } from "@/features/meu-painel/hooks/use-dashboard-layout";
import { PersonalizeDashboardDialog } from "@/features/meu-painel/components/PersonalizeDashboardDialog";
import { getPendingMeuPainelAction, setPendingMeuPainelAction, subscribePendingMeuPainelAction } from "@/lib/pending-meu-painel-action-store";

// ── Helpers ──────────────────────────────────────────────

function getMagicSyncedMonthYear(now: Date) {
  const day = now.getDate();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (day < 28) return { year: y, month: m };
  if (m < 12) return { year: y, month: m + 1 };
  return { year: y + 1, month: 1 };
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
function firstName(name: string) {
  return name.trim().split(" ").filter(Boolean)[0] ?? name;
}
function greetingForHour(hour: number) {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}
function hashStringToInt(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const motivationalLines = [
  "Nem todo dia vai ser produtivo… mas todo dia dá pra não desistir.",
  "Disciplina não é sobre estar motivado. É sobre ir mesmo sem vontade.",
  "Você não precisa acertar tudo. Só não pode parar.",
  "Tem dia que o foco é sobreviver ao dia. E tá tudo bem.",
  "Constância é chata… até começar a dar resultado.",
  "Se fosse fácil, não valia tanto.",
  "Você já passou por coisa pior. Não é hoje que você vai travar.",
  "Resultado bom não vem de um dia incrível. Vem de vários dias normais bem feitos.",
  "Faz o que dá. Faz direito. E segue.",
  "A maioria desiste antes de ver o resultado. Você não é a maioria.",
  "Nem sempre vai parecer que tá avançando. Mas tá.",
  "Foco não é fazer tudo. É saber o que ignorar.",
  "Hoje não precisa ser épico. Só precisa ser honesto.",
  "O segredo de quem entrega bem? Começa antes de ter vontade.",
  "Menos plano, mais ação. Ajusta no caminho.",
  "Quem espera a hora certa nunca começa.",
  "O trabalho chato de hoje é o case de amanhã.",
  "Fazer quando ninguém tá vendo é o que te diferencia.",
  "Se tá travado, diminui o passo. Mas não para.",
  "Não precisa correr. Precisa não sentar.",
  "O melhor momento pra começar era ontem. O segundo melhor é agora.",
  "Perfeição é desculpa bonita pra não entregar.",
  "Cada tarefa feita é uma micro-vitória. Coleciona elas.",
  "Progresso real é silencioso. Você só percebe olhando pra trás.",
  "O difícil de hoje vai ser o automático de amanhã.",
  "Cansaço não é sinal de fraqueza. É sinal de que você tá no jogo.",
  "Vai ter dia ruim. A ideia é não deixar o dia ruim virar semana ruim.",
  "Entrega boa não precisa de inspiração. Precisa de processo.",
  "Ninguém acordou talentoso. Acordou e treinou.",
  "Você não precisa estar pronto. Precisa estar disposto.",
  "Ritmo mata intensidade. Todo dia um pouco ganha de uma vez muito.",
  "O detalhe que você cuida hoje é o que o cliente elogia amanhã.",
  "Rotina não é prisão. É o chão que sustenta o extraordinário.",
  "A parte mais difícil já passou: você abriu isso aqui e vai trabalhar.",
  "Não subestime o poder de um dia comum bem aproveitado.",
  "Seu futuro eu vai agradecer o esforço de hoje. Confia.",
  "Menos reclamar, mais resolver. O resultado agradece.",
  "Tá difícil? Normal. Difícil é o preço de evoluir.",
  "Faz sem esperar aplauso. O resultado fala sozinho.",
  "Enquanto você tá aí pensando se vale a pena, alguém já começou.",
  "Organização não é frescura. É o que separa caos de resultado.",
  "Não é sobre ter o dia perfeito. É sobre aproveitar o dia possível.",
  "A diferença entre quem entrega e quem reclama? Atitude, só isso.",
  "Hoje o plano é simples: fazer o que precisa ser feito.",
  "Brilhar nos detalhes é o que transforma bom em memorável.",
];

const WIDTH_GROUP_SIZE: Record<BlockWidth, number> = { full: 1, half: 2, third: 3 };
const ROW_GRID_CLASS: Record<number, string> = {
  2: "grid grid-cols-1 items-stretch gap-4 md:grid-cols-2",
  3: "grid grid-cols-1 items-stretch gap-4 md:grid-cols-3",
};

// Agrupa em linhas quaisquer blocos CONSECUTIVOS com a MESMA largura definida (metade,
// terço) — qualquer bloco pode virar meio ou terço, não só um par fixo. Um grupo incompleto
// (ex.: só 2 blocos marcados como "terço" em sequência, sem um 3º pra fechar a linha) divide
// a linha igualmente entre os que tem, em vez de deixar um vão vazio. Usado tanto pro painel
// normal quanto pro modo de edição.
function computeRows(order: DashboardBlockKey[], widths: Record<DashboardBlockKey, BlockWidth>): DashboardBlockKey[][] {
  const rows: DashboardBlockKey[][] = [];
  let i = 0;
  while (i < order.length) {
    const w = widths[order[i]] ?? "full";
    if (w === "full") {
      rows.push([order[i]]);
      i += 1;
      continue;
    }
    const groupSize = WIDTH_GROUP_SIZE[w];
    const group: DashboardBlockKey[] = [];
    while (i < order.length && group.length < groupSize && (widths[order[i]] ?? "full") === w) {
      group.push(order[i]);
      i += 1;
    }
    rows.push(group);
  }
  return rows;
}

// ── Main Panel ───────────────────────────────────────────

export function MeuPainelPanel() {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);

  const [selectedPmTaskId, setSelectedPmTaskId] = useState<string | null>(null);
  const [confettiFired, setConfettiFired] = useState(false);
  const { visibleOrder: blockOrder, widths: savedWidths } = useMyDashboardLayout();
  const [personalizeOpen, setPersonalizeOpen] = useState(false);
  const [highlightPersonalize, setHighlightPersonalize] = useState(false);
  const personalizeBtnRef = useRef<HTMLButtonElement>(null);
  const today = useNow();
  const todayKey = format(today, "yyyy-MM-dd");

  const selected = useMemo(() => ({ year: today.getFullYear(), month: today.getMonth() + 1 }), [today]);
  const monthKey = useMemo(() => `${selected.year}-${String(selected.month).padStart(2, "0")}`, [selected.month, selected.year]);

  const perf = useMyMonthlyPerformanceRank({ userId: user?.id, year: selected.year, month: selected.month });
  const myProfileQ = useMyProfile();

  const teamMembersQ = useTeamMembers();
  const myTeamMember = useMemo(
    () => (teamMembersQ.data ?? []).find((member) => member.user_id === user?.id) ?? null,
    [teamMembersQ.data, user?.id]
  );
  const tasksQ = useTasks({ month: monthKey, assignedUserId: user?.id });
  const clientsQ = useClients();
  const setTaskStatus = useSetTaskStatus();
  const clientsById = useMemo(() => new Map((clientsQ.data ?? []).map((c) => [c.id, c] as const)), [clientsQ.data]);
  const myTasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);

  // Real Gestão tasks (pm_tasks) assigned to/watched by the user, due this month — what the
  // "Tarefas/Concluídas/Pendentes/Atrasadas" summary cards below count. They used to count
  // `myTasks` (the `tasks` table above), but that's a scoring/points snapshot that only gains
  // a row per scored stage transition — it undercounts real assigned work and didn't match
  // either its own "Total de tarefas atribuídas a você" description or the "Atribuídas a
  // mim" widget on this same page, which already reads from pm_tasks.
  const pmTasksForSummaryQ = usePmTasks();
  const monthEndKey = useMemo(() => format(endOfMonth(new Date(selected.year, selected.month - 1, 1)), "yyyy-MM-dd"), [selected]);
  const myMonthPmTasks = useMemo(() => {
    if (!user?.id) return [];
    return (pmTasksForSummaryQ.data ?? []).filter((t) =>
      (t.assignee_id === user.id || (t.watchers ?? []).includes(user.id)) &&
      t.status_global !== "cancelado" &&
      !(t as any).is_draft &&
      !!t.due_date && t.due_date >= `${monthKey}-01` && t.due_date <= monthEndKey
    );
  }, [pmTasksForSummaryQ.data, user?.id, monthKey, monthEndKey]);

  // ── Mês selecionado no widget "Por tipo de entrega" (independente do mês do painel) ──
  const [breakdownMonth, setBreakdownMonth] = useState(() => new Date());
  const breakdownIsCurrentMonth = isSameMonth(breakdownMonth, new Date());
  const [productivityTab, setProductivityTab] = useState<"geral" | "breakdown">("geral");

  // ── Cleaning ──
  const cleaningSchedulesQ = useCleaningSchedules();
  const cleaningCategoriesQ = useCleaningCategories();
  const cleaningCompletionsQ = useCleaningCompletions(todayKey);
  const toggleCleaning = useToggleCleaningCompletion();
  const todayDow = getDay(today);

  const myCleaningTasks = useMemo(() => {
    if (!user) return [];
    return (cleaningSchedulesQ.data ?? []).filter((s) => s.day_of_week === todayDow && s.user_id === user.id);
  }, [cleaningSchedulesQ.data, todayDow, user]);

  const cleaningCategoryById = useMemo(() => new Map((cleaningCategoriesQ.data ?? []).map((c) => [c.id, c])), [cleaningCategoriesQ.data]);
  const completedScheduleIds = useMemo(() => new Set((cleaningCompletionsQ.data ?? []).map((c) => c.schedule_id)), [cleaningCompletionsQ.data]);

  const cleaningVMs = useMemo((): MeuPainelTaskVM[] => {
    return myCleaningTasks.map((schedule) => {
      const cat = cleaningCategoryById.get(schedule.category_id);
      const isDone = completedScheduleIds.has(schedule.id);
      return {
        id: `cleaning:${schedule.id}`,
        clientName: cat?.name ?? "Limpeza",
        stageLabel: "🧹 Limpeza",
        stage: "captacao" as any,
        title: null,
        dueDate: todayKey,
        status: isDone ? "concluido" : ("pendente" as const),
        completedAt: null,
      };
    });
  }, [myCleaningTasks, cleaningCategoryById, completedScheduleIds, todayKey]);

  const todayTasks = useMemo(() => [...myTasks.filter((t) => t.due_date === todayKey), ...cleaningVMs.filter((c) => c.status !== "concluido")], [myTasks, todayKey, cleaningVMs]);
  const overdueTasks = useMemo(() => myTasks.filter((t) => t.status !== "concluido" && t.due_date < todayKey), [myTasks, todayKey]);
  const upcomingTasks = useMemo(() => myTasks.filter((t) => t.status !== "concluido" && t.due_date > todayKey), [myTasks, todayKey]);
  const completedTasks = useMemo(() => [...myTasks.filter((t) => t.status === "concluido"), ...cleaningVMs.filter((c) => c.status === "concluido")], [myTasks, cleaningVMs]);

  // Matches each card's own description: Concluídas = done, Atrasadas = open & past due,
  // Pendentes = open & "dentro do prazo" (not yet due) — mutually exclusive from Atrasadas.
  const summary = useMemo(() => {
    const done = myMonthPmTasks.filter((t) => t.status_global === "concluido").length;
    const overdue = myMonthPmTasks.filter((t) => t.status_global !== "concluido" && t.due_date! < todayKey).length;
    const pending = myMonthPmTasks.length - done - overdue;
    return { total: myMonthPmTasks.length, done, pending, overdue };
  }, [myMonthPmTasks, todayKey]);

  // Which metric card's task list is open in the side sheet, if any.
  const [metricSheet, setMetricSheet] = useState<"total" | "done" | "pending" | "overdue" | null>(null);
  const metricSheetTasks = useMemo(() => {
    switch (metricSheet) {
      case "done":
        return myMonthPmTasks.filter((t) => t.status_global === "concluido");
      case "overdue":
        return myMonthPmTasks.filter((t) => t.status_global !== "concluido" && t.due_date! < todayKey);
      case "pending":
        return myMonthPmTasks.filter((t) => t.status_global !== "concluido" && t.due_date! >= todayKey);
      case "total":
        return myMonthPmTasks;
      default:
        return [];
    }
  }, [metricSheet, myMonthPmTasks, todayKey]);
  const metricSheetTitle: Record<"total" | "done" | "pending" | "overdue", string> = {
    total: "Tarefas", done: "Concluídas", pending: "Pendentes", overdue: "Atrasadas",
  };
  const clientsNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientsQ.data ?? []).forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [clientsQ.data]);

  // ── Previous month for comparison ──
  const prevMonth = useMemo(() => {
    const pm = selected.month === 1 ? 12 : selected.month - 1;
    const py = selected.month === 1 ? selected.year - 1 : selected.year;
    return { year: py, month: pm };
  }, [selected]);
  const prevMonthKey = useMemo(() => `${prevMonth.year}-${String(prevMonth.month).padStart(2, "0")}`, [prevMonth]);
  const prevTasksQ = useTasks({ month: prevMonthKey, assignedUserId: user?.id });

  // ── Previous month rank ──
  const prevPerf = useMyMonthlyPerformanceRank({ userId: user?.id, year: prevMonth.year, month: prevMonth.month });

  // ── Team avg score ──
  const teamPerfQ = useQuery({
    queryKey: ["performance_scores_team_avg", selected.year, selected.month],
    queryFn: async () => {
      const { data } = await supabase.from("performance_scores").select("metas_prazos").eq("year", selected.year).eq("month", selected.month);
      if (!data || data.length === 0) return null;
      return Math.round((data.reduce((s, r) => s + Number(r.metas_prazos), 0) / data.length) * 10) / 10;
    },
    staleTime: 60_000,
  });
  const myScore = useMemo(() => Number(perf.total ?? 0), [perf.total]);

  // ── Qualitative scores for SmartFeedback ──
  const myQualitativeQ = useQuery({
    enabled: !!user?.id,
    queryKey: ["my_qualitative_scores", selected.year, selected.month, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("performance_scores")
        .select("padrao_qualidade_uau, comprometimento, ambiente_organizado, aprendizado_continuo")
        .eq("year", selected.year)
        .eq("month", selected.month)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data ?? null;
    },
    staleTime: 60_000,
  });

  // ── Previous month qualitative scores ──
  const prevQualitativeQ = useQuery({
    enabled: !!user?.id,
    queryKey: ["my_qualitative_scores", prevMonth.year, prevMonth.month, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("performance_scores")
        .select("padrao_qualidade_uau, comprometimento, ambiente_organizado, aprendizado_continuo")
        .eq("year", prevMonth.year)
        .eq("month", prevMonth.month)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data ?? null;
    },
    staleTime: 60_000,
  });

  // ── Annual qualitative average ──
  const annualQualitativeQ = useQuery({
    enabled: !!user?.id,
    queryKey: ["my_qualitative_annual", selected.year, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("performance_scores")
        .select("padrao_qualidade_uau, comprometimento, ambiente_organizado, aprendizado_continuo")
        .eq("year", selected.year)
        .eq("user_id", user!.id);
      if (!data || data.length === 0) return null;
      const count = data.length;
      return {
        padrao_qualidade_uau: Math.round((data.reduce((s, r) => s + r.padrao_qualidade_uau, 0) / count) * 10) / 10,
        comprometimento: Math.round((data.reduce((s, r) => s + r.comprometimento, 0) / count) * 10) / 10,
        ambiente_organizado: Math.round((data.reduce((s, r) => s + r.ambiente_organizado, 0) / count) * 10) / 10,
        aprendizado_continuo: Math.round((data.reduce((s, r) => s + r.aprendizado_continuo, 0) / count) * 10) / 10,
      };
    },
    staleTime: 60_000,
  });

  // ── Bottleneck data ──
  const pendingByStage = useMemo(() => {
    return myTasks.filter((t) => t.status !== "concluido").reduce((acc, t) => {
      acc[t.stage] = (acc[t.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [myTasks]);

  const myProfile = myProfileQ.data;
  const bannerPhotoUrl = myProfile?.banner_photo_url;

  const isBirthday = useMemo(() => {
    if (!myTeamMember?.birth_date) return false;
    const bd = new Date(myTeamMember.birth_date + "T12:00:00");
    return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
  }, [myTeamMember?.birth_date, todayKey]);

  useEffect(() => {
    if (isBirthday && !confettiFired) {
      setConfettiFired(true);
      const end = Date.now() + 3000;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#7C3AED", "#F59E0B", "#10B981", "#EF4444", "#3B82F6"] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#7C3AED", "#F59E0B", "#10B981", "#EF4444", "#3B82F6"] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [isBirthday, confettiFired]);

  const headerGreeting = useMemo(() => {
    const name = myProfile?.full_name ? firstName(myProfile.full_name) : "";
    if (isBirthday) return name ? `🎉 Feliz aniversário, ${name}!` : "🎉 Feliz aniversário!";
    return name ? `${greetingForHour(today.getHours())}, ${name}` : greetingForHour(today.getHours());
  }, [myProfile?.full_name, today, isBirthday]);

  const headerLine = useMemo(() => {
    if (isBirthday) return "Hoje é o seu dia especial! 🎂 Parabéns de toda a equipe! 🥳";
    const userSeed = user?.id ?? myProfile?.full_name ?? "anonymous";
    const seed = hashStringToInt(`${todayKey}:${userSeed}`);
    return motivationalLines[seed % motivationalLines.length] ?? motivationalLines[0];
  }, [myProfile?.full_name, todayKey, user?.id, isBirthday]);

  // ── Task handlers ──
  const onStart = async (taskId: string) => {
    if (!user) return;
    try {
      await setTaskStatus.mutateAsync({ taskId, status: "em_andamento", userId: user.id });
      toast.success("Em andamento! Bora manter o ritmo 🚀");
    } catch (e: any) { toast.error(e?.message ?? "Erro ao iniciar tarefa"); }
  };

  const [appealTask, setAppealTask] = useState<{ id: string; title: string; dueDate: string } | null>(null);

  const performComplete = async (taskId: string, next: "pendente" | "em_andamento" | "concluido") => {
    if (!user) return;
    await setTaskStatus.mutateAsync({ taskId, status: next, userId: user.id });
    toast.success(next === "concluido" ? "Concluída! ✔" : "Voltou para em andamento");
  };

  const onToggleComplete = async (taskId: string, current: "pendente" | "em_andamento" | "concluido") => {
    if (!user) return;
    if (taskId.startsWith("cleaning:")) {
      toggleCleaning.mutate({ scheduleId: taskId.replace("cleaning:", ""), date: todayKey, userId: user.id, isCompleted: current === "concluido" });
      return;
    }
    const next = current === "concluido" ? "em_andamento" : "concluido";
    // If completing a late task, ask for justification first
    if (next === "concluido") {
      const t = myTasks.find((x) => x.id === taskId);
      if (t && isTaskLate(t.due_date)) {
        setAppealTask({ id: t.id, title: t.title ?? "Tarefa", dueDate: t.due_date });
        return;
      }
    }
    try {
      await performComplete(taskId, next);
    } catch (e: any) { toast.error(e?.message ?? "Erro ao atualizar tarefa"); }
  };

  const toVM = (t: (typeof myTasks)[number] | MeuPainelTaskVM): MeuPainelTaskVM => {
    if ("clientName" in t) return t;
    const client = clientsById.get(t.client_id);
    const stageLabel = STAGES.find((s) => s.key === t.stage)?.label ?? t.stage;
    return { id: t.id, clientName: client?.name ?? "—", stageLabel, stage: t.stage, title: t.title, dueDate: t.due_date, status: t.status, completedAt: t.completed_at ?? null };
  };

  // Linhas do painel: blocos com a mesma largura definida (metade, terço) ficam lado a lado,
  // o resto ocupa a largura toda.
  const normalRows = useMemo(() => computeRows(blockOrder, savedWidths), [blockOrder, savedWidths]);

  // Consome um pedido de "destacar o botão de personalizar" feito por outra parte do app
  // (ex.: o aviso de novidade no topo) — rola até o botão e acende o contorno em degradê
  // por alguns segundos, sem abrir o diálogo de personalização sozinho. Pode ter sido
  // guardado antes deste painel existir, então checa o valor pendente já no mount e
  // também escuta atualizações posteriores.
  useEffect(() => {
    const consume = (action: string | null) => {
      if (action === "highlight_personalize") {
        setPendingMeuPainelAction(null);
        requestAnimationFrame(() => {
          personalizeBtnRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        setHighlightPersonalize(true);
        window.setTimeout(() => {
          setHighlightPersonalize(false);
        }, 4000);
      }
    };
    consume(getPendingMeuPainelAction());
    return subscribePendingMeuPainelAction(consume);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderBlockBody = (key: DashboardBlockKey): React.ReactNode => {
    switch (key) {
      case "metrics":
        return (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricSparkCard label="Tarefas" value={summary.total} icon={<ListChecks className="h-5 w-5" />} tone="violet" description="Total de tarefas atribuídas a você neste mês, em qualquer etapa." onClick={() => setMetricSheet("total")} />
            <MetricSparkCard label="Concluídas" value={summary.done} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" description="Tarefas que você já finalizou neste mês." onClick={() => setMetricSheet("done")} />
            <MetricSparkCard label="Pendentes" value={summary.pending} icon={<Clock className="h-5 w-5" />} tone="amber" description="Tarefas ainda em aberto, dentro do prazo." onClick={() => setMetricSheet("pending")} />
            <MetricSparkCard label="Atrasadas" value={summary.overdue} icon={<AlertTriangle className="h-5 w-5" />} tone="red" description="Tarefas com prazo vencido que ainda não foram concluídas." onClick={() => setMetricSheet("overdue")} />
          </div>
        );
      case "tasks":
        return <MyPmTasksWidget onOpenTask={(taskId) => setSelectedPmTaskId(taskId)} />;
      case "instagram":
        return <TodayInstagramLoopWidget onOpenTask={(taskId) => setSelectedPmTaskId(taskId)} />;
      case "notes":
        return <NotesWidget />;
      case "productivity_breakdown":
        return (
          <CollapsibleWidget title="Sua produtividade" icon={<Activity className="h-4 w-4 text-sidebar" />}>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-b border-border px-4">
              <div className="flex items-center gap-5">
                <button
                  type="button"
                  onClick={() => setProductivityTab("geral")}
                  className={cn(
                    "border-b-2 py-2.5 text-xs font-semibold uppercase tracking-wide transition",
                    productivityTab === "geral" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  Visão geral
                </button>
                <button
                  type="button"
                  onClick={() => setProductivityTab("breakdown")}
                  className={cn(
                    "border-b-2 py-2.5 text-xs font-semibold uppercase tracking-wide transition",
                    productivityTab === "breakdown" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  Por tipo de entrega
                </button>
              </div>
              {productivityTab === "breakdown" && (
                <div className="flex shrink-0 items-center gap-1 pb-1.5">
                  <button
                    type="button"
                    onClick={() => setBreakdownMonth((d) => subMonths(d, 1))}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Mês anterior"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownMonth(new Date())}
                    disabled={breakdownIsCurrentMonth}
                    title={breakdownIsCurrentMonth ? undefined : "Voltar pro mês atual"}
                    className={cn("min-w-[92px] text-center text-xs font-medium text-muted-foreground", !breakdownIsCurrentMonth && "hover:text-foreground")}
                  >
                    {(() => {
                      const s = format(breakdownMonth, "MMMM yyyy", { locale: ptBR });
                      return s.charAt(0).toUpperCase() + s.slice(1);
                    })()}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBreakdownMonth((d) => addMonths(d, 1))}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Próximo mês"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            {productivityTab === "geral" ? (
              <ProductivityWidget tasks={myTasks} allMonthTasks={[...myTasks, ...(prevTasksQ.data ?? [])]} todayKey={todayKey} userId={user?.id} />
            ) : (
              <WorkBreakdownWidget allTasks={pmTasksForSummaryQ.data ?? []} month={breakdownMonth} userId={user?.id} />
            )}
          </CollapsibleWidget>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5">
      {/* ── 1. HEADER + RANK (um único banner com o degradê de ponta a ponta) ── */}
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards" }}>
        <div
          className="relative group overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1.5 hover:scale-[1.004]"
          style={{ borderRadius: 28, boxShadow: "0 8px 32px -8px hsl(var(--brand-glow-3) / 0.18), 0 0 0 1px hsl(var(--brand-glow-5) / 0.12), inset 0 0 0 1px rgba(255,255,255,0.06)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px -8px hsl(var(--brand-glow-3) / 0.32), 0 0 24px 2px hsl(var(--brand-glow-5) / 0.18), 0 0 0 1px hsl(var(--brand-glow-5) / 0.25), inset 0 0 0 1px rgba(255,255,255,0.10)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px -8px hsl(var(--brand-glow-3) / 0.18), 0 0 0 1px hsl(var(--brand-glow-5) / 0.12), inset 0 0 0 1px rgba(255,255,255,0.06)"; }}
        >
          <div className="absolute -inset-8 opacity-90" style={{ background: "linear-gradient(135deg, hsl(var(--brand-glow-1)) 0%, hsl(var(--brand-glow-2)) 25%, hsl(var(--brand-glow-3)) 50%, hsl(var(--brand-glow-4)) 75%, hsl(var(--brand-glow-1)) 100%)", backgroundSize: "300% 300%", animation: "gradientFlow 14s ease-in-out infinite" }} />
          <div className="absolute -inset-12 opacity-60" style={{ background: "radial-gradient(ellipse 70% 60% at 25% 35%, hsl(var(--brand-glow-5)) 0%, transparent 70%), radial-gradient(ellipse 55% 65% at 75% 65%, hsl(var(--brand-glow-4)) 0%, transparent 65%)", animation: "parallaxLayer2 12s ease-in-out infinite" }} />
          <div className="absolute -inset-16 opacity-50" style={{ background: "radial-gradient(circle 280px at 20% 70%, hsl(var(--brand-glow-3)) 0%, transparent 60%), radial-gradient(circle 220px at 80% 25%, hsl(var(--brand-glow-2)) 0%, transparent 55%)", filter: "blur(30px)", animation: "parallaxLayer3 9s ease-in-out infinite" }} />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "44px 44px", animation: "gridDrift 22s linear infinite" }} />
          <div className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-40 group-hover:opacity-80" style={{ borderRadius: 28, boxShadow: "inset 0 0 0 1.5px hsl(var(--brand-glow-6) / 0.3), 0 0 20px 0 hsl(var(--brand-glow-3) / 0.08)" }} />
          <div className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ borderRadius: 28, background: "radial-gradient(circle at 50% 0%, hsl(var(--brand-glow-6) / 0.3), transparent 60%)" }} />

          {/* Foto do usuário (cadastrada em Editar perfil) — some inset à esquerda,
              esmaecendo pro degradê via máscara CSS, sem precisar de recorte manual. */}
          {bannerPhotoUrl && (
            <div
              className="absolute inset-y-0 left-0 z-[1] hidden w-[45%] max-w-[220px] sm:block"
              style={{
                WebkitMaskImage: "linear-gradient(to right, black 50%, transparent 92%)",
                maskImage: "linear-gradient(to right, black 50%, transparent 92%)",
              }}
            >
              <img src={bannerPhotoUrl} alt="" aria-hidden="true" className="h-full w-full object-cover object-top" />
            </div>
          )}

          <div className={cn("relative z-10 flex flex-col gap-3 p-5 sm:p-6 md:flex-row md:items-center md:gap-4", bannerPhotoUrl && "sm:pl-48 md:pl-56")}>
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn("relative shrink-0", bannerPhotoUrl && "sm:hidden")}>
                  <div className="absolute -inset-[3px] rounded-full" style={{ background: "linear-gradient(135deg, hsl(var(--brand-glow-6)), hsl(var(--brand-glow-7)), hsl(var(--brand-glow-5)))", opacity: 0.9, animation: "spin 6s linear infinite" }} />
                  <UserAvatar avatarUrl={myProfile?.avatar_url} name={myProfile?.full_name} className="relative h-16 w-16 ring-2 ring-white/20" fallbackClassName="bg-white/15 text-white font-bold text-base" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold tracking-tight text-white drop-shadow-sm">{headerGreeting}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <p className="max-w-[300px] break-words whitespace-normal text-sm text-white/70">{headerLine}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pontos mensal + visão geral do Magic Number — encaixados no mesmo banner, na lateral, como chips translúcidos */}
            <div className="grid grid-cols-2 gap-3 md:flex md:shrink-0 md:items-center md:gap-7">
              <MeuPainelPerformanceRankCard label="Mensal" rank={perf.rank} total={perf.total} medal={perf.medal} isLoading={perf.isLoading} />
              <div className="md:w-auto">
                <MeuPainelMagicNumberCard />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── BLOCOS CONFIGURÁVEIS (ordem/visibilidade/largura definidas em "Personalizar página") ── */}
      {normalRows.map((row, idx) => (
        <div
          key={row.join("-")}
          className={cn("opacity-0", ROW_GRID_CLASS[row.length])}
          style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: `${0.15 + idx * 0.1}s` }}
        >
          {row.map((key) => (
            <div key={key} className="h-full [&>*]:h-full">{renderBlockBody(key)}</div>
          ))}
        </div>
      ))}

      {/* ── Personalizar meu painel ── */}
      <div className="flex justify-center overflow-visible pt-1">
        <div className="relative isolate rounded-full">
          {/* Contorno em degradê animado — só o "background-position" se move (sem
              rotate), pra não estourar a caixa do elemento numa forma comprida como
              essa pílula e criar rolagem horizontal na página. */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -inset-[2px] -z-10 rounded-full transition-opacity duration-700",
              highlightPersonalize ? "opacity-100" : "opacity-0",
            )}
            style={{
              background: "linear-gradient(90deg, hsl(var(--brand-glow-6)), hsl(var(--brand-glow-7)), hsl(var(--brand-glow-5)), hsl(var(--brand-glow-6)))",
              backgroundSize: "300% 100%",
              animation: "gradientFlow 3s ease-in-out infinite",
            }}
          />
          <button
            ref={personalizeBtnRef}
            type="button"
            onClick={() => setPersonalizeOpen(true)}
            className="relative flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-foreground/20 hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Personalizar meu painel
          </button>
        </div>
      </div>
      <PersonalizeDashboardDialog open={personalizeOpen} onOpenChange={setPersonalizeOpen} />

      {/* ── PM Task Dialog ── */}
      <PmTaskDetailDialogWrapper taskId={selectedPmTaskId} onClose={() => setSelectedPmTaskId(null)} isAdmin={isAdmin} />

      {/* ── Metric card task list (Tarefas/Concluídas/Pendentes/Atrasadas) ── */}
      <MetricTaskListSheet
        open={!!metricSheet}
        onOpenChange={(open) => { if (!open) setMetricSheet(null); }}
        title={metricSheet ? metricSheetTitle[metricSheet] : ""}
        tasks={metricSheetTasks}
        clientsMap={clientsNameMap}
        todayKey={todayKey}
        onOpenTask={(taskId) => setSelectedPmTaskId(taskId)}
      />

      {/* ── Late task appeal dialog ── */}
      <LateAppealDialog
        open={!!appealTask}
        taskId={appealTask?.id ?? null}
        taskTitle={appealTask?.title}
        dueDate={appealTask?.dueDate}
        userId={user?.id ?? ""}
        onClose={() => setAppealTask(null)}
        onConfirm={async () => {
          if (appealTask) await performComplete(appealTask.id, "concluido");
        }}
      />
    </div>
  );
}

// ── Collapsible widget wrapper ──

function CollapsibleWidget({ title, icon, headerExtra, children }: { title: string; icon: React.ReactNode; headerExtra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="w-full flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-7 w-7 shrink-0 rounded-lg bg-sidebar/20 flex items-center justify-center">{icon}</div>
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
        </div>
        {headerExtra}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ── Dialog wrapper ──

function PmTaskDetailDialogWrapper({ taskId, onClose, isAdmin }: { taskId: string | null; onClose: () => void; isAdmin: boolean }) {
  const pmTasksQ = usePmTasks();
  const allTasks = pmTasksQ.data ?? [];
  const task = useMemo(() => (taskId ? allTasks.find((t) => t.id === taskId) ?? null : null), [taskId, allTasks]);

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

  const membersQ = useTeamMembers();
  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    (membersQ.data ?? []).forEach((tm) => { m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined }; });
    return m;
  }, [membersQ.data]);
  const membersList = useMemo(() => (membersQ.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name })), [membersQ.data]);

  return (
    <PmTaskDetailDialog task={task} open={!!taskId} onClose={onClose} clientsMap={clientsMap} membersMap={membersMap} members={membersList} isAdmin={isAdmin} onOpenInCalendario={(taskId) => { onClose(); openTaskInCalendario(taskId); }} />
  );
}
