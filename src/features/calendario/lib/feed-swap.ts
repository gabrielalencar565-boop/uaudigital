// Regras da "ordem do feed": trocar dois posts de lugar é trocar a data E o horário deles. Nada é gravado até "Salvar ordem".

export type FeedSlot = { date: string | null; time: string | null };

export type FeedSwappable = {
  id: string;
  publish_date: string | null;
  publish_time: string | null;
  instagram_status: string;
  instagram_scheduled?: boolean | null;
};

/** Rascunho: para cada post mexido, de onde saiu (base) e para onde vai (slot). */
export type FeedDraft = Record<string, { base: FeedSlot; slot: FeedSlot }>;

export type FeedChange = { id: string; base: FeedSlot; slot: FeedSlot };

const slotOf = (p: FeedSwappable): FeedSlot => ({ date: p.publish_date, time: p.publish_time });
const sameSlot = (a: FeedSlot, b: FeedSlot) => a.date === b.date && a.time === b.time;

export const isFeedLocked = (p: FeedSwappable) => p.instagram_status === "published" || p.instagram_status === "publishing";

/**
 * O rascunho só vale enquanto os posts continuam como estavam quando foram mexidos. Se um mudou (outra tela, outra pessoa,
 * publicou, saiu do ciclo), descarta tudo: aplicar só uma parte deixaria dois posts na mesma data.
 */
export function validDraft(draft: FeedDraft, posts: FeedSwappable[]): FeedDraft {
  const entries = Object.entries(draft);
  if (entries.length === 0) return draft;
  const byId = new Map(posts.map((p) => [p.id, p]));
  const ok = entries.every(([id, entry]) => {
    const p = byId.get(id);
    return !!p && !isFeedLocked(p) && sameSlot(slotOf(p), entry.base);
  });
  return ok ? draft : {};
}

export function applyDraft<T extends FeedSwappable>(posts: T[], draft: FeedDraft): T[] {
  if (Object.keys(draft).length === 0) return posts;
  return posts.map((p) => (draft[p.id] ? { ...p, publish_date: draft[p.id].slot.date, publish_time: draft[p.id].slot.time } : p));
}

export function swapInDraft(draft: FeedDraft, posts: FeedSwappable[], firstId: string, secondId: string): FeedDraft {
  const first = posts.find((p) => p.id === firstId);
  const second = posts.find((p) => p.id === secondId);
  if (!first || !second || first.id === second.id || isFeedLocked(first) || isFeedLocked(second)) return draft;
  const next: FeedDraft = { ...draft };
  const place = (p: FeedSwappable, slot: FeedSlot) => {
    const base = draft[p.id]?.base ?? slotOf(p);
    if (sameSlot(base, slot)) delete next[p.id];
    else next[p.id] = { base, slot };
  };
  const firstSlot = draft[first.id]?.slot ?? slotOf(first);
  const secondSlot = draft[second.id]?.slot ?? slotOf(second);
  place(first, secondSlot);
  place(second, firstSlot);
  return next;
}

export const draftChanges = (draft: FeedDraft): FeedChange[] => Object.entries(draft).map(([id, e]) => ({ id, ...e }));

/** Mais recente primeiro, como a grade do Instagram. */
export const byFeedOrder = (a: FeedSwappable, b: FeedSwappable) =>
  `${b.publish_date}T${b.publish_time ?? "00:00"}`.localeCompare(`${a.publish_date}T${a.publish_time ?? "00:00"}`);

/**
 * Posts agendados que a nova ordem quebraria: num horário que já passou o envio sai na hora; sem horário, nunca sai.
 * O horário é o de Brasília, igual ao do envio (instagram-publish).
 */
export function blockedChanges(changes: FeedChange[], posts: FeedSwappable[], now = Date.now()) {
  const byId = new Map(posts.map((p) => [p.id, p]));
  const past: FeedChange[] = [];
  const noTime: FeedChange[] = [];
  for (const change of changes) {
    if (!byId.get(change.id)?.instagram_scheduled) continue;
    if (!change.slot.date || !change.slot.time) noTime.push(change);
    else if (new Date(`${change.slot.date}T${change.slot.time.slice(0, 5)}:00-03:00`).getTime() <= now) past.push(change);
  }
  return { past, noTime };
}
