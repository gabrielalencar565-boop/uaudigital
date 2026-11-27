// Perfil do mês (Estúdio do feed): foto, nome, destaques e posts fixados de um cliente em um mês. Só prévia.

export const MAX_PINNED = 3;
export const MAX_HIGHLIGHTS = 20;
export const NAME_LIMIT = 64;
export const HIGHLIGHT_TITLE_LIMIT = 30;

export type Highlight = { id: string; title: string; cover_url: string | null };

export type ProfileDraft = {
  photo_url: string | null;
  display_name: string;
  highlights: Highlight[];
  pinned_publication_ids: string[];
};

export type ProfileRow = {
  id: string;
  month: string; // yyyy-MM-01
  photo_url: string | null;
  display_name: string | null;
  highlights: unknown;
  pinned_publication_ids: string[] | null;
};

export function readHighlights(value: unknown): Highlight[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .filter((item) => typeof item.id === "string")
    .map((item) => ({ id: item.id as string, title: typeof item.title === "string" ? item.title : "", cover_url: typeof item.cover_url === "string" ? item.cover_url : null }));
}

/** Mês do perfil de um calendário: o mês em que o período termina. O link do cliente usa a mesma regra (edge function). */
export const profileMonthKey = (cycleEnd: string) => `${cycleEnd.slice(0, 7)}-01`;

/**
 * De onde o mês começa: o dele, se já foi salvo; senão o mês salvo mais recente antes dele; senão o mais recente que houver.
 * Sem nada salvo, a foto e o nome do cliente.
 */
export function startingProfile(rows: ProfileRow[], month: string, client: { name: string; photo: string | null }) {
  const newestFirst = [...rows].sort((a, b) => b.month.localeCompare(a.month));
  const own = newestFirst.find((r) => r.month === month) ?? null;
  const source = own ?? newestFirst.find((r) => r.month < month) ?? newestFirst[0] ?? null;
  const draft: ProfileDraft = source
    ? {
      photo_url: source.photo_url,
      display_name: source.display_name ?? "",
      highlights: readHighlights(source.highlights),
      pinned_publication_ids: (source.pinned_publication_ids ?? []).slice(0, MAX_PINNED),
    }
    : { photo_url: client.photo, display_name: client.name, highlights: [], pinned_publication_ids: [] };
  return { draft, savedId: own?.id ?? null, copiedFrom: own ? null : source?.month ?? null };
}

export function togglePinned(pinned: string[], id: string): string[] {
  if (pinned.includes(id)) return pinned.filter((p) => p !== id);
  return pinned.length >= MAX_PINNED ? pinned : [...pinned, id];
}

/**
 * Regra da equipe: os fixados precisam ser postados todos no mesmo dia. O dia é o do primeiro fixado; "mixed" indica que as
 * datas mudaram depois (pelo calendário, por exemplo) e já não batem.
 */
export function pinnedDay(pinned: string[], posts: { id: string; date: string | null }[]) {
  const dates = pinned.map((id) => posts.find((p) => p.id === id)).filter((p): p is { id: string; date: string | null } => !!p).map((p) => p.date);
  return { day: dates[0] ?? null, mixed: dates.some((d) => !d || d !== dates[0]) };
}

export function moveItem<T>(list: T[], index: number, step: -1 | 1): T[] {
  const target = index + step;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Grade do perfil: os fixados primeiro (na ordem em que foram fixados) e depois o resto como já está. */
export function profileGrid<T extends { id: string }>(feed: T[], pinned: string[]) {
  const byId = new Map(feed.map((p) => [p.id, p]));
  const top = pinned.map((id) => byId.get(id)).filter((p): p is T => !!p);
  const topIds = new Set(top.map((p) => p.id));
  return [...top.map((post) => ({ post, pinned: true })), ...feed.filter((p) => !topIds.has(p.id)).map((post) => ({ post, pinned: false }))];
}
