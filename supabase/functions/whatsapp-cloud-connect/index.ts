// Connection screen backend for the WhatsApp Business Cloud API (Meta). Requires a logged-in admin of the agency.
// Actions (POST JSON):
//   save        { phone_number_id, waba_id?, access_token, app_secret }  validates the credentials against the Graph API and stores them
//   disconnect  {}                                                      removes the connection
//   send        { phone, text }                                         replies to a lead from the Conversas screen (inside the 24h window)
//   status      {}                                                      asks Meta how the number and the webhook subscription are doing (diagnosis)
//   request_code { method }                                             asks Meta to send the verification code (SMS or VOICE) to the number
//   verify_code  { code }                                               confirms the code Meta sent
//   zapi_save   { instance_id, instance_token, client_token? }          connects the unofficial (Z-API, QR code) WhatsApp of the CRM
//   zapi_status {}                                                      asks Z-API whether the phone is connected (and returns the QR code when it is not)
//   zapi_disconnect {}                                                  removes the Z-API connection
//   send_audio  { phone, audio (MP3 in base64), seconds }               sends a recorded voice message to a lead from the Conversas screen
//   register    { pin }                                                 activates the number on the Cloud API (it stops working in the WhatsApp phone app)
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

const ZAPI = "https://api.z-api.io";
const zapiBase = (c: { instance_id: string; instance_token: string }) => `${ZAPI}/instances/${encodeURIComponent(c.instance_id)}/token/${encodeURIComponent(c.instance_token)}`;
async function zapi(c: { instance_id: string; instance_token: string; client_token: string | null }, path: string, init?: RequestInit) {
  const res = await fetch(`${zapiBase(c)}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(c.client_token ? { "Client-Token": c.client_token } : {}), ...(init?.headers ?? {}) } });
  let data: any = null;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}
const zapiError = (d: any, fallback: string) => String(d?.error ?? d?.message ?? fallback);

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

    if (action === "zapi_save") {
      const instanceId = String(body.instance_id ?? "").trim();
      const instanceToken = String(body.instance_token ?? "").trim();
      const clientToken = String(body.client_token ?? "").trim() || null;
      if (!instanceId || !instanceToken) return json({ error: "Preencha o ID e o token da instância do Z-API." }, 400);
      const probe = { instance_id: instanceId, instance_token: instanceToken, client_token: clientToken };
      const st = await zapi(probe, "/status");
      // o Z-API devolve "You are already connected." no campo error quando o celular já está conectado: só o status HTTP diz se os dados valem
      if (!st.ok) return json({ error: `O Z-API recusou os dados: ${zapiError(st.data, "confira o ID, o token e o Client-Token")}` }, 400);
      const dev = await zapi(probe, "/device");
      const phone = dev.ok && dev.data?.phone ? String(dev.data.phone).replace(/\D/g, "") : null;
      const { data: existing } = await admin.from("whatsapp_zapi_connections").select("webhook_key").eq("agency_id", agencyId).maybeSingle();
      const { error } = await admin.from("whatsapp_zapi_connections").upsert({
        agency_id: agencyId, instance_id: instanceId, instance_token: instanceToken, client_token: clientToken,
        webhook_key: existing?.webhook_key ?? randomToken(), connected_phone: phone, last_error: null,
        connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }, { onConflict: "agency_id" });
      if (error) throw error;
      return json({ ok: true, connected: !!st.data?.connected });
    }

    if (action === "zapi_disconnect") {
      await admin.from("whatsapp_zapi_connections").delete().eq("agency_id", agencyId);
      return json({ ok: true });
    }

    if (action === "zapi_status") {
      const { data: conn } = await admin.from("whatsapp_zapi_connections").select("instance_id, instance_token, client_token").eq("agency_id", agencyId).maybeSingle();
      if (!conn) return json({ error: "O WhatsApp (Z-API) ainda não está conectado." }, 409);
      const st = await zapi(conn, "/status");
      if (!st.ok) return json({ error: `O Z-API recusou a consulta: ${zapiError(st.data, "falha ao consultar")}` }, 422);
      const connected = !!st.data?.connected;
      let qr: string | null = null;
      if (!connected) {
        const q = await zapi(conn, "/qr-code/image");
        const v = q.ok ? (q.data?.value ?? null) : null;
        if (typeof v === "string" && v) qr = v.startsWith("data:") ? v : `data:image/png;base64,${v}`;
      }
      return json({ ok: true, connected, smartphone_connected: st.data?.smartphoneConnected ?? null, qr, error: st.data?.error ?? null });
    }

    if (action === "status") {
      const { data: conn } = await admin.from("whatsapp_cloud_connections").select("phone_number_id, waba_id, access_token").eq("agency_id", agencyId).maybeSingle();
      if (!conn) return json({ error: "O WhatsApp ainda não está conectado." }, 409);
      const info = await graph(`/${conn.phone_number_id}?fields=display_phone_number,verified_name,status,code_verification_status,platform_type,quality_rating`, conn.access_token);
      if (!info.ok) return json({ error: `A Meta recusou a consulta: ${metaError(info.data, "falha ao consultar")}` }, 422);
      let subscribedApps: string[] | null = null;
      if (conn.waba_id) {
        const sub = await graph(`/${conn.waba_id}/subscribed_apps`, conn.access_token);
        if (sub.ok) subscribedApps = (sub.data?.data ?? []).map((a: any) => String(a?.whatsapp_business_api_data?.name ?? a?.name ?? a?.id ?? "app"));
      }
      return json({
        ok: true,
        phone: {
          status: info.data?.status ?? null, code_verification_status: info.data?.code_verification_status ?? null,
          platform_type: info.data?.platform_type ?? null, quality_rating: info.data?.quality_rating ?? null,
        },
        subscribed_apps: subscribedApps,
      });
    }

    if (action === "request_code" || action === "verify_code") {
      const { data: conn } = await admin.from("whatsapp_cloud_connections").select("phone_number_id, access_token").eq("agency_id", agencyId).maybeSingle();
      if (!conn) return json({ error: "O WhatsApp ainda não está conectado." }, 409);
      if (action === "request_code") {
        const method = body.method === "VOICE" ? "VOICE" : "SMS";
        const r = await graph(`/${conn.phone_number_id}/request_code`, conn.access_token, { method: "POST", body: JSON.stringify({ code_method: method, language: "pt_BR" }) });
        if (!r.ok) return json({ error: `A Meta recusou o pedido de código: ${metaError(r.data, "falha ao pedir o código")}` }, 422);
        return json({ ok: true });
      }
      const code = String(body.code ?? "").replace(/\D/g, "");
      if (code.length !== 6) return json({ error: "O código tem 6 números." }, 400);
      const r = await graph(`/${conn.phone_number_id}/verify_code`, conn.access_token, { method: "POST", body: JSON.stringify({ code }) });
      if (!r.ok) return json({ error: `A Meta recusou o código: ${metaError(r.data, "código inválido")}` }, 422);
      return json({ ok: true });
    }

    if (action === "register") {
      const pin = String(body.pin ?? "").replace(/\D/g, "");
      if (pin.length !== 6) return json({ error: "O PIN precisa ter 6 números." }, 400);
      const { data: conn } = await admin.from("whatsapp_cloud_connections").select("phone_number_id, access_token").eq("agency_id", agencyId).maybeSingle();
      if (!conn) return json({ error: "O WhatsApp ainda não está conectado." }, 409);
      const r = await graph(`/${conn.phone_number_id}/register`, conn.access_token, { method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", pin }) });
      if (!r.ok) return json({ error: `A Meta recusou o registro: ${metaError(r.data, "falha ao registrar")}` }, 422);
      return json({ ok: true });
    }

    if (action === "send_audio") {
      const digits = String(body.phone ?? "").replace(/\D/g, "");
      const b64 = String(body.audio ?? "").replace(/^data:[^,]*,/, "");
      const seconds = Math.max(1, Math.min(600, Math.round(Number(body.seconds)) || 1));
      if (!digits || !b64) return json({ error: "invalid_request" }, 400);
      if (b64.length > 9_000_000) return json({ error: "O áudio ficou grande demais. Grave um mais curto." }, 413);
      const to = digits.length <= 11 ? `55${digits}` : digits;
      const label = `🎤 Áudio (${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")})`;
      const saveMessage = (messageId: string | null, provider: string) => admin.from("whatsapp_messages").insert({
        contact_phone: to, direction: "out", body: label, media_type: "audio", status: "sent", source_type: "manual", agency_id: agencyId,
        sent_by_user_id: userId, zapi_message_id: messageId, raw: { provider, seconds },
      });

      const { data: zc } = await admin.from("whatsapp_zapi_connections").select("instance_id, instance_token, client_token").eq("agency_id", agencyId).maybeSingle();
      if (zc) {
        const z = await zapi(zc, "/send-audio", { method: "POST", body: JSON.stringify({ phone: to, audio: `data:audio/mpeg;base64,${b64}`, waveform: true }) });
        if (!z.ok || !(z.data?.messageId ?? z.data?.id)) return json({ error: zapiError(z.data, "falha no envio do áudio pelo Z-API") }, 422);
        await saveMessage(z.data?.messageId ?? z.data?.id ?? null, "zapi");
        return json({ ok: true });
      }

      const { data: conn } = await admin.from("whatsapp_cloud_connections").select("phone_number_id, access_token").eq("agency_id", agencyId).maybeSingle();
      if (!conn) return json({ error: "O WhatsApp ainda não está conectado." }, 409);
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append("messaging_product", "whatsapp");
      form.append("type", "audio/mpeg");
      form.append("file", new Blob([bytes], { type: "audio/mpeg" }), "audio.mp3");
      const upRes = await fetch(`${GRAPH}/${conn.phone_number_id}/media`, { method: "POST", headers: { Authorization: `Bearer ${conn.access_token}` }, body: form });
      const up: any = await upRes.json().catch(() => null);
      if (!upRes.ok || !up?.id) return json({ error: `A Meta recusou o áudio: ${metaError(up, "falha ao enviar o arquivo")}` }, 422);
      const r = await graph(`/${conn.phone_number_id}/messages`, conn.access_token, {
        method: "POST", body: JSON.stringify({ messaging_product: "whatsapp", to, type: "audio", audio: { id: up.id } }),
      });
      if (!r.ok) {
        const code = r.data?.error?.code;
        return json({ error: code === 131047 ? "Passaram mais de 24h desde a última mensagem do lead: só dá para responder com um modelo aprovado pela Meta." : metaError(r.data, "falha no envio do áudio") }, 422);
      }
      await saveMessage(r.data?.messages?.[0]?.id ?? null, "cloud");
      return json({ ok: true });
    }

    if (action === "send") {
      const digits = String(body.phone ?? "").replace(/\D/g, "");
      const msg = String(body.text ?? "").trim();
      if (!digits || !msg) return json({ error: "invalid_request" }, 400);
      const to = digits.length <= 11 ? `55${digits}` : digits;
      const { data: zc } = await admin.from("whatsapp_zapi_connections").select("instance_id, instance_token, client_token").eq("agency_id", agencyId).maybeSingle();
      if (zc) {
        const z = await zapi(zc, "/send-text", { method: "POST", body: JSON.stringify({ phone: to, message: msg }) });
        if (!z.ok || !(z.data?.messageId ?? z.data?.id)) return json({ error: zapiError(z.data, "falha no envio pelo Z-API") }, 422);
        await admin.from("whatsapp_messages").insert({
          contact_phone: to, direction: "out", body: msg, status: "sent", source_type: "manual", agency_id: agencyId,
          sent_by_user_id: userId, zapi_message_id: z.data?.messageId ?? z.data?.id ?? null, raw: { provider: "zapi" },
        });
        return json({ ok: true });
      }
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
