// Connection screen backend for the WhatsApp Business Cloud API (Meta). Requires a logged-in admin of the agency.
// Actions (POST JSON):
//   save        { phone_number_id, waba_id?, access_token, app_secret }  validates the credentials against the Graph API and stores them
//   disconnect  {}                                                      removes the connection
//   send        { phone, text }                                         replies to a lead from the Conversas screen (inside the 24h window)
// The token and the app secret live only in public.whatsapp_cloud_connections (no client access); the screen reads the status through
// the RPC whatsapp_cloud_status(), which never returns them.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const GRAPH = "https://graph.facebook.com/v21.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function randomToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function graph(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${GRAPH}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  let data: any = null;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

const metaError = (d: any, fallback: string) => String(d?.error?.error_user_msg ?? d?.error?.message ?? fallback);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: u, error: uerr } = await userClient.auth.getUser();
  if (uerr || !u?.user?.id) return json({ error: "unauthorized" }, 401);
  const userId = u.user.id;
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  const { data: agencyId } = await userClient.rpc("current_agency_id");
  if (!isAdmin || !agencyId) return json({ error: "forbidden" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = String(body?.action ?? "");

  try {
    if (action === "save") {
      const phoneNumberId = String(body.phone_number_id ?? "").replace(/\D/g, "");
      const wabaId = String(body.waba_id ?? "").replace(/\D/g, "");
      const accessToken = String(body.access_token ?? "").trim();
      const appSecret = String(body.app_secret ?? "").trim();
      if (!phoneNumberId || !accessToken || !appSecret) return json({ error: "Preencha o ID do número, o token e a chave secreta do app." }, 400);

      const info = await graph(`/${phoneNumberId}?fields=display_phone_number,verified_name`, accessToken);
      if (!info.ok) return json({ error: `A Meta recusou as credenciais: ${metaError(info.data, "confira o ID do número e o token")}` }, 400);

      const { data: existing } = await admin.from("whatsapp_cloud_connections").select("verify_token").eq("agency_id", agencyId).maybeSingle();
      const { error } = await admin.from("whatsapp_cloud_connections").upsert({
        agency_id: agencyId, phone_number_id: phoneNumberId, waba_id: wabaId || null,
        display_phone: info.data?.display_phone_number ?? null, verified_name: info.data?.verified_name ?? null,
        access_token: accessToken, app_secret: appSecret, verify_token: existing?.verify_token ?? randomToken(),
        last_error: null, connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "agency_id" });
      if (error) {
        if (error.message.includes("phone_number_id")) return json({ error: "Esse número já está conectado em outra conta." }, 409);
        throw error;
      }
      // makes Meta deliver this number's events to the app's webhook (harmless if it is already subscribed)
      let subscribed: boolean | null = null;
      if (wabaId) subscribed = (await graph(`/${wabaId}/subscribed_apps`, accessToken, { method: "POST" })).ok;
      return json({ ok: true, subscribed });
    }

    if (action === "disconnect") {
      await admin.from("whatsapp_cloud_connections").delete().eq("agency_id", agencyId);
      return json({ ok: true });
    }

    if (action === "send") {
      const digits = String(body.phone ?? "").replace(/\D/g, "");
      const msg = String(body.text ?? "").trim();
      if (!digits || !msg) return json({ error: "invalid_request" }, 400);
      const to = digits.length <= 11 ? `55${digits}` : digits;
      const { data: conn } = await admin.from("whatsapp_cloud_connections").select("phone_number_id, access_token").eq("agency_id", agencyId).maybeSingle();
      if (!conn) return json({ error: "O WhatsApp ainda não está conectado." }, 409);
      const r = await graph(`/${conn.phone_number_id}/messages`, conn.access_token, {
        method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: msg, preview_url: true } }),
      });
      if (!r.ok) {
        const code = r.data?.error?.code;
        const hint = code === 131047 ? "Passaram mais de 24h desde a última mensagem do lead: só dá para responder com um modelo aprovado pela Meta." : metaError(r.data, "falha no envio");
        return json({ error: hint }, 422);
      }
      await admin.from("whatsapp_messages").insert({
        contact_phone: to, direction: "out", body: msg, status: "sent", source_type: "manual", agency_id: agencyId,
        sent_by_user_id: userId, zapi_message_id: r.data?.messages?.[0]?.id ?? null, raw: { provider: "cloud" },
      });
      return json({ ok: true });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error("whatsapp-cloud-connect error:", e instanceof Error ? e.message : e);
    return json({ error: "server_error" }, 500);
  }
});
