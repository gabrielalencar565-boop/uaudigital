// WhatsApp Business Cloud API (Meta) webhook. Public endpoint (no JWT): Meta calls it.
//   GET  ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...  → echoes the challenge when the token belongs to a connection
//   POST { entry: [{ changes: [{ value: { metadata, contacts, messages, statuses } }] }] }
//        → verifies X-Hub-Signature-256 with the connection's app secret, stores inbound messages in public.whatsapp_messages
//          (the database trigger creates/updates the lead in the new CRM) and updates delivery status of sent messages.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const MEDIA_LABEL: Record<string, string> = {
  image: "[Imagem]", video: "[Vídeo]", audio: "[Áudio]", document: "[Documento]", sticker: "[Figurinha]", location: "[Localização]", contacts: "[Contato]",
};

function pickBody(m: any): { body: string | null; media_type: string | null; media_id: string | null } {
  const t = String(m?.type ?? "");
  if (t === "text") return { body: m.text?.body ?? null, media_type: null, media_id: null };
  if (t === "button") return { body: m.button?.text ?? m.button?.payload ?? null, media_type: null, media_id: null };
  if (t === "interactive") {
    const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
    return { body: r?.title ?? null, media_type: null, media_id: null };
  }
  if (["image", "video", "audio", "document", "sticker"].includes(t)) {
    const media = m[t] ?? {};
    return { body: media.caption ?? media.filename ?? MEDIA_LABEL[t], media_type: t, media_id: media.id ?? null };
  }
  if (MEDIA_LABEL[t]) return { body: MEDIA_LABEL[t], media_type: t, media_id: null };
  return { body: null, media_type: null, media_id: null };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token") ?? "";
    const challenge = url.searchParams.get("hub.challenge") ?? "";
    if (mode !== "subscribe" || !token) return text("forbidden", 403);
    const { data } = await admin.from("whatsapp_cloud_connections").select("agency_id").eq("verify_token", token).maybeSingle();
    return data ? text(challenge) : text("forbidden", 403);
  }
  if (req.method !== "POST") return text("ok");

  const raw = await req.text();
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return text("ok"); }
  if (payload?.object !== "whatsapp_business_account") return text("ok");

  const signature = (req.headers.get("x-hub-signature-256") ?? "").replace(/^sha256=/, "");

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const phoneNumberId = String(value.metadata?.phone_number_id ?? "");
        if (!phoneNumberId) continue;
        const { data: conn } = await admin
          .from("whatsapp_cloud_connections").select("agency_id, app_secret").eq("phone_number_id", phoneNumberId).maybeSingle();
        if (!conn) continue;
        const expected = await hmacHex(conn.app_secret, raw);
        if (!signature || !safeEqual(signature, expected)) return text("invalid signature", 401);

        const names = new Map<string, string>();
        for (const c of value.contacts ?? []) if (c?.wa_id && c?.profile?.name) names.set(String(c.wa_id), String(c.profile.name));

        for (const m of value.messages ?? []) {
          const from = String(m.from ?? "").replace(/\D/g, "");
          const wamid = m.id ? String(m.id) : null;
          if (!from || !wamid || m.type === "reaction") continue;
          const { data: existing } = await admin.from("whatsapp_messages").select("id").eq("zapi_message_id", wamid).maybeSingle();
          if (existing) continue;
          const { body, media_type, media_id } = pickBody(m);
          const profileName = names.get(String(m.from)) ?? null;
          const ts = Number(m.timestamp);
          const { error } = await admin.from("whatsapp_messages").insert({
            contact_phone: from, direction: "in", body, media_type, zapi_message_id: wamid,
            status: "received", source_type: "webhook", agency_id: conn.agency_id,
            raw: { provider: "cloud", type: m.type, profile_name: profileName, media_id },
            ...(ts ? { created_at: new Date(ts * 1000).toISOString() } : {}),
          });
          if (error) { console.error("insert message:", error.message); continue; }
          if (profileName) {
            await admin.from("whatsapp_contacts").update({ name: profileName }).eq("agency_id", conn.agency_id).eq("phone_key", await keyOf(from)).is("name", null);
          }
        }

        for (const s of value.statuses ?? []) {
          const wamid = s?.id ? String(s.id) : null;
          const status = String(s?.status ?? "");
          if (!wamid || !["sent", "delivered", "read", "failed"].includes(status)) continue;
          await admin.from("whatsapp_messages").update({ status }).eq("zapi_message_id", wamid).eq("agency_id", conn.agency_id);
          if (status === "failed") {
            const err = s.errors?.[0];
            await admin.from("whatsapp_cloud_connections").update({ last_error: `${err?.code ?? ""} ${err?.title ?? err?.message ?? "falha no envio"}`.trim() }).eq("agency_id", conn.agency_id);
          }
        }
      }
    }
  } catch (e) {
    console.error("whatsapp-cloud-webhook error:", e instanceof Error ? e.message : e);
  }
  return text("ok");
});

async function keyOf(phone: string): Promise<string> {
  const { data } = await admin.rpc("whatsapp_phone_key", { _raw: phone });
  return String(data ?? phone);
}
