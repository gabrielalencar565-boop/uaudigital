import type { FinExpense } from "../hooks/use-financial-data";

/**
 * Build the effective list of expenses for a given month/year.
 *
 * Rules:
 * 1. Direct expenses for this month are always included.
 * 2. Recurring (non-installment) expenses from ANY month of the same year carry over.
 * 3. Installment expenses carry over until all installments are done:
 *    - Created in month S with installment_current=C, installment_total=N
 *    - Appears in months S through S+(N-C)
 *    - Displayed installment_current = C + (targetMonth - S)
 */
export function buildEffectiveExpenses(
  storedExpenses: FinExpense[],
  allYearExpenses: FinExpense[],
  targetMonth: number,
  targetYear: number,
): FinExpense[] {
  const directIds = new Set(storedExpenses.map((e) => e.id));
  const result = [...storedExpenses];

  allYearExpenses.forEach((e) => {
    if (directIds.has(e.id)) return; // already included

    // Recurring non-installment → appears every month
    if (e.is_recurring && !e.installment_total) {
      result.push({ ...e, month: targetMonth, year: targetYear, status: "pendente", paid_at: null } as FinExpense);
      return;
    }

    // Installment expenses → appear from original month until installments finish
    if (e.installment_total && e.installment_current) {
      const originMonth = e.month;
      const remaining = e.installment_total - e.installment_current;
      const lastMonth = originMonth + remaining; // may exceed 12, but we're same year

      if (targetMonth >= originMonth && targetMonth <= lastMonth) {
        const offset = targetMonth - originMonth;
        result.push({
          ...e,
          month: targetMonth,
          year: targetYear,
          installment_current: e.installment_current + offset,
          status: "pendente",
          paid_at: null,
        } as FinExpense);
      }
    }
  });

  return result;
}
