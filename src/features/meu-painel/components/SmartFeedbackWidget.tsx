import { useMemo } from "react";
import {
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
  RefreshCw, BarChart3, Zap, Shield, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function SmartFeedbackWidget({ myTasks, teamAvgScore, myScore, todayKey, prevMonthDone }: Props) {
  const total = myTasks.length;
  const done = myTasks.filter((t) => t.status === "concluido").length;
  // Tarefas pendentes que já passaram do prazo
  const pendingOverdue = myTasks.filter((t) => t.status !== "concluido" && t.due_date < todayKey).length;
  // Tarefas concluídas APÓS o prazo (completed_at > due_date)
  const completedLate = myTasks.filter((t) => {
    if (t.status !== "concluido" || !t.completed_at) return false;
    const completedDate = t.completed_at.slice(0, 10);
    return completedDate > t.due_date;
  }).length;
  const doneOnTime = myTasks.filter((t) => {
    if (t.status !== "concluido" || !t.completed_at) return false;
    return t.completed_at.slice(0, 10) <= t.due_date;
  }).length;
  // Total de problemas de prazo: pendentes atrasadas + concluídas com atraso
  const totalLateIssues = pendingOverdue + completedLate;
  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;
  const pctOnTime = done > 0 ? Math.round((doneOnTime / done) * 100) : 0;

  const insights = useMemo(() => {
    const list: Insight[] = [];
    const pendingByStage = myTasks
      .filter((t) => t.status !== "concluido")
      .reduce((acc, t) => { acc[t.stage] = (acc[t.stage] || 0) + 1; return acc; }, {} as Record<string, number>);
    const inAlteracao = pendingByStage["alteracoes"] ?? 0;

    // Insight principal: analisa tanto pendentes atrasadas quanto concluídas fora do prazo
    if (totalLateIssues === 0 && total > 0) {
      list.push({ icon: <Shield className="h-4 w-4" />, title: "Organização impecável", description: "Nenhuma tarefa atrasada ou entregue fora do prazo", color: "green", priority: 3 });
    } else {
      if (pendingOverdue > 0) {
        list.push({ icon: <AlertTriangle className="h-4 w-4" />, title: `${pendingOverdue} tarefa${pendingOverdue > 1 ? "s" : ""} atrasada${pendingOverdue > 1 ? "s" : ""}`, description: "Priorize essas entregas o quanto antes", color: "red", priority: 1 });
      }
      if (completedLate > 0) {
        list.push({ icon: <Clock className="h-4 w-4" />, title: `${completedLate} entregue${completedLate > 1 ? "s" : ""} fora do prazo`, description: `${pctOnTime}% das entregas foram no prazo — busque melhorar`, color: "yellow", priority: 2 });
      }
    }

    if (teamAvgScore !== null && teamAvgScore > 0) {
      if (myScore > teamAvgScore) {
        list.push({ icon: <TrendingUp className="h-4 w-4" />, title: "Acima da média", description: "Seu desempenho supera o da equipe", color: "green", priority: 4 });
      } else if (myScore < teamAvgScore * 0.8) {
        list.push({ icon: <TrendingDown className="h-4 w-4" />, title: "Abaixo da média", description: "Seu desempenho está abaixo da equipe", color: "red", priority: 1 });
      }
    }

    if (doneOnTime >= 5 && doneOnTime === done) {
      list.push({ icon: <Zap className="h-4 w-4" />, title: "Consistência alta", description: "Todas as entregas no prazo", color: "green", priority: 5 });
    }

    if (inAlteracao > 0) {
      list.push({ icon: <RefreshCw className="h-4 w-4" />, title: "Tarefas em alteração", description: `${inAlteracao} tarefa${inAlteracao > 1 ? "s" : ""} parada${inAlteracao > 1 ? "s" : ""} nessa etapa`, color: "yellow", priority: 2 });
    }

    if (prevMonthDone > 0) {
      if (done > prevMonthDone) {
        list.push({ icon: <CheckCircle2 className="h-4 w-4" />, title: "Evolução mensal", description: "Mais tarefas concluídas que no mês passado", color: "green", priority: 5 });
      } else if (done < prevMonthDone * 0.7 && total > 3) {
        list.push({ icon: <TrendingDown className="h-4 w-4" />, title: "Queda de produtividade", description: "Menos entregas em relação ao mês anterior", color: "red", priority: 2 });
      }
    }

    if (pctDone >= 80 && total >= 5) {
      list.push({ icon: <BarChart3 className="h-4 w-4" />, title: `${pctDone}% concluído`, description: "Metas quase batidas — continue assim!", color: "blue", priority: 6 });
    }

    return list.sort((a, b) => a.priority - b.priority).slice(0, 4);
  }, [myTasks, teamAvgScore, myScore, todayKey, prevMonthDone, total, done, pendingOverdue, completedLate, totalLateIssues, pctDone, pctOnTime, doneOnTime]);

  const headline = useMemo(() => {
    if (pendingOverdue >= 3) return { text: "Atenção: tarefas acumuladas", sub: "Reorganize suas prioridades para voltar ao ritmo", positive: false, emoji: "⚠️" };
    if (completedLate > 0 && pendingOverdue === 0) return { text: "Entregas fora do prazo", sub: `${completedLate} tarefa${completedLate > 1 ? "s foram marcadas" : " foi marcada"} após o prazo definido`, positive: false, emoji: "📋" };
    if (total > 0 && done / total >= 0.7 && totalLateIssues === 0) return { text: "Alto desempenho", sub: "Seu ritmo está acima da média — tudo no prazo!", positive: true, emoji: "🚀" };
    if (total > 0 && done / total >= 0.7) return { text: "Bom ritmo", sub: `${pctOnTime}% das entregas no prazo`, positive: true, emoji: "🚀" };
    if (pendingOverdue > 0) return { text: "Organize suas prioridades", sub: "Existem entregas que precisam de atenção", positive: false, emoji: "📋" };
    return { text: "Continue avançando", sub: "Mantenha o ritmo e foco nas próximas tarefas", positive: true, emoji: "💪" };
  }, [total, done, pendingOverdue, completedLate, totalLateIssues, pctOnTime]);

  const alerts = insights.filter((i) => i.color === "red");
  const positiveInsights = insights.filter((i) => i.color !== "red");

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3 transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-sidebar/20 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-sidebar" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Seu desempenho</h3>
      </div>

      {/* Headline + Metrics row */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <p className={cn("text-xl font-bold tracking-tight", headline.positive ? "text-emerald-500" : "text-red-500")}>
            {headline.emoji} {headline.text}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{headline.sub}</p>
        </div>

        {total > 0 && (
          <div className="flex gap-2 shrink-0">
            <div className="rounded-xl px-3.5 py-2.5 border border-border bg-muted/50 text-center transition-all duration-200 hover:scale-105">
              <p className="text-lg font-bold text-foreground tabular-nums">{done}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Feitas</p>
            </div>
            <div className="rounded-xl px-3.5 py-2.5 border border-border bg-muted/50 text-center transition-all duration-200 hover:scale-105">
              <p className={cn("text-lg font-bold tabular-nums", headline.positive ? "text-emerald-500" : "text-foreground")}>{pctDone}%</p>
              <p className="text-[10px] text-muted-foreground font-medium">Concluído</p>
            </div>
            {teamAvgScore !== null && (
              <div className="rounded-xl px-3.5 py-2.5 border border-border bg-muted/50 text-center transition-all duration-200 hover:scale-105">
                <p className="text-lg font-bold text-foreground tabular-nums">{teamAvgScore}</p>
                <p className="text-[10px] text-muted-foreground font-medium">Média</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="h-2.5 rounded-full overflow-hidden bg-muted">
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

      {/* Alert cards */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((insight, i) => (
            <div
              key={`alert-${i}`}
              className="flex items-center gap-3 rounded-xl p-3.5 border border-red-500/20 bg-red-50 dark:bg-red-500/5 transition-all duration-200 hover:scale-[1.02] hover:shadow-md"
            >
              <div className="h-10 w-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <span className="text-red-500">{insight.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-red-500">{insight.title}</p>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Positive insight cards */}
      {positiveInsights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {positiveInsights.map((insight, i) => (
            <div
              key={`insight-${i}`}
              className="rounded-xl p-3.5 border border-border bg-muted/30 transition-all duration-200 hover:scale-[1.03] hover:shadow-md opacity-0"
              style={{ animation: `fadeUp 0.4s ease-out forwards`, animationDelay: `${(alerts.length + i) * 0.08}s` }}
            >
              <div className="flex items-start gap-3">
                <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", ICON_BG[insight.color])}>
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
