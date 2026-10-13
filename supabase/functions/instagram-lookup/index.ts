// NOT USED BY THE APP YET: Business Discovery needs a Facebook Login connection whose token has pages_read_engagement
// (today's only one lacks it, error 190) and does not exist on Instagram Login connections (error 100). Kept so the
// collaborator picker can confirm an @ with photo/name/followers once such a connection exists.
// Looks up a public Instagram professional account by its exact @ (Business Discovery), so the collaborator picker
// can show photo, name and followers before the invite is added. The query goes out with a connected account of the
// agency (Facebook Login only) — the access token never leaves the server. Instagram has no free-text search and
// does not expose who an account follows, so this only confirms an @ that was typed in full. Personal accounts are
// not returned by Business Discovery; the answer is then `found: false` (the UI still lets the @ be added).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GRAPH_VERSION = "v21.0";
const USERNAME_RE = /^[a-z0-9._]{1,30}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "missing authorization" }, 401);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.client_id ?? "");
    const username = String(body?.username ?? "").replace(/^@/, "").trim().toLowerCase();
    if (!clientId || !USERNAME_RE.test(username)) return json({ found: false, reason: "invalid" });

    // the caller's own (RLS-scoped) view must include this client — never query with another agency's token
    const { data: visible } = await userClient.from("clients").select("id, agency_id").eq("id", clientId).maybeSingle();
    if (!visible) return json({ error: "client not found" }, 404);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // an account can't invite itself
    const { data: own } = await admin.from("instagram_connections").select("instagram_username").eq("client_id", clientId).maybeSingle();
    if (String(own?.instagram_username ?? "").toLowerCase() === username) return json({ found: false, reason: "self" });

    // Business Discovery only exists for connections made through Facebook Login (the Instagram Login API has no such
    // field), and any connected professional account of the agency can look up another public professional account.
    const { data: conn } = await admin
      .from("instagram_connections")
      .select("instagram_business_account_id, access_token")
      .eq("agency_id", visible.agency_id)
      .eq("auth_provider", "facebook_login")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (!conn || !conn.access_token) return json({ found: false, reason: "not_supported" });

    const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${conn.instagram_business_account_id}`);
    url.searchParams.set("fields", `business_discovery.username(${username}){username,name,profile_picture_url,followers_count}`);
    url.searchParams.set("access_token", conn.access_token as string);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    let res: Response;
    try {
      res = await fetch(url.toString(), { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    const profile = data?.business_discovery;
    if (res.ok && profile?.username) {
      return json({
        found: true,
        username: String(profile.username).toLowerCase(),
        name: profile.name ?? null,
        picture: profile.profile_picture_url ?? null,
        followers: typeof profile.followers_count === "number" ? profile.followers_count : null,
      });
    }
    // 110 / "Invalid user id": no professional account with that @ (it may be personal, private or not exist)
    const code = data?.error?.code;
    console.log("instagram-lookup not found:", code, data?.error?.message ?? res.status);
    return json({ found: false, reason: code === 110 || code === 24 || code === 100 ? "not_found" : "unavailable" });
  } catch (e) {
    console.error("instagram-lookup error:", e instanceof Error ? e.message : e);
    return json({ found: false, reason: "unavailable" });
  }
});
