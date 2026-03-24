import { useMemo } from "react";
import { Zap, ArrowRight, AlertTriangle, RefreshCw, TrendingDown, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/uau";
import { Button } from "@/components/ui/button";

interface TaskData {
  id: string;
  status: string;
  completed_at: string | null;
  due_date: string;
  stage: string;
  title?: string | null;
  point_value?: number | null;
}

interface Props {
  myTasks: TaskData[];
  todayKey: string;
  pendingByStage: Record<string, number>;
  onScrollToTasks?: () => void;
}

type Severity = "green" | "yellow" | "red";

interface FocusState {
  severity: Severity;
  emoji: string;
  headline: string;
  reason: string;
  actions: string[];
  buttonLabel: string;
}

const GRADIENTS: Record<Severity, string> = {
  green: "linear-gradient(135deg, #065F46 0%, #047857 40%, #059669 100%)",
  yellow: "linear-gradient(135deg, #78350F 0%, #B45309 40%, #D97706 100%)",
  red: "linear-gradient(135deg, #7F1D1D 0%, #B91C1C 40%, #DC2626 100%)",
};

const GLOW: Record<Severity, string> = {
  green: "rgba(16,185,129,0.25)",
  yellow: "rgba(245,158,11,0.25)",
  red: "rgba(239,68,68,0.25)",
};

export function FocusNowWidget({ myTasks, todayKey, pendingByStage, onScrollToTasks }: Props) {
  const focus = useMemo((): FocusState => {
    const overdue = myTasks.filter((t) => t.status !== "concluido" && t.due_date < todayKey);
    const todayPending = myTasks.filter((t) => t.status !== "concluido" && t.due_date === todayKey);
    const inAlteracao = pendingByStage["alteracoes"] ?? 0;

    // Top bottleneck stage
    const topStage = Object.entries(pendingByStage).sort((a, b) => b[1] - a[1])[0];
    const topStageLabel = topStage ? (STAGES.find((s) => s.key === topStage[0])?.label ?? topStage[0]) : "";

    // 🔴 Overdue tasks
    if (overdue.length >= 2) {
      const actionTasks = overdue.slice(0, 2).map((t) => t.title || "Tarefa pendente");
      return {
        severity: "red",
        emoji: "⚠️",
        headline: `Você tem ${overdue.length} tarefa${overdue.length > 1 ? "s" : ""} atrasada${overdue.length > 1 ? "s" : ""}. Priorize agora.`,
        reason: `Essas entregas já passaram do prazo e precisam de atenção imediata.`,
        actions: actionTasks,
        buttonLabel: "Resolver atrasadas",
      };
    }

    // 🟠 Bottleneck in alteração
    if (inAlteracao >= 2) {
      return {
        severity: "yellow",
        emoji: "🔄",
        headline: `Você está travado em Alteração. Resolva isso primeiro.`,
        reason: `${inAlteracao} tarefa${inAlteracao > 1 ? "s" : ""} parada${inAlteracao > 1 ? "s" : ""} nessa etapa podem atrasar o fluxo.`,
        actions: ["Resolver pendências em alteração"],
        buttonLabel: "Resolver gargalos",
      };
    }

    // 🟠 Big bottleneck
    if (topStage && topStage[1] >= 3) {
      return {
        severity: "yellow",
        emoji: "⚡",
        headline: `Você está travado em ${topStageLabel}. Resolva isso primeiro.`,
        reason: `${topStage[1]} tarefas acumuladas nessa etapa podem atrasar o restante.`,
        actions: [`Priorizar tarefas em ${topStageLabel}`],
        buttonLabel: "Ver tarefas",
      };
    }

    // 🔴 1 overdue
    if (overdue.length === 1) {
      return {
        severity: "red",
        emoji: "⏰",
        headline: `Você tem 1 tarefa vencida. Priorize agora.`,
        reason: `"${overdue[0]?.title || "Tarefa"}" já passou do prazo.`,
        actions: [overdue[0]?.title || "Finalizar tarefa atrasada"],
        buttonLabel: "Resolver atrasada",
      };
    }

    // 🟡 Today tasks pending
    if (todayPending.length > 0) {
      const actionTasks = todayPending.slice(0, 2).map((t) => t.title || "Tarefa de hoje");
      return {
        severity: "yellow",
        emoji: "🎯",
        headline: `Você tem ${todayPending.length} tarefa${todayPending.length > 1 ? "s" : ""} para hoje. Foque agora.`,
        reason: `Finalize suas entregas do dia para manter o ritmo.`,
        actions: actionTasks,
        buttonLabel: "Ver tarefas de hoje",
      };
    }

    // 🟢 All good
    const done = myTasks.filter((t) => t.status === "concluido").length;
    const total = myTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
      severity: "green",
      emoji: "🚀",
      headline: "Continue nesse ritmo. Você está mandando bem!",
      reason: total > 0
        ? `${pct}% das tarefas concluídas. Falta pouco para bater sua meta do mês.`
        : "Nenhuma tarefa pendente no momento.",
      actions: total > done ? ["Finalizar próximas tarefas pendentes"] : ["Manter o ritmo de entregas"],
      buttonLabel: "Ver tarefas",
    };
  }, [myTasks, todayKey, pendingByStage]);

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.005] opacity-0"
      style={{
        animation: "fadeUp 0.6s ease-out forwards",
        boxShadow: `0 8px 32px -8px ${GLOW[focus.severity]}, 0 0 0 1px rgba(255,255,255,0.06)`,
      }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0" style={{ background: GRADIENTS[focus.severity] }} />
      <div className="absolute inset-0 opacity-[0.06]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />
      {/* Glow accent */}
      <div className="absolute -top-20 -right-20 h-48 w-48 rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{ background: focus.severity === "green" ? "rgba(16,185,129,0.5)" : focus.severity === "yellow" ? "rgba(245,158,11,0.5)" : "rgba(239,68,68,0.5)" }}
      />

      <div className="relative z-10 p-5 sm:p-6 space-y-4">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white/90 border border-white/15 backdrop-blur-sm" style={{ background: "rgba(255,255,255,0.1)" }}>
          <Zap className="h-3.5 w-3.5" />
          Seu foco agora
        </div>

        {/* Headline */}
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-tight">
            {focus.emoji} {focus.headline}
          </h2>
          <p className="text-sm text-white/70 mt-1">{focus.reason}</p>
        </div>

        {/* Actions */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">O que fazer agora:</p>
          {focus.actions.map((action, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-white/90">
              <ArrowRight className="h-3.5 w-3.5 text-white/50 shrink-0" />
              <span className="truncate">{action}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Button
          variant="secondary"
          size="sm"
          className="bg-white/15 hover:bg-white/25 text-white border-white/15 backdrop-blur-sm font-semibold"
          onClick={onScrollToTasks}
        >
          {focus.buttonLabel}
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
