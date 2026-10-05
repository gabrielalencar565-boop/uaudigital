import { describe, expect, it } from "vitest";
import { addWorkdays, computePlan, downstreamOf, pushPlan, stepKeyFor, workdaysBetween, type CascadeStep } from "./cascade";

const steps: CascadeStep[] = [
  { key: "planejamento", label: "Planejamento", after: [], days: 0 },
  { key: "revisao_plan", label: "Revisão do planejamento", after: ["planejamento"], days: 2 },
  { key: "design", label: "Design", after: ["revisao_plan"], days: 7 },
  { key: "edicao_videos", label: "Vídeo", after: ["revisao_plan"], days: 5 },
  { key: "revisao_design", label: "Revisão do design", after: ["design"], days: 1 },
  { key: "revisao_video", label: "Revisão do vídeo", after: ["edicao_videos"], days: 1 },
  { key: "pdf", label: "PDF", after: ["revisao_design", "revisao_video"], days: 1 },
  { key: "agendamento", label: "Agendamento", after: ["pdf"], days: 2 },
];

describe("working-day math", () => {
  it("skips weekends", () => {
    // 2026-09-10 is a Thursday; +2 working days = Monday 14th (matches the real Sept case)
    expect(addWorkdays("2026-09-10", 2)).toBe("2026-09-14");
    expect(addWorkdays("2026-09-11", 1)).toBe("2026-09-14");
  });
  it("moves a weekend start to Monday", () => {
    expect(addWorkdays("2026-09-12", 0)).toBe("2026-09-14");
  });
  it("counts working days between dates", () => {
    expect(workdaysBetween("2026-09-10", "2026-09-14")).toBe(2);
    expect(workdaysBetween("2026-09-14", "2026-09-10")).toBe(0);
  });
});

describe("computePlan", () => {
  const plan = computePlan(steps, "2026-09-10");
  it("anchors the first step on the start date", () => expect(plan.planejamento).toBe("2026-09-10"));
  it("chains durations", () => {
    expect(plan.revisao_plan).toBe("2026-09-14");
    expect(plan.design).toBe("2026-09-23"); // 14th + 7 working days
    expect(plan.edicao_videos).toBe("2026-09-21"); // 14th + 5 working days
  });
  it("joins parallel branches on the later one", () => {
    expect(plan.revisao_design).toBe("2026-09-24");
    expect(plan.revisao_video).toBe("2026-09-22");
    expect(plan.pdf).toBe("2026-09-25"); // after the later review (24th) + 1
    expect(plan.agendamento).toBe("2026-09-29"); // 25th (Fri) + 2 working days
  });
  it("can use calendar days", () => {
    const p = computePlan(steps, "2026-09-10", false);
    expect(p.revisao_plan).toBe("2026-09-12");
  });
});

describe("pushPlan (delays slide the rest)", () => {
  const plan = computePlan(steps, "2026-09-10");
  it("does nothing when finished on time or early", () => {
    expect(pushPlan(steps, plan, "revisao_plan", "2026-09-14")).toBe(plan);
    expect(pushPlan(steps, plan, "revisao_plan", "2026-09-11")).toBe(plan);
  });
  it("pushes everything downstream when late", () => {
    // review planned Mon 14th, finished Thu 17th
    const next = pushPlan(steps, plan, "revisao_plan", "2026-09-17");
    expect(next.revisao_plan).toBe("2026-09-17");
    expect(next.design).toBe("2026-09-28"); // 17th + 7 working days
    expect(next.edicao_videos).toBe("2026-09-24");
    expect(next.pdf > plan.pdf).toBe(true);
    expect(next.planejamento).toBe(plan.planejamento); // upstream untouched
  });
  it("only pushes the affected branch", () => {
    const next = pushPlan(steps, plan, "design", "2026-09-30");
    expect(next.edicao_videos).toBe(plan.edicao_videos);
    expect(next.revisao_video).toBe(plan.revisao_video);
    expect(next.revisao_design > plan.revisao_design).toBe(true);
    expect(next.pdf > plan.pdf).toBe(true);
  });
});

describe("helpers", () => {
  it("finds downstream steps", () => {
    expect([...downstreamOf(steps, "design")].sort()).toEqual(["agendamento", "pdf", "revisao_design"]);
  });
  it("maps stages to step keys", () => {
    expect(stepKeyFor("revisao", "planejamento")).toBe("revisao_plan");
    expect(stepKeyFor("revisao", "design")).toBe("revisao_design");
    expect(stepKeyFor("pdf", null)).toBe("pdf");
  });
});
