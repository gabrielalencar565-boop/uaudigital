import { beforeEach, describe, expect, it, vi } from "vitest";

// minimal stand-in for the supabase client: `.gt(...)` marks the "changed since" query, `.limit(1)` the watermark query
const state = { delta: [] as any[], watermark: "2026-10-01T10:00:00+00:00", fullCalls: 0, deltaCalls: 0 };
vi.mock("@/integrations/supabase/client", () => {
  const builder = () => {
    let isDelta = false;
    const b: any = {
      select: () => b,
      gt: () => { isDelta = true; return b; },
      order: () => b,
      limit: () => b,
      then: (resolve: any) => {
        if (isDelta) { state.deltaCalls++; return resolve({ data: state.delta, error: null }); }
        return resolve({ data: [{ updated_at: state.watermark }], error: null });
      },
    };
    return b;
  };
  return {
    supabase: {
      from: () => builder(),
      auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: null } }) },
    },
  };
});

import { syncTaskList, isLiveChild, byCreatedAsc } from "./pm-task-sync";

const row = (id: string, created: string, extra: Record<string, unknown> = {}) =>
  ({ id, created_at: created, updated_at: created, parent_task_id: "p1", deleted_at: null, ...extra }) as any;

const makeQc = () => {
  const store = new Map<string, any>();
  return { store, qc: { getQueryData: (k: string[]) => store.get(k[0]), setQueryData: (k: string[], v: any) => store.set(k[0], v) } as any };
};

beforeEach(() => { state.delta = []; state.fullCalls = 0; state.deltaCalls = 0; });

describe("syncTaskList", () => {
  const base = [row("a", "2026-09-01T00:00:00+00:00"), row("b", "2026-09-02T00:00:00+00:00"), row("c", "2026-09-03T00:00:00+00:00")];
  const opts = (qc: any, key: string) => ({ qc, key, columns: "*", accept: isLiveChild, sort: byCreatedAsc, full: async () => { state.fullCalls++; return base; } });

  it("downloads everything the first time, then only asks for what changed", async () => {
    const { qc, store } = makeQc();
    store.set("k1", await syncTaskList(opts(qc, "k1")));
    expect(state.fullCalls).toBe(1);
    const again = await syncTaskList(opts(qc, "k1"));
    expect(state.fullCalls).toBe(1);
    expect(state.deltaCalls).toBe(1);
    expect(again).toBe(store.get("k1")); // nothing changed: same array, no re-render
  });

  it("applies edits, soft deletes, re-parenting and new rows from the delta", async () => {
    const { qc, store } = makeQc();
    store.set("k2", await syncTaskList(opts(qc, "k2")));
    state.delta = [
      row("a", "2026-09-01T00:00:00+00:00", { title: "editada", updated_at: "2026-10-02T00:00:00+00:00" }),
      row("b", "2026-09-02T00:00:00+00:00", { deleted_at: "2026-10-02T01:00:00+00:00", updated_at: "2026-10-02T01:00:00+00:00" }), // sent to the trash
      row("c", "2026-09-03T00:00:00+00:00", { parent_task_id: null, updated_at: "2026-10-02T02:00:00+00:00" }), // became a root task
      row("d", "2026-09-04T00:00:00+00:00", { updated_at: "2026-10-02T03:00:00+00:00" }), // new subtask
    ];
    const merged = await syncTaskList(opts(qc, "k2"));
    expect(merged.map((t: any) => t.id)).toEqual(["a", "d"]);
    expect((merged[0] as any).title).toBe("editada");
  });

  it("reloads everything when too many rows changed at once", async () => {
    const { qc, store } = makeQc();
    store.set("k3", await syncTaskList(opts(qc, "k3")));
    state.delta = Array.from({ length: 501 }, (_, i) => row(`x${i}`, "2026-09-10T00:00:00+00:00"));
    await syncTaskList(opts(qc, "k3"));
    expect(state.fullCalls).toBe(2);
  });
});
