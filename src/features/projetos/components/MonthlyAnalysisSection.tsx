import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar,
} from "recharts";
import { TrendingUp, Clock, Zap, BarChart3, Info } from "lucide-react";
import {
  format, getDaysInMonth,
} from "date-fns";
import { useMagic2Month } from "@/features/magic2/hooks/use-magic2";
import { MAGIC2_STAGES } from "@/features/magic2/magic2-stages";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

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

const INDICATOR_TOOLTIPS: Record<string, string> = {
  "Prazo": "Avalia se a operação foi concluída dentro do prazo ideal (dia 25). Quanto antes finalizar, maior a pontuação.",
  "Eficiência": "Percentual de etapas concluídas em relação ao total de etapas de todos os clientes ativos no mês.",
  "Consistência": "Mede se a produção foi distribuída de forma uniforme ao longo do mês, evitando acúmulo nos últimos dias.",
};

const SCORE_RANGES = [
  { min: 90, max: 100, label: "Excelente", tone: "success" as const, desc: "Operação impecável, tudo no prazo e bem distribuído." },
  { min: 75, max: 89, label: "Saudável", tone: "primary" as const, desc: "Boa performance, com pequenos pontos de melhoria." },
  { min: 60, max: 74, label: "Atenção", tone: "warning" as const, desc: "Atrasos ou acúmulos que precisam de correção." },
  { min: 0, max: 59, label: "Crítico", tone: "danger" as const, desc: "Performance abaixo do aceitável, ação urgente necessária." },
];

export function MonthlyAnalysisSection() {
  const now = new Date();
  const currentDay = now.getDate();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const { data: magic2Data } = useMagic2Month(year, month);
  const { data: prevMagic2Data } = useMagic2Month(prevYear, prevMonth);

  const cycles = magic2Data?.cycles ?? [];
  const stages = magic2Data?.stages ?? [];

  const totalStages = cycles.length * MAGIC2_STAGES.length;
  const doneStages = stages.filter(s => s.completed).length;

  const prevCycles = prevMagic2Data?.cycles ?? [];
  const prevStages = prevMagic2Data?.stages ?? [];
  const prevTotalStages = prevCycles.length * MAGIC2_STAGES.length;

  // ── Progress line chart data (current + previous month) ──
  const progressData = useMemo(() => {
    const totalDays = getDaysInMonth(now);
    const prevTotalDays = getDaysInMonth(new Date(prevYear, prevMonth - 1, 1));

    return Array.from({ length: totalDays }, (_, i) => {
      const dia = i + 1;

      // Current month
      const dateStr = format(new Date(year, month - 1, dia), "yyyy-MM-dd");
      const doneUpToDay = dia <= currentDay
        ? stages.filter(s => s.completed && s.completed_at && s.completed_at.slice(0, 10) <= dateStr).length
        : undefined;
      const pct = doneUpToDay !== undefined && totalStages > 0 ? Math.round((doneUpToDay / totalStages) * 100) : undefined;

      // Previous month
      const prevDateStr = dia <= prevTotalDays
        ? format(new Date(prevYear, prevMonth - 1, dia), "yyyy-MM-dd")
        : null;
      const prevDoneUpToDay = prevDateStr
        ? prevStages.filter(s => s.completed && s.completed_at && s.completed_at.slice(0, 10) <= prevDateStr).length
        : undefined;
      const prevPct = prevDoneUpToDay !== undefined && prevTotalStages > 0 ? Math.round((prevDoneUpToDay / prevTotalStages) * 100) : undefined;

      return { dia, percentual: pct, anterior: prevPct };
    });
  }, [stages, prevStages, now, totalStages, prevTotalStages, currentDay, year, month, prevYear, prevMonth]);

  // ── Uau Score calculation ──
  const { prazo, eficiencia, consistencia, uauScore } = useMemo(() => {
    // Prazo
    const completedDates = stages
      .filter(s => s.completed && s.completed_at)
      .map(s => new Date(s.completed_at!).getDate());
    const lastDay = completedDates.length > 0 ? Math.max(...completedDates) : currentDay;

    let prazoScore: number;
    if (doneStages === totalStages && totalStages > 0) {
      if (lastDay <= 25) prazoScore = 100;
      else if (lastDay <= 27) prazoScore = 85;
      else if (lastDay <= 30) prazoScore = 60;
      else prazoScore = 40;
    } else {
      if (currentDay <= 20) prazoScore = 80;
      else if (currentDay <= 25) prazoScore = 65;
      else if (currentDay <= 27) prazoScore = 50;
      else prazoScore = 35;
    }

    // Eficiência
    const eficienciaScore = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

    // Consistência
    let consistenciaScore = 50;
    if (doneStages > 0) {
      const dayBuckets: Record<number, number> = {};
      stages.filter(s => s.completed && s.completed_at).forEach(s => {
        const d = new Date(s.completed_at!).getDate();
        dayBuckets[d] = (dayBuckets[d] ?? 0) + 1;
      });
      const counts = Object.values(dayBuckets);
      if (counts.length > 1) {
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
        const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
        consistenciaScore = Math.max(20, Math.min(100, Math.round(100 - cv * 40)));
      } else if (counts.length === 1) {
        consistenciaScore = doneStages <= 3 ? 70 : 30;
      }
      const spreadRatio = counts.length / Math.min(currentDay, 27);
      consistenciaScore = Math.round(consistenciaScore * 0.7 + spreadRatio * 100 * 0.3);
      consistenciaScore = Math.max(0, Math.min(100, consistenciaScore));
    }

    const score = Math.round((prazoScore + eficienciaScore + consistenciaScore) / 3);
    return { prazo: prazoScore, eficiencia: eficienciaScore, consistencia: consistenciaScore, uauScore: score };
  }, [stages, currentDay, doneStages, totalStages]);

  // ── Previous month Uau Score ──
  const prevUauScore = useMemo(() => {
    const prevDone = prevStages.filter(s => s.completed).length;
    const prevEficiencia = prevTotalStages > 0 ? Math.round((prevDone / prevTotalStages) * 100) : 0;

    const prevCompletedDates = prevStages
      .filter(s => s.completed && s.completed_at)
      .map(s => new Date(s.completed_at!).getDate());
    const prevLastDay = prevCompletedDates.length > 0 ? Math.max(...prevCompletedDates) : 28;

    let prevPrazo: number;
    if (prevDone === prevTotalStages && prevTotalStages > 0) {
      if (prevLastDay <= 25) prevPrazo = 100;
      else if (prevLastDay <= 27) prevPrazo = 85;
      else if (prevLastDay <= 30) prevPrazo = 60;
      else prevPrazo = 40;
    } else {
      prevPrazo = 35;
    }

    let prevConsistencia = 50;
    if (prevDone > 0) {
      const dayBuckets: Record<number, number> = {};
      prevStages.filter(s => s.completed && s.completed_at).forEach(s => {
        const d = new Date(s.completed_at!).getDate();
        dayBuckets[d] = (dayBuckets[d] ?? 0) + 1;
      });
      const counts = Object.values(dayBuckets);
      if (counts.length > 1) {
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
        const cv = avg > 0 ? Math.sqrt(variance) / avg : 0;
        prevConsistencia = Math.max(20, Math.min(100, Math.round(100 - cv * 40)));
      } else if (counts.length === 1) {
        prevConsistencia = prevDone <= 3 ? 70 : 30;
      }
      const prevTotalDaysInMonth = getDaysInMonth(new Date(prevYear, prevMonth - 1, 1));
      const spreadRatio = counts.length / Math.min(prevTotalDaysInMonth, 27);
      prevConsistencia = Math.round(prevConsistencia * 0.7 + spreadRatio * 100 * 0.3);
      prevConsistencia = Math.max(0, Math.min(100, prevConsistencia));
    }

    return Math.round((prevPrazo + prevEficiencia + prevConsistencia) / 3);
  }, [prevStages, prevTotalStages, prevYear, prevMonth]);

  const uauDelta = uauScore - prevUauScore;

  const classification = getClassification(uauScore);
  const scoreColor = toneColor(classification.tone);

  const indicators = [
    { label: "Prazo", value: prazo, icon: Clock },
    { label: "Eficiência", value: eficiencia, icon: Zap },
    { label: "Consistência", value: consistencia, icon: BarChart3 },
  ];

  const MONTH_NAMES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const prevMonthLabel = MONTH_NAMES[prevMonth - 1];
  const currentMonthLabel = MONTH_NAMES[month - 1];

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-0.5">
          <p className="font-semibold text-foreground">Dia {label}</p>
          {payload.map((p: any) => (
            <p key={p.dataKey} style={{ color: p.color }}>
              {p.dataKey === "percentual" ? currentMonthLabel : prevMonthLabel}: {p.value ?? "—"}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <TooltipProvider delayDuration={200}>
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
                  Evolução baseada nas etapas do Magic Number concluídas ao longo do mês.
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
                      <linearGradient id="prevGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.01} />
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
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="anterior"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      fill="url(#prevGradient)"
                      dot={false}
                      activeDot={{ r: 3, fill: "hsl(var(--muted-foreground))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                      connectNulls
                    />
                    <Area
                      type="monotone"
                      dataKey="percentual"
                      stroke="hsl(var(--sidebar))"
                      strokeWidth={2.5}
                      fill="url(#progressGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: "hsl(var(--sidebar))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-col gap-2 pt-1 border-t border-border/50">
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5 rounded-full" style={{ backgroundColor: "hsl(var(--sidebar))" }} />
                    {currentMonthLabel} (atual)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-0.5 rounded-full border-t border-dashed" style={{ borderColor: "hsl(var(--muted-foreground))" }} />
                    {prevMonthLabel} (anterior)
                  </span>
                </div>

                {(() => {
                  const currentPct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;
                  const prevDoneStages = prevStages.filter(s => s.completed).length;
                  const prevPct = prevTotalStages > 0 ? Math.round((prevDoneStages / prevTotalStages) * 100) : 0;

                  // Compare same day progress
                  const prevSameDayDone = prevStages.filter(s => {
                    if (!s.completed || !s.completed_at) return false;
                    const d = new Date(s.completed_at).getDate();
                    return d <= currentDay;
                  }).length;
                  const prevSameDayPct = prevTotalStages > 0 ? Math.round((prevSameDayDone / prevTotalStages) * 100) : 0;
                  const delta = currentPct - prevSameDayPct;

                  return (
                    <div className="flex items-center gap-4 text-xs flex-wrap">
                      <span className="text-muted-foreground">
                        Progresso atual: <strong className="text-foreground">{currentPct}%</strong>
                      </span>
                      <span className="text-muted-foreground">
                        {prevMonthLabel} dia {currentDay}: <strong className="text-foreground">{prevSameDayPct}%</strong>
                      </span>
                      <span className={cn(
                        "font-bold tabular-nums",
                        delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"
                      )}>
                        {delta > 0 ? "+" : ""}{delta}pp {delta > 0 ? "↑" : delta < 0 ? "↓" : "="}
                      </span>
                      <span className="ml-auto text-muted-foreground">{doneStages}/{totalStages} etapas · {cycles.length} clientes</span>
                    </div>
                  );
                })()}
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

              <div className="flex items-start gap-6 justify-center">
                {/* Donut */}
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

                {/* Score range legend */}
                <div className="flex flex-col gap-2.5 pt-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Faixas</p>
                  {SCORE_RANGES.map(range => {
                    const color = toneColor(range.tone);
                    const isActive = uauScore >= range.min && uauScore <= range.max;
                    return (
                      <div
                        key={range.label}
                        className={cn(
                          "flex flex-col gap-0.5 transition-opacity",
                          isActive ? "opacity-100" : "opacity-40"
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <div
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-muted-foreground whitespace-nowrap">
                            {range.min}–{range.max}
                          </span>
                          <span
                            className={cn("font-semibold", isActive && "underline")}
                            style={{ color }}
                          >
                            {range.label}
                          </span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground/60 cursor-help hover:text-foreground transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-xs">
                              {range.desc}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Previous month comparison */}
              <div className="flex items-center gap-3 text-xs pt-2 border-t border-border/50">
                <span className="text-muted-foreground">
                  {prevMonthLabel}: <strong className="text-foreground">{prevUauScore}</strong>
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="text-muted-foreground">
                  {currentMonthLabel}: <strong className="text-foreground">{uauScore}</strong>
                </span>
                <span className={cn(
                  "font-bold tabular-nums ml-auto",
                  uauDelta > 0 ? "text-success" : uauDelta < 0 ? "text-destructive" : "text-muted-foreground"
                )}>
                  {uauDelta > 0 ? "+" : ""}{uauDelta}pts {uauDelta > 0 ? "↑" : uauDelta < 0 ? "↓" : "="}
                </span>
              </div>

              {/* Indicators with info tooltips */}
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground/60 cursor-help hover:text-foreground transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px] text-xs">
                              {INDICATOR_TOOLTIPS[ind.label]}
                            </TooltipContent>
                          </Tooltip>
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
    </TooltipProvider>
  );
}
