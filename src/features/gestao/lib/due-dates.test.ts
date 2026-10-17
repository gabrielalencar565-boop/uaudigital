import { describe, expect, it } from "vitest";
import { nextDueBase, nextDueKey, normalizeLateRule } from "./due-dates";

const today = new Date(2026, 9, 17, 15, 0); // 17/10/2026

describe("prazo da etapa seguinte", () => {
  it("'keep' soma ao prazo anterior, mesmo atrasado (13/10 + 1 = 14/10, já atrasado)", () => {
    expect(nextDueKey("2026-10-13", 1, "keep", today)).toBe("2026-10-14");
  });
  it("'from_today' conta de hoje quando a etapa anterior estava atrasada (17/10 + 1 = 18/10)", () => {
    expect(nextDueKey("2026-10-13", 1, "from_today", today)).toBe("2026-10-18");
    expect(nextDueKey("2026-10-13", 0, "from_today", today)).toBe("2026-10-17");
  });
  it("'from_today' não adianta prazo de quem concluiu em dia ou antes", () => {
    expect(nextDueKey("2026-10-17", 2, "from_today", today)).toBe("2026-10-19");
    expect(nextDueKey("2026-10-20", 1, "from_today", today)).toBe("2026-10-21");
  });
  it("sem prazo anterior, parte de hoje", () => {
    expect(nextDueBase(null, "keep", today).getDate()).toBe(17);
    expect(nextDueKey(undefined, 1, "keep", today)).toBe("2026-10-18");
  });
  it("valor desconhecido vira 'keep'", () => {
    expect(normalizeLateRule("outra")).toBe("keep");
    expect(normalizeLateRule("from_today")).toBe("from_today");
  });
});
