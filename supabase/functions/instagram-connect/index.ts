// Admin-only OAuth flow that links one client's Instagram Business Account (via its
// Facebook Page) to this app, so instagram-publish can post on their behalf later.
// Unlike the Google Drive integration (one static refresh token for the whole app),
// each client has their own Instagram account, so this needs a real interactive OAuth
// per client, run by the Uau Digital team (never the client themselves).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = "v21.0";
const APP_ID = Deno.env.get("META_APP_ID")!;
const APP_SECRET = Deno.env.get("META_APP_SECRET")!;
const REDIRECT_URI = Deno.env.get("INSTAGRAM_OAUTH_REDIRECT_URI")!;

// Names/set confirmed against this app's own "Permissões e recursos" page (App Dashboard →
// Casos de uso → API do Instagram → Permissões e recursos), the source of truth for exact
// spelling and "Pronto para teste" status — the "Casos de uso" summary page's bullet list
// showed "instagram_content_publishing" (with "-ing"), which turned out to be a stale/wrong
// label there; the real permission, confirmed "Pronto para teste", is instagram_content_publish.
const OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

// OAuth states older than this are rejected — bounds how long a stale, abandoned
// connect attempt can be replayed.
const STATE_TTL_MS = 10 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw json({ error: "missing authorization" }, 401);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) throw json({ error: "invalid session" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userData.user.id);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
    throw json({ error: "admin role required" }, 403);
  }

  return { admin, userId: userData.user.id as string };
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Graph API error on ${path}: ${JSON.stringify(data.error ?? data)}`);
  return data;
}

async function handleStart(admin: ReturnType<typeof createClient>, userId: string, body: { client_id?: string }) {
  const clientId = body.client_id;
  if (!clientId) return json({ error: "client_id is required" }, 400);

  const { data: client } = await admin.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) return json({ error: "client not found" }, 404);

  const state = crypto.randomUUID();
  const { error } = await admin.from("instagram_oauth_states").insert({ state, client_id: clientId, created_by: userId });
  if (error) throw error;

  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", OAUTH_SCOPES);
  url.searchParams.set("response_type", "code");

  return json({ url: url.toString() });
}

async function handleCallback(admin: ReturnType<typeof createClient>, body: { code?: string; state?: string }) {
  const { code, state } = body;
  if (!code || !state) return json({ error: "code and state are required" }, 400);

  const { data: stateRow } = await admin
    .from("instagram_oauth_states")
    .select("client_id, created_at, consumed_at")
    .eq("state", state)
    .maybeSingle();
  if (!stateRow) return json({ error: "unknown or expired state" }, 400);
  if (stateRow.consumed_at) return json({ error: "state already used" }, 400);
  if (Date.now() - new Date(stateRow.created_at).getTime() > STATE_TTL_MS) {
    return json({ error: "state expired, please reconnect" }, 400);
  }
  await admin.from("instagram_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("state", state);

  const clientId = stateRow.client_id as string;

  try {
    // 1. Short-lived user token from the auth code.
    const shortLived = await graphGet("oauth/access_token", {
      client_id: APP_ID,
      client_secret: APP_SECRET,
      redirect_uri: REDIRECT_URI,
      code,
    });

    // 2. Exchange for a long-lived (~60 day) user token.
    const longLived = await graphGet("oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: APP_ID,
      client_secret: APP_SECRET,
      fb_exchange_token: shortLived.access_token,
    });
    const expiresInSeconds: number = longLived.expires_in ?? 60 * 24 * 60 * 60;

    // 3. List the Pages this user manages. Page tokens returned here (when the user
    // token used to request them is already long-lived) inherit that same long
    // expiry per Meta's docs — verify this against a real token before relying on it.
    const pagesRes = await graphGet("me/accounts", { access_token: longLived.access_token });
    const pages: { id: string; name: string; access_token: string }[] = pagesRes.data ?? [];
    if (pages.length === 0) {
      return json({ error: "nenhuma Página do Facebook encontrada para essa conta" }, 422);
    }

    // 4. Find the first Page with a linked Instagram Business Account.
    let linked: { page: (typeof pages)[number]; igAccountId: string } | null = null;
    for (const page of pages) {
      const pageInfo = await graphGet(page.id, { fields: "instagram_business_account", access_token: page.access_token });
      if (pageInfo.instagram_business_account?.id) {
        linked = { page, igAccountId: pageInfo.instagram_business_account.id };
        break;
      }
    }
    if (!linked) {
      return json({ error: "nenhuma Página encontrada tem uma conta do Instagram Business vinculada" }, 422);
    }

    const igInfo = await graphGet(linked.igAccountId, { fields: "username", access_token: linked.page.access_token });

    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    const { error: upsertError } = await admin.from("instagram_connections").upsert(
      {
        client_id: clientId,
        facebook_page_id: linked.page.id,
        facebook_page_name: linked.page.name,
        instagram_business_account_id: linked.igAccountId,
        instagram_username: igInfo.username ?? null,
        access_token: linked.page.access_token,
        token_expires_at: tokenExpiresAt,
        status: "active",
        last_error: null,
      },
      { onConflict: "client_id" },
    );
    if (upsertError) throw upsertError;

    return json({ success: true, facebook_page_name: linked.page.name, instagram_username: igInfo.username ?? null });
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
}

async function handleDisconnect(admin: ReturnType<typeof createClient>, body: { client_id?: string }) {
  const clientId = body.client_id;
  if (!clientId) return json({ error: "client_id is required" }, 400);
  const { error } = await admin.from("instagram_connections").update({ status: "revoked" }).eq("client_id", clientId);
  if (error) throw error;
  return json({ success: true });
}

async function handleStatus(admin: ReturnType<typeof createClient>, body: { client_id?: string }) {
  const clientId = body.client_id;
  let query = admin
    .from("instagram_connections")
    .select("client_id, status, facebook_page_name, instagram_username, token_expires_at, last_error");
  if (clientId) query = query.eq("client_id", clientId);
  const { data, error } = await query;
  if (error) throw error;
  return json({ connections: data ?? [] });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    // "status" is read-only (never exposes access_token) and is safe for any
    // authenticated team member to call, not just admins — everything else that
    // creates/revokes a connection is admin-gated.
    if (action === "status") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "missing authorization" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user) return json({ error: "invalid session" }, 401);
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      return await handleStatus(admin, body);
    }

    const { admin, userId } = await requireAdmin(req);

    switch (action) {
      case "start":
        return await handleStart(admin, userId, body);
      case "callback":
        return await handleCallback(admin, body);
      case "disconnect":
        return await handleDisconnect(admin, body);
      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
