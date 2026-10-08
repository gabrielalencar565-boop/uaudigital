// Margin per client. The expenses are not tied to a client, so the operational expenses of each month are split by how
// much work each client took: the stages completed in the month, each stage type with its own weight (design is lighter
// than capturing footage). A client with no completed stage has nothing to split by, so it gets NO margin (it would
// look like 100%): only its revenue is shown.

/** Starting weights; any stage not listed here starts at 1. Configurable per agency (Margem por cliente → Ajustar). */
export const DEFAULT_STAGE_WEIGHTS: Record<string, number> = {
  agendamento: 1, // publication
  design: 2,
  planejamento: 3,
  edicao_videos: 3,
  captacao: 4,
};
export const FALLBACK_STAGE_WEIGHT = 1;

/** Expense categories that stay out of the split unless the agency turns them on. */
export const DEFAULT_EXCLUDED_CATEGORIES = ["investimento", "financeira"];

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  operacional: "Operacional",
  administrativa: "Administrativa",
  comercial: "Comercial",
  financeira: "Financeira",
  investimento: "Investimento",
};

export const stageWeight = (weights: Record<string, number>, stage: string) =>
  weights[stage] ?? DEFAULT_STAGE_WEIGHTS[stage] ?? FALLBACK_STAGE_WEIGHT;

export type StageCount = { client_id: string; stage: string; stages: number };

/** Weighted work per client: sum of (completed stages of a type × that type's weight). */
export function weightedWorkload(rows: StageCount[], weights: Record<string, number>): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.client_id, (map.get(r.client_id) ?? 0) + r.stages * stageWeight(weights, r.stage));
  return map;
}

export function sumIncludedExpenses(expenses: { amount: number | string; category: string }[], excludedCategories: string[]): number {
  const excluded = new Set(excludedCategories);
  return expenses.filter((e) => !excluded.has(e.category)).reduce((s, e) => s + Number(e.amount), 0);
}

export type ClientMarginInput = { id: string; name: string; revenue: number };
export type ClientMarginRow = {
  id: string;
  name: string;
  revenue: number; // everything the client paid in the period (always shown)
  revenueWithData: number; // the part of it that falls in months with recorded work
  cost: number;
  margin: number | null;
  marginPct: number | null;
  weight: number;
  stages: number;
  monthsWithData: number;
  monthsActive: number;
  insufficient: boolean; // no completed stage in the whole period: no reliable margin
};
export type ClientMarginResult = {
  rows: ClientMarginRow[];
  totalWeight: number;
  totalExpenses: number;
  unallocated: number; // expenses of months where nobody had recorded work
};

export type MonthMarginInput = {
  clients: ClientMarginInput[];
  workload: Map<string, number>; // weighted
  stageCounts?: Map<string, number>; // raw number of stages, only for display
  totalExpenses: number;
};

/** One month, or several (the year so far): every month is split on its own, then each client is summed. */
export function computeClientMargins(months: MonthMarginInput[]): ClientMarginResult {
  const acc = new Map<string, ClientMarginRow>();
  let totalWeight = 0;
  let totalExpenses = 0;
  let unallocated = 0;

  for (const m of months) {
    const monthWeight = m.clients.reduce((s, c) => s + (m.workload.get(c.id) ?? 0), 0);
    totalWeight += monthWeight;
    totalExpenses += m.totalExpenses;
    if (monthWeight === 0) unallocated += m.totalExpenses;

    for (const c of m.clients) {
      const weight = m.workload.get(c.id) ?? 0;
      const withData = weight > 0 && monthWeight > 0;
      const cost = withData ? m.totalExpenses * (weight / monthWeight) : 0;
      const row =
        acc.get(c.id) ??
        { id: c.id, name: c.name, revenue: 0, revenueWithData: 0, cost: 0, margin: null, marginPct: null, weight: 0, stages: 0, monthsWithData: 0, monthsActive: 0, insufficient: true };
      row.revenue += c.revenue;
      row.monthsActive += 1;
      row.stages += m.stageCounts?.get(c.id) ?? 0;
      row.weight += weight;
      if (withData) {
        row.revenueWithData += c.revenue;
        row.cost += cost;
        row.monthsWithData += 1;
      }
      acc.set(c.id, row);
    }
  }

  const rows = [...acc.values()].map((r) => {
    const insufficient = r.monthsWithData === 0;
    const margin = insufficient ? null : r.revenueWithData - r.cost;
    const marginPct = insufficient || r.revenueWithData <= 0 ? null : ((margin as number) / r.revenueWithData) * 100;
    return { ...r, insufficient, margin, marginPct };
  });

  // reliable margins first (best to worst), then the clients without enough data, biggest revenue first
  rows.sort((a, b) => {
    if (a.insufficient !== b.insufficient) return a.insufficient ? 1 : -1;
    if (a.insufficient) return b.revenue - a.revenue;
    return (b.marginPct ?? -Infinity) - (a.marginPct ?? -Infinity);
  });
  return { rows, totalWeight, totalExpenses, unallocated };
}
