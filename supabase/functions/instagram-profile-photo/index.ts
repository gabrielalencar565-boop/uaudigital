// Copies the connected Instagram account's profile picture into the client's own photo (clients.logo_url).
// Instagram's picture links expire after a few days, so the image is stored in our own bucket. A photo the team
// uploaded by hand is kept unless `force` is set (the "Usar foto do Instagram" button); a photo that itself came
// from Instagram (path client-logos/ig-…) is refreshed whenever this runs. Same access rule as instagram-connect.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GRAPH_VERSION = "v21.0";
const MAX_BYTES = 5 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getRoleTitle(admin: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: profile } = await admin.from("profiles").select("role_title").eq("user_id", userId).maybeSingle();
  if (profile?.role_title != null) return profile.role_title as string;
  const { data: member } = await admin.from("team_members").select("role_title").eq("user_id", userId).maybeSingle();
  return (member?.role_title as string | undefined) ?? null;
}

// Same rule as instagram-connect: admin always passes, otherwise the role/cargo configured for this feature key
async function requirePermission(req: Request, key: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw json({ error: "missing authorization" }, 401);
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) throw json({ error: "invalid session" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const userId = userData.user.id as string;
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
  const roleSet = new Set((roles ?? []).map((r: { role: string }) => r.role as string));
  if (!roleSet.has("admin")) {
    const { data: perm } = await admin.from("feature_permissions").select("allowed_roles, allowed_cargos").eq("key", key).maybeSingle();
    const roleMatch = (perm?.allowed_roles ?? []).some((r: string) => roleSet.has(r));
    let cargoMatch = false;
    if (!roleMatch && perm?.allowed_cargos?.length) {
      const roleTitle = ((await getRoleTitle(admin, userId)) ?? "").trim().toLowerCase();
      cargoMatch = !!roleTitle && perm.allowed_cargos.some((c: string) => c.trim().toLowerCase() === roleTitle);
    }
    if (!roleMatch && !cargoMatch) throw json({ error: "sem permissão para esta ação" }, 403);
  }
  const { data: agencyId } = await userClient.rpc("current_agency_id");
  return { admin, agencyId: (agencyId as string | null) ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const clientId = String(body?.client_id ?? "");
    const force = body?.force === true;
    if (!clientId) return json({ error: "client_id is required" }, 400);

    const { admin, agencyId } = await requirePermission(req, "action_instagram_connect");
    if (!agencyId) return json({ error: "client not found" }, 404);
    const { data: client } = await admin.from("clients").select("id, logo_url").eq("id", clientId).eq("agency_id", agencyId).maybeSingle();
    if (!client) return json({ error: "client not found" }, 404);

    const current = (client.logo_url as string | null) ?? null;
    const fromInstagram = !!current && current.includes("/client-logos/ig-");
    if (!force && current && !fromInstagram) return json({ updated: false, reason: "has_photo" });

    const { data: conn } = await admin
      .from("instagram_connections")
      .select("auth_provider, instagram_business_account_id, access_token, status")
      .eq("client_id", clientId)
      .maybeSingle();
    if (!conn || conn.status !== "active" || !conn.access_token) return json({ error: "Instagram não conectado para este cliente" }, 409);

    const base = conn.auth_provider === "instagram_login"
      ? `https://graph.instagram.com/${GRAPH_VERSION}/me`
      : `https://graph.facebook.com/${GRAPH_VERSION}/${conn.instagram_business_account_id}`;
    const metaUrl = new URL(base);
    metaUrl.searchParams.set("fields", "profile_picture_url");
    metaUrl.searchParams.set("access_token", conn.access_token as string);
    const metaRes = await fetch(metaUrl.toString());
    const meta = await metaRes.json().catch(() => ({}));
    const pictureUrl = meta?.profile_picture_url as string | undefined;
    if (!metaRes.ok || meta?.error || !pictureUrl) return json({ updated: false, reason: "no_picture" });

    const imgRes = await fetch(pictureUrl);
    const type = imgRes.headers.get("content-type") ?? "";
    if (!imgRes.ok || !type.startsWith("image/")) return json({ updated: false, reason: "download_failed" });
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return json({ updated: false, reason: "bad_size" });

    const ext = type.includes("png") ? "png" : "jpg";
    const path = `client-logos/ig-${clientId}-${Date.now()}.${ext}`;
    const up = await admin.storage.from("app-assets").upload(path, bytes, { contentType: type, upsert: true });
    if (up.error) throw up.error;
    const logoUrl = admin.storage.from("app-assets").getPublicUrl(path).data.publicUrl;
    const { error } = await admin.from("clients").update({ logo_url: logoUrl }).eq("id", clientId);
    if (error) throw error;
    return json({ updated: true, logo_url: logoUrl });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("instagram-profile-photo error:", e instanceof Error ? e.message : e);
    return json({ error: "server_error" }, 500);
  }
});
