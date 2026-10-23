import type { FinExpense } from "../hooks/use-financial-data";

/**
 * Build the effective list of expenses for a given month/year.
 *
 * Rules:
 * 1. Direct expenses for this month are always included.
 * 2. Recurring (non-installment) expenses carry over to the other months of the same year. A recurring expense can have several
 *    versions (a raise creates a new version from the month it was edited): the month shows the latest version that starts on or
 *    before it; months before the first version keep showing the first one, as they always did (unless it was created with
 *    `starts_at_month`, which means it only starts at its month).
 * 3. Installment expenses carry over until all installments are done, even across years:
 *    - Created in month S (of year Y) with installment_current=C, installment_total=N
 *    - Appears in months S through S+(N-C), counting months straight through year ends (Dec → Jan)
 *    - Displayed installment_current = C + (months between S and the target month)
 *
 * `allExpenses` may include installment rows from earlier years (see useFinAllExpenses); recurring ones from other years are ignored.
 * Calculated copies carry `anchor_year`/`anchor_month`: where the row that really applies is stored.
 */
export function buildEffectiveExpenses(
  storedExpenses: FinExpense[],
  allExpenses: FinExpense[],
  targetMonth: number,
  targetYear: number,
): FinExpense[] {
  const directIds = new Set(storedExpenses.map((e) => e.id));
  const result = [...storedExpenses];
  const targetIndex = targetYear * 12 + (targetMonth - 1);

  // Recurring versions grouped by series
  const series = new Map<string, FinExpense[]>();

  allExpenses.forEach((e) => {
    if (e.is_recurring && !e.installment_total) {
      if (e.year !== targetYear) return; // recurring only lives inside its own year
      const key = e.series_id ?? e.id;
      series.set(key, [...(series.get(key) ?? []), e]);
      return;
    }

    if (directIds.has(e.id)) return; // already included

    // Installment expenses → appear from the original month until the installments finish (months counted across years)
    if (e.installment_total && e.installment_current) {
      const originIndex = e.year * 12 + (e.month - 1);
      const lastIndex = originIndex + (e.installment_total - e.installment_current);

      if (targetIndex >= originIndex && targetIndex <= lastIndex) {
        result.push({
          ...e,
          month: targetMonth,
          year: targetYear,
          installment_current: e.installment_current + (targetIndex - originIndex),
          status: "pendente",
          paid_at: null,
          anchor_year: e.year,
          anchor_month: e.month,
        } as FinExpense);
      }
    }
  });

  series.forEach((versions) => {
    const ordered = [...versions].sort((a, b) => a.month - b.month);
    const applying = [...ordered].reverse().find((v) => v.month <= targetMonth) ?? (ordered[0].starts_at_month ? undefined : ordered[0]);
    if (!applying) return; // ainda não começou: a recorrente foi cadastrada com "vale a partir de" num mês depois deste
    if (directIds.has(applying.id)) return; // the version stored in this very month is already in the list
    // another version stored in this month (stored rows were added above) already covers the series
    if (ordered.some((v) => directIds.has(v.id))) return;
    result.push({ ...applying, month: targetMonth, year: targetYear, status: "pendente", paid_at: null, anchor_year: applying.year, anchor_month: applying.month } as FinExpense);
  });

  return result;
}
