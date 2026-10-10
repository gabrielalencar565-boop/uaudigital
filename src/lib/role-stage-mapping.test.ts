import { describe, expect, it } from "vitest";
import { buildAssigneesForClient, buildCandidatesForClient, DEFAULT_STAGE_ROLES, pickAssignee, getStagesForRoles, resolveStageRoles, sortForAssignment, stagesByRole } from "./role-stage-mapping";

describe("stage → cargo", () => {
  it("starts with the mapping the system always used", () => {
    expect(DEFAULT_STAGE_ROLES.captacao).toBe("Editor de Vídeo");
    expect(DEFAULT_STAGE_ROLES.edicao_videos).toBe("Editor de Vídeo");
    expect(DEFAULT_STAGE_ROLES.design).toBe("Designer");
    expect(DEFAULT_STAGE_ROLES.planejamento).toBe("Social Media");
    expect(DEFAULT_STAGE_ROLES.agendamento).toBe("Social Media");
    expect(DEFAULT_STAGE_ROLES.revisao_design).toBe("Diretor de Arte");
  });

  it("each kind of alteration follows the cargo of the work it comes from", () => {
    expect(DEFAULT_STAGE_ROLES.alteracao_pauta).toBe("Social Media");
    expect(DEFAULT_STAGE_ROLES.alteracao_design).toBe("Designer");
    expect(DEFAULT_STAGE_ROLES.alteracao_video).toBe("Editor de Vídeo");
  });

  it("the squad auto-assignment also fills the alteration of each kind", () => {
    const members = [{ user_id: "mica", role_titles: ["Designer"] }, { user_id: "kaue", role_titles: ["Editor de Vídeo"] }];
    const result = buildAssigneesForClient(members, stagesByRole(resolveStageRoles([])));
    expect(result.alteracao_design).toBe("mica");
    expect(result.alteracao_video).toBe("kaue");
  });

  it("applies what the agency saved on top of the defaults, and null means no cargo on purpose", () => {
    const m = resolveStageRoles([
      { stage_key: "captacao", role_title: "Social Media" },
      { stage_key: "design", role_title: null },
    ]);
    expect(m.captacao).toBe("Social Media");
    expect(m.design).toBeNull();
    expect(m.planejamento).toBe("Social Media"); // untouched
  });

  it("groups the stages of each cargo", () => {
    const by = stagesByRole(resolveStageRoles([{ stage_key: "captacao", role_title: "Social Media" }]));
    expect(by["Social Media"]).toContain("captacao");
    expect(by["Editor de Vídeo"]).toEqual(["edicao_videos", "alteracao_video"]);
  });

  it("the squad auto-assignment follows the configured cargos", () => {
    const roleToStages = stagesByRole(resolveStageRoles([{ stage_key: "captacao", role_title: "Social Media" }]));
    const members = [
      { user_id: "bruna", role_titles: ["Social Media"] },
      { user_id: "kaue", role_titles: ["Editor de Vídeo"] },
    ];
    const result = buildAssigneesForClient(members, roleToStages);
    expect(result.captacao).toBe("bruna"); // moved to Social Media
    expect(result.edicao_videos).toBe("kaue");
    expect(getStagesForRoles(["Editor de Vídeo"], roleToStages)).toEqual(["edicao_videos", "alteracao_video"]);
  });
});

describe("who takes a cargo when two people of the squad have it", () => {
  it("the one who joined the squad first, then alphabetical", () => {
    const sorted = sortForAssignment([
      { display_name: "João", joined_at: "2026-04-07" },
      { display_name: "Gabriel", joined_at: "2026-04-07" },
      { display_name: "Zeca", joined_at: "2026-03-01" },
    ]);
    expect(sorted.map((p) => p.display_name)).toEqual(["Zeca", "Gabriel", "João"]);
  });

  it("the squad assignment picks the earliest member for a shared cargo", () => {
    const people = sortForAssignment([
      { user_id: "novo", role_titles: ["Social Media"], display_name: "Ana", joined_at: "2026-05-04" },
      { user_id: "antigo", role_titles: ["Social Media"], display_name: "Bruna", joined_at: "2026-03-17" },
    ]);
    expect(buildAssigneesForClient(people).planejamento).toBe("antigo");
  });
});

describe("two people with the same cargo in the squad", () => {
  const people = sortForAssignment([
    { user_id: "joao", role_titles: ["Designer"], display_name: "João", joined_at: "2026-04-07" },
    { user_id: "gabriel", role_titles: ["Designer"], display_name: "Gabriel", joined_at: "2026-04-07" },
    { user_id: "ana", role_titles: ["Social Media"], display_name: "Ana", joined_at: "2026-05-04" },
  ]);

  it("lists everyone who could take each stage", () => {
    const c = buildCandidatesForClient(people);
    expect(c.design).toEqual(["gabriel", "joao"]);
    expect(c.alteracao_design).toEqual(["gabriel", "joao"]);
    expect(c.planejamento).toEqual(["ana"]);
  });

  it("the person chosen for the client wins over the default", () => {
    expect(pickAssignee(["gabriel", "joao"], undefined, "joao")).toBe("joao");
  });

  it("a choice made earlier survives, as long as that person is still a candidate", () => {
    expect(pickAssignee(["gabriel", "joao"], "joao", undefined)).toBe("joao");
    expect(pickAssignee(["gabriel", "joao"], "saiu-do-squad", undefined)).toBe("gabriel");
  });

  it("ignores a choice that is not a candidate, and does nothing without candidates", () => {
    expect(pickAssignee(["gabriel", "joao"], undefined, "outra-pessoa")).toBe("gabriel");
    expect(pickAssignee([], "joao", "joao")).toBeNull();
  });
});
