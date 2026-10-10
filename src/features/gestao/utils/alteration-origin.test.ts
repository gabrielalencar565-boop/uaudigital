import { describe, expect, it } from "vitest";
import { resolveAlterationOrigin } from "./alteration-origin";

const task = (over: Partial<Parameters<typeof resolveAlterationOrigin>[0]> = {}) => ({ title: "Post", post_type: null, stage_current: "revisao", tags: [], ...over });

describe("resolveAlterationOrigin", () => {
  it("a design task whose title mentions video stays design (the old bug)", () => {
    expect(resolveAlterationOrigin(task({ title: "Cliente - Vídeo institucional (arte)", post_type: "design", stage_current: "alteracoes" })).origin).toBe("design");
  });

  it("a design task tagged as video stays design", () => {
    expect(resolveAlterationOrigin(task({ post_type: "design", tags: ["Vídeo"], stage_current: "alteracoes" })).origin).toBe("design");
  });

  it("what was saved when the task entered alteration wins over everything else", () => {
    expect(resolveAlterationOrigin(task({ alteration_origin: "video", post_type: "design", title: "Design - arte" })).origin).toBe("video");
    expect(resolveAlterationOrigin(task({ alteration_origin: "design", post_type: "video" }), ["video"]).origin).toBe("design");
  });

  it("a planning stays planning even if its subtasks are design or video", () => {
    expect(resolveAlterationOrigin(task({ post_type: "planejamento" }), ["design", "video"])).toEqual({ origin: "planejamento", mixed: true });
    expect(resolveAlterationOrigin(task({ post_type: "planejamento" }), ["design"]).origin).toBe("planejamento");
  });

  it("subtasks decide when the task itself has a doubtful type", () => {
    expect(resolveAlterationOrigin(task({ post_type: "video" }), ["design", "design"]).origin).toBe("design");
    expect(resolveAlterationOrigin(task({ post_type: null }), ["video"]).origin).toBe("video");
  });

  it("design and video subtasks together without a planning have no single origin", () => {
    expect(resolveAlterationOrigin(task({ post_type: "design" }), ["design", "video"])).toEqual({ origin: null, mixed: true });
  });

  it("a review with no type at all is a planning review", () => {
    expect(resolveAlterationOrigin(task({ post_type: null, stage_current: "revisao", title: "Vídeo do mês" })).origin).toBe("planejamento");
  });

  it("only without any real signal does it look at the title and tags", () => {
    expect(resolveAlterationOrigin(task({ post_type: null, stage_current: "alteracoes", title: "Cliente - Design - Extra" })).origin).toBe("design");
    expect(resolveAlterationOrigin(task({ post_type: null, stage_current: "alteracoes", title: "Algo", tags: ["Vídeo"] })).origin).toBe("video");
    expect(resolveAlterationOrigin(task({ post_type: null, stage_current: "alteracoes", title: "Algo" })).origin).toBeNull();
  });
});
