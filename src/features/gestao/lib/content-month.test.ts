import { describe, expect, it } from "vitest";
import { automaticMonthDate, effectiveMonthKey, monthKey, monthLabel, monthOptions, pickToReferenceMonth } from "./content-month";

describe("mês do conteúdo", () => {
  it("rótulo e chave do mês", () => {
    expect(monthKey(2026, 10)).toBe("2026-11-01");
    expect(monthLabel("2026-11-01")).toBe("Novembro de 2026");
    expect(monthLabel(null)).toBe("");
  });
  it("o mês efetivo é o do conteúdo, e sem ele o do prazo", () => {
    expect(effectiveMonthKey({ reference_month: "2026-11-01", due_date: "2026-10-20" })).toBe("2026-11-01");
    expect(effectiveMonthKey({ reference_month: null, due_date: "2026-10-20" })).toBe("2026-10-01");
    expect(effectiveMonthKey({})).toBeNull();
  });
  it("o seletor vai do mês anterior até 12 meses à frente e mantém o mês já escolhido", () => {
    const opts = monthOptions(new Date(2026, 9, 15));
    expect(opts[0].key).toBe("2026-09-01");
    expect(opts[opts.length - 1].key).toBe("2027-10-01");
    expect(opts).toHaveLength(14);
    expect(monthOptions(new Date(2026, 9, 15), 12, "2025-01-01")[0].key).toBe("2025-01-01");
  });
});

describe("mês referente dos diálogos de criar tarefa", () => {
  it("o próprio mês do prazo segue o prazo (sem mês de conteúdo)", () => {
    expect(pickToReferenceMonth("10", new Date(2026, 9, 20))).toBeNull();
  });
  it("outro mês vira o primeiro dia desse mês, no ano mais próximo", () => {
    expect(pickToReferenceMonth("11", new Date(2026, 9, 20))).toBe("2026-11-01");
    expect(pickToReferenceMonth("01", new Date(2026, 11, 10))).toBe("2027-01-01");
    expect(pickToReferenceMonth("12", new Date(2026, 0, 5))).toBe("2025-12-01");
  });
  it("valor inválido é ignorado", () => {
    expect(pickToReferenceMonth("", new Date(2026, 9, 20))).toBeNull();
  });
});

describe("mês automático da agência", () => {
  it("prazo + antecedência; sem antecedência é o próprio mês", () => {
    expect(automaticMonthDate("2026-10-20", 1).getMonth()).toBe(10);
    expect(automaticMonthDate("2026-12-05", 1)).toEqual(new Date(2027, 0, 1));
    expect(automaticMonthDate("2026-10-20", 0)).toEqual(new Date(2026, 9, 1));
    expect(automaticMonthDate(null, 1, new Date(2026, 9, 15))).toEqual(new Date(2026, 10, 1));
  });
});
