import { describe, expect, it } from "vitest";
import { buildActivityEvents, dayLabel, type ActivityEntry } from "./activity-timeline";

const STAGES = ["planejamento", "video", "design", "revisao", "pdf", "alteracoes"];
const names: Record<string, string> = { planejamento: "Planejamento", video: "Vídeo", design: "Design", revisao: "Revisão", pdf: "PDF", alteracoes: "Alterações" };
const ctx = {
  taskId: "T",
  stageName: (k: string) => names[k] ?? k,
  statusName: (k: string) => ({ backlog: "Backlog", em_andamento: "Em andamento" } as Record<string, string>)[k] ?? k,
  memberName: (id: string) => ({ u1: "Izadora Torres" } as Record<string, string>)[id] ?? null,
  stageIndex: (k: string) => STAGES.indexOf(k),
};

let n = 0;
const entry = (action: string, metadata: any, at: string, by = "a", entity = "T"): ActivityEntry => ({ id: `e${++n}`, action, metadata, created_by: by, created_at: at, entity_id: entity });

describe("activity timeline", () => {
  it("says where a task came from when it was created by advancing a stage", () => {
    const [ev] = buildActivityEvents([entry("created", { title: "x", stage_current: "video", from_stage: "planejamento", to_stage: "video", subtasks: 6 }, "2026-10-13T10:00:00Z")], ctx);
    expect(ev.lines[0].text).toBe("enviou de Planejamento para Vídeo · 6 subtarefas");
  });

  it("records where the old task sent its work", () => {
    const [ev] = buildActivityEvents([entry("stage_sent", { from_stage: "planejamento", to_stage: "design", subtasks: 1 }, "2026-10-13T10:00:00Z")], ctx);
    expect(ev.lines[0].text).toBe("concluiu Planejamento e enviou para Design · 1 subtarefa");
  });

  it("only says 'criou esta tarefa' for a task made from scratch, with its stage", () => {
    const [ev] = buildActivityEvents([entry("created", { title: "x", stage_current: "planejamento" }, "2026-10-13T10:00:00Z")], ctx);
    expect(ev.lines[0].text).toBe("criou esta tarefa em Planejamento");
  });

  it("does not claim a clone was created from nothing when its old log has no detail", () => {
    const [ev] = buildActivityEvents([entry("created", { title: "x" }, "2026-10-13T10:00:00Z")], { ...ctx, derived: true });
    expect(ev.lines[0].text).toBe("esta etapa foi criada ao avançar da etapa anterior");
  });

  it("splits one update into short lines instead of one run-on sentence", () => {
    const [ev] = buildActivityEvents([entry("updated", { stage_current: "alteracoes", _from_stage: "revisao", assignee_id: "u1", due_date: "2026-10-15" }, "2026-10-14T09:28:00Z")], ctx);
    expect(ev.lines.map((l) => l.text)).toEqual(["avançou de Revisão para Alterações", "Responsável: Izadora Torres", "Data: 15/10/2026"]);
  });

  it("tells going back from going forward", () => {
    const [ev] = buildActivityEvents([entry("updated", { stage_current: "design", _from_stage: "pdf" }, "2026-10-14T09:28:00Z")], ctx);
    expect(ev.lines[0].text).toBe("voltou de PDF para Design");
  });

  it("falls back to the previous event to know where a stage move started", () => {
    const events = buildActivityEvents([
      entry("created", { stage_current: "video" }, "2026-10-13T10:00:00Z"),
      entry("updated", { stage_current: "revisao" }, "2026-10-13T12:00:00Z"),
    ], ctx);
    expect(events[1].lines[0].text).toBe("avançou de Vídeo para Revisão");
  });

  it("joins changes by the same person made within seconds, and keeps different people apart", () => {
    const events = buildActivityEvents([
      entry("updated", { stage_current: "pdf" }, "2026-10-14T09:00:00Z", "a"),
      entry("updated", { assignee_id: "u1" }, "2026-10-14T09:00:02Z", "a"),
      entry("updated", { due_date: "2026-10-20" }, "2026-10-14T09:00:03Z", "b"),
    ], ctx);
    expect(events).toHaveLength(2);
    expect(events[0].lines).toHaveLength(2);
  });

  it("collapses the same change on many subtasks into one line", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      entry("updated", { task_id: `c${i}`, _ref_title: `Post ${i}`, stage_current: "design", _from_stage: "pdf" }, "2026-10-14T09:00:00Z", "a"));
    const [ev] = buildActivityEvents(rows, ctx);
    expect(ev.lines).toHaveLength(1);
    expect(ev.lines[0].subject).toBe("5 subtarefas");
  });

  it("names the subtask when only one or two changed", () => {
    const [ev] = buildActivityEvents([entry("updated", { task_id: "c1", _ref_title: "Post 3", assignee_id: "u1" }, "2026-10-14T09:00:00Z")], ctx);
    expect(ev.lines[0].subject).toBe("Post 3");
  });

  it("ignores noise", () => {
    expect(buildActivityEvents([entry("comment_added", {}, "2026-10-14T09:00:00Z"), entry("updated", { order_index: 3, revision_notes: true }, "2026-10-14T09:01:00Z")], ctx)).toHaveLength(0);
  });

  it("starts the history from the task's own creation when its log never recorded it", () => {
    const events = buildActivityEvents([entry("updated", { assignee_id: "u1" }, "2026-10-14T17:24:00Z")], { ...ctx, derived: true, created: { at: "2026-10-13T13:09:00Z", by: "a" } });
    expect(events[0].lines[0].text).toBe("esta etapa foi criada ao avançar da etapa anterior");
    expect(events[0].at).toBe("2026-10-13T13:09:00Z");
    expect(events).toHaveLength(2);
  });

  it("does not add a second start when the log already has one", () => {
    const events = buildActivityEvents([entry("created", { stage_current: "planejamento" }, "2026-10-13T13:09:00Z")], { ...ctx, created: { at: "2026-10-13T13:09:00Z", by: "a" } });
    expect(events).toHaveLength(1);
  });

  it("shows changes logged under a subtask's own id, named after the subtask", () => {
    const [ev] = buildActivityEvents([{ ...entry("updated", { task_id: "c9", assignee_id: "u1", propagated_from: "T" }, "2026-10-14T10:00:00Z", "a", "c9"), child_title: "1- Foto" }], ctx);
    expect(ev.lines[0]).toMatchObject({ text: "Responsável: Izadora Torres", subject: "1- Foto" });
  });

  it("keeps only where an on/off toggle ended up", () => {
    const [ev] = buildActivityEvents([
      entry("updated", { watchers: ["u1"] }, "2026-10-14T15:12:53Z"),
      entry("updated", { watchers: [] }, "2026-10-14T15:12:53.7Z"),
      entry("updated", { watchers: ["u1"] }, "2026-10-14T15:12:54.9Z"),
    ], ctx);
    expect(ev.lines.map((l) => l.text)).toEqual(["Acompanhando: Izadora Torres"]);
  });

  it("folds repeated saves of the same edit into one line", () => {
    const events = buildActivityEvents([
      entry("updated", { description: "a" }, "2026-10-14T10:00:00Z"),
      entry("updated", { description: "ab" }, "2026-10-14T10:03:00Z"),
      entry("updated", { description: "abc" }, "2026-10-14T10:06:00Z"),
    ], ctx);
    expect(events).toHaveLength(1);
    expect(events[0].lines[0].text).toBe("Editou a descrição");
  });

  it("labels days", () => {
    const now = new Date(2026, 9, 14, 12);
    expect(dayLabel(new Date(2026, 9, 14, 9).toISOString(), now)).toBe("Hoje");
    expect(dayLabel(new Date(2026, 9, 13, 9).toISOString(), now)).toBe("Ontem");
  });
});
