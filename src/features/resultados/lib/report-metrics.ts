// Pure calculations behind the Instagram report. Shared by the internal "Resultados" tab and the
// public client report page, so both always show the same numbers.

export type MetricSnapshot = {
  snapshot_date: string;
  followers_count: number | null;
  reach: number | null;
  views: number | null;
  profile_views: number | null;
  profile_link_taps: number | null;
  follower_delta: number | null;
  accounts_engaged: number | null;
  total_interactions: number | null;
};

export type MediaInsight = {
  ig_media_id: string;
  content_type: string | null;
  posted_at: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  total_interactions: number | null;
};

export type Audience = {
  gender: Record<string, number> | null;
  age: Record<string, number> | null;
  city: Record<string, number> | null;
  country: Record<string, number> | null;
  city_geo?: Record<string, [number, number]> | null;
  captured_at?: string;
} | null;

export type ReportData = {
  client: { name: string; logo_url: string | null; instagram_username: string | null };
  snapshots: MetricSnapshot[];
  media: MediaInsight[];
  audience: Audience;
  generatedAt: string;
};

export const PRESET_PERIODS = [7, 15, 30, 60, 90] as const;
export type PresetPeriod = (typeof PRESET_PERIODS)[number];

export type PeriodSelection = { kind: "preset"; days: PresetPeriod } | { kind: "custom"; from: string; to: string };

// A resolved, inclusive date window (yyyy-mm-dd, São Paulo calendar days). Every calculation works on
// this instead of "last N days", so presets and custom ranges share exactly the same code path.
export type DateRange = { from: string; to: string; days: number; label: string; phrase: string };

const DAY = 24 * 3600 * 1000;
const fmtShort = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const fmtFull = (key: string) => `${fmtShort(key)}/${key.slice(0, 4)}`;

export function resolveRange(sel: PeriodSelection): DateRange {
  if (sel.kind === "preset") {
    const from = dayKey(sel.days - 1);
    return { from, to: dayKey(0), days: sel.days, label: `Últimos ${sel.days} dias`, phrase: `nos últimos ${sel.days} dias` };
  }
  const days = Math.max(1, Math.round((Date.parse(sel.to) - Date.parse(sel.from)) / DAY) + 1);
  return {
    from: sel.from,
    to: sel.to,
    days,
    label: `${fmtShort(sel.from)} – ${fmtShort(sel.to)}`,
    phrase: `entre ${fmtShort(sel.from)} e ${fmtFull(sel.to)}`,
  };
}

export const isPreset = (n: number): n is PresetPeriod => (PRESET_PERIODS as readonly number[]).includes(n);

export const FORMAT_LABELS: Record<string, string> = {
  reel: "Reels",
  carrossel: "Carrosséis",
  story: "Stories",
  post: "Posts",
  foto: "Fotos",
  outro: "Outros",
};

const TZ = "America/Sao_Paulo";

export function dayKey(offsetDays: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

const postedAt = (m: MediaInsight) => (m.posted_at ? new Date(m.posted_at).getTime() : 0);

const startOf = (key: string) => Date.parse(`${key}T00:00:00-03:00`);
const endOf = (key: string) => Date.parse(`${key}T23:59:59.999-03:00`);

export function postsInWindow(media: MediaInsight[], from: string, to: string) {
  const start = startOf(from);
  const end = endOf(to);
  return media.filter((m) => {
    const t = postedAt(m);
    return t >= start && t <= end;
  });
}

export const postsWithin = (media: MediaInsight[], range: DateRange) => postsInWindow(media, range.from, range.to);

// The window of the same length immediately before `range` (used for "vs. anterior").
export function previousRange(range: DateRange): { from: string; to: string } {
  const to = new Date(Date.parse(range.from) - DAY).toISOString().slice(0, 10);
  const from = new Date(Date.parse(to) - (range.days - 1) * DAY).toISOString().slice(0, 10);
  return { from, to };
}

const sumOf = (rows: MetricSnapshot[], col: keyof MetricSnapshot) =>
  rows.reduce((acc, r) => acc + ((r[col] as number | null) ?? 0), 0);

function pctDelta(now: number, prev: number) {
  return prev > 0 ? ((now - prev) / prev) * 100 : null;
}

export type Summary = ReturnType<typeof computeSummary>;

// Instagram only keeps ~28 days of account series, so the "previous period" is often thin or empty:
// without enough days a percentage would be noise, so it's left out (null) instead.
export function computeSummary(snapshots: MetricSnapshot[], media: MediaInsight[], range: DateRange) {
  const prevRange = previousRange(range);
  const inRange = (r: MetricSnapshot, from: string, to: string) => r.snapshot_date >= from && r.snapshot_date <= to;
  const current = snapshots.filter((r) => inRange(r, range.from, range.to));
  const previous = snapshots.filter((r) => inRange(r, prevRange.from, prevRange.to));
  const enoughPrevious = (col: keyof MetricSnapshot) => previous.filter((r) => r[col] != null).length >= range.days / 2;
  const covered = (col: keyof MetricSnapshot) => current.filter((r) => r[col] != null).length;

  const metric = (col: keyof MetricSnapshot) => {
    const now = sumOf(current, col);
    const prev = sumOf(previous, col);
    return { value: now, delta: enoughPrevious(col) ? pctDelta(now, prev) : null, days: covered(col) };
  };

  // We only store today's follower total on each sync, so for a window that ended earlier the figure
  // is rebuilt from the latest known total minus the net follower changes that happened after it.
  const knownFollowers = snapshots.filter((s) => s.followers_count != null);
  const anchor = knownFollowers[knownFollowers.length - 1] ?? null;
  let followers: number | null = null;
  if (anchor) {
    if (range.to >= anchor.snapshot_date) {
      followers = anchor.followers_count;
    } else {
      const after = snapshots.filter((s) => s.snapshot_date > range.to && s.snapshot_date <= anchor.snapshot_date);
      const hasDeltas = after.some((s) => s.follower_delta != null);
      followers = hasDeltas ? (anchor.followers_count as number) - sumOf(after, "follower_delta") : null;
    }
  }
  const newFollowers = covered("follower_delta") > 0 ? sumOf(current, "follower_delta") : null;
  const newFollowersPrev = newFollowers !== null && enoughPrevious("follower_delta") ? sumOf(previous, "follower_delta") : null;

  return {
    reach: metric("reach"),
    views: metric("views"),
    profileViews: metric("profile_views"),
    linkTaps: metric("profile_link_taps"),
    followers,
    newFollowers,
    newFollowersDelta: newFollowers !== null && newFollowersPrev !== null && newFollowersPrev > 0 ? pctDelta(newFollowers, newFollowersPrev) : null,
  };
}

// ---- Best days / times (average reach per post, in São Paulo time) ----

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const SLOTS = ["6h", "9h", "12h", "15h", "18h", "21h"] as const;

const WEEKDAY_FULL = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const partsFormatter = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", hourCycle: "h23" });
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localDayAndHour(iso: string) {
  const parts = partsFormatter.formatToParts(new Date(iso));
  const weekday = WEEKDAY_INDEX[parts.find((p) => p.type === "weekday")?.value ?? "Sun"] ?? 0;
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { weekday, hour };
}

const slotOf = (hour: number) => (hour < 6 ? SLOTS.length - 1 : Math.min(SLOTS.length - 1, Math.floor((hour - 6) / 3)));

export function computeBestTimes(media: MediaInsight[]) {
  const usable = media.filter((m) => m.posted_at && (m.reach ?? 0) > 0);
  type Cell = { sum: number; n: number; inter: number; interN: number; top: MediaInsight | null };
  const cell: Cell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: SLOTS.length }, () => ({ sum: 0, n: 0, inter: 0, interN: 0, top: null })),
  );
  const byDay = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
  const bySlot = Array.from({ length: SLOTS.length }, () => ({ sum: 0, n: 0 }));
  for (const m of usable) {
    const { weekday, hour } = localDayAndHour(m.posted_at!);
    const slot = slotOf(hour);
    const reach = m.reach ?? 0;
    const c = cell[weekday][slot];
    c.sum += reach; c.n += 1;
    if (m.total_interactions != null) { c.inter += m.total_interactions; c.interN += 1; }
    if (!c.top || reach > (c.top.reach ?? 0)) c.top = m;
    byDay[weekday].sum += reach; byDay[weekday].n += 1;
    bySlot[slot].sum += reach; bySlot[slot].n += 1;
  }
  const avg = (c: { sum: number; n: number }) => (c.n > 0 ? c.sum / c.n : 0);
  const grid = cell.map((row) =>
    row.map((c) => ({ avg: avg(c), n: c.n, avgInteractions: c.interN > 0 ? c.inter / c.interN : null, top: c.top })),
  );
  const maxCell = Math.max(0, ...grid.flat().map((c) => c.avg));
  const bestIndex = (arr: { sum: number; n: number }[]) => {
    // A single lucky post shouldn't crown a day/time, so slots need at least 2 posts when possible.
    const eligible = arr.map((c, i) => ({ i, a: avg(c), n: c.n })).filter((x) => x.n >= 2);
    const pool = eligible.length > 0 ? eligible : arr.map((c, i) => ({ i, a: avg(c), n: c.n })).filter((x) => x.n >= 1);
    return pool.sort((a, b) => b.a - a.a)[0]?.i ?? null;
  };
  return {
    grid,
    maxCell,
    posts: usable.length,
    bestDay: bestIndex(byDay),
    bestSlot: bestIndex(bySlot),
  };
}

export const weekdayName = (i: number) => WEEKDAY_FULL[i];

const SLOT_STARTS = [6, 9, 12, 15, 18, 21];
export const slotRange = (i: number) => `${SLOT_STARTS[i]}h–${i === SLOT_STARTS.length - 1 ? 6 : SLOT_STARTS[i + 1]}h`;

// ---- Posting frequency vs. reach ----

export const CADENCE_BUCKETS = [
  { label: "1 post", min: 1, max: 1 },
  { label: "2–3 posts", min: 2, max: 3 },
  { label: "4–5 posts", min: 4, max: 5 },
  { label: "6+ posts", min: 6, max: Infinity },
] as const;

function weekKey(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const monday = new Date(local);
  monday.setDate(local.getDate() - ((local.getDay() + 6) % 7));
  return `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`;
}

export function computeCadence(media: MediaInsight[]) {
  const weeks = new Map<string, { posts: number; reach: number }>();
  for (const m of media) {
    if (!m.posted_at || (m.reach ?? 0) <= 0) continue;
    const key = weekKey(m.posted_at);
    const w = weeks.get(key) ?? { posts: 0, reach: 0 };
    w.posts += 1;
    w.reach += m.reach ?? 0;
    weeks.set(key, w);
  }
  const buckets = CADENCE_BUCKETS.map((b) => {
    const inBucket = [...weeks.values()].filter((w) => w.posts >= b.min && w.posts <= b.max);
    const posts = inBucket.reduce((acc, w) => acc + w.posts, 0);
    const reach = inBucket.reduce((acc, w) => acc + w.reach, 0);
    return { label: b.label, weeks: inBucket.length, avgReach: posts > 0 ? reach / posts : 0 };
  });
  const best = buckets.filter((b) => b.weeks > 0).sort((a, b) => b.avgReach - a.avgReach)[0] ?? null;
  return { buckets, best, totalWeeks: weeks.size };
}

// ---- Formats ----

export function formatTotals(media: MediaInsight[]) {
  const totals = new Map<string, number>();
  for (const m of media) totals.set(m.content_type ?? "outro", (totals.get(m.content_type ?? "outro") ?? 0) + (m.reach ?? 0));
  return [...totals.entries()].map(([type, reach]) => ({ type, reach })).filter((r) => r.reach > 0).sort((a, b) => b.reach - a.reach);
}

// ---- Audience ----

export function toPercentList(map: Record<string, number> | null | undefined, take?: number) {
  const entries = Object.entries(map ?? {}).filter(([, v]) => v > 0);
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  if (total === 0) return [];
  const list = entries.map(([label, value]) => ({ label, value, pct: (value / total) * 100 })).sort((a, b) => b.value - a.value);
  return take ? list.slice(0, take) : list;
}

export const GENDER_LABELS: Record<string, string> = { F: "Mulheres", M: "Homens", U: "Não informado" };

export function sortAges(list: { label: string; pct: number; value: number }[]) {
  const start = (l: string) => parseInt(l, 10) || 0;
  return [...list].sort((a, b) => start(a.label) - start(b.label));
}

// ---- Plain-language summary for the client ----

const compact = (n: number) => n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const int = (n: number) => n.toLocaleString("pt-BR");

export function buildNarrative(args: { range: DateRange; summary: Summary; periodMedia: MediaInsight[]; allMedia: MediaInsight[] }) {
  const { range, summary, periodMedia, allMedia } = args;
  const lines: string[] = [];

  if (summary.reach.value > 0) {
    const d = summary.reach.delta;
    const trend = d === null ? "" : d >= 0 ? `, ${Math.abs(d).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% a mais que no período anterior` : `, ${Math.abs(d).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% a menos que no período anterior`;
    const views = summary.views.value > 0 ? ` e gerou ${compact(summary.views.value)} visualizações` : "";
    lines.push(`${range.phrase.charAt(0).toUpperCase()}${range.phrase.slice(1)}, o perfil alcançou ${int(summary.reach.value)} contas${trend}${views}.`);
  }

  const topFormat = formatTotals(periodMedia)[0];
  const formatSum = formatTotals(periodMedia).reduce((acc, f) => acc + f.reach, 0);
  if (topFormat && formatSum > 0) {
    const share = Math.round((topFormat.reach / formatSum) * 100);
    lines.push(`${FORMAT_LABELS[topFormat.type] ?? topFormat.type} foram o destaque: responderam por ${share}% do alcance dos conteúdos publicados.`);
  }

  const topPost = [...periodMedia].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0];
  if (topPost && (topPost.reach ?? 0) > 0) {
    lines.push(`O conteúdo de maior alcance chegou a ${int(topPost.reach ?? 0)} contas.`);
  }

  const growth: string[] = [];
  if (summary.newFollowers !== null && summary.newFollowers !== 0) {
    growth.push(summary.newFollowers > 0 ? `ganhou ${int(summary.newFollowers)} novos seguidores` : `perdeu ${int(Math.abs(summary.newFollowers))} seguidores`);
  }
  if (summary.profileViews.value > 0) growth.push(`recebeu ${int(summary.profileViews.value)} visitas ao perfil`);
  if (summary.linkTaps.value > 0) growth.push(`teve ${int(summary.linkTaps.value)} cliques no link da bio`);
  if (growth.length > 0) lines.push(`No mesmo período, o perfil ${growth.join(", ")}.`);

  const best = computeBestTimes(allMedia);
  const cadence = computeCadence(allMedia);
  const tips: string[] = [];
  if (best.posts >= 6 && best.bestDay !== null && best.bestSlot !== null) {
    tips.push(`publicar às ${weekdayName(best.bestDay)}s, por volta das ${SLOTS[best.bestSlot]}`);
  }
  if (cadence.best && cadence.totalWeeks >= 4) tips.push(`manter semanas com ${cadence.best.label.replace(" posts", "").replace(" post", "")} publicações`);
  if (tips.length > 0) lines.push(`Sugestão para o próximo ciclo: ${tips.join(" e ")}.`);

  return lines;
}
