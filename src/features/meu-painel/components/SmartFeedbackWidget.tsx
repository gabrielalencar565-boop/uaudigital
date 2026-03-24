import { useMemo, useCallback, useRef, useState } from "react";
import {
  CheckCircle2, AlertTriangle, TrendingUp, TrendingDown,
  RefreshCw, BarChart3, Zap, Shield, Sparkles,
} from "lucide-react";
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
const CARD_GLOW: Record<string, string> = {
  green: "hover:shadow-emerald-500/10",
  red: "hover:shadow-red-500/10",
  yellow: "hover:shadow-amber-500/10",
  blue: "hover:shadow-blue-500/10",
};

export function SmartFeedbackWidget({ myTasks, teamAvgScore, myScore, todayKey, prevMonthDone }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const total = myTasks.length;
  const done = myTasks.filter((t) => t.status === "concluido").length;
  const overdue = myTasks.filter((t) => t.status !== "concluido" && t.due_date < todayKey).length;
  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const insights = useMemo(() => {
    const list: Insight[] = [];
    const pendingByStage = myTasks
      .filter((t) => t.status !== "concluido")
      .reduce((acc, t) => { acc[t.stage] = (acc[t.stage] || 0) + 1; return acc; }, {} as Record<string, number>);
    const inAlteracao = pendingByStage["alteracoes"] ?? 0;

    if (overdue === 0 && total > 0) {
      list.push({ icon: <Shield className="h-4 w-4" />, title: "Organização impecável", description: "Nenhuma tarefa atrasada", color: "green", priority: 3 });
    } else if (overdue > 0) {
      list.push({ icon: <AlertTriangle className="h-4 w-4" />, title: `${overdue} tarefa${overdue > 1 ? "s" : ""} atrasada${overdue > 1 ? "s" : ""}`, description: "Priorize essas entregas o quanto antes", color: "red", priority: 1 });
    }

    if (teamAvgScore !== null && teamAvgScore > 0) {
      if (myScore > teamAvgScore) {
        list.push({ icon: <TrendingUp className="h-4 w-4" />, title: "Acima da média", description: "Seu desempenho supera o da equipe", color: "green", priority: 4 });
      } else if (myScore < teamAvgScore * 0.8) {
        list.push({ icon: <TrendingDown className="h-4 w-4" />, title: "Abaixo da média", description: "Seu desempenho está abaixo da equipe", color: "red", priority: 1 });
      }
    }

    const doneOnTime = myTasks.filter((t) => t.status === "concluido" && t.completed_at && t.completed_at.slice(0, 10) <= t.due_date).length;
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
  }, [myTasks, teamAvgScore, myScore, todayKey, prevMonthDone, total, done, overdue, pctDone]);

  const headline = useMemo(() => {
    if (overdue >= 3) return { text: "Atenção: tarefas acumuladas", sub: "Reorganize suas prioridades para voltar ao ritmo", positive: false, emoji: "⚠️" };
    if (total > 0 && done / total >= 0.7) return { text: "Alto desempenho", sub: "Seu ritmo está acima da média da equipe", positive: true, emoji: "🚀" };
    if (overdue > 0) return { text: "Organize suas prioridades", sub: "Existem entregas que precisam de atenção", positive: false, emoji: "📋" };
    return { text: "Continue avançando", sub: "Mantenha o ritmo e foco nas próximas tarefas", positive: true, emoji: "💪" };
  }, [total, done, overdue]);

  const alerts = insights.filter((i) => i.color === "red");
  const positiveInsights = insights.filter((i) => i.color !== "red");

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1 hover:scale-[1.005]"
      style={{
        borderRadius: 24,
        boxShadow: isHovered
          ? "0 16px 48px -8px rgba(124,58,237,0.25), 0 0 0 1px rgba(139,92,246,0.2), inset 0 0 0 1px rgba(255,255,255,0.08)"
          : "0 8px 32px -8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* Deep gradient background */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(145deg, hsl(263 50% 12%) 0%, hsl(240 30% 8%) 50%, hsl(263 40% 10%) 100%)",
      }} />

      {/* Subtle noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }} />

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)",
      }} />

      {/* Mouse light effect */}
      {isHovered && (
        <div
          className="absolute pointer-events-none transition-opacity duration-300"
          style={{
            left: mousePos.x - 150,
            top: mousePos.y - 150,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          }}
        />
      )}

      {/* Border glow on hover */}
      <div className="absolute inset-0 pointer-events-none rounded-[24px] transition-opacity duration-500 opacity-0 group-hover:opacity-100" style={{
        boxShadow: "inset 0 0 0 1.5px rgba(139,92,246,0.3), 0 0 20px rgba(124,58,237,0.1)",
      }} />

      {/* Content */}
      <div className="relative z-10 p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sidebar/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-sidebar" />
          </div>
          <h3 className="text-base font-semibold text-white/90">Seu desempenho</h3>
        </div>

        {/* Headline + Metrics row */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Left: Headline */}
          <div className="flex-1 min-w-0">
            <p className={cn("text-xl font-bold tracking-tight", headline.positive ? "text-emerald-400" : "text-red-400")}>
              {headline.emoji} {headline.text}
            </p>
            <p className="text-xs text-white/50 mt-1">{headline.sub}</p>
          </div>

          {/* Right: Mini metric cards */}
          {total > 0 && (
            <div className="flex gap-2 shrink-0">
              <div className="rounded-xl px-3.5 py-2.5 border border-white/8 text-center transition-all duration-200 hover:scale-105 hover:border-white/15" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="text-lg font-bold text-white tabular-nums">{done}</p>
                <p className="text-[10px] text-white/40 font-medium">Feitas</p>
              </div>
              <div className="rounded-xl px-3.5 py-2.5 border border-white/8 text-center transition-all duration-200 hover:scale-105 hover:border-white/15" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className={cn("text-lg font-bold tabular-nums", headline.positive ? "text-emerald-400" : "text-foreground")}>{pctDone}%</p>
                <p className="text-[10px] text-white/40 font-medium">Concluído</p>
              </div>
              {teamAvgScore !== null && (
                <div className="rounded-xl px-3.5 py-2.5 border border-white/8 text-center transition-all duration-200 hover:scale-105 hover:border-white/15" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <p className="text-lg font-bold text-white/80 tabular-nums">{teamAvgScore}</p>
                  <p className="text-[10px] text-white/40 font-medium">Média</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="space-y-1.5">
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${pctDone}%`,
                  background: headline.positive
                    ? "linear-gradient(90deg, hsl(160 84% 39%), hsl(142 71% 45%))"
                    : "linear-gradient(90deg, hsl(0 84% 60%), hsl(25 95% 53%))",
                  boxShadow: headline.positive
                    ? "0 0 12px rgba(16,185,129,0.4)"
                    : "0 0 12px rgba(239,68,68,0.4)",
                }}
              />
            </div>
            <p className="text-[10px] text-white/30 tabular-nums">{done} de {total} tarefas</p>
          </div>
        )}

        {/* Alert cards */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.map((insight, i) => (
              <div
                key={`alert-${i}`}
                className="flex items-center gap-3 rounded-xl p-3.5 border border-red-500/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-red-500/10 hover:border-red-500/40"
                style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.03) 100%)" }}
              >
                <div className="h-10 w-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0" style={{ boxShadow: "0 0 12px rgba(239,68,68,0.15)" }}>
                  <span className="text-red-400">{insight.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-red-400">{insight.title}</p>
                  <p className="text-xs text-white/40">{insight.description}</p>
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
                className={cn(
                  "rounded-xl p-3.5 border border-white/8 transition-all duration-200 hover:scale-[1.03] hover:shadow-lg hover:border-white/15 opacity-0",
                  CARD_GLOW[insight.color]
                )}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  animation: `fadeUp 0.4s ease-out forwards`,
                  animationDelay: `${(alerts.length + i) * 0.08}s`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center shrink-0", ICON_BG[insight.color])} style={{ boxShadow: `0 0 10px ${insight.color === "green" ? "rgba(16,185,129,0.12)" : insight.color === "yellow" ? "rgba(245,158,11,0.12)" : "rgba(59,130,246,0.12)"}` }}>
                    <span className={ICON_TEXT[insight.color]}>{insight.icon}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/90">{insight.title}</p>
                    <p className="text-[11px] text-white/40 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {insights.length === 0 && (
          <p className="text-sm text-white/30 text-center py-4">Sem dados suficientes para gerar insights ainda.</p>
        )}
      </div>
    </div>
  );
}
