// Pulls Instagram account + per-post insights for a client and stores them as snapshots
// (the Graph API only keeps a short rolling window, so our own daily rows are what make
// "crescimento" over time possible).
//   - action "sync": one client, requires a real user session; the client must be visible to that user (RLS).
//   - action "connect_url": same, plus the "action_instagram_connect" permission.
//   - action "run_daily": every active connection, called by pg_cron via pg_net (not scheduled yet).
//     Authenticated by the shared cron secret header.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = "v21.0";
const REQUEST_TIMEOUT_MS = 25_000;
const SERIES_DAYS = 28;
const MEDIA_LIMIT = 100;
const MEDIA_CONCURRENCY = 8;

type Admin = ReturnType<typeof createClient>;
type GraphHost = "graph.facebook.com" | "graph.instagram.com";

class GraphError extends Error {
  needsReauth: boolean;
  constructor(path: string, detail: unknown) {
    super(`Graph API error on ${path}: ${JSON.stringify(detail)}`);
    const d = detail as { code?: number; message?: string } | undefined;
    const msg = (d?.message ?? "").toLowerCase();
    // 10 = permission denied, 190 = invalid/expired token, 200 = permission required.
    this.needsReauth = d?.code === 10 || d?.code === 190 || d?.code === 200 || msg.includes("permission");
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function graphHostForProvider(authProvider: string): GraphHost {
  return authProvider === "instagram_login" ? "graph.instagram.com" : "graph.facebook.com";
}

async function graphGet(host: GraphHost, path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://${host}/${GRAPH_VERSION}/${path}`);
  for (const [k, v] of Object.entries({ ...params, access_token: accessToken })) url.searchParams.set(k, v);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    const data = await res.json();
    if (!res.ok || data.error) throw new GraphError(path, data.error ?? data);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function unix(d: Date) {
  return Math.floor(d.getTime() / 1000).toString();
}

function contentTypeFromMedia(m: { media_type?: string; media_product_type?: string }): string {
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_product_type === "STORY") return "story";
  if (m.media_type === "CAROUSEL_ALBUM") return "carrossel";
  return "post";
}

// Insights come back as [{ name, values: [{ value }] }] (time series) or [{ name, total_value: { value } }].
// deno-lint-ignore no-explicit-any
function metricValue(entry: any): number | null {
  const v = entry?.total_value?.value ?? entry?.values?.[0]?.value;
  return typeof v === "number" ? v : null;
}

// Per-day totals Instagram only exposes as window totals (not a daily series): link-in-bio taps,
// views and profile visits. Each day is its own 1-day window, and only days we don't have yet (plus
// the last two, which Instagram may still revise) are requested, so after the first run this is just
// a few calls. Every metric is probed separately first so one unsupported metric can't sink the rest.
type DailyCol = "profile_link_taps" | "views" | "profile_views";
const DAILY_METRICS: { col: DailyCol; candidates: string[] }[] = [
  { col: "profile_link_taps", candidates: ["profile_links_taps", "website_clicks"] },
  { col: "views", candidates: ["views"] },
  { col: "profile_views", candidates: ["profile_views"] },
];
const DAILY_CONCURRENCY = 7;
const DAY_MS = 24 * 3600 * 1000;

async function collectDailyTotals(
  host: GraphHost,
  igUserId: string,
  token: string,
  existing: Map<string, Record<string, unknown>>,
  seriesStart: Date,
  todayStart: Date,
): Promise<{ values: Map<string, Partial<Record<DailyCol, number>>>; status: Record<string, string> }> {
  const values = new Map<string, Partial<Record<DailyCol, number>>>();
  const status: Record<string, string> = {};
  const fetchDay = (metric: string, d: Date) =>
    graphGet(host, `${igUserId}/insights`, token, {
      metric,
      metric_type: "total_value",
      period: "day",
      since: unix(d),
      until: unix(new Date(d.getTime() + DAY_MS)),
    });

  const newest = new Date(todayStart.getTime() - DAY_MS);
  const resolved: { col: DailyCol; metric: string }[] = [];
  for (const { col, candidates } of DAILY_METRICS) {
    let lastError = "";
    for (const metric of candidates) {
      try {
        const probe = await fetchDay(metric, newest);
        resolved.push({ col, metric });
        values.set(isoDay(newest), { ...values.get(isoDay(newest)), [col]: metricValue(probe.data?.[0]) ?? 0 });
        status[col] = metric;
        break;
      } catch (e) {
        lastError = e instanceof Error ? e.message.slice(0, 160) : String(e);
      }
    }
    if (!status[col]) status[col] = `erro: ${lastError}`;
  }
  if (resolved.length === 0) return { values, status };

  const days: Date[] = [];
  for (let d = new Date(seriesStart); d < newest; d = new Date(d.getTime() + DAY_MS)) {
    const recent = d.getTime() >= todayStart.getTime() - 3 * DAY_MS;
    const row = existing.get(isoDay(d));
    if (recent || resolved.some((r) => row?.[r.col] == null)) days.push(d);
  }
  const metricList = resolved.map((r) => r.metric).join(",");
  for (let i = 0; i < days.length; i += DAILY_CONCURRENCY) {
    await Promise.all(
      days.slice(i, i + DAILY_CONCURRENCY).map(async (d) => {
        try {
          const res = await fetchDay(metricList, d);
          const entry: Partial<Record<DailyCol, number>> = {};
          // deno-lint-ignore no-explicit-any
          for (const item of (res.data ?? []) as any[]) {
            const hit = resolved.find((r) => r.metric === item.name);
            if (hit) entry[hit.col] = metricValue(item) ?? 0;
          }
          values.set(isoDay(d), entry);
        } catch {
          // A missing day just stays empty and is retried on the next sync.
        }
      }),
    );
  }
  return { values, status };
}

// follower_demographics returns one breakdown per call: [{ dimension_values: ["F"], value: 123 }, ...].
const DEMOGRAPHIC_BREAKDOWNS = ["gender", "age", "city", "country"] as const;
async function collectAudience(host: GraphHost, igUserId: string, token: string) {
  const out: Record<string, Record<string, number>> = {};
  const errors: string[] = [];
  for (const breakdown of DEMOGRAPHIC_BREAKDOWNS) {
    try {
      const res = await graphGet(host, `${igUserId}/insights`, token, {
        metric: "follower_demographics",
        period: "lifetime",
        metric_type: "total_value",
        breakdown,
      });
      const results = res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      const map: Record<string, number> = {};
      // deno-lint-ignore no-explicit-any
      for (const r of results as any[]) map[String(r.dimension_values?.[0] ?? "?")] = Number(r.value ?? 0);
      out[breakdown] = map;
    } catch (e) {
      errors.push(`${breakdown}: ${e instanceof Error ? e.message.slice(0, 120) : String(e)}`);
    }
  }
  return { out, errors };
}

// Coordinates for the audience's top cities (used to draw the map). Open-Meteo's geocoder is free and
// keyless; each city is looked up once and kept in city_geo, so later syncs only geocode new cities.
const GEO_TOP_CITIES = 12;
const normalize = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

async function geocodeCities(cities: Record<string, number>, known: Record<string, [number, number]>) {
  const top = Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, GEO_TOP_CITIES).map(([label]) => label);
  const geo: Record<string, [number, number]> = {};
  for (const label of top) {
    if (known[label]) {
      geo[label] = known[label];
      continue;
    }
    const [name, state = ""] = label.split(",").map((p) => p.trim());
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=pt&countryCode=BR`,
        { signal: AbortSignal.timeout(8000) },
      );
      const data = await res.json();
      // deno-lint-ignore no-explicit-any
      const places = ((data.results ?? []) as any[]).filter((r) => String(r.feature_code ?? "").startsWith("PPL"));
      const match = places.find((r) => normalize(String(r.admin1 ?? "")) === normalize(state)) ?? places[0];
      if (match) geo[label] = [match.latitude, match.longitude];
    } catch {
      // A city that can't be located just won't get a bubble; it's retried on the next sync.
    }
  }
  return geo;
}

async function syncClient(admin: Admin, clientId: string) {
  const { data: client } = await admin.from("clients").select("id, agency_id").eq("id", clientId).maybeSingle();
  if (!client?.agency_id) throw new Error("cliente não encontrado");

  const { data: connection } = await admin
    .from("instagram_connections")
    .select("instagram_business_account_id, access_token, status, auth_provider")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!connection || connection.status !== "active" || !connection.access_token) {
    throw new Error("cliente sem conexão ativa com o Instagram");
  }

  const igUserId = connection.instagram_business_account_id as string;
  const token = connection.access_token as string;
  const host = graphHostForProvider(connection.auth_provider as string);
  const agencyId = client.agency_id as string;

  const now = new Date();
  const today = isoDay(now);
  const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const seriesStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - SERIES_DAYS));

  const account = await graphGet(host, igUserId, token, { fields: "followers_count" });

  // Daily reach series — end_time marks the END of each day's window, so it belongs to the day before.
  const series = await graphGet(host, `${igUserId}/insights`, token, {
    metric: "reach",
    period: "day",
    since: unix(seriesStart),
    until: unix(todayStart),
  });
  const rows = new Map<string, Record<string, unknown>>();
  const row = (date: string) => {
    if (!rows.has(date)) rows.set(date, { agency_id: agencyId, client_id: clientId, snapshot_date: date });
    return rows.get(date)!;
  };
  // deno-lint-ignore no-explicit-any
  for (const point of series.data?.[0]?.values ?? []) {
    const end = new Date(point.end_time);
    row(isoDay(new Date(end.getTime() - 24 * 3600 * 1000))).reach = point.value;
  }

  // Engagement only comes as a window total, so yesterday's single-day window is captured daily.
  const engaged = await graphGet(host, `${igUserId}/insights`, token, {
    metric: "accounts_engaged,total_interactions",
    metric_type: "total_value",
    period: "day",
    since: unix(yesterdayStart),
    until: unix(todayStart),
  });
  const y = row(isoDay(yesterdayStart));
  // deno-lint-ignore no-explicit-any
  for (const entry of (engaged.data ?? []) as any[]) {
    if (entry.name === "accounts_engaged") y.accounts_engaged = metricValue(entry);
    if (entry.name === "total_interactions") y.total_interactions = metricValue(entry);
  }
  row(today).followers_count = account.followers_count ?? null;

  // A batch upsert writes NULL into every column a row doesn't carry, so values captured on earlier
  // syncs (followers, daily engagement, link taps…) would be wiped. Carry them over before saving.
  const PRESERVED = [
    "followers_count", "accounts_engaged", "total_interactions", "profile_link_taps", "views", "profile_views", "follower_delta",
  ] as const;
  const { data: existingRows } = await admin
    .from("instagram_metric_snapshots")
    .select(["snapshot_date", ...PRESERVED].join(", "))
    .eq("client_id", clientId)
    .gte("snapshot_date", isoDay(seriesStart));
  const existingByDate = new Map<string, Record<string, unknown>>();
  for (const r of (existingRows ?? []) as Record<string, unknown>[]) {
    existingByDate.set(r.snapshot_date as string, r);
    const target = rows.get(r.snapshot_date as string);
    if (!target) continue;
    for (const col of PRESERVED) if (target[col] === undefined && r[col] != null) target[col] = r[col];
  }

  const daily = await collectDailyTotals(host, igUserId, token, existingByDate, seriesStart, todayStart);
  for (const [date, entry] of daily.values) Object.assign(row(date), entry);

  // Net new followers per day (can be negative). Same end_time → previous-day attribution as reach.
  let followerSeriesStatus = "ok";
  try {
    const fc = await graphGet(host, `${igUserId}/insights`, token, {
      metric: "follower_count",
      period: "day",
      since: unix(seriesStart),
      until: unix(todayStart),
    });
    for (const point of fc.data?.[0]?.values ?? []) {
      const end = new Date(point.end_time);
      row(isoDay(new Date(end.getTime() - DAY_MS))).follower_delta = point.value;
    }
  } catch (e) {
    followerSeriesStatus = `erro: ${e instanceof Error ? e.message.slice(0, 160) : String(e)}`;
  }

  const { error: snapErr } = await admin
    .from("instagram_metric_snapshots")
    .upsert([...rows.values()], { onConflict: "client_id,snapshot_date" });
  if (snapErr) throw snapErr;

  const audience = await collectAudience(host, igUserId, token);
  if (Object.keys(audience.out).length > 0) {
    const { data: prevAudience } = await admin.from("instagram_audience_snapshots").select("city_geo").eq("client_id", clientId).maybeSingle();
    const cityGeo = await geocodeCities(audience.out.city ?? {}, (prevAudience?.city_geo ?? {}) as Record<string, [number, number]>);
    const { error: audErr } = await admin.from("instagram_audience_snapshots").upsert(
      { client_id: clientId, agency_id: agencyId, captured_at: new Date().toISOString(), ...audience.out, city_geo: cityGeo },
      { onConflict: "client_id" },
    );
    if (audErr) audience.errors.push(`salvar: ${audErr.message}`);
  }

  // Per-post insights.
  const mediaList = await graphGet(host, `${igUserId}/media`, token, {
    fields: "id,media_type,media_product_type,timestamp,permalink,like_count,comments_count,caption,thumbnail_url,media_url",
    limit: String(MEDIA_LIMIT),
  });
  // deno-lint-ignore no-explicit-any
  const medias = (mediaList.data ?? []) as any[];

  const { data: pubs } = await admin
    .from("calendar_publications")
    .select("id, content_type, instagram_media_id")
    .in("instagram_media_id", medias.map((m) => m.id));
  const pubByMedia = new Map((pubs ?? []).map((p: { id: string; content_type: string; instagram_media_id: string }) => [p.instagram_media_id, p]));

  const buildRow = async (m: (typeof medias)[number]) => {
    const base = contentTypeFromMedia(m);
    let metrics: Record<string, number | null> = {};
    for (const metricSet of ["reach,saved,shares,total_interactions", "reach,total_interactions"]) {
      try {
        const ins = await graphGet(host, `${m.id}/insights`, token, { metric: metricSet });
        // deno-lint-ignore no-explicit-any
        metrics = Object.fromEntries(((ins.data ?? []) as any[]).map((e) => [e.name, metricValue(e)]));
        break;
      } catch (e) {
        if (e instanceof GraphError && e.needsReauth) throw e;
      }
    }
    const pub = pubByMedia.get(m.id);
    return {
      agency_id: agencyId,
      client_id: clientId,
      ig_media_id: m.id,
      publication_id: pub?.id ?? null,
      content_type: pub?.content_type ?? base,
      posted_at: m.timestamp ?? null,
      permalink: m.permalink ?? null,
      // Videos/Reels expose thumbnail_url; photos only have media_url. These Instagram CDN links
      // expire after a while, so every sync refreshes them.
      thumbnail_url: m.thumbnail_url ?? m.media_url ?? null,
      caption: typeof m.caption === "string" ? m.caption.slice(0, 200) : null,
      reach: metrics.reach ?? null,
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
      saves: metrics.saved ?? null,
      shares: metrics.shares ?? null,
      total_interactions: metrics.total_interactions ?? null,
      captured_at: new Date().toISOString(),
    };
  };
  // Per-post insights are one request each, so they run in small parallel batches.
  const mediaRows = [];
  for (let i = 0; i < medias.length; i += MEDIA_CONCURRENCY) {
    mediaRows.push(...(await Promise.all(medias.slice(i, i + MEDIA_CONCURRENCY).map(buildRow))));
  }
  if (mediaRows.length > 0) {
    const { error: mediaErr } = await admin.from("instagram_media_insights").upsert(mediaRows, { onConflict: "client_id,ig_media_id" });
    if (mediaErr) throw mediaErr;
  }

  return {
    snapshots: rows.size,
    media: mediaRows.length,
    extras: { ...daily.status, follower_count: followerSeriesStatus, audience: audience.errors.length ? audience.errors : "ok" },
  };
}

// Same Instagram Login OAuth as instagram-connect's "start_ig_login" (same redirect URI and
// state table, so its existing callback finishes the connection), plus the insights scope.
// Kept here instead of in instagram-connect so everyone else's connect flow never asks Meta
// for a permission that isn't approved for them yet.
async function handleConnectUrl(admin: Admin, userId: string, clientId: string) {
  const { data: client } = await admin.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return json({ error: "client not found" }, 404);

  const state = "ig:" + crypto.randomUUID();
  const { error } = await admin
    .from("instagram_oauth_states")
    .insert({ state, client_id: clientId, created_by: userId, provider: "instagram_login" });
  if (error) throw error;

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", Deno.env.get("INSTAGRAM_LOGIN_APP_ID")!.trim());
  url.searchParams.set("redirect_uri", Deno.env.get("INSTAGRAM_LOGIN_OAUTH_REDIRECT_URI")!.trim());
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights");
  url.searchParams.set("response_type", "code");
  return json({ url: url.toString() });
}

function errorResponse(e: unknown) {
  if (e instanceof GraphError) return json({ error: e.message, needs_reauthorization: e.needsReauth }, e.needsReauth ? 403 : 502);
  return json({ error: e instanceof Error ? e.message : String(e) }, 500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "run_daily") {
      const { data: validSecret } = await admin.rpc("verify_instagram_cron_secret", { candidate: req.headers.get("X-Cron-Secret") });
      if (!validSecret) return json({ error: "unauthorized" }, 401);
      const { data: conns } = await admin.from("instagram_connections").select("client_id").eq("status", "active");
      const results: Record<string, string> = {};
      for (const c of conns ?? []) {
        try {
          await syncClient(admin, c.client_id as string);
          results[c.client_id as string] = "ok";
        } catch (e) {
          results[c.client_id as string] = e instanceof Error ? e.message : String(e);
        }
      }
      return json({ results });
    }

    if (action === "sync" || action === "connect_url") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "missing authorization" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user) return json({ error: "invalid session" }, 401);

      const clientId = body.client_id as string | undefined;
      if (!clientId) return json({ error: "client_id is required" }, 400);

      // The sync below runs with the service role, so scope it here: RLS on the user's own client
      // only returns clients from their agency.
      const { data: visible } = await userClient.from("clients").select("id").eq("id", clientId).maybeSingle();
      if (!visible) return json({ error: "cliente não encontrado" }, 404);

      if (action === "connect_url") {
        const { data: allowed } = await admin.rpc("has_feature_permission", {
          _user_id: userData.user.id,
          _key: "action_instagram_connect",
        });
        if (!allowed) return json({ error: "sem permissão para esta ação" }, 403);
      }

      if (action === "connect_url") return await handleConnectUrl(admin, userData.user.id, clientId);
      return json(await syncClient(admin, clientId));
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return errorResponse(e);
  }
});
