import { MAGIC2_STAGES } from "@/features/magic2/magic2-stages";
import { getDaysInMonth } from "date-fns";

/** Extract the day-of-month in Brazil timezone (UTC-3) from an ISO timestamp */
export function getBrazilDay(isoStr: string): number {
  const d = new Date(isoStr);
  return new Date(d.getTime() - 3 * 3600 * 1000).getUTCDate();
}

export function getClassification(score: number) {
  if (score >= 90) return { label: "Excelente", tone: "success" as const };
  if (score >= 75) return { label: "Saudável", tone: "primary" as const };
  if (score >= 60) return { label: "Atenção", tone: "warning" as const };
  return { label: "Crítico", tone: "danger" as const };
}

export function toneColor(tone: "success" | "primary" | "warning" | "danger") {
  switch (tone) {
    case "success": return "hsl(142, 71%, 45%)";
    case "warning": return "hsl(38, 92%, 50%)";
    case "danger": return "hsl(0, 84%, 60%)";
    default: return "hsl(142, 50%, 55%)";
  }
}

export function barColor(score: number) {
  if (score >= 90) return "hsl(142, 71%, 45%)";
  if (score >= 75) return "hsl(142, 50%, 55%)";
  if (score >= 60) return "hsl(38, 92%, 50%)";
  return "hsl(0, 84%, 60%)";
}

export const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function computeMonthScore(monthStages: any[], totalClients: number, monthNum: number, year: number) {
  const totalStages = totalClients * MAGIC2_STAGES.length;
  const doneStages = monthStages.filter(s => s.completed).length;
  const daysInMonth = getDaysInMonth(new Date(year, monthNum - 1, 1));

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

  const eficiencia = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;

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

export type MonthScoreData = {
  mes: string;
  monthNum: number;
  score: number;
  magicDiff: number | null;
  hasData: boolean;
  label?: string;
  tone?: "success" | "primary" | "warning" | "danger";
};

export function computeAnnualScores(yearData: any, year: number, currentMonth: number): MonthScoreData[] {
  if (!yearData) return [];
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthCycles = (yearData.cycles ?? []).filter((c: any) => c.month === m && c.is_active);
    const monthStages = (yearData.stages ?? []).filter((s: any) => {
      return monthCycles.some((c: any) => c.id === s.cycle_id);
    });
    const totalClients = monthCycles.length;

    if (totalClients === 0 || m > currentMonth) {
      return { mes: MONTH_SHORT[i], monthNum: m, score: 0, magicDiff: null, hasData: false };
    }

    const { score, magicDiff } = computeMonthScore(monthStages, totalClients, m, year);
    const cls = getClassification(score);
    return { mes: MONTH_SHORT[i], monthNum: m, score, magicDiff, hasData: true, ...cls };
  });
}
