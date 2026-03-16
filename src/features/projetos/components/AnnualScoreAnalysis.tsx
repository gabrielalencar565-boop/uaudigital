import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip,
  LineChart, Line, Cell,
} from "recharts";
import { Trophy, AlertTriangle, TrendingUp, TrendingDown, Target } from "lucide-react";
import { useMagic2Year } from "@/features/magic2/hooks/use-magic2-year";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { getClassification, toneColor, barColor, computeAnnualScores } from "@/features/projetos/utils/score-utils";

interface AnnualScoreAnalysisProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
}

export function AnnualScoreAnalysis({ open, onOpenChange, year }: AnnualScoreAnalysisProps) {
  const { data: yearData } = useMagic2Year(year);
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12;

  const monthlyScores = useMemo(() => computeAnnualScores(yearData, year, currentMonth), [yearData, year, currentMonth]);
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
    return monthlyScores.filter(m => m.hasData && m.score > 0).map(m => ({ mes: m.mes, score: m.score }));
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
          {/* Bar chart */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">Uau Score por Mês</p>
            <p className="text-xs text-muted-foreground">Cada barra representa a saúde da operação naquele mês.</p>
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyScores} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
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
                              <p className={cn("font-medium", d.magicDiff > 0 ? "text-success" : d.magicDiff < 0 ? "text-destructive" : "text-foreground")}>
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

          {/* Line chart */}
          {trendData.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Tendência do Ano</p>
              <p className="text-xs text-muted-foreground">Evolução do Uau Score ao longo dos meses.</p>
              <div className="h-[180px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
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
                      stroke="hsl(var(--sidebar))"
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
              <StatCard label="Média do Ano" value={stats.avg} icon={<Target className="h-4 w-4" />} color={toneColor(getClassification(stats.avg).tone)} />
              <StatCard label="Melhor Mês" value={stats.best.score} subtitle={stats.best.mes} icon={<Trophy className="h-4 w-4" />} color={toneColor(getClassification(stats.best.score).tone)} />
              <StatCard label="Pior Mês" value={stats.worst.score} subtitle={stats.worst.mes} icon={<AlertTriangle className="h-4 w-4" />} color={toneColor(getClassification(stats.worst.score).tone)} />
              <StatCard label="Meses Saudáveis" value={stats.healthy} icon={<TrendingUp className="h-4 w-4" />} color="hsl(142, 71%, 45%)" />
              <StatCard label="Meses Críticos" value={stats.critical} icon={<TrendingDown className="h-4 w-4" />} color="hsl(0, 84%, 60%)" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, subtitle, icon, color }: { label: string; value: number; subtitle?: string; icon: React.ReactNode; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="py-3 px-3 flex flex-col items-center text-center gap-1">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-2xl font-black tabular-nums" style={{ color }}><AnimatedNumber value={value} /></span>
        {subtitle && <span className="text-[10px] text-muted-foreground font-medium">{subtitle}</span>}
        <span className="text-[10px] text-muted-foreground leading-tight">{label}</span>
      </CardContent>
    </Card>
  );
}
