import { describe, expect, it } from "vitest";
import { defaultExtraOutcome, extraOutcome } from "./extra-rules";

describe("regra de demanda extra", () => {
  it("planejamento segue o fluxo e as demais etapas vão para Entregue, quando não há regra salva", () => {
    expect(extraOutcome({}, "planejamento")).toBe("flow");
    expect(extraOutcome({}, "design")).toBe("deliver");
    expect(extraOutcome(undefined, "edicao_videos")).toBe("deliver");
    expect(extraOutcome(null, "agendamento")).toBe("deliver");
    expect(defaultExtraOutcome("pdf")).toBe("deliver");
  });
  it("usa a regra salva no Fluxo quando existe", () => {
    expect(extraOutcome({ design: "complete", planejamento: "deliver" }, "design")).toBe("complete");
    expect(extraOutcome({ design: "complete", planejamento: "deliver" }, "planejamento")).toBe("deliver");
  });
  it("ignora valor inválido e volta ao padrão", () => {
    expect(extraOutcome({ design: "qualquer" }, "design")).toBe("deliver");
    expect(extraOutcome({ planejamento: 5 }, "planejamento")).toBe("flow");
  });
});
