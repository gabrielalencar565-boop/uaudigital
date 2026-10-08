import { describe, expect, it } from "vitest";
import {
  computeClientMargins, DEFAULT_STAGE_WEIGHTS, stageWeight, sumIncludedExpenses, weightedWorkload,
} from "./client-margin";

const two = [{ id: "a", name: "A", revenue: 3000 }, { id: "b", name: "B", revenue: 1000 }];
const month = (workload: [string, number][], totalExpenses: number, clients = two) => ({ clients, workload: new Map(workload), totalExpenses });

describe("stage weights", () => {
  it("starts with publication 1, design 2, planning 3, video editing 3 and capture 4", () => {
    expect(DEFAULT_STAGE_WEIGHTS).toEqual({ agendamento: 1, design: 2, planejamento: 3, edicao_videos: 3, captacao: 4 });
  });

  it("uses 1 for stages that are not configured, and lets the agency override any of them", () => {
    expect(stageWeight({}, "revisao")).toBe(1);
    expect(stageWeight({}, "captacao")).toBe(4);
    expect(stageWeight({ captacao: 6, revisao: 2 }, "captacao")).toBe(6);
    expect(stageWeight({ captacao: 6, revisao: 2 }, "revisao")).toBe(2);
  });

  it("weights the completed stages of each client by type", () => {
    const w = weightedWorkload(
      [
        { client_id: "a", stage: "captacao", stages: 2 }, // 8
        { client_id: "a", stage: "design", stages: 3 }, // 6
        { client_id: "b", stage: "agendamento", stages: 4 }, // 4
        { client_id: "b", stage: "revisao", stages: 1 }, // 1 (not configured)
      ],
      {},
    );
    expect(w.get("a")).toBe(14);
    expect(w.get("b")).toBe(5);
  });
});

describe("expenses that take part in the split", () => {
  it("leaves out the excluded categories", () => {
    const exp = [
      { amount: 1000, category: "operacional" },
      { amount: "500", category: "administrativa" },
      { amount: 700, category: "investimento" },
      { amount: 300, category: "financeira" },
    ];
    expect(sumIncludedExpenses(exp, ["investimento", "financeira"])).toBe(1500);
    expect(sumIncludedExpenses(exp, [])).toBe(2500);
    expect(sumIncludedExpenses(exp, ["administrativa", "investimento", "financeira"])).toBe(1000);
  });
});

describe("computeClientMargins (one month)", () => {
  it("splits the expenses by weight and orders by margin %", () => {
    const r = computeClientMargins([month([["a", 10], ["b", 30]], 4000)]); // a pays 1000, b pays 3000
    const a = r.rows.find((x) => x.id === "a")!;
    const b = r.rows.find((x) => x.id === "b")!;
    expect(a.cost).toBeCloseTo(1000);
    expect(b.cost).toBeCloseTo(3000);
    expect(a.marginPct).toBeCloseTo(66.67, 1);
    expect(b.margin).toBeCloseTo(-2000);
    expect(r.rows[0].id).toBe("a");
  });

  it("allocates exactly the expenses it was given", () => {
    const r = computeClientMargins([month([["a", 3], ["b", 5]], 4321.5)]);
    expect(r.rows.reduce((s, x) => s + x.cost, 0)).toBeCloseTo(4321.5);
  });

  it("gives no margin to a client without completed stages, keeps its revenue, and does not charge it anything", () => {
    const r = computeClientMargins([month([["a", 10]], 2000)]);
    const b = r.rows.find((x) => x.id === "b")!;
    expect(b.insufficient).toBe(true);
    expect(b.margin).toBeNull();
    expect(b.marginPct).toBeNull();
    expect(b.revenue).toBe(1000);
    expect(b.cost).toBe(0);
    expect(r.rows[r.rows.length - 1].id).toBe("b"); // after the clients with a reliable margin
    expect(r.rows.find((x) => x.id === "a")!.cost).toBeCloseTo(2000);
  });

  it("with no work recorded at all nobody gets a margin and the expenses stay unallocated", () => {
    const r = computeClientMargins([month([], 3000)]);
    expect(r.rows.every((x) => x.insufficient && x.margin === null)).toBe(true);
    expect(r.unallocated).toBe(3000);
    expect(r.rows.map((x) => x.revenue)).toEqual([3000, 1000]);
  });
});

describe("computeClientMargins (year to date)", () => {
  it("splits each month on its own and sums revenue, cost and work per client", () => {
    const r = computeClientMargins([
      month([["a", 1], ["b", 1]], 1000), // 500 each
      month([["a", 3]], 800), // all 800 on a; b has no data this month
    ]);
    const a = r.rows.find((x) => x.id === "a")!;
    const b = r.rows.find((x) => x.id === "b")!;
    expect(a.revenue).toBe(6000);
    expect(a.cost).toBeCloseTo(1300);
    expect(a.monthsWithData).toBe(2);
    expect(b.cost).toBeCloseTo(500);
    // b's margin only counts the month with data: (1000 - 500) / 1000
    expect(b.revenue).toBe(2000);
    expect(b.revenueWithData).toBe(1000);
    expect(b.marginPct).toBeCloseTo(50);
    expect(b.monthsWithData).toBe(1);
    expect(b.monthsActive).toBe(2);
  });

  it("marks as insufficient a client without data in any month of the year", () => {
    const r = computeClientMargins([month([["a", 2]], 500), month([["a", 1]], 500)]);
    const b = r.rows.find((x) => x.id === "b")!;
    expect(b.insufficient).toBe(true);
    expect(b.revenue).toBe(2000);
  });
});
