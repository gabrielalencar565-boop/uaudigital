import { useMemo, useState } from "react";
import { AnnualScoreAnalysis } from "./AnnualScoreAnalysis";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, LineChart, Line, Cell,
} from "recharts";
import { TrendingUp, Clock, Zap, BarChart3, Info, CalendarCheck, ArrowUp, ArrowDown, Trophy, AlertTriangle, TrendingDown, Target, Star } from "lucide-react";
import {
  format, getDaysInMonth,
} from "date-fns";
import { useMagic2Month } from "@/features/magic2/hooks/use-magic2";
import { useMagic2Year } from "@/features/magic2/hooks/use-magic2-year";
import { MAGIC2_STAGES } from "@/features/magic2/magic2-stages";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

import { getClassification, toneColor, barColor, MONTH_SHORT, computeAnnualScores } from "@/features/projetos/utils/score-utils";


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

  const [chartMode, setChartMode] = useState<"mensal" | "anual">("mensal");
  const [annualDialogOpen, setAnnualDialogOpen] = useState(false);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const { data: magic2Data } = useMagic2Month(year, month);
  const { data: prevMagic2Data } = useMagic2Month(prevYear, prevMonth);
  const { data: yearData } = useMagic2Year(year);

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

  // ── Annual progress data (% completed before Magic Number per month) ──
  const annualProgressData = useMemo(() => {
    if (!yearData) return [];
    const now2 = new Date();
    const currentMonth = now2.getFullYear() === year ? now2.getMonth() + 1 : 12;

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthCycles = (yearData.cycles ?? []).filter((c: any) => c.month === m && c.is_active);
      const monthStages = (yearData.stages ?? []).filter((s: any) =>
        monthCycles.some((c: any) => c.id === s.cycle_id)
      );
      const totalClients = monthCycles.length;
      const totalStagesMonth = totalClients * MAGIC2_STAGES.length;
      const completedStages = monthStages.filter((s: any) => s.completed).length;
      const beforeMagic = monthStages.filter((s: any) =>
        s.completed && s.completed_at && new Date(s.completed_at).getDate() <= 27
      ).length;
      const pct = totalStagesMonth > 0 ? Math.round((beforeMagic / totalStagesMonth) * 100) : 0;

      // Magic diff
      const completedDates = monthStages
        .filter((s: any) => s.completed && s.completed_at)
        .map((s: any) => new Date(s.completed_at!).getDate());
      const lastDay = completedDates.length > 0 ? Math.max(...completedDates) : null;
      const allDone = completedStages === totalStagesMonth && totalStagesMonth > 0;
      const magicDiff = allDone && lastDay !== null ? 27 - lastDay : null;

      return {
        mes: MONTH_SHORT[i],
        monthNum: m,
        percentual: m > currentMonth ? 0 : pct,
        totalEtapas: completedStages,
        totalEtapasMonth: totalStagesMonth,
        clientes: totalClients,
        magicDiff,
        hasData: m <= currentMonth && totalClients > 0,
      };
    });
  }, [yearData, year]);

  const bestProactiveMonth = useMemo(() => {
    const active = annualProgressData.filter(m => m.hasData && m.percentual > 0);
    if (active.length === 0) return null;
    return active.reduce((a, b) => a.percentual > b.percentual ? a : b);
  }, [annualProgressData]);

  const annualProgressStats = useMemo(() => {
    const active = annualProgressData.filter(m => m.hasData);
    if (active.length === 0) return null;
    const avg = Math.round(active.reduce((s, m) => s + m.percentual, 0) / active.length);
    const totalEtapas = active.reduce((s, m) => s + m.totalEtapas, 0);
    const totalClientes = new Set(active.flatMap(m => {
      const monthCycles = (yearData?.cycles ?? []).filter((c: any) => c.month === m.monthNum && c.is_active);
      return monthCycles.map((c: any) => c.client_id);
    })).size;
    return { avg, totalEtapas, totalClientes };
  }, [annualProgressData, yearData]);

  // ── Proactivity Index per month ──
  const proactivityData = useMemo(() => {
    if (!yearData) return [];
    const now2 = new Date();
    const currentMonth = now2.getFullYear() === year ? now2.getMonth() + 1 : 12;

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthCycles = (yearData.cycles ?? []).filter((c: any) => c.month === m && c.is_active);
      const monthStages = (yearData.stages ?? []).filter((s: any) =>
        monthCycles.some((c: any) => c.id === s.cycle_id)
      );
      const totalClients = monthCycles.length;
      const totalStagesMonth = totalClients * MAGIC2_STAGES.length;
      const completedStages = monthStages.filter((s: any) => s.completed);

      if (m > currentMonth || totalClients === 0 || completedStages.length === 0) {
        return { mes: MONTH_SHORT[i], monthNum: m, proatividade: 0, totalTarefas: 0, antes20Pct: 0, hasData: false };
      }

      // Weighted proactivity: days 1-10 = weight 1.0, 11-20 = 0.6, 21-27 = 0.3
      let weightedSum = 0;

      for (const s of completedStages) {
        const day = s.completed_at ? new Date(s.completed_at).getDate() : 28;
        if (day <= 10) weightedSum += 1.0;
        else if (day <= 20) weightedSum += 0.6;
        else if (day <= 27) weightedSum += 0.3;
      }

      const before20 = completedStages.filter((s: any) => {
        const day = s.completed_at ? new Date(s.completed_at).getDate() : 28;
        return day <= 20;
      }).length;

      const proatividade = Math.round((weightedSum / completedStages.length) * 100);
      const antes20Pct = Math.round((before20 / completedStages.length) * 100);

      return {
        mes: MONTH_SHORT[i],
        monthNum: m,
        proatividade,
        totalTarefas: completedStages.length,
        antes20Pct,
        hasData: true,
      };
    });
  }, [yearData, year]);

  const bestProactivityMonth = useMemo(() => {
    const active = proactivityData.filter(m => m.hasData && m.proatividade > 0);
    if (active.length === 0) return null;
    return active.reduce((a, b) => a.proatividade > b.proatividade ? a : b);
  }, [proactivityData]);

  // ── Annual score data (Uau Score per month) ──
  const annualScoreData = useMemo(() => {
    return computeAnnualScores(yearData, year, month);
  }, [yearData, year, month]);

  const annualStats = useMemo(() => {
    const active = annualScoreData.filter(m => m.hasData && m.score > 0);
    if (active.length === 0) return null;
    const scores = active.map(m => m.score);
    const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const best = active.reduce((a, b) => a.score > b.score ? a : b);
    const worst = active.reduce((a, b) => a.score < b.score ? a : b);
    const healthy = active.filter(m => m.score >= 75).length;
    const critical = active.filter(m => m.score < 60).length;
    return { avg, best, worst, healthy, critical };
  }, [annualScoreData]);


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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-foreground">
                    Progresso da Operação {chartMode === "mensal" ? "no Mês" : "Anual"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {chartMode === "mensal"
                      ? "Evolução baseada nas etapas do Magic Number concluídas ao longo do mês."
                      : `Etapas concluídas antes do Magic Number em cada mês de ${year}.`}
                  </p>
                </div>
                <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
                  <button
                    onClick={() => setChartMode("mensal")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium transition-colors",
                      chartMode === "mensal"
                        ? "bg-sidebar text-sidebar-foreground"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setChartMode("anual")}
                    className={cn(
                      "px-3 py-1 text-xs font-medium transition-colors",
                      chartMode === "anual"
                        ? "bg-sidebar text-sidebar-foreground"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Anual
                  </button>
                </div>
              </div>

              {chartMode === "mensal" ? (
                <>
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
                </>
              ) : (
                <>
                  {/* ── Proactivity Index Chart ── */}
                  <div className="space-y-3">
                    {bestProactivityMonth && bestProactivityMonth.proatividade > 0 && (
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-sidebar/5 border border-sidebar/20">
                        <div className="h-8 w-8 rounded-lg bg-sidebar/10 flex items-center justify-center shrink-0">
                          <Star className="h-4 w-4 text-sidebar fill-sidebar" />
                        </div>
                        <div className="text-xs">
                          <p className="text-muted-foreground">Mês mais proativo do ano</p>
                          <p className="font-bold text-foreground">
                            {bestProactivityMonth.mes} — {bestProactivityMonth.proatividade}% de proatividade operacional
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="h-[200px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={proactivityData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="proactBarGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(var(--sidebar))" stopOpacity={0.85} />
                              <stop offset="100%" stopColor="hsl(var(--sidebar))" stopOpacity={0.35} />
                            </linearGradient>
                            <linearGradient id="proactBarBestGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={1} />
                              <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.45} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
                          <XAxis
                            dataKey="mes"
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
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (active && payload?.length) {
                                const d = payload[0].payload;
                                if (!d.hasData) return null;
                                return (
                                  <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-0.5">
                                    <p className="font-semibold text-foreground flex items-center gap-1">
                                      {d.mes} {year}
                                      {bestProactivityMonth && d.monthNum === bestProactivityMonth.monthNum && (
                                        <Star className="h-3 w-3 text-sidebar fill-sidebar" />
                                      )}
                                    </p>
                                    <p className="text-muted-foreground">Proatividade: <strong className="text-foreground">{d.proatividade}%</strong></p>
                                    <p className="text-muted-foreground">Tarefas concluídas: <strong className="text-foreground">{d.totalTarefas}</strong></p>
                                    <p className="text-muted-foreground">Concluídas antes do dia 20: <strong className="text-foreground">{d.antes20Pct}%</strong></p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="proatividade" radius={[4, 4, 0, 0]} maxBarSize={36}>
                            {proactivityData.map((entry, index) => (
                              <Cell
                                key={index}
                                fill={
                                  !entry.hasData
                                    ? "hsl(var(--muted))"
                                    : bestProactivityMonth && entry.monthNum === bestProactivityMonth.monthNum
                                      ? "url(#proactBarBestGrad)"
                                      : "url(#proactBarGrad)"
                                }
                                fillOpacity={entry.hasData ? 1 : 0.3}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Chart 2: Uau Score ── */}
          <Card>
            <CardContent className="py-5 px-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-foreground">Uau Score do Mês</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Indicador de saúde da operação em relação ao Magic Number.
                  </p>
                </div>
                <button
                  onClick={() => setAnnualDialogOpen(true)}
                  className="text-xs font-medium text-sidebar hover:underline shrink-0 mt-0.5"
                >
                  Ver desempenho anual →
                </button>
              </div>

              {/* Score + Faixas */}
              <div className="flex items-start gap-5 justify-center">
                {/* Donut */}
                <div className="flex flex-col items-center gap-2">
                  <ProgressRing
                    value={uauScore}
                    size={150}
                    stroke={14}
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

                  {/* Comparison badge */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{prevMonthLabel}: <strong>{prevUauScore}</strong></span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-muted-foreground">{currentMonthLabel}: <strong>{uauScore}</strong></span>
                    <span className={cn(
                      "font-bold tabular-nums flex items-center gap-0.5",
                      uauDelta > 0 ? "text-success" : uauDelta < 0 ? "text-destructive" : "text-muted-foreground"
                    )}>
                      {uauDelta > 0 ? <ArrowUp className="h-3 w-3" /> : uauDelta < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                      {uauDelta > 0 ? "+" : ""}{uauDelta}pts
                    </span>
                  </div>
                </div>

                {/* Faixas */}
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Faixas</p>
                  {SCORE_RANGES.map(range => {
                    const color = toneColor(range.tone);
                    const isActive = uauScore >= range.min && uauScore <= range.max;
                    return (
                      <div
                        key={range.label}
                        className={cn(
                          "flex items-center gap-2 text-xs transition-opacity",
                          isActive ? "opacity-100" : "opacity-40"
                        )}
                      >
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
                    );
                  })}
                </div>
              </div>

              {/* Magic Number deadline indicator */}
              {(() => {
                const completedDatesAll = stages
                  .filter(s => s.completed && s.completed_at)
                  .map(s => new Date(s.completed_at!));
                const allDone = doneStages === totalStages && totalStages > 0;
                const magicDay = 27;

                if (allDone && completedDatesAll.length > 0) {
                  const lastDate = new Date(Math.max(...completedDatesAll.map(d => d.getTime())));
                  const lastDay = lastDate.getDate();
                  const diff = magicDay - lastDay;
                  const formattedDate = `${String(lastDay).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
                  const magicDate = `${String(magicDay).padStart(2, "0")}/${String(month).padStart(2, "0")}`;

                  return (
                    <div className="flex items-center gap-3 text-xs p-2.5 rounded-lg bg-muted/50 border border-border/50">
                      <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">
                          Conclusão: <strong className="text-foreground">{formattedDate}</strong> · Magic Number: <strong className="text-foreground">{magicDate}</strong>
                        </span>
                        <span className={cn(
                          "font-semibold",
                          diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-foreground"
                        )}>
                          {diff > 0
                            ? `+${diff} dia${diff > 1 ? "s" : ""} de folga`
                            : diff < 0
                              ? `${diff} dia${Math.abs(diff) > 1 ? "s" : ""} de atraso`
                              : "Concluído no prazo exato"}
                        </span>
                      </div>
                    </div>
                  );
                }

                // Not yet completed
                const daysLeft = magicDay - currentDay;
                return (
                  <div className="flex items-center gap-3 text-xs p-2.5 rounded-lg bg-muted/50 border border-border/50">
                    <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">
                      {daysLeft > 0
                        ? <>{daysLeft} dia{daysLeft > 1 ? "s" : ""} restante{daysLeft > 1 ? "s" : ""} para o Magic Number (<strong className="text-foreground">dia {magicDay}</strong>)</>
                        : daysLeft === 0
                          ? <strong className="text-warning">Hoje é o dia do Magic Number!</strong>
                          : <strong className="text-destructive">Magic Number ultrapassado em {Math.abs(daysLeft)} dia{Math.abs(daysLeft) > 1 ? "s" : ""}</strong>}
                    </span>
                  </div>
                );
              })()}

              {/* Interpretive text */}
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {(() => {
                  const parts: string[] = [];
                  if (prazo >= 80) parts.push("dentro do prazo");
                  else if (prazo >= 60) parts.push("com leve pressão no prazo");
                  else parts.push("com atraso significativo");

                  if (eficiencia >= 80) parts.push("alta eficiência na execução");
                  else if (eficiencia >= 50) parts.push("eficiência moderada");
                  else parts.push("baixa eficiência na execução das tarefas");

                  if (consistencia >= 75) parts.push("boa distribuição de produção ao longo do mês");
                  else if (consistencia >= 50) parts.push("produção com leve acúmulo em alguns dias");
                  else parts.push("produção concentrada em poucos dias");

                  return `Operação ${parts[0]}, ${parts[1]} e ${parts[2]}.`;
                })()}
              </p>

              {/* Indicators */}
              <div className="space-y-3 pt-1 border-t border-border/50">
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
        <AnnualScoreAnalysis open={annualDialogOpen} onOpenChange={setAnnualDialogOpen} year={year} />
      </div>
    </TooltipProvider>
  );
}
