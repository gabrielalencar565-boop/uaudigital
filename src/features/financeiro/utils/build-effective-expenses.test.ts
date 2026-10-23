import { describe, expect, it } from "vitest";
import { buildEffectiveExpenses } from "./build-effective-expenses";
import type { FinExpense } from "../hooks/use-financial-data";

const exp = (o: Partial<FinExpense>): FinExpense => ({
  id: "x", description: "Item", category: "investimento", amount: 100, is_recurring: false,
  installment_total: null, installment_current: null, month: 1, year: 2026, status: "pago", ...o,
} as unknown as FinExpense);

describe("buildEffectiveExpenses", () => {
  it("parcela aparece do mês de origem até a última parcela, contando a parcela de cada mês", () => {
    const e = exp({ id: "a", installment_total: 12, installment_current: 2, month: 10, year: 2026 });
    expect(buildEffectiveExpenses([], [e], 9, 2026)).toHaveLength(0);
    expect(buildEffectiveExpenses([], [e], 10, 2026)[0].installment_current).toBe(2);
    expect(buildEffectiveExpenses([], [e], 12, 2026)[0].installment_current).toBe(4);
  });

  it("parcela que passa de dezembro continua em janeiro do ano seguinte até terminar", () => {
    const e = exp({ id: "a", installment_total: 12, installment_current: 2, month: 10, year: 2026 });
    const jan = buildEffectiveExpenses([], [e], 1, 2027);
    expect(jan).toHaveLength(1);
    expect(jan[0].installment_current).toBe(5);
    expect(jan[0].year).toBe(2027);
    expect(buildEffectiveExpenses([], [e], 8, 2027)[0].installment_current).toBe(12);
    expect(buildEffectiveExpenses([], [e], 9, 2027)).toHaveLength(0);
  });

  it("parcela que já terminou não aparece mais", () => {
    const e = exp({ id: "a", installment_total: 10, installment_current: 10, month: 9, year: 2026 });
    expect(buildEffectiveExpenses([], [e], 9, 2026)).toHaveLength(1);
    expect(buildEffectiveExpenses([], [e], 10, 2026)).toHaveLength(0);
  });

  it("recorrente sem parcelas só vale dentro do próprio ano", () => {
    const e = exp({ id: "r", is_recurring: true, month: 3, year: 2026 });
    expect(buildEffectiveExpenses([], [e], 11, 2026)).toHaveLength(1);
    expect(buildEffectiveExpenses([], [e], 1, 2027)).toHaveLength(0);
  });

  it("o que já está lançado no mês não é duplicado", () => {
    const e = exp({ id: "a", installment_total: 12, installment_current: 2, month: 10, year: 2026 });
    expect(buildEffectiveExpenses([e], [e], 10, 2026)).toHaveLength(1);
  });

  it("reajuste de recorrente vale do mês dele para a frente; os meses antes continuam com o valor antigo", () => {
    const antigo = exp({ id: "v1", is_recurring: true, month: 1, year: 2026, amount: 2000 });
    const novo = exp({ id: "v2", is_recurring: true, month: 11, year: 2026, amount: 2200, series_id: "v1" });
    const valor = (m: number) => buildEffectiveExpenses([], [antigo, novo], m, 2026).map((e) => Number(e.amount));
    expect(valor(3)).toEqual([2000]);
    expect(valor(10)).toEqual([2000]);
    expect(valor(11)).toEqual([2200]);
    expect(valor(12)).toEqual([2200]);
  });

  it("recorrente com uma versão só aparece em todos os meses do ano, como antes", () => {
    const e = exp({ id: "r", is_recurring: true, month: 10, year: 2026, amount: 500 });
    expect(buildEffectiveExpenses([], [e], 2, 2026)).toHaveLength(1);
    expect(buildEffectiveExpenses([], [e], 12, 2026)).toHaveLength(1);
  });

  it("a versão gravada no próprio mês não é duplicada", () => {
    const antigo = exp({ id: "v1", is_recurring: true, month: 1, year: 2026, amount: 2000 });
    const novo = exp({ id: "v2", is_recurring: true, month: 11, year: 2026, amount: 2200, series_id: "v1" });
    const nov = buildEffectiveExpenses([novo], [antigo, novo], 11, 2026);
    expect(nov).toHaveLength(1);
    expect(Number(nov[0].amount)).toBe(2200);
  });

  it("recorrente cadastrada com 'vale a partir de' não aparece nos meses antes dele", () => {
    const e = exp({ id: "r", is_recurring: true, month: 11, year: 2026, amount: 500, starts_at_month: true });
    expect(buildEffectiveExpenses([], [e], 10, 2026)).toHaveLength(0);
    expect(buildEffectiveExpenses([], [e], 11, 2026)).toHaveLength(1);
    expect(buildEffectiveExpenses([], [e], 12, 2026)).toHaveLength(1);
  });
});
