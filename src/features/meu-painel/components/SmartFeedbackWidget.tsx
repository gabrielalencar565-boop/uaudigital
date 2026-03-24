import { useMemo } from "react";
import {
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
  Clock, RefreshCw, BarChart3, Zap, Shield, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/uau";
import { Progress } from "@/components/ui/progress";

interface TaskData {
  id: string;
  status: string;
  completed_at: string | null;
  due_date: string;
  stage: string;
  point_value?: number | null;
}

interface Props {
  myTasks: TaskData[];
  teamAvgScore: number | null;
  myScore: number;
  todayKey: string;
  prevMonthDone: number;
}

interface Insight {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: "green" | "red" | "yellow" | "blue";
  priority: number;
}

const ICON_BG: Record<string, string> = {
  green: "bg-emerald-500/15",
  red: "bg-red-500/15",
  yellow: "bg-amber-500/15",
  blue: "bg-blue-500/15",
};
const ICON_TEXT: Record<string, string> = {
  green: "text-emerald-500",
  red: "text-red-500",
  yellow: "text-amber-500",
  blue: "text-blue-500",
};
const CARD_BORDER: Record<string, string> = {
  green: "border-emerald-500/20 hover:border-emerald-500/40",
  red: "border-red-500/20 hover:border-red-500/40",
  yellow: "border-amber-500/20 hover:border-amber-500/40",
  blue: "border-blue-500/20 hover:border-blue-500/40",
};

export function SmartFeedbackWidget({ myTasks, teamAvgScore, myScore, todayKey, prevMonthDone }: Props) {
  const total = myTasks.length;
  const done = myTasks.filter((t) => t.status === "concluido").length;
  const overdue = myTasks.filter((t) => t.status !== "concluido" && t.due_date < todayKey).length;
  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;

  const insights = useMemo(() => {
    const list: Insight[] = [];

    const pendingByStage = myTasks
      .filter((t) => t.status !== "concluido")
      .reduce((acc, t) => { acc[t.stage] = (acc[t.stage] || 0) + 1; return acc; }, {} as Record<string, number>);

    const inAlteracao = pendingByStage["alteracoes"] ?? 0;

    // Overdue
    if (overdue === 0 && total > 0) {
      list.push({
        icon: <Shield className="h-4 w-4" />,
        title: "Organização impecável",
        description: "Nenhuma tarefa atrasada",
        color: "green",
        priority: 3,
      });
    } else if (overdue > 0) {
      list.push({
        icon: <AlertTriangle className="h-4 w-4" />,
        title: `${overdue} tarefa${overdue > 1 ? "s" : ""} atrasada${overdue > 1 ? "s" : ""}`,
        description: "Priorize essas entregas o quanto antes",
        color: "red",
        priority: 1,
      });
    }

    // Team comparison
    if (teamAvgScore !== null && teamAvgScore > 0) {
      if (myScore > teamAvgScore) {
        list.push({
          icon: <TrendingUp className="h-4 w-4" />,
          title: "Acima da média",
          description: "Seu desempenho supera o da equipe",
          color: "green",
          priority: 4,
        });
      } else if (myScore < teamAvgScore * 0.8) {
        list.push({
          icon: <TrendingDown className="h-4 w-4" />,
          title: "Abaixo da média",
          description: "Seu desempenho está abaixo da equipe",
          color: "red",
          priority: 1,
        });
      }
    }

    // Consistency
    const doneOnTime = myTasks.filter(
      (t) => t.status === "concluido" && t.completed_at && t.completed_at.slice(0, 10) <= t.due_date
    ).length;
    if (doneOnTime >= 5 && doneOnTime === done) {
      list.push({
        icon: <Zap className="h-4 w-4" />,
        title: "Consistência alta",
        description: "Todas as entregas no prazo",
        color: "green",
        priority: 5,
      });
    }

    // Alteração bottleneck
    if (inAlteracao > 0) {
      list.push({
        icon: <RefreshCw className="h-4 w-4" />,
        title: "Tarefas em alteração",
        description: `${inAlteracao} tarefa${inAlteracao > 1 ? "s" : ""} parada${inAlteracao > 1 ? "s" : ""} nessa etapa`,
        color: "yellow",
        priority: 2,
      });
    }

    // Month comparison
    if (prevMonthDone > 0) {
      if (done > prevMonthDone) {
        list.push({
          icon: <CheckCircle2 className="h-4 w-4" />,
          title: "Evolução mensal",
          description: "Mais tarefas concluídas que no mês passado",
          color: "green",
          priority: 5,
        });
      } else if (done < prevMonthDone * 0.7 && total > 3) {
        list.push({
          icon: <TrendingDown className="h-4 w-4" />,
          title: "Queda de produtividade",
          description: "Menos entregas em relação ao mês anterior",
          color: "red",
          priority: 2,
        });
      }
    }

    // High completion
    if (pctDone >= 80 && total >= 5) {
      list.push({
        icon: <BarChart3 className="h-4 w-4" />,
        title: `${pctDone}% concluído`,
        description: "Metas quase batidas — continue assim!",
        color: "blue",
        priority: 6,
      });
    }

    return list.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }, [myTasks, teamAvgScore, myScore, todayKey, prevMonthDone, total, done, overdue, pctDone]);

  // Headline
  const headline = useMemo(() => {
    if (overdue >= 3) return { text: "Atenção: você tem tarefas acumuladas", sub: "Reorganize suas prioridades para voltar ao ritmo", positive: false, emoji: "⚠️" };
    if (total > 0 && done / total >= 0.7) return { text: "Você está em alto desempenho", sub: "Seu ritmo está acima da média da equipe", positive: true, emoji: "🚀" };
    if (overdue > 0) return { text: "Organize suas prioridades", sub: "Existem entregas que precisam de atenção", positive: false, emoji: "📋" };
    return { text: "Continue avançando nas entregas", sub: "Mantenha o ritmo e foco nas próximas tarefas", positive: true, emoji: "💪" };
  }, [total, done, overdue]);

  // Alert insights (problems only)
  const alerts = insights.filter((i) => i.color === "red");
  const positiveInsights = insights.filter((i) => i.color !== "red");

  return (
    <div
      className="rounded-2xl border border-border/40 p-6 space-y-5"
      style={{
        background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.85) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-sidebar" />
        <h3 className="text-base font-semibold text-foreground">Seu desempenho</h3>
      </div>

      {/* Headline Card */}
      <div
        className={cn(
          "relative rounded-xl p-5 border overflow-hidden transition-all duration-300 hover:scale-[1.01]",
          headline.positive
            ? "border-emerald-500/25"
            : "border-red-500/25"
        )}
        style={{
          background: headline.positive
            ? "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.03) 100%)"
            : "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 100%)",
        }}
      >
        {/* Glow */}
        <div
          className="absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-30 pointer-events-none"
          style={{ background: headline.positive ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)" }}
        />
        <div className="relative">
          <p className={cn("text-lg font-bold tracking-tight", headline.positive ? "text-emerald-400" : "text-red-400")}>
            {headline.emoji} {headline.text}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{headline.sub}</p>

          {/* Progress bar */}
          {total > 0 && (
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Tarefas concluídas</span>
                <span className={cn("font-bold tabular-nums", headline.positive ? "text-emerald-400" : "text-foreground")}>
                  {pctDone}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${pctDone}%`,
                    background: headline.positive
                      ? "linear-gradient(90deg, hsl(160 84% 39%), hsl(142 71% 45%))"
                      : "linear-gradient(90deg, hsl(0 84% 60%), hsl(25 95% 53%))",
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground tabular-nums">{done} de {total} tarefas</p>
            </div>
          )}
        </div>
      </div>

      {/* Alert cards (problems first) */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((insight, i) => (
            <div
              key={`alert-${i}`}
              className="flex items-center gap-3 rounded-xl p-3.5 border border-red-500/25 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
              style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.03) 100%)" }}
            >
              <div className="h-9 w-9 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <span className="text-red-500">{insight.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-400">{insight.title}</p>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Positive / neutral insight cards */}
      {positiveInsights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {positiveInsights.map((insight, i) => (
            <div
              key={`insight-${i}`}
              className={cn(
                "rounded-xl p-3.5 border transition-all duration-200 hover:scale-[1.02] hover:shadow-lg opacity-0",
                CARD_BORDER[insight.color]
              )}
              style={{
                background: "hsl(var(--card) / 0.7)",
                animation: `fadeUp 0.4s ease-out forwards`,
                animationDelay: `${(alerts.length + i) * 0.08}s`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", ICON_BG[insight.color])}>
                  <span className={ICON_TEXT[insight.color]}>{insight.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{insight.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {insights.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Sem dados suficientes para gerar insights ainda.</p>
      )}
    </div>
  );
}
