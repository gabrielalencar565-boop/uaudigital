// Lets an agency owner (admin) connect THEIR Google Drive to Fluxo.
//   start         → returns the Google consent URL (restricted "drive.file" scope: Fluxo only sees what it creates)
//   callback      → exchanges the code, stores the refresh token encrypted, creates the root folder and one folder per client
//   status        → connection summary for the settings screen
//   sync_folders  → creates the folders of clients that don't have one yet
//   disconnect    → revokes the token and forgets the connection (the Drive folders themselves stay where they are)
// Reuses the existing Google OAuth client (GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET): the redirect URI
// the app sends here must be registered on that client in Google Cloud.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCOPES = "https://www.googleapis.com/auth/drive.file openid email";
const STATE_TTL_MS = 15 * 60 * 1000;
const CALL_TIMEOUT_MS = 20_000;
const FOLDER_MIME = "application/vnd.google-apps.folder";

type Admin = ReturnType<typeof createClient>;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function timedFetch(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const q = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new HttpError(401, "missing authorization");
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) throw new HttpError(401, "invalid session");
  const userId = userData.user.id as string;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) {
    throw new HttpError(403, "apenas o administrador da agência pode conectar o Google Drive");
  }
  const { data: agencyId } = await userClient.rpc("current_agency_id");
  if (!agencyId) throw new HttpError(403, "agência não encontrada");
  return { admin, userId, agencyId: agencyId as string };
}

async function exchangeCode(code: string, redirectUri: string) {
  const res = await timedFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new HttpError(400, `o Google recusou o código: ${data.error_description ?? data.error ?? res.status}`);
  return data as { access_token: string; refresh_token?: string; scope?: string };
}

async function accessTokenFor(admin: Admin, agencyId: string) {
  const { data: refresh } = await admin.rpc("get_drive_refresh_token", { p_agency: agencyId });
  if (!refresh) throw new HttpError(409, "Google Drive não conectado");
  const res = await timedFetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refresh as string,
      client_id: Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!,
      client_secret: Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.error === "invalid_grant") {
      await admin.from("agency_drive_connections").update({ status: "revoked", last_error: "Acesso revogado no Google. Conecte de novo.", updated_at: new Date().toISOString() }).eq("agency_id", agencyId);
      throw new HttpError(409, "O acesso ao Google Drive foi revogado. Conecte de novo.");
    }
    throw new HttpError(502, `falha ao renovar o acesso: ${data.error_description ?? data.error ?? res.status}`);
  }
  return data.access_token as string;
}

async function createFolder(token: string, name: string, parentId?: string) {
  const res = await timedFetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new HttpError(502, `não consegui criar a pasta "${name}" no Drive: ${data.error?.message ?? res.status}`);
  return data.id as string;
}

// With the restricted scope only folders Fluxo itself created are visible, which is exactly what we want:
// an existing folder with that name under the root is ours, so it is reused instead of duplicated.
async function findOrCreateFolder(token: string, name: string, parentId: string) {
  const query = `name='${q(name)}' and mimeType='${FOLDER_MIME}' and '${parentId}' in parents and trashed=false`;
  const res = await timedFetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (res.ok && data.files?.length) return data.files[0].id as string;
  return await createFolder(token, name, parentId);
}

async function syncFolders(admin: Admin, agencyId: string, token: string, rootFolderId: string) {
  const { data: clients } = await admin
    .from("clients").select("id, name")
    .eq("agency_id", agencyId).eq("is_active", true).eq("is_freelancer_sentinel", false);
  const { data: existing } = await admin.from("agency_drive_client_folders").select("client_id").eq("agency_id", agencyId);
  const have = new Set((existing ?? []).map((r: { client_id: string }) => r.client_id));

  let created = 0;
  const failures: string[] = [];
  for (const c of (clients ?? []) as { id: string; name: string }[]) {
    if (have.has(c.id)) continue;
    try {
      const folderId = await findOrCreateFolder(token, c.name?.trim() || c.id, rootFolderId);
      await admin.from("agency_drive_client_folders").upsert({ client_id: c.id, agency_id: agencyId, drive_folder_id: folderId });
      created++;
    } catch (e) {
      failures.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { created, total: (clients ?? []).length, failures };
}

async function handleStart(admin: Admin, userId: string, agencyId: string, body: { redirect_uri?: string }) {
  const redirectUri = body.redirect_uri ?? "";
  let valid = false;
  try {
    const u = new URL(redirectUri);
    valid = (u.protocol === "https:" || u.hostname === "localhost") && u.pathname === "/admin/drive-callback";
  } catch { /* invalid URL */ }
  if (!valid) throw new HttpError(400, "redirect_uri inválido");

  // Drop stale handshakes, then open a new one.
  await admin.from("drive_oauth_states").delete().lt("created_at", new Date(Date.now() - STATE_TTL_MS).toISOString());
  const state = crypto.randomUUID();
  const { error } = await admin.from("drive_oauth_states").insert({ state, agency_id: agencyId, user_id: userId, redirect_uri: redirectUri });
  if (error) throw error;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return json({ url: url.toString() });
}

async function handleCallback(admin: Admin, userId: string, agencyId: string, body: { code?: string; state?: string }) {
  if (!body.code || !body.state) throw new HttpError(400, "code e state são obrigatórios");
  const { data: row } = await admin.from("drive_oauth_states").select("*").eq("state", body.state).maybeSingle();
  if (!row || row.user_id !== userId || row.agency_id !== agencyId) throw new HttpError(400, "pedido de conexão inválido ou expirado");
  await admin.from("drive_oauth_states").delete().eq("state", body.state);
  if (Date.now() - new Date(row.created_at).getTime() > STATE_TTL_MS) throw new HttpError(400, "o pedido de conexão expirou — tente de novo");

  const tokens = await exchangeCode(body.code, row.redirect_uri);
  if (!tokens.refresh_token) {
    throw new HttpError(400, "o Google não liberou o acesso contínuo. Remova o Fluxo em myaccount.google.com/permissions e conecte de novo.");
  }
  if (!(tokens.scope ?? "").includes("drive.file")) throw new HttpError(400, "a permissão do Drive não foi concedida");

  const info = await (await timedFetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json();

  const { data: agency } = await admin.from("agencies").select("name").eq("id", agencyId).maybeSingle();
  const rootName = `Fluxo — ${agency?.name ?? "Agência"}`;
  const rootId = await createFolder(tokens.access_token, rootName);

  const { error: secretErr } = await admin.rpc("save_drive_refresh_token", { p_agency: agencyId, p_token: tokens.refresh_token });
  if (secretErr) throw secretErr;
  // New connection → old per-client mappings (from a previous Drive) are meaningless.
  await admin.from("agency_drive_client_folders").delete().eq("agency_id", agencyId);
  const { error: connErr } = await admin.from("agency_drive_connections").upsert({
    agency_id: agencyId, google_email: info.email ?? null, root_folder_id: rootId, root_folder_name: rootName,
    status: "active", last_error: null, connected_by: userId, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  if (connErr) throw connErr;

  const folders = await syncFolders(admin, agencyId, tokens.access_token, rootId);
  return json({ email: info.email ?? null, root_folder_id: rootId, root_folder_name: rootName, folders });
}

async function handleStatus(admin: Admin, agencyId: string) {
  const { data: conn } = await admin.from("agency_drive_connections").select("*").eq("agency_id", agencyId).maybeSingle();
  const { count: clientCount } = await admin.from("clients").select("id", { count: "exact", head: true })
    .eq("agency_id", agencyId).eq("is_active", true).eq("is_freelancer_sentinel", false);
  const { count: folderCount } = await admin.from("agency_drive_client_folders").select("client_id", { count: "exact", head: true }).eq("agency_id", agencyId);
  return json({ connected: !!conn, connection: conn ?? null, clients: clientCount ?? 0, folders: folderCount ?? 0 });
}

async function handleSyncFolders(admin: Admin, agencyId: string) {
  const { data: conn } = await admin.from("agency_drive_connections").select("root_folder_id, status").eq("agency_id", agencyId).maybeSingle();
  if (!conn) throw new HttpError(409, "Google Drive não conectado");
  const token = await accessTokenFor(admin, agencyId);
  try {
    return json(await syncFolders(admin, agencyId, token, conn.root_folder_id));
  } catch (e) {
    await admin.from("agency_drive_connections").update({ status: "error", last_error: e instanceof Error ? e.message : String(e), updated_at: new Date().toISOString() }).eq("agency_id", agencyId);
    throw e;
  }
}

async function handleDisconnect(admin: Admin, agencyId: string) {
  const { data: refresh } = await admin.rpc("get_drive_refresh_token", { p_agency: agencyId });
  if (refresh) {
    await timedFetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh as string)}`, { method: "POST" }).catch(() => {});
  }
  await admin.from("agency_drive_client_folders").delete().eq("agency_id", agencyId);
  await admin.from("agency_drive_secrets").delete().eq("agency_id", agencyId);
  await admin.from("agency_drive_connections").delete().eq("agency_id", agencyId);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { admin, userId, agencyId } = await authenticate(req);
    switch (body.action) {
      case "start": return await handleStart(admin, userId, agencyId, body);
      case "callback": return await handleCallback(admin, userId, agencyId, body);
      case "status": return await handleStatus(admin, agencyId);
      case "sync_folders": return await handleSyncFolders(admin, agencyId);
      case "disconnect": return await handleDisconnect(admin, agencyId);
      default: return json({ error: `unknown action: ${body.action}` }, 400);
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
