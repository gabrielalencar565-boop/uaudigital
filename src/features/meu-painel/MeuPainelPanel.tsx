import { useEffect, useMemo, useState } from "react";
import { format, getDay } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { useClients, useSetTaskStatus, useTasks } from "@/features/data/queries";
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
import { MonthYearNav } from "@/features/magic2/components/MonthYearNav";
import { MentionsWidget } from "@/features/meu-painel/components/MentionsWidget";
import { MyPmTasksWidget } from "@/features/meu-painel/components/MyPmTasksWidget";
import { PmTaskDetailDialog } from "@/features/gestao/components/PmTaskDetailDialog";
import { usePmTasks } from "@/features/gestao/hooks/use-pm-data";
import { useQuery } from "@tanstack/react-query";
import {
  useCleaningSchedules,
  useCleaningCategories,
  useCleaningCompletions,
  useToggleCleaningCompletion,
} from "@/features/cleaning/hooks/use-cleaning";
import { cn } from "@/lib/utils";

function getMagicSyncedMonthYear(now: Date) {
  // Regra do Magic Number: a partir do dia 28, o "mês vigente" vira o próximo.
  const day = now.getDate();
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12

  if (day < 28) return { year: y, month: m };
  if (m < 12) return { year: y, month: m + 1 };
  return { year: y + 1, month: 1 };
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
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
  // hash simples e estável (determinístico) para indexar a lista
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
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

export function MeuPainelPanel() {
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);

  const [myProfile, setMyProfile] = useState<{ full_name: string; avatar_url: string | null } | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);
  const [selectedPmTaskId, setSelectedPmTaskId] = useState<string | null>(null);
  const today = useNow();
  const todayKey = format(today, "yyyy-MM-dd");

  const [selected, setSelected] = useState(() => getMagicSyncedMonthYear(today));
  // Mantém o estado sincronizado com o calendário apenas no primeiro load.
  // (Se o usuário escolher manualmente outro mês/ano, não sobrescrevemos.)
  // Obs: useNow atualiza em tempo real; por isso o initializer acima.

  const monthKey = useMemo(
    () => `${selected.year}-${String(selected.month).padStart(2, "0")}`,
    [selected.month, selected.year],
  );

  const perf = useMyMonthlyPerformanceRank({
    userId: user?.id,
    year: selected.year,
    month: selected.month,
  });

  const perfYear = useMyAnnualPerformanceRank({
    userId: user?.id,
    year: selected.year,
  });

  const tasksQ = useTasks({ month: monthKey, assignedUserId: user?.id });
  const clientsQ = useClients();
  const setTaskStatus = useSetTaskStatus();

  const clientsById = useMemo(() => new Map((clientsQ.data ?? []).map((c) => [c.id, c] as const)), [clientsQ.data]);

  const myTasks = useMemo(() => tasksQ.data ?? [], [tasksQ.data]);

  // ─── Cleaning ───
  const cleaningSchedulesQ = useCleaningSchedules();
  const cleaningCategoriesQ = useCleaningCategories();
  const cleaningCompletionsQ = useCleaningCompletions(todayKey);
  const toggleCleaning = useToggleCleaningCompletion();

  const todayDow = getDay(today);

  const myCleaningTasks = useMemo(() => {
    if (!user) return [];
    const schedules = cleaningSchedulesQ.data ?? [];
    return schedules.filter((s) => s.day_of_week === todayDow && s.user_id === user.id);
  }, [cleaningSchedulesQ.data, todayDow, user]);

  const cleaningCategoryById = useMemo(
    () => new Map((cleaningCategoriesQ.data ?? []).map((c) => [c.id, c])),
    [cleaningCategoriesQ.data]
  );

  const completedScheduleIds = useMemo(
    () => new Set((cleaningCompletionsQ.data ?? []).map((c) => c.schedule_id)),
    [cleaningCompletionsQ.data]
  );

  // Cleaning task VMs merged as normal tasks
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

  const todayTasks = useMemo(
    () => [...myTasks.filter((t) => t.due_date === todayKey), ...cleaningVMs.filter((c) => c.status !== "concluido")],
    [myTasks, todayKey, cleaningVMs],
  );
  const overdueTasks = useMemo(
    () => myTasks.filter((t) => t.status !== "concluido" && t.due_date < todayKey),
    [myTasks, todayKey],
  );
  const upcomingTasks = useMemo(
    () => myTasks.filter((t) => t.status !== "concluido" && t.due_date > todayKey),
    [myTasks, todayKey],
  );
  const completedTasks = useMemo(
    () => [...myTasks.filter((t) => t.status === "concluido"), ...cleaningVMs.filter((c) => c.status === "concluido")],
    [myTasks, cleaningVMs],
  );

  const summary = useMemo(() => {
    const done = myTasks.filter((t) => t.status === "concluido").length;
    const pending = myTasks.filter((t) => t.status !== "concluido").length;
    return {
      total: myTasks.length,
      done,
      pending,
      overdue: overdueTasks.length,
    };
  }, [myTasks, overdueTasks.length]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (!data?.full_name) {
          setMyProfile(null);
          return;
        }
        setMyProfile({ full_name: data.full_name, avatar_url: data.avatar_url ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, profileVersion]);

  const headerGreeting = useMemo(() => {
    const g = greetingForHour(today.getHours());
    const name = myProfile?.full_name ? firstName(myProfile.full_name) : "";
    return name ? `${g}, ${name}` : g;
  }, [myProfile?.full_name, today]);

  const headerLine = useMemo(() => {
    // frase estável por dia E por usuário (cada pessoa vê uma diferente)
    const userSeed = user?.id ?? myProfile?.full_name ?? "anonymous";
    const seed = hashStringToInt(`${todayKey}:${userSeed}`);
    const idx = seed % motivationalLines.length;
    const phrase = motivationalLines[idx] ?? motivationalLines[0];
    return `Frase do dia: ${phrase}`;
  }, [myProfile?.full_name, todayKey, user?.id]);

  const onStart = async (taskId: string) => {
    if (!user) return;
    try {
      await setTaskStatus.mutateAsync({ taskId, status: "em_andamento", userId: user.id });
      toast.success("Em andamento! Bora manter o ritmo 🚀");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar tarefa");
    }
  };

  const onToggleComplete = async (taskId: string, current: "pendente" | "em_andamento" | "concluido") => {
    if (!user) return;
    // Handle cleaning tasks
    if (taskId.startsWith("cleaning:")) {
      const scheduleId = taskId.replace("cleaning:", "");
      toggleCleaning.mutate({
        scheduleId,
        date: todayKey,
        userId: user.id,
        isCompleted: current === "concluido",
      });
      return;
    }
    const next = current === "concluido" ? "em_andamento" : "concluido";
    try {
      await setTaskStatus.mutateAsync({ taskId, status: next, userId: user.id });
      toast.success(next === "concluido" ? "Concluída! ✔" : "Voltou para em andamento");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar tarefa");
    }
  };

  const toVM = (t: (typeof myTasks)[number] | MeuPainelTaskVM): MeuPainelTaskVM => {
    // Already a VM (cleaning tasks)
    if ("clientName" in t) return t;
    const client = clientsById.get(t.client_id);
    const stageLabel = STAGES.find((s) => s.key === t.stage)?.label ?? t.stage;
    return {
      id: t.id,
      clientName: client?.name ?? "—",
      stageLabel,
      stage: t.stage,
      title: t.title,
      dueDate: t.due_date,
      status: t.status,
      completedAt: t.completed_at ?? null,
    };
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <div
          className="md:col-span-2 relative group overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1.5 hover:scale-[1.008]"
          style={{
            borderRadius: 28,
            boxShadow: "0 8px 32px -8px rgba(124,58,237,0.18), 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 16px 48px -8px rgba(124,58,237,0.32), 0 0 24px 2px rgba(139,92,246,0.18), 0 0 0 1px rgba(139,92,246,0.25), inset 0 0 0 1px rgba(255,255,255,0.10)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px -8px rgba(124,58,237,0.18), 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)";
          }}
        >
          {/* Layer 1 — deep base gradient (slowest, continuous motion) */}
          <div
            className="absolute -inset-8 opacity-90"
            style={{
              background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 25%, #7C3AED 50%, #5B21B6 75%, #4C1D95 100%)",
              backgroundSize: "300% 300%",
              animation: "gradientFlow 14s ease-in-out infinite",
            }}
          />

          {/* Layer 2 — organic translucent shapes (medium speed) */}
          <div
            className="absolute -inset-12 opacity-60"
            style={{
              background: "radial-gradient(ellipse 70% 60% at 25% 35%, #8B5CF6 0%, transparent 70%), radial-gradient(ellipse 55% 65% at 75% 65%, #5B21B6 0%, transparent 65%)",
              animation: "parallaxLayer2 12s ease-in-out infinite",
            }}
          />

          {/* Layer 3 — blurred accent blobs (fastest) */}
          <div
            className="absolute -inset-16 opacity-50"
            style={{
              background: "radial-gradient(circle 280px at 20% 70%, #7C3AED 0%, transparent 60%), radial-gradient(circle 220px at 80% 25%, #6D28D9 0%, transparent 55%), radial-gradient(circle 160px at 55% 50%, #4C1D95 0%, transparent 50%)",
              filter: "blur(30px)",
              animation: "parallaxLayer3 9s ease-in-out infinite",
            }}
          />

          {/* Geometric grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              animation: "gridDrift 22s linear infinite",
            }}
          />

          {/* Glow border — always visible, intensifies on hover */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-40 group-hover:opacity-80"
            style={{ borderRadius: 28, boxShadow: "inset 0 0 0 1.5px rgba(167,139,250,0.3), 0 0 20px 0 rgba(124,58,237,0.08)" }}
          />
          {/* Top glow accent on hover */}
          <div
            className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{ borderRadius: 28, background: "radial-gradient(circle at 50% 0%, rgba(167,139,250,0.3), transparent 60%)" }}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
            <div className="flex min-w-0 items-center gap-3.5">
              {/* Avatar with gradient ring */}
              <div className="relative shrink-0">
                <div className="absolute -inset-[3px] rounded-full" style={{ background: "linear-gradient(135deg, #A78BFA, #6366F1, #8B5CF6)", opacity: 0.9 }} />
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

            {/* Glassmorphism date badge */}
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold tabular-nums text-white backdrop-blur-xl border border-white/15 shadow-lg shadow-black/10" style={{ background: "rgba(255,255,255,0.12)" }}>
                {format(today, "dd/MM")}
              </div>
            </div>
          </div>
        </div>

        <MeuPainelPerformanceRankCard
          label="Mensal"
          rank={perf.rank}
          total={perf.total}
          medal={perf.medal}
          isLoading={perf.isLoading}
        />
        <MeuPainelPerformanceRankCard
          label="Anual"
          rank={perfYear.rank}
          total={perfYear.total}
          medal={perfYear.medal}
          isLoading={perfYear.isLoading}
        />
      </div>

      {/* Resumo do mês */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-sidebar" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tarefas do mês</p>
              <AnimatedNumber value={summary.total} className="text-3xl font-semibold tracking-tight" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-sidebar" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Concluídas</p>
              <AnimatedNumber value={summary.done} className="text-3xl font-semibold tracking-tight" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-sidebar" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <AnimatedNumber value={summary.pending} className="text-3xl font-semibold tracking-tight" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-sidebar" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Atrasadas</p>
              <AnimatedNumber value={summary.overdue} className="text-3xl font-semibold tracking-tight" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tarefas de Gestão atribuídas (estilo ClickUp) */}
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.3s" }}>
        <MyPmTasksWidget onOpenTask={(taskId) => setSelectedPmTaskId(taskId)} />
      </div>

      {/* Minhas tarefas do mês (agenda) */}
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.45s" }}>
        <MeuPainelTasksGroupedCard
          overdue={overdueTasks.map(toVM)}
          today={todayTasks.map(toVM)}
          upcoming={upcomingTasks.map(toVM)}
          completed={completedTasks.map(toVM)}
          isUpdating={setTaskStatus.isPending}
          onStart={onStart}
          onToggleComplete={onToggleComplete}
        />
      </div>

      {/* Widget de menções */}
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.6s" }}>
        <MentionsWidget onOpenTask={(taskId) => setSelectedPmTaskId(taskId)} />
      </div>

      {/* PM Task Detail Dialog */}
      <PmTaskDetailDialogWrapper
        taskId={selectedPmTaskId}
        onClose={() => setSelectedPmTaskId(null)}
        isAdmin={isAdmin}
      />
    </div>
  );
}

/** Wrapper to load data needed by PmTaskDetailDialog */
function PmTaskDetailDialogWrapper({ taskId, onClose, isAdmin }: { taskId: string | null; onClose: () => void; isAdmin: boolean }) {
  const pmTasksQ = usePmTasks();
  const allTasks = pmTasksQ.data ?? [];

  const task = useMemo(() => {
    if (!taskId) return null;
    return allTasks.find(t => t.id === taskId) ?? null;
  }, [taskId, allTasks]);

  const clientsQ = useQuery({
    queryKey: ["clients_all"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });
  const clientsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientsQ.data ?? []).forEach(c => { m[c.id] = c.name; });
    return m;
  }, [clientsQ.data]);

  const membersQ = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("user_id, display_name, avatar_url").eq("is_active", true);
      return data ?? [];
    },
  });
  const membersMap = useMemo(() => {
    const m: Record<string, { name: string; avatar?: string }> = {};
    (membersQ.data ?? []).forEach(tm => { m[tm.user_id] = { name: tm.display_name, avatar: tm.avatar_url ?? undefined }; });
    return m;
  }, [membersQ.data]);
  const membersList = useMemo(() => (membersQ.data ?? []).map(m => ({ id: m.user_id, name: m.display_name })), [membersQ.data]);

  return (
    <PmTaskDetailDialog
      task={task}
      open={!!taskId}
      onClose={onClose}
      clientsMap={clientsMap}
      membersMap={membersMap}
      members={membersList}
      isAdmin={isAdmin}
    />
  );
}
