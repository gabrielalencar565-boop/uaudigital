import { describe, expect, it } from "vitest";
import { lateDays, lateLabel, manualPostState } from "./manual-post";

const base = { manual_post: true, instagram_status: "not_published" as const, instagram_scheduled: false, publish_date: "2026-11-10" };

describe("manualPostState", () => {
  it("publicação comum não é manual", () => {
    expect(manualPostState({ ...base, manual_post: false }, "2026-11-20")).toBeNull();
  });
  it("dentro do prazo ou sem data fica aguardando", () => {
    expect(manualPostState(base, "2026-11-10")).toBe("waiting");
    expect(manualPostState({ ...base, publish_date: null }, "2026-11-20")).toBe("waiting");
  });
  it("passou o dia sem marcar nem agendar: atrasada", () => {
    expect(manualPostState(base, "2026-11-11")).toBe("late");
  });
  it("marcada como postada", () => {
    expect(manualPostState({ ...base, instagram_status: "published" }, "2026-11-20")).toBe("posted");
  });
  it("agendada normalmente segue o fluxo de sempre", () => {
    expect(manualPostState({ ...base, instagram_scheduled: true }, "2026-11-20")).toBeNull();
  });
});

describe("lateDays / lateLabel", () => {
  it("conta os dias de atraso", () => {
    expect(lateDays("2026-11-10", "2026-11-13")).toBe(3);
    expect(lateDays("2026-11-10", "2026-11-10")).toBe(1);
    expect(lateLabel(1)).toBe("Atrasado 1 dia");
    expect(lateLabel(3)).toBe("Atrasado 3 dias");
  });
});
