// Read-only data for the client-facing Instagram report page (/relatorio/:token). No login: access is
// by the unguessable token of an enabled row in instagram_report_links, and only that one client's
// already-collected numbers are returned (never tokens or anything from other clients).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: { token?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const token = String(payload?.token ?? "");
  if (!UUID_RE.test(token)) return json({ error: "not_found" }, 404);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: link } = await admin
    .from("instagram_report_links")
    .select("client_id, period_days, enabled")
    .eq("token", token)
    .maybeSingle();
  if (!link || !link.enabled) return json({ error: "not_found" }, 404);

  const clientId = link.client_id as string;
  const [client, connection, snapshots, media, audience] = await Promise.all([
    admin.from("clients").select("name, logo_url").eq("id", clientId).maybeSingle(),
    admin.from("instagram_connections").select("instagram_username").eq("client_id", clientId).maybeSingle(),
    admin
      .from("instagram_metric_snapshots")
      .select("snapshot_date, followers_count, reach, views, profile_views, profile_link_taps, follower_delta, total_interactions, accounts_engaged")
      .eq("client_id", clientId)
      .order("snapshot_date", { ascending: true })
      .limit(400),
    admin
      .from("instagram_media_insights")
      .select("ig_media_id, content_type, posted_at, permalink, thumbnail_url, caption, reach, likes, comments, saves, shares, total_interactions")
      .eq("client_id", clientId)
      .order("posted_at", { ascending: false })
      .limit(200),
    admin.from("instagram_audience_snapshots").select("gender, age, city, country, city_geo, captured_at").eq("client_id", clientId).maybeSingle(),
  ]);

  if (!client.data) return json({ error: "not_found" }, 404);

  return json({
    client: { name: client.data.name, logo_url: client.data.logo_url, instagram_username: connection.data?.instagram_username ?? null },
    period_days: link.period_days,
    generated_at: new Date().toISOString(),
    snapshots: snapshots.data ?? [],
    media: media.data ?? [],
    audience: audience.data ?? null,
  });
});
