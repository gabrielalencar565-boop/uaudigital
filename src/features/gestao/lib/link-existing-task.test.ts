import { describe, expect, it } from "vitest";
import { nextStagePostTypeFilter } from "./link-existing-task";

describe("nextStagePostTypeFilter", () => {
  it("Revisão (Planejamento) aprovada procura Design/Vídeo sem filtrar por post_type", () => {
    const rev = { stage_current: "revisao", post_type: "planejamento" };
    expect(nextStagePostTypeFilter(rev, "design")).toBeUndefined();
    expect(nextStagePostTypeFilter(rev, "edicao_videos")).toBeUndefined();
  });
  it("Planejamento concluído procura a Revisão de planejamento", () => {
    expect(nextStagePostTypeFilter({ stage_current: "planejamento", post_type: null }, "revisao")).toBe("planejamento");
  });
  it("Design e Vídeo concluídos procuram a Revisão do mesmo tipo", () => {
    expect(nextStagePostTypeFilter({ stage_current: "design" }, "revisao")).toBe("design");
    expect(nextStagePostTypeFilter({ stage_current: "edicao_videos" }, "revisao")).toBe("video");
  });
  it("demais casos herdam o post_type da tarefa", () => {
    expect(nextStagePostTypeFilter({ stage_current: "revisao", post_type: "design" }, "pdf")).toBe("design");
    expect(nextStagePostTypeFilter({ stage_current: "revisao", post_type: null }, "pdf")).toBeUndefined();
  });
});
