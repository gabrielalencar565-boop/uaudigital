import { describe, expect, it } from "vitest";
import { defaultExtraOutcome, extraDisplayStage, extraOutcome } from "./extra-rules";

describe("regra de demanda extra", () => {
  it("planejamento segue o fluxo e as demais etapas ficam concluídas na própria etapa, quando não há regra salva", () => {
    expect(extraOutcome({}, "planejamento")).toBe("flow");
    expect(extraOutcome({}, "design")).toBe("complete");
    expect(extraOutcome(undefined, "edicao_videos")).toBe("complete");
    expect(extraOutcome(null, "agendamento")).toBe("complete");
    expect(defaultExtraOutcome("pdf")).toBe("complete");
  });
  it("usa a regra salva no Fluxo quando existe", () => {
    expect(extraOutcome({ design: "deliver", planejamento: "complete" }, "design")).toBe("deliver");
    expect(extraOutcome({ design: "deliver", planejamento: "complete" }, "planejamento")).toBe("complete");
  });
  it("ignora valor inválido e volta ao padrão", () => {
    expect(extraOutcome({ design: "qualquer" }, "design")).toBe("complete");
    expect(extraOutcome({ planejamento: 5 }, "planejamento")).toBe("flow");
  });
});

describe("etapa mostrada em demanda extra concluída", () => {
  const base = { is_extra_demand: true, status_global: "concluido", tags: [] as string[] };
  it("design e vídeo concluídos em Agendamento, PDF ou Revisão aparecem como design e vídeo", () => {
    expect(extraDisplayStage({ ...base, stage_current: "agendamento", post_type: "design", title: "[DiFerro] - Design - Extra" })).toBe("design");
    expect(extraDisplayStage({ ...base, stage_current: "pdf", post_type: "video", title: "Reels" })).toBe("edicao_videos");
    expect(extraDisplayStage({ ...base, stage_current: "revisao", post_type: null, title: "Capa - Design - Extra" })).toBe("design");
  });
  it("não mexe no que já mostra o próprio tipo, no que não é extra, nem no que ainda não foi concluído", () => {
    expect(extraDisplayStage({ ...base, stage_current: "design", post_type: "design", title: "x" })).toBeNull();
    expect(extraDisplayStage({ ...base, is_extra_demand: false, stage_current: "agendamento", post_type: "design", title: "x" })).toBeNull();
    expect(extraDisplayStage({ ...base, status_global: "backlog", stage_current: "agendamento", post_type: "design", title: "x" })).toBeNull();
    expect(extraDisplayStage({ ...base, stage_current: "agendamento", post_type: null, title: "Reunião" })).toBeNull();
    expect(extraDisplayStage({ ...base, stage_current: "agendamento", periodic_stage_key: "custom_x", post_type: "design", title: "x" })).toBeNull();
  });
});
