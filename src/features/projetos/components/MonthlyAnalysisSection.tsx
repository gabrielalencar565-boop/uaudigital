import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, Award, Clock, Zap, BarChart3 } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth,
} from "date-fns";

interface Task {
  id: string;
  status_global: string;
  due_date: string | null;
  created_at?: string;
}

interface Props {
  tasks: Task[];
  /** Reference date (defaults to now) */
  now?: Date;
}

function getClassification(score: number) {
  if (score >= 90) return { label: "Excelente", tone: "success" as const };
  if (score >= 75) return { label: "Saudável", tone: "primary" as const };
  if (score >= 60) return { label: "Atenção", tone: "warning" as const };
  return { label: "Crítico", tone: "danger" as const };
}

function toneColor(tone: "success" | "primary" | "warning" | "danger") {
  switch (tone) {
    case "success": return "hsl(var(--success))";
    case "warning": return "hsl(var(--warning))";
    case "danger": return "hsl(var(--danger))";
    default: return "hsl(var(--primary))";
  }
}

export function MonthlyAnalysisSection({ tasks, now: nowProp }: Props) {
  const now = nowProp ?? new Date();
  const totalDays = getDaysInMonth(now);
  const currentDay = now.getDate();

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status_global === "concluido").length;

  // ── Progress line chart data ──
  // Simulate cumulative progress: count tasks whose due_date <= day AND are completed
  const progressData = useMemo(() => {
    const monthStr = format(now, "yyyy-MM");
    const days = eachDayOfInterval({
      start: startOfMonth(now),
      end: new Date(Math.min(now.getTime(), endOfMonth(now).getTime())),
    });

    // Group completed tasks by completion approximation (due_date as proxy)
    let cumDone = 0;
    return days.map(d => {
      const dayNum = d.getDate();
      const dateStr = format(d, "yyyy-MM-dd");
      // Count tasks completed with due_date <= this day
      const doneUpToDay = tasks.filter(t =>
        t.status_global === "concluido" && t.due_date && t.due_date <= dateStr
      ).length;
      const pct = totalTasks > 0 ? Math.round((doneUpToDay / totalTasks) * 100) : 0;
      return { dia: dayNum, percentual: pct };
    });
  }, [tasks, now, totalTasks]);

  // ── Uau Score calculation ──
  const { prazo, eficiencia, consistencia, uauScore } = useMemo(() => {
    // Prazo: based on when operation finishes (last completed task due_date)
    const completedDueDates = tasks
      .filter(t => t.status_global === "concluido" && t.due_date)
      .map(t => new Date(t.due_date!).getDate());
    const lastDay = completedDueDates.length > 0 ? Math.max(...completedDueDates) : currentDay;

    let prazoScore: number;
    if (doneTasks === totalTasks && totalTasks > 0) {
      // All done
      if (lastDay <= 25) prazoScore = 100;
      else if (lastDay <= 27) prazoScore = 85;
      else if (lastDay <= 30) prazoScore = 60;
      else prazoScore = 40;
    } else {
      // Not finished yet - estimate based on current day
      if (currentDay <= 20) prazoScore = 80;
      else if (currentDay <= 25) prazoScore = 65;
      else if (currentDay <= 27) prazoScore = 50;
      else prazoScore = 35;
    }

    // Eficiência
    const eficienciaScore = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // Consistência: measure how evenly tasks are distributed across days
    let consistenciaScore = 50;
    if (doneTasks > 0) {
      const dayBuckets: Record<number, number> = {};
      tasks.filter(t => t.status_global === "concluido" && t.due_date).forEach(t => {
        const d = new Date(t.due_date!).getDate();
        dayBuckets[d] = (dayBuckets[d] ?? 0) + 1;
      });
      const counts = Object.values(dayBuckets);
      if (counts.length > 1) {
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
        const cv = avg > 0 ? Math.sqrt(variance) / avg : 0; // coefficient of variation
        // Lower CV = more consistent. CV=0 → 100, CV>=2 → 20
        consistenciaScore = Math.max(20, Math.min(100, Math.round(100 - cv * 40)));
      } else if (counts.length === 1) {
        // All tasks done in one day → low consistency
        consistenciaScore = doneTasks <= 3 ? 70 : 30;
      }
      // Bonus for spreading across many days
      const spreadRatio = counts.length / Math.min(currentDay, 27);
      consistenciaScore = Math.round(consistenciaScore * 0.7 + spreadRatio * 100 * 0.3);
      consistenciaScore = Math.max(0, Math.min(100, consistenciaScore));
    }

    const score = Math.round((prazoScore + eficienciaScore + consistenciaScore) / 3);
    return { prazo: prazoScore, eficiencia: eficienciaScore, consistencia: consistenciaScore, uauScore: score };
  }, [tasks, currentDay, doneTasks, totalTasks]);

  const classification = getClassification(uauScore);
  const scoreColor = toneColor(classification.tone);

  // Donut data
  const donutData = [
    { name: "score", value: uauScore },
    { name: "rest", value: 100 - uauScore },
  ];

  const indicators = [
    { label: "Prazo", value: prazo, icon: Clock },
    { label: "Eficiência", value: eficiencia, icon: Zap },
    { label: "Consistência", value: consistencia, icon: BarChart3 },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
          <p className="font-semibold text-foreground">Dia {label}</p>
          <p className="text-muted-foreground">{payload[0].value}% concluído</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-sidebar" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">Análise Mensal da Operação</p>
          <p className="text-xs text-muted-foreground">Performance e progresso do mês atual</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Chart 1: Progresso da Operação ── */}
        <Card>
          <CardContent className="py-5 px-5 space-y-4">
            <div>
              <p className="text-base font-bold text-foreground">Progresso da Operação no Mês</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mostra como a operação evoluiu ao longo do mês até o Magic Number.
              </p>
            </div>

            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="progressGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--sidebar))" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(var(--sidebar))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="dia"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="percentual"
                    stroke="hsl(var(--sidebar))"
                    strokeWidth={2.5}
                    fill="url(#progressGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--sidebar))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
              <span>Dia atual: <strong className="text-foreground">{currentDay}</strong></span>
              <span>Progresso: <strong className="text-foreground">{totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}%</strong></span>
              <span>{doneTasks}/{totalTasks} tarefas</span>
            </div>
          </CardContent>
        </Card>

        {/* ── Chart 2: Uau Score ── */}
        <Card>
          <CardContent className="py-5 px-5 space-y-4">
            <div>
              <p className="text-base font-bold text-foreground">Uau Score do Mês</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nota geral da performance da operação no mês atual.
              </p>
            </div>

            <div className="flex items-center justify-center">
              <div className="relative">
                <ProgressRing
                  value={uauScore}
                  size={160}
                  stroke={16}
                  tone={classification.tone}
                  label={
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-3xl font-black tabular-nums" style={{ color: scoreColor }}>
                        <AnimatedNumber value={uauScore} />
                      </span>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: scoreColor }}
                      >
                        {classification.label}
                      </span>
                    </div>
                  }
                />
              </div>
            </div>

            {/* Indicators */}
            <div className="space-y-3 pt-2">
              {indicators.map(ind => {
                const IndIcon = ind.icon;
                const indClass = getClassification(ind.value);
                const indColor = toneColor(indClass.tone);
                return (
                  <div key={ind.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <IndIcon className="h-3.5 w-3.5" />
                        {ind.label}
                      </span>
                      <span className="font-bold tabular-nums" style={{ color: indColor }}>
                        <AnimatedNumber value={ind.value} />
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${ind.value}%`, backgroundColor: indColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
