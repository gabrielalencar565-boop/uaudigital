import { useEffect, useMemo, useState } from "react";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { format, getDay, subDays } from "date-fns";
import { ListChecks, CheckCircle2, Clock, AlertTriangle, Flame, Activity, Trophy, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useClients, useSetTaskStatus, useTasks, useTeamMembers } from "@/features/data/queries";
import { STAGES } from "@/lib/uau";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MeuPainelTasksGroupedCard, type MeuPainelTaskVM } from "@/features/meu-painel/components/MeuPainelTasksGroupedCard";
import { useMyMonthlyPerformanceRank } from "@/features/meu-painel/hooks/use-my-monthly-performance-rank";
import { MeuPainelPerformanceRankCard } from "@/features/meu-painel/components/MeuPainelPerformanceRankCard";
import { useMyAnnualPerformanceRank } from "@/features/meu-painel/hooks/use-my-annual-performance-rank";
import { useNow } from "@/hooks/use-now";
import { MentionsWidget } from "@/features/meu-painel/components/MentionsWidget";
import { MyPmTasksWidget } from "@/features/meu-painel/components/MyPmTasksWidget";
import { PmTaskDetailDialog } from "@/features/gestao/components/PmTaskDetailDialog";
import { usePmTasks } from "@/features/gestao/hooks/use-pm-data";
import { useQuery } from "@tanstack/react-query";
import { ProductivityWidget } from "@/features/meu-painel/components/ProductivityWidget";
import { SmartFeedbackWidget } from "@/features/meu-painel/components/SmartFeedbackWidget";
import { DayQuickView } from "@/features/meu-painel/components/DayQuickView";
import { BottleneckWidget } from "@/features/meu-painel/components/BottleneckWidget";
import { MetricSparkCard } from "@/features/meu-painel/components/MetricSparkCard";

import {
  useCleaningSchedules,
  useCleaningCategories,
  useCleaningCompletions,
  useToggleCleaningCompletion,
} from "@/features/cleaning/hooks/use-cleaning";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  "Pequenos passos hoje viram grandes resultados amanhã.",
  "Foco no próximo movimento — você está evoluindo.",
  "Constância ganha do talento quando o talento não é constante.",
  "Entrega feita com capricho é marca registrada.",
  "Um dia de cada vez, no ritmo certo.",
  "Comece simples. Termine forte.",
  "O que você entrega hoje constrói sua reputação amanhã.",
  "Feito é melhor que perfeito — mas capricho é obrigatório.",
  "Priorize o que move a agulha.",
  "Disciplina primeiro, motivação depois.",
  "Você não precisa de mais tempo; precisa de mais foco.",
  "Consistência é o superpoder do time.",
  "Uma tarefa por vez. Uma vitória por vez.",
  "A meta é clareza, ritmo e entrega.",
  "O padrão é alto — e você dá conta.",
  "Trabalho bem feito abre portas.",
  "Hoje é dia de ganhar no detalhe.",
  "O progresso vem do que você repete.",
  "Se está difícil, é porque está te elevando.",
  "Faz com calma, mas faz.",
];

// ── Main Panel ───────────────────────────────────────────

export function MeuPainelPanel() {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);

  const [myProfile, setMyProfile] = useState<{ full_name: string; avatar_url: string | null; birth_date?: string | null } | null>(null);
  const [profileVersion] = useState(0);
  const [selectedPmTaskId, setSelectedPmTaskId] = useState<string | null>(null);
  const [confettiFired, setConfettiFired] = useState(false);
  const today = useNow();
  const todayKey = format(today, "yyyy-MM-dd");

  const selected = useMemo(() => ({ year: today.getFullYear(), month: today.getMonth() + 1 }), [today]);
  const monthKey = useMemo(() => `${selected.year}-${String(selected.month).padStart(2, "0")}`, [selected.month, selected.year]);

  const perf = useMyMonthlyPerformanceRank({ userId: user?.id, year: selected.year, month: selected.month });
  const perfYear = useMyAnnualPerformanceRank({ userId: user?.id, year: selected.year });

  const teamMembersQ = useTeamMembers();
  const tasksQ = useTasks({ month: monthKey, assignedUserId: user?.id });
  const clientsQ = useClients();
  const setTaskStatus = useSetTaskStatus();
  const clientsById = useMemo(() => new Map((clientsQ.data ?? []).map((c) => [c.id, c] as const)), [clientsQ.data]);
  const myTasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);

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

  const summary = useMemo(() => {
    const done = myTasks.filter((t) => t.status === "concluido").length;
    const pending = myTasks.filter((t) => t.status !== "concluido").length;
    return { total: myTasks.length, done, pending, overdue: overdueTasks.length };
  }, [myTasks, overdueTasks.length]);

  // ── Previous month for comparison ──
  const prevMonth = useMemo(() => {
    const pm = selected.month === 1 ? 12 : selected.month - 1;
    const py = selected.month === 1 ? selected.year - 1 : selected.year;
    return { year: py, month: pm };
  }, [selected]);
  const prevMonthKey = useMemo(() => `${prevMonth.year}-${String(prevMonth.month).padStart(2, "0")}`, [prevMonth]);
  const prevTasksQ = useTasks({ month: prevMonthKey, assignedUserId: user?.id });
  const prevSummary = useMemo(() => {
    const all = prevTasksQ.data ?? [];
    return { total: all.length, done: all.filter((t) => t.status === "concluido").length, pending: all.filter((t) => t.status !== "concluido").length };
  }, [prevTasksQ.data]);

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

  // ── Streak calculation ──
  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = format(subDays(today, i), "yyyy-MM-dd");
      const doneOnDay = myTasks.some((t) => t.status === "concluido" && t.completed_at && format(new Date(t.completed_at), "yyyy-MM-dd") === d);
      if (doneOnDay) count++;
      else if (i > 0) break; // break on first gap (skip today if nothing yet)
    }
    return count;
  }, [myTasks, todayKey]);

  // ── Sparkline data (last 7 days) ──
  const sparkData = useMemo(() => {
    const data: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(today, i), "yyyy-MM-dd");
      data.push(myTasks.filter((t) => t.status === "concluido" && t.completed_at && format(new Date(t.completed_at), "yyyy-MM-dd") === d).length);
    }
    return data;
  }, [myTasks, todayKey]);

  // ── Bottleneck data ──
  const pendingByStage = useMemo(() => {
    return myTasks.filter((t) => t.status !== "concluido").reduce((acc, t) => {
      acc[t.stage] = (acc[t.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [myTasks]);

  // ── Profile loading ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle(),
      supabase.from("team_members").select("birth_date").eq("user_id", user.id).maybeSingle(),
    ]).then(([profileRes, tmRes]) => {
      if (cancelled) return;
      const data = profileRes.data;
      if (!data?.full_name) { setMyProfile(null); return; }
      setMyProfile({ full_name: data.full_name, avatar_url: normalizeAvatarUrl(data.avatar_url) ?? null, birth_date: (tmRes.data as any)?.birth_date ?? null });
    });
    return () => { cancelled = true; };
  }, [user?.id, profileVersion]);

  const isBirthday = useMemo(() => {
    if (!myProfile?.birth_date) return false;
    const bd = new Date(myProfile.birth_date + "T12:00:00");
    return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
  }, [myProfile?.birth_date, todayKey]);

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

  const onToggleComplete = async (taskId: string, current: "pendente" | "em_andamento" | "concluido") => {
    if (!user) return;
    if (taskId.startsWith("cleaning:")) {
      toggleCleaning.mutate({ scheduleId: taskId.replace("cleaning:", ""), date: todayKey, userId: user.id, isCompleted: current === "concluido" });
      return;
    }
    const next = current === "concluido" ? "em_andamento" : "concluido";
    try {
      await setTaskStatus.mutateAsync({ taskId, status: next, userId: user.id });
      toast.success(next === "concluido" ? "Concluída! ✔" : "Voltou para em andamento");
    } catch (e: any) { toast.error(e?.message ?? "Erro ao atualizar tarefa"); }
  };

  const toVM = (t: (typeof myTasks)[number] | MeuPainelTaskVM): MeuPainelTaskVM => {
    if ("clientName" in t) return t;
    const client = clientsById.get(t.client_id);
    const stageLabel = STAGES.find((s) => s.key === t.stage)?.label ?? t.stage;
    return { id: t.id, clientName: client?.name ?? "—", stageLabel, stage: t.stage, title: t.title, dueDate: t.due_date, status: t.status, completedAt: t.completed_at ?? null };
  };

  return (
    <div className="space-y-5">
      {/* ── 1. HEADER + RANK ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards" }}>
        <div
          className="md:col-span-2 relative group overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1.5 hover:scale-[1.008]"
          style={{ borderRadius: 28, boxShadow: "0 8px 32px -8px rgba(124,58,237,0.18), 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px -8px rgba(124,58,237,0.32), 0 0 24px 2px rgba(139,92,246,0.18), 0 0 0 1px rgba(139,92,246,0.25), inset 0 0 0 1px rgba(255,255,255,0.10)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px -8px rgba(124,58,237,0.18), 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)"; }}
        >
          <div className="absolute -inset-8 opacity-90" style={{ background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 25%, #7C3AED 50%, #5B21B6 75%, #4C1D95 100%)", backgroundSize: "300% 300%", animation: "gradientFlow 14s ease-in-out infinite" }} />
          <div className="absolute -inset-12 opacity-60" style={{ background: "radial-gradient(ellipse 70% 60% at 25% 35%, #8B5CF6 0%, transparent 70%), radial-gradient(ellipse 55% 65% at 75% 65%, #5B21B6 0%, transparent 65%)", animation: "parallaxLayer2 12s ease-in-out infinite" }} />
          <div className="absolute -inset-16 opacity-50" style={{ background: "radial-gradient(circle 280px at 20% 70%, #7C3AED 0%, transparent 60%), radial-gradient(circle 220px at 80% 25%, #6D28D9 0%, transparent 55%)", filter: "blur(30px)", animation: "parallaxLayer3 9s ease-in-out infinite" }} />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "44px 44px", animation: "gridDrift 22s linear infinite" }} />
          <div className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-40 group-hover:opacity-80" style={{ borderRadius: 28, boxShadow: "inset 0 0 0 1.5px rgba(167,139,250,0.3), 0 0 20px 0 rgba(124,58,237,0.08)" }} />
          <div className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ borderRadius: 28, background: "radial-gradient(circle at 50% 0%, rgba(167,139,250,0.3), transparent 60%)" }} />

          <div className="relative z-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="relative shrink-0">
                <div className="absolute -inset-[3px] rounded-full" style={{ background: "linear-gradient(135deg, #A78BFA, #6366F1, #8B5CF6)", opacity: 0.9, animation: "spin 6s linear infinite" }} />
                <Avatar className="relative h-12 w-12 ring-2 ring-white/20">
                  <AvatarImage src={myProfile?.avatar_url ?? undefined} alt={myProfile?.full_name ?? ""} />
                  <AvatarFallback className="bg-white/15 text-white font-bold text-sm">{initials(myProfile?.full_name ?? "?")}</AvatarFallback>
                </Avatar>
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight text-white drop-shadow-sm">{headerGreeting}</h2>
                <p className="break-words whitespace-normal text-sm text-white/70">{headerLine}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Streak badge */}
              {streak >= 2 && (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-xl border border-orange-400/30 shadow-lg cursor-default"
                        style={{ background: "rgba(251,146,60,0.2)" }}
                      >
                        <Flame className="h-4 w-4 text-orange-400" />
                        <span className="tabular-nums">{streak}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs z-[9999] max-w-[260px] whitespace-normal">
                      🔥 Sequência de {streak} dias consecutivos concluindo tarefas
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <div className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold tabular-nums text-white backdrop-blur-xl border border-white/15 shadow-lg shadow-black/10" style={{ background: "rgba(255,255,255,0.12)" }}>
                {format(today, "dd/MM")}
              </div>
            </div>
          </div>
        </div>

        <MeuPainelPerformanceRankCard label="Mensal" rank={perf.rank} total={perf.total} medal={perf.medal} isLoading={perf.isLoading} />
        <MeuPainelPerformanceRankCard label="Anual" rank={perfYear.rank} total={perfYear.total} medal={perfYear.medal} isLoading={perfYear.isLoading} />
      </div>

      {/* ── 3. METRIC CARDS ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}>
        <MetricSparkCard label="Tarefas" value={summary.total} prevValue={prevSummary.total || undefined} icon={<ListChecks className="h-5 w-5" />} sparkData={sparkData} />
        <MetricSparkCard label="Concluídas" value={summary.done} prevValue={prevSummary.done || undefined} icon={<CheckCircle2 className="h-5 w-5" />} accentClass="text-emerald-500" sparkData={sparkData} />
        <MetricSparkCard label="Pendentes" value={summary.pending} prevValue={prevSummary.pending || undefined} icon={<Clock className="h-5 w-5" />} accentClass="text-amber-500" />
        <MetricSparkCard label="Atrasadas" value={summary.overdue} icon={<AlertTriangle className="h-5 w-5" />} accentClass="text-red-500" />
      </div>

      {/* ── 4. PM TASKS (Gestão) ── */}
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.22s" }}>
        <MyPmTasksWidget onOpenTask={(taskId) => setSelectedPmTaskId(taskId)} />
      </div>


      {/* ── 6. MENTIONS ── */}
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.38s" }}>
        <MentionsWidget onOpenTask={(taskId) => setSelectedPmTaskId(taskId)} />
      </div>

      {/* ── 7. PRODUCTIVITY + FEEDBACK (below mentions) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.45s" }}>
        <CollapsibleWidget title="Sua produtividade" icon={<Activity className="h-4 w-4 text-sidebar" />}>
          <ProductivityWidget tasks={myTasks} allMonthTasks={[...myTasks, ...(prevTasksQ.data ?? [])]} todayKey={todayKey} />
        </CollapsibleWidget>
        <CollapsibleWidget title="Seu desempenho" icon={<Trophy className="h-4 w-4 text-sidebar" />}>
        <SmartFeedbackWidget
          myTasks={myTasks.map((t) => ({ ...t, completed_at: t.completed_at ?? null, point_value: (t as any).point_value ?? null }))}
          teamAvgScore={teamPerfQ.data ?? null}
          myScore={myScore}
          todayKey={todayKey}
          prevMonthDone={prevSummary.done}
          qualitative={myQualitativeQ.data ?? null}
          rank={perf.rank}
          rankTotal={teamMembersQ.data?.length ?? null}
          prevRank={prevPerf.rank}
          prevRankTotal={teamMembersQ.data?.length ?? null}
          prevQualitative={prevQualitativeQ.data ?? null}
          prevTasks={(prevTasksQ.data ?? []).map((t) => ({ ...t, completed_at: t.completed_at ?? null, point_value: (t as any).point_value ?? null }))}
          annualQualitative={annualQualitativeQ.data ?? null}
          annualScore={Math.round((perfYear.total ?? 0) / Math.max(1, selected.month) * 10) / 10}
          annualRank={perfYear.rank}
          annualRankTotal={teamMembersQ.data?.length ?? null}
        />
        </CollapsibleWidget>
      </div>

      {/* ── PM Task Dialog ── */}
      <PmTaskDetailDialogWrapper taskId={selectedPmTaskId} onClose={() => setSelectedPmTaskId(null)} isAdmin={isAdmin} />
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

  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url").eq("is_active", true);
      return (data ?? []).map(tm => ({ ...tm, avatar_url: normalizeAvatarUrl(tm.avatar_url) ?? null }));
    },
  });
  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    (membersQ.data ?? []).forEach((tm) => { m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined }; });
    return m;
  }, [membersQ.data]);
  const membersList = useMemo(() => (membersQ.data ?? []).map((m) => ({ id: m.user_id, name: m.display_name })), [membersQ.data]);

  return (
    <PmTaskDetailDialog task={task} open={!!taskId} onClose={onClose} clientsMap={clientsMap} membersMap={membersMap} members={membersList} isAdmin={isAdmin} />
  );
}
