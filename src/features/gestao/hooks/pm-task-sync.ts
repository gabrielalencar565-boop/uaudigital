import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PmTask } from "../pm-types";

// The task lists (root tasks, all subtasks) are the heaviest reads of the app: ~13k rows, ~6 MB. Every realtime event on
// pm_tasks used to invalidate them, so every open tab downloaded the whole table again (162k runs of the subtask query in
// two weeks, ~830 ms each, saturating the database). Here a refetch only asks for the rows that changed since the last
// sync and merges them into the cached list; a full download happens on the first load and as a safety net every 10 min.
//
// Why merging is safe: soft deletes (deleted_at), re-parenting (parent_task_id) and every other edit are UPDATEs, and
// the pm_tasks_updated_at trigger bumps updated_at on each of them, so they show up in the delta and `accept()` decides
// whether the row belongs in this list. Hard deletes only happen for rows already in the trash (not in these lists).

const sb = supabase as any;
const PAGE_SIZE = 1000;
const DELTA_LIMIT = 500; // more changes than this → just reload everything
const FULL_REFRESH_MS = 10 * 60 * 1000;
const PERSIST_MAX_AGE_MS = 6 * 60 * 60 * 1000; // a snapshot kept in the browser older than this is discarded
const PERSIST_EVERY_MS = 30 * 1000;
const OVERLAP_MS = 60 * 1000; // re-read the last minute: covers transactions that commit slightly late

type SyncState = { fullAt: number; since: string };
const states = new Map<string, SyncState>();

// Snapshot of each list kept in the browser (IndexedDB) so that reloading the page starts from it and only asks for
// what changed, instead of downloading ~6 MB again. Keyed by user, discarded on sign-out and after 6 h. Best effort:
// when IndexedDB is unavailable (private window, blocked) everything just works without it.
type Persisted = { uid: string; rows: PmTask[]; since: string; fullAt: number };
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("fluxo-cache", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("lists");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key: string): Promise<Persisted | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const r = db.transaction("lists").objectStore("lists").get(key);
      r.onsuccess = () => resolve((r.result as Persisted) ?? null);
      r.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
async function idbSet(key: string, value: Persisted): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction("lists", "readwrite");
      tx.objectStore("lists").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* cache only */ }
}
async function idbClear(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction("lists", "readwrite");
      tx.objectStore("lists").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* cache only */ }
}

const lastPersist = new Map<string, number>();
function persistSoon(key: string, uid: string | null, rows: PmTask[], state: SyncState, force = false) {
  if (!uid) return;
  const now = Date.now();
  if (!force && now - (lastPersist.get(key) ?? 0) < PERSIST_EVERY_MS) return;
  lastPersist.set(key, now);
  void idbSet(key, { uid, rows, since: state.since, fullAt: state.fullAt });
}

// a different person signing in on the same browser must never be handed the previous person's cached rows
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    states.clear();
    lastPersist.clear();
    void idbClear();
  }
});

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** Latest updated_at the server has (uses idx_pm_tasks_updated_at): where "what changed since" starts, taken from the
 * server's clock so this never depends on the browser's. Read before a full download, so nothing slips in between. */
async function serverWatermark(): Promise<string | null> {
  const { data, error } = await sb.from("pm_tasks").select("updated_at").order("updated_at", { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0]?.updated_at ?? null;
}

async function fetchChangedSince(columns: string, since: string): Promise<PmTask[] | null> {
  const from = new Date(Date.parse(since) - OVERLAP_MS).toISOString();
  const { data, error } = await sb
    .from("pm_tasks")
    .select(columns)
    .gt("updated_at", from)
    .order("updated_at", { ascending: true })
    .limit(DELTA_LIMIT + 1);
  if (error) throw error;
  if ((data?.length ?? 0) > DELTA_LIMIT) return null;
  return (data ?? []) as PmTask[];
}

/** Every live subtask (light columns), a page at a time. No count query: it stops at the first short page. */
export async function fetchAllChildTasks(columns: string): Promise<PmTask[]> {
  const rows: PmTask[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await sb
      .from("pm_tasks")
      .select(columns)
      .not("parent_task_id", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as PmTask[]));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return rows;
}

export const isLiveChild = (t: PmTask) => t.parent_task_id != null && (t as any).deleted_at == null;
export const isLiveRoot = (t: PmTask) => t.parent_task_id == null && (t as any).deleted_at == null;

export const byCreatedAsc = (a: PmTask, b: PmTask) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1);
export const byCreatedDesc = (a: PmTask, b: PmTask) => (a.created_at > b.created_at ? -1 : a.created_at < b.created_at ? 1 : a.id > b.id ? -1 : 1);

export async function syncTaskList(opts: {
  qc: QueryClient;
  key: string;
  columns: string;
  full: () => Promise<PmTask[]>;
  accept: (t: PmTask) => boolean;
  sort: (a: PmTask, b: PmTask) => number;
}): Promise<PmTask[]> {
  const { qc, key, columns, full, accept, sort } = opts;
  const uid = await currentUserId();
  let prev = qc.getQueryData<PmTask[]>([key]);
  let state = states.get(key);
  let maxAge = FULL_REFRESH_MS;

  // nothing in memory (page just loaded): start from the snapshot saved in this browser, if it is this person's and recent
  if ((!prev || !state) && uid) {
    const saved = await idbGet(key);
    if (saved && saved.uid === uid && Date.now() - saved.fullAt < PERSIST_MAX_AGE_MS) {
      prev = saved.rows;
      state = { fullAt: saved.fullAt, since: saved.since };
      maxAge = PERSIST_MAX_AGE_MS;
    }
  }

  if (prev && state && Date.now() - state.fullAt < maxAge) {
    try {
      const changed = await fetchChangedSince(columns, state.since);
      if (changed) {
        let since = state.since;
        for (const t of changed) if (t.updated_at > since) since = t.updated_at;
        const next: SyncState = { fullAt: state.fullAt, since };
        states.set(key, next);
        if (changed.length === 0) {
          persistSoon(key, uid, prev, next);
          return prev;
        }
        const byId = new Map(prev.map((t) => [t.id, t]));
        for (const t of changed) {
          if (accept(t)) byId.set(t.id, t);
          else byId.delete(t.id);
        }
        const merged = Array.from(byId.values()).sort(sort);
        persistSoon(key, uid, merged, next);
        return merged;
      }
    } catch {
      /* any problem with the incremental read: fall back to the full download below */
    }
  }

  const watermark = await serverWatermark();
  const rows = await full();
  const next: SyncState = { fullAt: Date.now(), since: watermark ?? new Date().toISOString() };
  states.set(key, next);
  persistSoon(key, uid, rows, next, true);
  return rows;
}
