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

import { getClassification, toneColor, barColor, MONTH_SHORT, computeAnnualScores, getBrazilDay } from "@/features/projetos/utils/score-utils";


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

export function MonthlyAnalysisSection({ className }: { className?: string }) {
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
        s.completed && s.completed_at && getBrazilDay(s.completed_at) <= 27
      ).length;
      const pct = totalStagesMonth > 0 ? Math.round((beforeMagic / totalStagesMonth) * 100) : 0;

      // Magic diff
      const completedDates = monthStages
        .filter((s: any) => s.completed && s.completed_at)
        .map((s: any) => getBrazilDay(s.completed_at!));
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
        const day = s.completed_at ? getBrazilDay(s.completed_at) : 28;
        if (day <= 10) weightedSum += 1.0;
        else if (day <= 20) weightedSum += 0.6;
        else if (day <= 27) weightedSum += 0.3;
      }

      const before20 = completedStages.filter((s: any) => {
        const day = s.completed_at ? getBrazilDay(s.completed_at) : 28;
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

  // ── IDO (Índice de Disciplina Operacional) per month ──
  const idoData = useMemo(() => {
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
        return { mes: MONTH_SHORT[i], monthNum: m, ido: 0, proatividade: 0, prazo: 0, consistencia: 0, hasData: false };
      }

      // 1. Proatividade (weight: 0.4)
      let weightedSum = 0;
      for (const s of completedStages) {
        const day = s.completed_at ? getBrazilDay(s.completed_at) : 28;
        if (day <= 10) weightedSum += 1.0;
        else if (day <= 20) weightedSum += 0.6;
        else if (day <= 27) weightedSum += 0.3;
      }
      const proatividade = Math.round((weightedSum / completedStages.length) * 100);

      // 2. Prazo (weight: 0.3) — based on last completion day vs Magic Number
      const completedDays = completedStages
        .filter((s: any) => s.completed_at)
        .map((s: any) => getBrazilDay(s.completed_at));
      const lastDay = completedDays.length > 0 ? Math.max(...completedDays) : 28;
      const allDone = completedStages.length === totalStagesMonth;
      let prazoScore: number;
      if (allDone) {
        if (lastDay <= 24) prazoScore = 100;
        else if (lastDay <= 27) prazoScore = 75;
        else prazoScore = 40;
      } else {
        prazoScore = 30;
      }

      // 3. Consistência (weight: 0.3) — weekly distribution
      const weekBuckets = [0, 0, 0, 0]; // week1(1-7), week2(8-14), week3(15-21), week4(22+)
      for (const s of completedStages) {
        const day = s.completed_at ? getBrazilDay(s.completed_at) : 28;
        if (day <= 7) weekBuckets[0]++;
        else if (day <= 14) weekBuckets[1]++;
        else if (day <= 21) weekBuckets[2]++;
        else weekBuckets[3]++;
      }
      const activeWeeks = weekBuckets.filter(w => w > 0).length;
      const avgWeek = completedStages.length / 4;
      const weekVariance = weekBuckets.reduce((sum, w) => sum + Math.pow(w - avgWeek, 2), 0) / 4;
      const weekCv = avgWeek > 0 ? Math.sqrt(weekVariance) / avgWeek : 0;
      let consistenciaScore = Math.max(0, Math.min(100, Math.round(100 - weekCv * 35)));
      // Bonus for spreading across weeks
      consistenciaScore = Math.round(consistenciaScore * 0.7 + (activeWeeks / 4) * 100 * 0.3);
      consistenciaScore = Math.max(0, Math.min(100, consistenciaScore));

      const ido = Math.round(proatividade * 0.4 + prazoScore * 0.3 + consistenciaScore * 0.3);

      return {
        mes: MONTH_SHORT[i],
        monthNum: m,
        ido,
        proatividade,
        prazo: prazoScore,
        consistencia: consistenciaScore,
        hasData: true,
      };
    });
  }, [yearData, year]);

  const idoStats = useMemo(() => {
    const active = idoData.filter(m => m.hasData && m.ido > 0);
    if (active.length === 0) return null;
    const best = active.reduce((a, b) => a.ido > b.ido ? a : b);
    const worst = active.reduce((a, b) => a.ido < b.ido ? a : b);
    const avg = Math.round(active.reduce((s, m) => s + m.ido, 0) / active.length);
    return { best, worst, avg };
  }, [idoData]);

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
      .map(s => getBrazilDay(s.completed_at!));
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
        const d = getBrazilDay(s.completed_at!);
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
      .map(s => getBrazilDay(s.completed_at!));
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
        const d = getBrazilDay(s.completed_at!);
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
      <div className={cn("flex flex-col", className)}>
          {/* ── Progresso da Operação ── */}
          <Card className="flex flex-col flex-1">
            <CardContent className="py-6 px-6 space-y-5 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-sidebar/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-sidebar" />
                  </div>
                  <div>
                    <p className="text-base font-bold leading-none">
                      Progresso da Operação {chartMode === "mensal" ? "no Mês" : "Anual"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Evolução das etapas ao longo do período</p>
                  </div>
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
                  <div className="h-[260px] w-full flex-1">
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

                   {/* Insight line */}
                   {(() => {
                     const currentPct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;
                     const prevDoneStages = prevStages.filter(s => s.completed).length;
                     const prevSameDayDone = prevStages.filter(s => {
                       if (!s.completed || !s.completed_at) return false;
                       return new Date(s.completed_at).getDate() <= currentDay;
                     }).length;
                     const prevSameDayPct = prevTotalStages > 0 ? Math.round((prevSameDayDone / prevTotalStages) * 100) : 0;
                     const delta = currentPct - prevSameDayPct;

                     if (delta !== 0 && prevSameDayPct > 0) {
                       return (
                         <div className="flex items-center gap-2 text-xs bg-accent/30 rounded-lg px-3 py-2 mt-auto">
                           <Lightbulb className="h-3.5 w-3.5 text-sidebar shrink-0" />
                           <span className="text-muted-foreground">
                             {delta > 0
                               ? <>Operação está <strong className="text-success">{delta}pp à frente</strong> do mesmo dia no mês anterior</>
                               : <>Operação está <strong className="text-destructive">{Math.abs(delta)}pp atrás</strong> do mesmo dia no mês anterior</>
                             }
                           </span>
                         </div>
                       );
                     }
                     return null;
                   })()}
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

                  {/* ── IDO Line Chart ── */}
                  <div className="space-y-3 pt-4 border-t border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-foreground">Índice de Disciplina Operacional (IDO)</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Proatividade (40%) + Prazo (30%) + Consistência (30%)
                        </p>
                      </div>
                    </div>

                    {/* Best / Worst cards */}
                    {idoStats && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-sidebar/5 border border-sidebar/20">
                          <Trophy className="h-4 w-4 text-success shrink-0" />
                          <div className="text-xs">
                            <p className="text-muted-foreground">Melhor mês</p>
                            <p className="font-bold text-foreground">{idoStats.best.mes} — <span className="text-success">{idoStats.best.ido}</span></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                          <div className="text-xs">
                            <p className="text-muted-foreground">Pior mês</p>
                            <p className="font-bold text-foreground">{idoStats.worst.mes} — <span className="text-destructive">{idoStats.worst.ido}</span></p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={idoData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (active && payload?.length) {
                                const d = payload[0].payload;
                                if (!d.hasData) return null;
                                const cls = getClassification(d.ido);
                                return (
                                  <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-0.5">
                                    <p className="font-semibold text-foreground">{d.mes} {year}</p>
                                    <p>IDO: <strong style={{ color: toneColor(cls.tone) }}>{d.ido}</strong> — {cls.label}</p>
                                    <p className="text-muted-foreground">Proatividade: {d.proatividade} · Prazo: {d.prazo} · Consistência: {d.consistencia}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="ido"
                            stroke="hsl(var(--sidebar))"
                            strokeWidth={2.5}
                            dot={(props: any) => {
                              const { cx, cy, payload } = props;
                              if (!payload.hasData) return <circle key={props.key} cx={cx} cy={cy} r={0} />;
                              return (
                                <circle
                                  key={props.key}
                                  cx={cx}
                                  cy={cy}
                                  r={4}
                                  fill={barColor(payload.ido)}
                                  stroke="hsl(var(--background))"
                                  strokeWidth={2}
                                />
                              );
                            }}
                            activeDot={{ r: 6, fill: "hsl(var(--sidebar))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                            connectNulls={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {idoStats && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/50">
                        <span>Média IDO: <strong className="text-foreground">{idoStats.avg}</strong></span>
                        <span className="ml-auto">{year}</span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        <AnnualScoreAnalysis open={annualDialogOpen} onOpenChange={setAnnualDialogOpen} year={year} />
      </div>
    </TooltipProvider>
  );
}
