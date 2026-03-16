import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip,
  LineChart, Line, Cell,
} from "recharts";
import { Trophy, AlertTriangle, TrendingUp, TrendingDown, CalendarCheck, Target, X } from "lucide-react";
import { useMagic2Year } from "@/features/magic2/hooks/use-magic2-year";
import { useMagic2Month } from "@/features/magic2/hooks/use-magic2";
import { MAGIC2_STAGES } from "@/features/magic2/magic2-stages";
import { getDaysInMonth } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

function getClassification(score: number) {
  if (score >= 90) return { label: "Excelente", tone: "success" as const };
  if (score >= 75) return { label: "Saudável", tone: "primary" as const };
  if (score >= 60) return { label: "Atenção", tone: "warning" as const };
  return { label: "Crítico", tone: "danger" as const };
}

function toneColor(tone: "success" | "primary" | "warning" | "danger") {
  switch (tone) {
    case "success": return "hsl(142, 71%, 45%)";
    case "warning": return "hsl(38, 92%, 50%)";
    case "danger": return "hsl(0, 84%, 60%)";
    default: return "hsl(142, 50%, 55%)";
  }
}

function barColor(score: number) {
  if (score >= 90) return "hsl(142, 71%, 45%)";
  if (score >= 75) return "hsl(142, 50%, 55%)";
  if (score >= 60) return "hsl(38, 92%, 50%)";
  return "hsl(0, 84%, 60%)";
}

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function computeMonthScore(monthStages: any[], totalClients: number, monthNum: number, year: number) {
  const totalStages = totalClients * MAGIC2_STAGES.length;
  const doneStages = monthStages.filter(s => s.completed).length;
  const daysInMonth = getDaysInMonth(new Date(year, monthNum - 1, 1));

  // Prazo
  const completedDates = monthStages
    .filter(s => s.completed && s.completed_at)
    .map(s => new Date(s.completed_at!).getDate());
  const lastDay = completedDates.length > 0 ? Math.max(...completedDates) : daysInMonth;

  let prazo: number;
  if (doneStages === totalStages && totalStages > 0) {
    if (lastDay <= 25) prazo = 100;
    else if (lastDay <= 27) prazo = 85;
    else if (lastDay <= 30) prazo = 60;
    else prazo = 40;
  } else {
    prazo = 35;
  }

  // Eficiência
  const eficiencia = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

  // Consistência
  let consistencia = 50;
  if (doneStages > 0) {
    const dayBuckets: Record<number, number> = {};
    monthStages.filter(s => s.completed && s.completed_at).forEach(s => {
      const d = new Date(s.completed_at!).getDate();
      dayBuckets[d] = (dayBuckets[d] ?? 0) + 1;
    });
    const counts = Object.values(dayBuckets);
    if (counts.length > 1) {
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
      const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
      consistencia = Math.max(20, Math.min(100, Math.round(100 - cv * 40)));
    } else if (counts.length === 1) {
      consistencia = doneStages <= 3 ? 70 : 30;
    }
    const maxDay = Math.min(daysInMonth, 27);
    const spreadRatio = counts.length / maxDay;
    consistencia = Math.round(consistencia * 0.7 + spreadRatio * 100 * 0.3);
    consistencia = Math.max(0, Math.min(100, consistencia));
  }

  const magicDiff = totalStages > 0 && doneStages === totalStages ? 27 - lastDay : null;

  return {
    score: Math.round((prazo + eficiencia + consistencia) / 3),
    lastDay,
    magicDiff,
  };
}

interface AnnualScoreAnalysisProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
}

export function AnnualScoreAnalysis({ open, onOpenChange, year }: AnnualScoreAnalysisProps) {
  const { data: yearData } = useMagic2Year(year);

  const monthlyScores = useMemo(() => {
    if (!yearData) return [];
    const now = new Date();
    const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthCycles = (yearData.cycles ?? []).filter(c => c.month === m && c.is_active);
      const monthStages = (yearData.stages ?? []).filter(s => {
        const cycle = monthCycles.find(c => c.id === s.cycle_id);
        return !!cycle;
      });
      const totalClients = monthCycles.length;

      if (totalClients === 0 || m > currentMonth) {
        return { mes: MONTH_SHORT[i], monthNum: m, score: 0, magicDiff: null, hasData: false };
      }

      const { score, magicDiff } = computeMonthScore(monthStages, totalClients, m, year);
      const cls = getClassification(score);
      return { mes: MONTH_SHORT[i], monthNum: m, score, magicDiff, hasData: true, ...cls };
    });
  }, [yearData, year]);

  const activeMonths = monthlyScores.filter(m => m.hasData && m.score > 0);

  const stats = useMemo(() => {
    if (activeMonths.length === 0) return null;
    const scores = activeMonths.map(m => m.score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const best = activeMonths.reduce((a, b) => a.score > b.score ? a : b);
    const worst = activeMonths.reduce((a, b) => a.score < b.score ? a : b);
    const healthy = activeMonths.filter(m => m.score >= 75).length;
    const critical = activeMonths.filter(m => m.score < 60).length;
    return { avg, best, worst, healthy, critical };
  }, [activeMonths]);

  const trendData = useMemo(() => {
    return monthlyScores
      .filter(m => m.hasData && m.score > 0)
      .map(m => ({ mes: m.mes, score: m.score }));
  }, [monthlyScores]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-sidebar" />
            Análise Anual da Operação — {year}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-2">
          {/* Bar chart - Score por mês */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Uau Score por Mês</p>
            <p className="text-xs text-muted-foreground">Cada barra representa a saúde da operação naquele mês.</p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyScores} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload?.length) {
                        const d = payload[0].payload;
                        if (!d.hasData) return null;
                        const cls = getClassification(d.score);
                        return (
                          <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-0.5">
                            <p className="font-semibold text-foreground">{d.mes} {year}</p>
                            <p>Score: <strong style={{ color: toneColor(cls.tone) }}>{d.score}</strong> — {cls.label}</p>
                            {d.magicDiff !== null && (
                              <p className={cn(
                                "font-medium",
                                d.magicDiff > 0 ? "text-success" : d.magicDiff < 0 ? "text-destructive" : "text-foreground"
                              )}>
                                {d.magicDiff > 0 ? `+${d.magicDiff} dias de folga` : d.magicDiff < 0 ? `${d.magicDiff} dias de atraso` : "No prazo exato"}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={36}>
                    {monthlyScores.map((entry, index) => (
                      <Cell key={index} fill={entry.hasData ? barColor(entry.score) : "hsl(var(--muted))"} fillOpacity={entry.hasData ? 1 : 0.3} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Line chart - Tendência */}
          {trendData.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Tendência do Ano</p>
              <p className="text-xs text-muted-foreground">Evolução do Uau Score ao longo dos meses.</p>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trendLineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(var(--sidebar))" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="hsl(var(--sidebar))" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      content={({ active, payload }) => {
                        if (active && payload?.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs">
                              <p className="font-semibold">{d.mes}: <strong>{d.score}</strong></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="url(#trendLineGradient)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "hsl(var(--sidebar))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "hsl(var(--sidebar))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <StatCard
                label="Média do Ano"
                value={stats.avg}
                icon={<Target className="h-4 w-4" />}
                color={toneColor(getClassification(stats.avg).tone)}
              />
              <StatCard
                label="Melhor Mês"
                value={stats.best.score}
                subtitle={stats.best.mes}
                icon={<Trophy className="h-4 w-4" />}
                color={toneColor(getClassification(stats.best.score).tone)}
              />
              <StatCard
                label="Pior Mês"
                value={stats.worst.score}
                subtitle={stats.worst.mes}
                icon={<AlertTriangle className="h-4 w-4" />}
                color={toneColor(getClassification(stats.worst.score).tone)}
              />
              <StatCard
                label="Meses Saudáveis"
                value={stats.healthy}
                icon={<TrendingUp className="h-4 w-4" />}
                color="hsl(142, 71%, 45%)"
              />
              <StatCard
                label="Meses Críticos"
                value={stats.critical}
                icon={<TrendingDown className="h-4 w-4" />}
                color="hsl(0, 84%, 60%)"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, subtitle, icon, color }: {
  label: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="py-3 px-3 flex flex-col items-center text-center gap-1">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-2xl font-black tabular-nums" style={{ color }}>
          <AnimatedNumber value={value} />
        </span>
        {subtitle && <span className="text-[10px] text-muted-foreground font-medium">{subtitle}</span>}
        <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
      </CardContent>
    </Card>
  );
}
