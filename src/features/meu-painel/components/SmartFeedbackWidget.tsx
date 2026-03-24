import { useMemo } from "react";
import { CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Clock, RefreshCw, BarChart3, Zap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/uau";

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
  /** tasks from previous month for comparison */
  prevMonthDone: number;
}

interface Insight {
  icon: React.ReactNode;
  text: string;
  color: "green" | "red" | "yellow" | "blue" | "muted";
  priority: number; // lower = higher priority
}

const COLOR_MAP: Record<string, string> = {
  green: "text-emerald-500",
  red: "text-red-500",
  yellow: "text-amber-500",
  blue: "text-blue-500",
  muted: "text-muted-foreground",
};

const BG_MAP: Record<string, string> = {
  green: "bg-emerald-500/10",
  red: "bg-red-500/10",
  yellow: "bg-amber-500/10",
  blue: "bg-blue-500/10",
  muted: "bg-muted/30",
};

export function SmartFeedbackWidget({ myTasks, teamAvgScore, myScore, todayKey, prevMonthDone }: Props) {
  const insights = useMemo(() => {
    const list: Insight[] = [];
    const total = myTasks.length;
    const done = myTasks.filter((t) => t.status === "concluido").length;
    const overdue = myTasks.filter((t) => t.status !== "concluido" && t.due_date < todayKey).length;
    const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;

    // Stage concentration
    const pendingByStage = myTasks
      .filter((t) => t.status !== "concluido")
      .reduce((acc, t) => {
        acc[t.stage] = (acc[t.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topStage = Object.entries(pendingByStage).sort((a, b) => b[1] - a[1])[0];

    // Overdue
    if (overdue === 0 && total > 0) {
      list.push({
        icon: <Shield className="h-4 w-4" />,
        text: "Nenhuma tarefa atrasada. Excelente organização!",
        color: "green",
        priority: 3,
      });
    } else if (overdue > 0) {
      list.push({
        icon: <AlertTriangle className="h-4 w-4" />,
        text: `Você tem ${overdue} tarefa${overdue > 1 ? "s" : ""} atrasada${overdue > 1 ? "s" : ""}. Priorize!`,
        color: "red",
        priority: 1,
      });
    }

    // Stage bottleneck
    if (topStage && topStage[1] >= 3) {
      const stageLabel = STAGES.find((s) => s.key === topStage[0])?.label ?? topStage[0];
      list.push({
        icon: <Clock className="h-4 w-4" />,
        text: `Sua maior concentração de tarefas está em ${stageLabel} (${topStage[1]})`,
        color: "yellow",
        priority: 2,
      });
    }

    // Alteração bottleneck
    const inAlteracao = pendingByStage["alteracoes"] ?? 0;
    if (inAlteracao > 0) {
      list.push({
        icon: <RefreshCw className="h-4 w-4" />,
        text: `Você possui ${inAlteracao} tarefa${inAlteracao > 1 ? "s" : ""} parada${inAlteracao > 1 ? "s" : ""} em alteração`,
        color: "yellow",
        priority: 2,
      });
    }

    // Team comparison
    if (teamAvgScore !== null && teamAvgScore > 0) {
      if (myScore > teamAvgScore) {
        list.push({
          icon: <TrendingUp className="h-4 w-4" />,
          text: "Seu desempenho está acima da média da equipe",
          color: "green",
          priority: 4,
        });
      } else if (myScore < teamAvgScore * 0.8) {
        list.push({
          icon: <TrendingDown className="h-4 w-4" />,
          text: "Seu desempenho está abaixo da média da equipe",
          color: "red",
          priority: 1,
        });
      }
    }

    // Month comparison
    if (prevMonthDone > 0) {
      if (done > prevMonthDone) {
        list.push({
          icon: <Zap className="h-4 w-4" />,
          text: "Você concluiu mais tarefas do que no mês passado",
          color: "green",
          priority: 5,
        });
      } else if (done < prevMonthDone * 0.7 && total > 3) {
        list.push({
          icon: <TrendingDown className="h-4 w-4" />,
          text: "Sua produtividade caiu em relação ao mês anterior",
          color: "red",
          priority: 2,
        });
      }
    }

    // High completion
    if (pctDone >= 80 && total >= 5) {
      list.push({
        icon: <CheckCircle2 className="h-4 w-4" />,
        text: `Você já concluiu ${pctDone}% das tarefas. Continue assim!`,
        color: "green",
        priority: 6,
      });
    }

    // Consistency (all done on time)
    const doneOnTime = myTasks.filter(
      (t) => t.status === "concluido" && t.completed_at && t.completed_at.slice(0, 10) <= t.due_date
    ).length;
    if (doneOnTime >= 5 && doneOnTime === done) {
      list.push({
        icon: <BarChart3 className="h-4 w-4" />,
        text: "Você manteve um ritmo constante — todas as entregas no prazo",
        color: "green",
        priority: 5,
      });
    }

    return list.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }, [myTasks, teamAvgScore, myScore, todayKey, prevMonthDone]);

  // Headline
  const headline = useMemo(() => {
    const overdue = myTasks.filter((t) => t.status !== "concluido" && t.due_date < todayKey).length;
    if (overdue >= 3) return { text: "Atenção: você tem tarefas acumuladas em atraso", positive: false };
    const done = myTasks.filter((t) => t.status === "concluido").length;
    const total = myTasks.length;
    if (total > 0 && done / total >= 0.7) return { text: "Você está em um ótimo ritmo este mês!", positive: true };
    if (overdue > 0) return { text: "Organize suas prioridades para voltar ao ritmo", positive: false };
    return { text: "Continue avançando nas suas entregas", positive: true };
  }, [myTasks, todayKey]);

  return (
    <div
      className="rounded-2xl border border-border/40 p-6 space-y-4"
      style={{
        background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.85) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div>
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-sidebar" />
          Seu desempenho
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Resumo automático baseado na sua performance</p>
      </div>

      {/* Headline */}
      <div
        className={cn(
          "rounded-xl p-4 border",
          headline.positive
            ? "bg-emerald-500/8 border-emerald-500/20"
            : "bg-red-500/8 border-red-500/20"
        )}
      >
        <p className={cn("text-sm font-semibold", headline.positive ? "text-emerald-500" : "text-red-500")}>
          {headline.positive ? "🚀" : "⚠️"} {headline.text}
        </p>
      </div>

      {/* Insights */}
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg p-3 border border-border/20 opacity-0"
            style={{
              background: "hsl(var(--card) / 0.5)",
              animation: `fadeUp 0.4s ease-out forwards`,
              animationDelay: `${i * 0.08}s`,
            }}
          >
            <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0 mt-0.5", BG_MAP[insight.color])}>
              <span className={COLOR_MAP[insight.color]}>{insight.icon}</span>
            </div>
            <p className="text-sm text-foreground/90 leading-relaxed">{insight.text}</p>
          </div>
        ))}
        {insights.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Sem dados suficientes para gerar insights ainda.</p>
        )}
      </div>
    </div>
  );
}
