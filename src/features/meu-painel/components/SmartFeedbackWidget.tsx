import { useMemo } from "react";
import {
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
  RefreshCw, Zap, Shield, Sparkles, Clock, ArrowUpRight,
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
  label: string;
  color: "green" | "red" | "yellow" | "blue";
  priority: number;
}

export function SmartFeedbackWidget({ myTasks, teamAvgScore, myScore, todayKey, prevMonthDone }: Props) {
  const total = myTasks.length;
  const done = myTasks.filter((t) => t.status === "concluido").length;
  const pendingOverdue = myTasks.filter((t) => t.status !== "concluido" && t.due_date < todayKey).length;
  const completedLate = myTasks.filter((t) => {
    if (t.status !== "concluido" || !t.completed_at) return false;
    return t.completed_at.slice(0, 10) > t.due_date;
  }).length;
  const doneOnTime = myTasks.filter((t) => {
    if (t.status !== "concluido" || !t.completed_at) return false;
    return t.completed_at.slice(0, 10) <= t.due_date;
  }).length;
  const totalLateIssues = pendingOverdue + completedLate;
  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;

  // Nota de 0 a 10 baseada no desempenho
  const nota = useMemo(() => {
    if (total === 0) return 0;
    const pctComplete = done / total;
    const pctOnTime = done > 0 ? doneOnTime / done : 1;
    // 50% peso conclusão, 50% peso pontualidade
    const raw = (pctComplete * 5) + (pctOnTime * 5);
    return Math.round(raw * 10) / 10;
  }, [total, done, doneOnTime]);

  // Variação vs mês anterior
  const monthDelta = useMemo(() => {
    if (prevMonthDone <= 0) return null;
    const pct = Math.round(((done - prevMonthDone) / prevMonthDone) * 100);
    return pct;
  }, [done, prevMonthDone]);

  // Headline
  const headline = useMemo(() => {
    if (pendingOverdue >= 3) return { text: "Atenção necessária", sub: "Reorganize suas prioridades para voltar ao ritmo", positive: false, emoji: "⚠️" };
    if (completedLate > 0 && pendingOverdue === 0) return { text: "Quase lá", sub: `${completedLate} entrega${completedLate > 1 ? "s" : ""} fora do prazo neste mês`, positive: false, emoji: "📋" };
    if (total > 0 && pctDone >= 70 && totalLateIssues === 0) return { text: "Alto desempenho", sub: "Você está acima da média da equipe", positive: true, emoji: "🚀" };
    if (total > 0 && pctDone >= 70) return { text: "Bom ritmo", sub: "Continue focado nas próximas entregas", positive: true, emoji: "🚀" };
    if (pendingOverdue > 0) return { text: "Foco nas prioridades", sub: "Existem entregas que precisam de atenção", positive: false, emoji: "📋" };
    return { text: "Continue avançando", sub: "Mantenha o ritmo nas próximas tarefas", positive: true, emoji: "💪" };
  }, [total, pctDone, pendingOverdue, completedLate, totalLateIssues]);

  // Insights list
  const insights = useMemo(() => {
    const list: Insight[] = [];
    const pendingByStage = myTasks
      .filter((t) => t.status !== "concluido")
      .reduce((acc, t) => { acc[t.stage] = (acc[t.stage] || 0) + 1; return acc; }, {} as Record<string, number>);

    if (totalLateIssues === 0 && total > 0) {
      list.push({ icon: <Shield className="h-3.5 w-3.5" />, label: "Organização impecável — tudo no prazo", color: "green", priority: 3 });
    } else {
      if (pendingOverdue > 0) {
        list.push({ icon: <AlertTriangle className="h-3.5 w-3.5" />, label: `${pendingOverdue} tarefa${pendingOverdue > 1 ? "s" : ""} atrasada${pendingOverdue > 1 ? "s" : ""} — priorize agora`, color: "red", priority: 1 });
      }
      if (completedLate > 0) {
        list.push({ icon: <Clock className="h-3.5 w-3.5" />, label: `${completedLate} entrega${completedLate > 1 ? "s" : ""} fora do prazo neste mês`, color: "yellow", priority: 2 });
      }
    }

    if (teamAvgScore !== null && teamAvgScore > 0) {
      if (myScore > teamAvgScore) {
        list.push({ icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Acima da média da equipe", color: "green", priority: 4 });
      } else if (myScore < teamAvgScore * 0.8) {
        list.push({ icon: <TrendingDown className="h-3.5 w-3.5" />, label: "Abaixo da média da equipe", color: "red", priority: 1 });
      }
    }

    if (doneOnTime >= 5 && doneOnTime === done) {
      list.push({ icon: <Zap className="h-3.5 w-3.5" />, label: "Consistência alta nas entregas", color: "green", priority: 5 });
    }

    if ((pendingByStage["alteracoes"] ?? 0) > 0) {
      list.push({ icon: <RefreshCw className="h-3.5 w-3.5" />, label: `${pendingByStage["alteracoes"]} tarefa${(pendingByStage["alteracoes"] ?? 0) > 1 ? "s" : ""} parada${(pendingByStage["alteracoes"] ?? 0) > 1 ? "s" : ""} em alteração`, color: "yellow", priority: 2 });
    }

    if (prevMonthDone > 0 && done > prevMonthDone) {
      list.push({ icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: "Evolução em relação ao mês passado", color: "green", priority: 5 });
    } else if (prevMonthDone > 0 && done < prevMonthDone * 0.7 && total > 3) {
      list.push({ icon: <TrendingDown className="h-3.5 w-3.5" />, label: "Queda de produtividade vs mês anterior", color: "red", priority: 2 });
    }

    return list.sort((a, b) => a.priority - b.priority).slice(0, 5);
  }, [myTasks, teamAvgScore, myScore, todayKey, prevMonthDone, total, done, pendingOverdue, completedLate, totalLateIssues, doneOnTime]);

  const DOT_COLOR: Record<string, string> = {
    green: "bg-emerald-400",
    red: "bg-red-400",
    yellow: "bg-amber-400",
    blue: "bg-blue-400",
  };

  const ICON_COLOR: Record<string, string> = {
    green: "text-emerald-500",
    red: "text-red-500",
    yellow: "text-amber-500",
    blue: "text-blue-500",
  };

  const notaColor = nota >= 8 ? "text-emerald-500" : nota >= 6 ? "text-amber-500" : "text-red-500";
  const notaGlow = nota >= 8 ? "shadow-emerald-500/20" : nota >= 6 ? "shadow-amber-500/20" : "shadow-red-500/20";
  const notaBorder = nota >= 8 ? "border-emerald-500/20" : nota >= 6 ? "border-amber-500/20" : "border-red-500/20";

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4 transition-all duration-300 hover:shadow-lg">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-sidebar/20 to-sidebar/5 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-sidebar" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-foreground tracking-tight">{headline.emoji} {headline.text}</h3>
            </div>
            <p className="text-xs text-muted-foreground/70 mt-0.5">{headline.sub}</p>
          </div>
        </div>

        {/* Nota badge */}
        <div className={cn(
          "flex flex-col items-center rounded-xl border px-3 py-1.5 shrink-0 shadow-sm transition-all duration-500",
          notaBorder, notaGlow
        )}
          style={{ animation: "fadeUp 0.6s ease-out forwards" }}
        >
          <span className={cn("text-2xl font-black tabular-nums tracking-tighter leading-none", notaColor)}>
            {nota.toFixed(1)}
          </span>
          <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-0.5">nota</span>
        </div>
      </div>

      {/* ── Dynamic highlight ── */}
      {monthDelta !== null && (
        <div
          className="flex items-center gap-1.5 opacity-0"
          style={{ animation: "fadeUp 0.5s ease-out 0.2s forwards" }}
        >
          <ArrowUpRight className={cn("h-3.5 w-3.5", monthDelta >= 0 ? "text-emerald-500" : "text-red-500 rotate-90")} />
          <span className={cn("text-xs font-semibold tabular-nums", monthDelta >= 0 ? "text-emerald-500" : "text-red-500")}>
            {monthDelta >= 0 ? "+" : ""}{monthDelta}% vs mês anterior
          </span>
        </div>
      )}

      {/* ── Inline metrics ── */}
      {total > 0 && (
        <div
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 font-medium opacity-0"
          style={{ animation: "fadeUp 0.5s ease-out 0.3s forwards" }}
        >
          <span className="text-foreground font-semibold tabular-nums">{done}</span>
          <span>tarefas</span>
          <span className="text-muted-foreground/30">•</span>
          <span className="text-foreground font-semibold tabular-nums">{pctDone}%</span>
          <span>concluído</span>
          {teamAvgScore !== null && (
            <>
              <span className="text-muted-foreground/30">•</span>
              <span>média</span>
              <span className="text-foreground font-semibold tabular-nums">{teamAvgScore}</span>
            </>
          )}
        </div>
      )}

      {/* ── Insights list ── */}
      {insights.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5 py-1 rounded-lg transition-all duration-200 hover:bg-muted/30 px-1.5 -mx-1.5 cursor-default opacity-0 group"
              style={{ animation: `fadeUp 0.4s ease-out ${0.35 + i * 0.07}s forwards` }}
            >
              <div className={cn("h-1.5 w-1.5 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-150", DOT_COLOR[insight.color])} />
              <span className={cn("shrink-0", ICON_COLOR[insight.color])}>{insight.icon}</span>
              <span className="text-[13px] text-foreground/80 font-medium">{insight.label}</span>
            </div>
          ))}
        </div>
      )}

      {insights.length === 0 && total === 0 && (
        <p className="text-sm text-muted-foreground/50 text-center py-3">Sem dados suficientes para gerar insights.</p>
      )}
    </div>
  );
}
