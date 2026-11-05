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
import { TrendingUp, Clock, Zap, BarChart3, Info, CalendarCheck, ArrowUp, ArrowDown, Trophy, AlertTriangle, TrendingDown, Target, Star, Lightbulb, FileText, Copy, Download, Grid3x3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  format, getDaysInMonth,
} from "date-fns";
import { useMagic2Month, type Magic2CycleRow, type Magic2StageRow } from "@/features/magic2/hooks/use-magic2";
import { useMagic2Year } from "@/features/magic2/hooks/use-magic2-year";
import { MAGIC2_STAGES } from "@/features/magic2/magic2-stages";
import { getCycleMonthYear } from "@/features/magic2/Magic2Panel";
import { useMagicNumberConfig } from "@/features/data/queries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brandChartDefs, useBrandGradientIds } from "@/components/metrics/BrandChartDefs";
import { brandGradientCss } from "@/lib/brand-gradient";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

import { getClassification, toneColor, MONTH_SHORT, computeAnnualScores, getBrazilDay } from "@/features/projetos/utils/score-utils";


const INDICATOR_TOOLTIPS: Record<string, string> = {
  "Prazo": "Avalia se a operação foi concluída dentro do prazo ideal (dia 25). Quanto antes finalizar, maior a pontuação.",
  "Eficiência": "Percentual de etapas concluídas em relação ao total de etapas de todos os clientes ativos no mês.",
  "Consistência": "Mede se a produção foi distribuída de forma uniforme ao longo do mês, evitando acúmulo nos últimos dias.",
};

const MONTH_FULL_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const SCORE_RANGES = [
  { min: 90, max: 100, label: "Excelente", tone: "success" as const, desc: "Operação impecável, tudo no prazo e bem distribuído." },
  { min: 75, max: 89, label: "Saudável", tone: "primary" as const, desc: "Boa performance, com pequenos pontos de melhoria." },
  { min: 60, max: 74, label: "Atenção", tone: "warning" as const, desc: "Atrasos ou acúmulos que precisam de correção." },
  { min: 0, max: 59, label: "Crítico", tone: "danger" as const, desc: "Performance abaixo do aceitável, ação urgente necessária." },
];

// ───────── cliente por etapa (usado na tela e no relatório) ─────────

const STAGE_SHORT: Record<string, string> = {
  planejamento: "Planej.", captacao: "Captação", design: "Design", edicao_videos: "Vídeo", pdf: "Cronog.", agendamento: "Agend.", alteracoes: "Alter.",
};
// Ordem em que as etapas costumam acontecer ao longo do mês.
const STAGE_ORDER = ["planejamento", "captacao", "design", "edicao_videos", "pdf", "agendamento", "alteracoes"] as const;
const EARLY_DAY = 20;

type GridCell = { label: string; done: boolean; late: boolean; early: boolean; rel: number | null };
type GridRow = { name: string; cells: GridCell[]; avg: number };

/** Dia (do mês escolhido) em que cada cliente concluiu cada etapa; do mais adiantado ao mais atrasado. */
function buildStageGrid(cycles: Magic2CycleRow[], stages: Magic2StageRow[], prefix: string): GridRow[] {
  const monthStart = Date.UTC(+prefix.slice(0, 4), +prefix.slice(5, 7) - 1, 1);
  const rows = cycles.map((c) => {
    const cells = STAGE_ORDER.map((key): GridCell => {
      const st = stages.find((x) => x.cycle_id === c.id && x.stage === key);
      if (!st?.completed || !st.completed_at) return { label: "–", done: false, late: false, early: false, rel: null };
      const d = brDate(st.completed_at);
      const inMonth = d.startsWith(prefix);
      const rel = Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - monthStart) / 86400000) + 1;
      return { label: inMonth ? String(+d.slice(8, 10)) : `${+d.slice(8, 10)}/${+d.slice(5, 7)}`, done: true, late: d > c.due_date, early: inMonth && +d.slice(8, 10) <= EARLY_DAY, rel };
    });
    const production = cells.slice(0, 5).filter((x) => x.rel !== null).map((x) => x.rel as number);
    const avg = production.length ? production.reduce((a, b) => a + b, 0) / production.length : Infinity;
    return { name: c.magic2_clients?.name ?? "Sem nome", cells, avg };
  });
  return rows.sort((a, b) => a.avg - b.avg || a.name.localeCompare(b.name));
}

function stageGridSummary(rows: GridRow[]) {
  const lateByStage = STAGE_ORDER.map((key, idx) => ({ key, n: rows.filter((r) => r.cells[idx].late).length }));
  const topLate = [...lateByStage].sort((a, b) => b.n - a.n)[0];
  const earliest = rows.filter((r) => Number.isFinite(r.avg)).slice(0, 3).map((r) => r.name);
  const withLate = rows.filter((r) => r.cells.some((c) => c.late)).length;
  const medianDay = (idx: number) => {
    const v = rows.map((r) => r.cells[idx].rel).filter((x): x is number => x !== null).sort((a, b) => a - b);
    return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
  };
  return { lateByStage, topLate, earliest, withLate, medianDay };
}

// ───────── relatório do mês (texto pronto para colar em uma IA) ─────────

type MagicReportInput = {
  year: number;
  month: number;
  prevYear: number;
  prevMonth: number;
  magicDay: number;
  magicLabel: string;
  isCurrent: boolean;
  today: string;
  cycles: Magic2CycleRow[];
  stages: Magic2StageRow[];
  prevCycles: Magic2CycleRow[];
  prevStages: Magic2StageRow[];
  cycleMonth: number;
  score: { total: number; label: string; prev: number | null };
  annual: { n: number; mes: string; score: number; ido: number; proatividade: number; antesMagic: number; clientes: number }[];
  withPrompt: boolean;
};

const brDate = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
const rowsToMd = (head: string[], rows: (string | number)[][]) => [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...rows.map((r) => `| ${r.join(" | ")} |`)];

function buildMagicReport(i: MagicReportInput): string {
  const mm = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const prefix = mm(i.year, i.month);
  const lastDay = getDaysInMonth(new Date(i.year, i.month - 1, 1));
  const monthEnd = `${prefix}-${String(lastDay).padStart(2, "0")}`;
  const cutoff = i.isCurrent ? i.today : monthEnd; // mês passado = como estava no último dia
  const done = i.stages.filter((s) => s.completed && s.completed_at);
  const doneBy = (list: Magic2StageRow[], limit: string) => list.filter((s) => s.completed && s.completed_at && brDate(s.completed_at) <= limit).length;
  const total = i.cycles.length * MAGIC2_STAGES.length;
  const prevTotal = i.prevCycles.length * MAGIC2_STAGES.length;
  const pctOf = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const atCutoff = doneBy(i.stages, cutoff);
  const later = done.filter((s) => brDate(s.completed_at!) > monthEnd).length;
  const clientName = (c: Magic2CycleRow) => c.magic2_clients?.name ?? "Sem nome";
  const L: string[] = [];

  if (i.withPrompt) {
    L.push(
      "# Instruções para a IA", "",
      `Você é analista de operações de uma agência de marketing digital. Abaixo estão os dados reais do ${i.magicLabel} (progresso da operação) de ${MONTH_FULL_NAMES[i.month - 1].toLowerCase()} de ${i.year}. Use SOMENTE esses dados e não invente números. Responda em português, em linguagem simples e direta, com:`, "",
      "1. Resumo executivo (até 5 linhas).",
      "2. Como foi o ritmo do mês e se a operação chegou ao prazo.",
      "3. Clientes e etapas que seguraram o resultado, com os números.",
      "4. Comparação com o mês anterior e com o ano.",
      "5. Pauta da reunião e ações recomendadas, com responsável sugerido e prazo.", "",
      "---", ""
    );
  }

  L.push(`# Relatório do ${i.magicLabel}: ${MONTH_FULL_NAMES[i.month - 1].toLowerCase()} de ${i.year}`, "", `Gerado em ${i.today.split("-").reverse().join("/")}.`, "");

  L.push("## Como ler os dados", "");
  L.push(
    `- Cada cliente tem ${MAGIC2_STAGES.length} etapas no mês (${MAGIC2_STAGES.map((s) => s.label).join(", ")}). O progresso é o % de etapas concluídas sobre o total.`,
    `- O prazo da operação é o dia ${i.magicDay} (${i.magicLabel}). Quanto antes as etapas forem concluídas, melhor.`,
    i.isCurrent ? "- Este é o mês em andamento: os números mostram a situação até hoje." : "- Este é um mês encerrado: o progresso mostra como estava no último dia do mês. Etapas concluídas depois disso aparecem à parte.",
    "- Uau Score: nota mensal do sistema (0 a 100) que combina prazo, eficiência e consistência.",
    ""
  );

  L.push("## Resumo do mês", "");
  const prevCut = i.isCurrent ? `${mm(i.prevYear, i.prevMonth)}-${String(Math.min(+i.today.slice(8, 10), getDaysInMonth(new Date(i.prevYear, i.prevMonth - 1, 1)))).padStart(2, "0")}` : `${mm(i.prevYear, i.prevMonth)}-${String(getDaysInMonth(new Date(i.prevYear, i.prevMonth - 1, 1))).padStart(2, "0")}`;
  const prevAt = doneBy(i.prevStages, prevCut);
  const fullClients = i.cycles.filter((c) => {
    const st = i.stages.filter((s) => s.cycle_id === c.id);
    return st.length > 0 && st.every((s) => s.completed && s.completed_at && brDate(s.completed_at) <= cutoff);
  });
  L.push(
    ...rowsToMd(["Indicador", `${MONTH_FULL_NAMES[i.month - 1]}`, `${MONTH_FULL_NAMES[i.prevMonth - 1]} (anterior)`], [
      ["Clientes ativos", i.cycles.length, i.prevCycles.length],
      ["Etapas no mês", total, prevTotal],
      [i.isCurrent ? "Etapas concluídas até hoje" : "Etapas concluídas até o fim do mês", atCutoff, prevAt],
      ["Progresso", `${pctOf(atCutoff, total)}%`, `${pctOf(prevAt, prevTotal)}%`],
      ["Uau Score", i.score.total ? `${i.score.total} (${i.score.label})` : "–", i.score.prev ?? "n/d"],
    ]),
    ""
  );
  L.push(`Clientes com todas as etapas concluídas: ${fullClients.length} de ${i.cycles.length}.`);
  if (!i.isCurrent && later > 0) L.push(`Etapas concluídas só depois do fim do mês: ${later}.`);
  L.push("");

  // ritmo: acumulado em pontos do mês, contra o mês anterior
  const todayDay = +i.today.slice(8, 10);
  const checkpoints = [...new Set([5, 10, 15, 20, i.magicDay, lastDay, ...(i.isCurrent ? [todayDay] : [])])].filter((d) => d <= lastDay).sort((a, b) => a - b);
  const prevLast = getDaysInMonth(new Date(i.prevYear, i.prevMonth - 1, 1));
  L.push("## Ritmo ao longo do mês (progresso acumulado)", "");
  L.push(
    ...rowsToMd(["Até o dia", `${MONTH_FULL_NAMES[i.month - 1]}`, `${MONTH_FULL_NAMES[i.prevMonth - 1]}`],
      checkpoints
        .filter((d) => i.isCurrent ? `${prefix}-${String(d).padStart(2, "0")}` <= i.today : true)
        .map((d) => [
          d === lastDay ? `${d} (fim do mês)` : d === i.magicDay ? `${d} (${i.magicLabel})` : i.isCurrent && d === todayDay ? `${d} (hoje)` : d,
          `${pctOf(doneBy(i.stages, `${prefix}-${String(d).padStart(2, "0")}`), total)}%`,
          `${pctOf(doneBy(i.prevStages, `${mm(i.prevYear, i.prevMonth)}-${String(Math.min(d, prevLast)).padStart(2, "0")}`), prevTotal)}%`,
        ])
    ),
    ""
  );

  const bucket = (from: number, to: number) => done.filter((s) => { const d = brDate(s.completed_at!); return d.startsWith(prefix) && +d.slice(8, 10) >= from && +d.slice(8, 10) <= to; }).length;
  L.push("## Quando as etapas foram concluídas", "");
  L.push(
    ...rowsToMd(["Período", "Etapas"], [
      ["Dias 1 a 10", bucket(1, 10)],
      ["Dias 11 a 20", bucket(11, 20)],
      [`Dias 21 a ${i.magicDay}`, bucket(21, i.magicDay)],
      [`Depois do dia ${i.magicDay} (no mês)`, bucket(i.magicDay + 1, lastDay)],
      ["Depois do fim do mês", later],
    ]),
    ""
  );

  const grid = buildStageGrid(i.cycles, i.stages, prefix);
  const gsum = stageGridSummary(grid);
  L.push("## Por etapa", "");
  L.push(
    ...rowsToMd(["Etapa", "Concluídas", "Total", "%", "Dia mais comum de conclusão", "Concluídas depois do prazo"], MAGIC2_STAGES.map((st) => {
      const rows = i.stages.filter((s) => s.stage === st.key);
      const n = rows.filter((s) => s.completed && s.completed_at && brDate(s.completed_at) <= cutoff).length;
      const idx = STAGE_ORDER.indexOf(st.key);
      const med = gsum.medianDay(idx);
      return [st.label, n, i.cycles.length, `${pctOf(n, i.cycles.length)}%`, med === null ? "–" : med > lastDay ? `mês seguinte (dia ${med - lastDay})` : `dia ${med}`, gsum.lateByStage[idx].n];
    })),
    ""
  );

  L.push("## Cliente por etapa", "");
  L.push(`Dia do mês em que cada cliente concluiu cada etapa, do mais adiantado ao mais atrasado. * = concluída depois do prazo do cliente. – = ainda não concluída. Datas como 5/11 são do mês seguinte.`, "");
  L.push(
    ...rowsToMd(["Cliente", ...STAGE_ORDER.map((k) => MAGIC2_STAGES.find((m) => m.key === k)!.label)], grid.map((r) => [r.name, ...r.cells.map((c) => (c.late ? `${c.label}*` : c.label))])),
    ""
  );
  if (gsum.earliest.length > 0) L.push(`Clientes que mais adiantaram as etapas de produção: ${gsum.earliest.join(", ")}.`, "");
  if (gsum.topLate.n > 0) {
    const stLabel = MAGIC2_STAGES.find((m) => m.key === gsum.topLate.key)!.label;
    L.push(`Etapa que mais passou do prazo: ${stLabel} (${gsum.topLate.n} clientes). ${gsum.withLate} clientes tiveram ao menos uma etapa fora do prazo.`, "");
  }

  L.push("## Por cliente", "");
  const clientRows = i.cycles.map((c) => {
    const st = i.stages.filter((s) => s.cycle_id === c.id);
    const okSt = st.filter((s) => s.completed && s.completed_at && brDate(s.completed_at) <= cutoff);
    const last = okSt.length ? okSt.map((s) => brDate(s.completed_at!)).sort().pop()! : null;
    const missing = MAGIC2_STAGES.filter((m) => !okSt.some((s) => s.stage === m.key)).map((m) => m.label);
    const finished = okSt.length === MAGIC2_STAGES.length;
    const status = finished ? (last && last <= c.due_date ? "No prazo" : "Atrasado") : i.isCurrent ? "Em andamento" : "Não concluído";
    return { name: clientName(c), n: okSt.length, last, missing, status, due: c.due_date };
  }).sort((a, b) => a.n - b.n || a.name.localeCompare(b.name));
  L.push(
    ...rowsToMd(["Cliente", "Etapas", "%", "Prazo", "Última conclusão", "Situação", "Faltam"], clientRows.map((c) => [
      c.name, `${c.n}/${MAGIC2_STAGES.length}`, `${pctOf(c.n, MAGIC2_STAGES.length)}%`, ddmm(c.due), c.last ? ddmm(c.last) : "–", c.status, c.missing.length ? c.missing.join(", ") : "–",
    ])),
    ""
  );

  // Só meses fechados e o mês escolhido: um mês recém-começado distorce a leitura do ano.
  const shown = i.annual.filter((m) => m.clientes > 0 && (m.n < i.cycleMonth || m.n === i.month));
  if (shown.length > 0) {
    L.push("## Visão do ano", "");
    L.push(...rowsToMd(["Mês", "Uau Score", "IDO", "Proatividade", `Etapas feitas até o dia ${i.magicDay}`, "Clientes"], shown.map((m) => [m.mes, m.score || "–", m.ido || "–", m.proatividade ? `${m.proatividade}%` : "–", `${m.antesMagic}%`, m.clientes])), "");
    L.push("IDO = Índice de Disciplina Operacional: Proatividade (40%) + Prazo (30%) + Consistência (30%).", "");
  }

  return L.join("\n").trim() + "\n";
}

export function MonthlyAnalysisSection({ className }: { className?: string }) {
  const now = new Date();
  const areaIds = useBrandGradientIds();
  const barIds = useBrandGradientIds();
  const lineIds = useBrandGradientIds();
  const { dayFor, label: magicLabel } = useMagicNumberConfig();
  // Magic Number cycle: after the configured D-day it rolls over to next month, same rule as Magic2Panel.
  const cycleMY = getCycleMonthYear(now, dayFor);
  const cycleYear = cycleMY.year;
  const cycleMonth = cycleMY.month;

  // The month shown in the monthly chart: the current cycle by default, or any earlier month picked by the user.
  const [pickedMonth, setPickedMonth] = useState<number | null>(null);
  const year = cycleYear;
  const month = pickedMonth ?? cycleMonth;
  // Dia D do mês mostrado (pode ser uma exceção, ex.: dezembro fechando antes)
  const magicDay = dayFor(year, month);
  const isCurrentCycle = month === cycleMonth;
  // How many real days of the shown month have elapsed: the current cycle follows today's date,
  // a past month counts as complete (0 while we've rolled over but that month hasn't started yet).
  const currentDay = isCurrentCycle
    ? ((now.getFullYear() === year && now.getMonth() + 1 === month) ? now.getDate() : 0)
    : getDaysInMonth(new Date(year, month - 1, 1));
  // The annual charts always run up to the current cycle, whatever month is picked.
  const annualCutoff = cycleMonth;

  const [chartMode, setChartMode] = useState<"mensal" | "anual">("mensal");
  const [annualDialogOpen, setAnnualDialogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [stageGridOpen, setStageGridOpen] = useState(false);
  const [reportWithPrompt, setReportWithPrompt] = useState(true);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMagicDay = dayFor(prevYear, prevMonth);

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
    const totalDays = getDaysInMonth(new Date(year, month - 1, 1));
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
  }, [stages, prevStages, now, totalStages, prevTotalStages, currentDay, year, month, prevYear, prevMonth, dayFor]);

  // ── Annual progress data (% completed before Magic Number per month) ──
  const annualProgressData = useMemo(() => {
    if (!yearData) return [];
    const currentMonth = annualCutoff;

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
        s.completed && s.completed_at && getBrazilDay(s.completed_at) <= dayFor(year, m)
      ).length;
      const pct = totalStagesMonth > 0 ? Math.round((beforeMagic / totalStagesMonth) * 100) : 0;

      // Magic diff
      const completedDates = monthStages
        .filter((s: any) => s.completed && s.completed_at)
        .map((s: any) => getBrazilDay(s.completed_at!));
      const lastDay = completedDates.length > 0 ? Math.max(...completedDates) : null;
      const allDone = completedStages === totalStagesMonth && totalStagesMonth > 0;
      const magicDiff = allDone && lastDay !== null ? dayFor(year, m) - lastDay : null;

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
  }, [yearData, year, dayFor]);

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
    const currentMonth = annualCutoff;

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
        else if (day <= dayFor(year, m)) weightedSum += 0.3;
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
  }, [yearData, year, dayFor]);

  const bestProactivityMonth = useMemo(() => {
    const active = proactivityData.filter(m => m.hasData && m.proatividade > 0);
    if (active.length === 0) return null;
    return active.reduce((a, b) => a.proatividade > b.proatividade ? a : b);
  }, [proactivityData]);

  // ── IDO (Índice de Disciplina Operacional) per month ──
  const idoData = useMemo(() => {
    if (!yearData) return [];
    const currentMonth = annualCutoff;

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
        else if (day <= dayFor(year, m)) weightedSum += 0.3;
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
        if (lastDay <= dayFor(year, m) - 3) prazoScore = 100;
        else if (lastDay <= dayFor(year, m)) prazoScore = 75;
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
  }, [yearData, year, dayFor]);

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
    return computeAnnualScores(yearData, year, annualCutoff, dayFor);
  }, [yearData, year, annualCutoff, dayFor]);

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
      if (lastDay <= magicDay - 2) prazoScore = 100;
      else if (lastDay <= magicDay) prazoScore = 85;
      else if (lastDay <= 30) prazoScore = 60;
      else prazoScore = 40;
    } else {
      if (currentDay <= 20) prazoScore = 80;
      else if (currentDay <= magicDay - 2) prazoScore = 65;
      else if (currentDay <= magicDay) prazoScore = 50;
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
      const spreadRatio = counts.length / Math.min(currentDay, magicDay);
      consistenciaScore = Math.round(consistenciaScore * 0.7 + spreadRatio * 100 * 0.3);
      consistenciaScore = Math.max(0, Math.min(100, consistenciaScore));
    }

    const score = Math.round((prazoScore + eficienciaScore + consistenciaScore) / 3);
    return { prazo: prazoScore, eficiencia: eficienciaScore, consistencia: consistenciaScore, uauScore: score };
  }, [stages, currentDay, doneStages, totalStages, dayFor]);

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
      if (prevLastDay <= prevMagicDay - 2) prevPrazo = 100;
      else if (prevLastDay <= prevMagicDay) prevPrazo = 85;
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
      const spreadRatio = counts.length / Math.min(prevTotalDaysInMonth, prevMagicDay);
      prevConsistencia = Math.round(prevConsistencia * 0.7 + spreadRatio * 100 * 0.3);
      prevConsistencia = Math.max(0, Math.min(100, prevConsistencia));
    }

    return Math.round((prevPrazo + prevEficiencia + prevConsistencia) / 3);
  }, [prevStages, prevTotalStages, prevYear, prevMonth, dayFor]);

  // Numbers behind the "Progresso" line. A past month is judged as it stood on its last day:
  // stages finished later (in the next month) don't count, so the text agrees with the chart.
  const monthEndStr = format(new Date(year, month - 1, Math.max(currentDay, 1)), "yyyy-MM-dd");
  const viewDone = isCurrentCycle
    ? doneStages
    : stages.filter(s => s.completed && s.completed_at && s.completed_at.slice(0, 10) <= monthEndStr).length;
  const prevCutDay = isCurrentCycle ? currentDay : Math.min(currentDay, getDaysInMonth(new Date(prevYear, prevMonth - 1, 1)));
  const prevCutStr = format(new Date(prevYear, prevMonth - 1, Math.max(prevCutDay, 1)), "yyyy-MM-dd");
  const prevSameDayDoneView = isCurrentCycle
    ? prevStages.filter(s => {
        if (!s.completed || !s.completed_at) return false;
        return new Date(s.completed_at).getDate() <= currentDay;
      }).length
    : prevStages.filter(s => s.completed && s.completed_at && s.completed_at.slice(0, 10) <= prevCutStr).length;

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

  const stageGrid = useMemo(() => buildStageGrid(cycles, stages, `${year}-${String(month).padStart(2, "0")}`), [cycles, stages, year, month]);
  const stageGridInfo = useMemo(() => stageGridSummary(stageGrid), [stageGrid]);
  const todayStr = new Date(now.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const reportText = useMemo(() => {
    if (!reportOpen) return "";
    return buildMagicReport({
      year, month, prevYear, prevMonth, magicDay, magicLabel, isCurrent: isCurrentCycle, today: todayStr, cycleMonth,
      cycles, stages, prevCycles, prevStages,
      score: {
        total: annualScoreData[month - 1]?.score ?? 0,
        label: getClassification(annualScoreData[month - 1]?.score ?? 0).label,
        prev: prevYear === year ? (annualScoreData[prevMonth - 1]?.score ?? null) : null,
      },
      annual: Array.from({ length: 12 }, (_, idx) => ({
        n: idx + 1,
        mes: MONTH_FULL_NAMES[idx],
        score: annualScoreData[idx]?.hasData ? annualScoreData[idx].score : 0,
        ido: idoData[idx]?.hasData ? idoData[idx].ido : 0,
        proatividade: proactivityData[idx]?.hasData ? proactivityData[idx].proatividade : 0,
        antesMagic: annualProgressData[idx]?.hasData ? annualProgressData[idx].percentual : 0,
        clientes: annualProgressData[idx]?.hasData ? annualProgressData[idx].clientes : 0,
      })),
      withPrompt: reportWithPrompt,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportOpen, reportWithPrompt, year, month, cycleMonth, cycles, stages, prevCycles, prevStages, annualScoreData, idoData, proactivityData, annualProgressData, dayFor]);

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success("Relatório copiado. É só colar na sua IA.");
    } catch {
      toast.error("Não foi possível copiar. Use o botão Baixar ou selecione o texto.");
    }
  };

  const downloadReport = () => {
    const url = URL.createObjectURL(new Blob([reportText], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-magic-number-${year}-${String(month).padStart(2, "0")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-0.5">
          <p className="font-semibold text-foreground">Dia {label}</p>
          {payload.map((p: any) => (
            <p key={p.dataKey} style={{ color: p.dataKey === "percentual" ? "#c86be6" : p.color }}>
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
                <div className="flex flex-col items-end gap-2 shrink-0">
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
                {chartMode === "mensal" && (
                  <Select value={String(month)} onValueChange={(v) => setPickedMonth(+v === cycleMonth ? null : +v)}>
                    <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Escolher o mês">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: cycleMonth }, (_, i) => cycleMonth - i).map((m) => (
                        <SelectItem key={m} value={String(m)} className="text-xs">
                          {MONTH_FULL_NAMES[m - 1]}{m === cycleMonth ? " (atual)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {chartMode === "mensal" && (
                  <Button type="button" variant="outline" size="sm" className="h-8 w-[150px] text-xs" onClick={() => setReportOpen(true)}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" /> Gerar relatório
                  </Button>
                )}
                </div>
              </div>

              {chartMode === "mensal" ? (
                <>
                  <div className="h-[260px] w-full flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={progressData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        {brandChartDefs(areaIds)}
                        <defs>
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
                          stroke={`url(#${areaIds.h})`}
                          strokeWidth={2.5}
                          fill={`url(#${areaIds.area})`}
                          dot={false}
                          activeDot={{ r: 4, fill: "#c86be6", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-col gap-2 pt-1 border-t border-border/50">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-0.5 rounded-full" style={{ background: brandGradientCss(90) }} />
                        {currentMonthLabel}{isCurrentCycle ? " (atual)" : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block w-4 h-0.5 rounded-full border-t border-dashed" style={{ borderColor: "hsl(var(--muted-foreground))" }} />
                        {prevMonthLabel} (anterior)
                      </span>
                      <Button type="button" variant="outline" size="sm" className="ml-auto h-7 text-xs" onClick={() => setStageGridOpen(true)}>
                        <Grid3x3 className="mr-1.5 h-3.5 w-3.5" /> Cliente por etapa
                      </Button>
                    </div>

                    {(() => {
                      const currentPct = totalStages > 0 ? Math.round((viewDone / totalStages) * 100) : 0;
                      const prevDoneStages = prevStages.filter(s => s.completed).length;
                      const prevPct = prevTotalStages > 0 ? Math.round((prevDoneStages / prevTotalStages) * 100) : 0;

                      const prevSameDayDone = prevSameDayDoneView;
                      const prevSameDayPct = prevTotalStages > 0 ? Math.round((prevSameDayDone / prevTotalStages) * 100) : 0;
                      const delta = currentPct - prevSameDayPct;

                      return (
                        <div className="flex items-center gap-4 text-xs flex-wrap">
                          <span className="text-muted-foreground">
                            {isCurrentCycle ? "Progresso atual" : "Fechou o mês com"}: <strong className="text-foreground">{currentPct}%</strong>
                          </span>
                          <span className="text-muted-foreground">
                            {prevMonthLabel} dia {prevCutDay}: <strong className="text-foreground">{prevSameDayPct}%</strong>
                          </span>
                          <span className={cn(
                            "font-bold tabular-nums",
                            delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"
                          )}>
                            {delta > 0 ? "+" : ""}{delta}pp {delta > 0 ? "↑" : delta < 0 ? "↓" : "="}
                          </span>
                          <span className="ml-auto text-muted-foreground">{viewDone}/{totalStages} etapas · {cycles.length} clientes</span>
                        </div>
                      );
                    })()}
                   </div>

                   {/* Insight line */}
                   {(() => {
                     const currentPct = totalStages > 0 ? Math.round((viewDone / totalStages) * 100) : 0;
                     const prevDoneStages = prevStages.filter(s => s.completed).length;
                     const prevSameDayDone = prevSameDayDoneView;
                     const prevSameDayPct = prevTotalStages > 0 ? Math.round((prevSameDayDone / prevTotalStages) * 100) : 0;
                     const delta = currentPct - prevSameDayPct;

                     if (delta !== 0 && prevSameDayPct > 0) {
                       return (
                         <div className="flex items-center gap-2 text-xs bg-accent/30 rounded-lg px-3 py-2 mt-auto">
                           <Lightbulb className="h-3.5 w-3.5 text-sidebar shrink-0" />
                           <span className="text-muted-foreground">
                             {delta > 0
                               ? <>Operação {isCurrentCycle ? "está" : "ficou"} <strong className="text-success">{delta}pp à frente</strong> {isCurrentCycle ? "do mesmo dia no mês anterior" : `de ${prevMonthLabel}`}</>
                               : <>Operação {isCurrentCycle ? "está" : "ficou"} <strong className="text-destructive">{Math.abs(delta)}pp atrás</strong> {isCurrentCycle ? "do mesmo dia no mês anterior" : `de ${prevMonthLabel}`}</>
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
                          {brandChartDefs(barIds)}
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
                                fill={entry.hasData ? `url(#${barIds.v})` : "hsl(var(--muted))"}
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
                          {brandChartDefs(lineIds)}
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
                            stroke={`url(#${lineIds.h})`}
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
                                  fill="#c86be6"
                                  stroke="hsl(var(--background))"
                                  strokeWidth={2}
                                />
                              );
                            }}
                            activeDot={{ r: 6, fill: "#c86be6", stroke: "hsl(var(--background))", strokeWidth: 2 }}
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
        <Dialog open={stageGridOpen} onOpenChange={setStageGridOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cliente por etapa: {MONTH_FULL_NAMES[month - 1].toLowerCase()}</DialogTitle>
              <DialogDescription>Dia em que cada etapa foi concluída, do cliente mais adiantado ao mais atrasado.</DialogDescription>
            </DialogHeader>
            {stageGrid.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente ativo neste mês.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/30" />Até o dia {EARLY_DAY}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted" />Depois do dia {EARLY_DAY}, no prazo</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500/30" />Depois do prazo</span>
                  <span className="flex items-center gap-1.5"><span className="font-medium">–</span>Ainda não concluída</span>
                </div>
                <div className="grid grid-cols-[minmax(84px,120px)_repeat(7,minmax(0,1fr))] gap-1 text-xs">
                  <span />
                  {STAGE_ORDER.map((k) => (
                    <span key={k} className="text-center text-[11px] text-muted-foreground" title={MAGIC2_STAGES.find((m) => m.key === k)?.label}>{STAGE_SHORT[k]}</span>
                  ))}
                  {stageGrid.map((r) => (
                    <div key={r.name} className="contents">
                      <span className="truncate self-center" title={r.name}>{r.name}</span>
                      {r.cells.map((c, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            "rounded-md py-1 text-center tabular-nums",
                            !c.done ? "text-muted-foreground/50" : c.late ? "bg-red-500/15 text-red-600 dark:text-red-400" : c.early ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted/60 text-muted-foreground"
                          )}
                        >
                          {c.label}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {stageGridInfo.earliest.length > 0 && <p>Mais adiantados nas etapas de produção: <strong className="text-foreground">{stageGridInfo.earliest.join(", ")}</strong>.</p>}
                  {stageGridInfo.topLate.n > 0 && (
                    <p>
                      Etapa que mais passou do prazo: <strong className="text-foreground">{MAGIC2_STAGES.find((m) => m.key === stageGridInfo.topLate.key)?.label}</strong> ({stageGridInfo.topLate.n} clientes). {stageGridInfo.withLate} clientes tiveram ao menos uma etapa fora do prazo.
                    </p>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Relatório de {MONTH_FULL_NAMES[month - 1].toLowerCase()}</DialogTitle>
              <DialogDescription>Texto pronto com os dados do {magicLabel} do mês escolhido. Copie e cole na sua IA para ela montar a análise e a pauta.</DialogDescription>
            </DialogHeader>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={reportWithPrompt} onCheckedChange={(v) => setReportWithPrompt(v === true)} />
              Incluir instruções para a IA
            </label>
            <textarea
              readOnly
              value={reportText}
              onFocus={(e) => e.currentTarget.select()}
              className="h-[48vh] w-full resize-none rounded-lg border bg-muted/30 p-3 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={downloadReport}><Download className="mr-1.5 h-4 w-4" /> Baixar (.md)</Button>
              <Button type="button" onClick={() => void copyReport()}><Copy className="mr-1.5 h-4 w-4" /> Copiar para a IA</Button>
            </div>
          </DialogContent>
        </Dialog>
        <AnnualScoreAnalysis open={annualDialogOpen} onOpenChange={setAnnualDialogOpen} year={year} />
      </div>
    </TooltipProvider>
  );
}
