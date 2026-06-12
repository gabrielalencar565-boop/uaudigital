// Z-API webhook receiver — stores inbound (and echoed outbound) messages
// into public.whatsapp_messages. Public endpoint (no JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function isGroupId(raw: string): boolean {
  const s = String(raw ?? "").toLowerCase().trim();
  return s.includes("-") || s.endsWith("@g.us");
}

function normalizePhoneOrGroup(raw: string): string {
  const s = String(raw ?? "").trim();
  if (isGroupId(s)) return s.toLowerCase().replace(/@g\.us$/, "");
  return s.replace(/\D/g, "");
}

function phoneKey(raw: string): string | null {
  const s = String(raw ?? "");
  if (isGroupId(s)) return s.toLowerCase().trim().replace(/@g\.us$/, "");
  const digits = s.replace(/\D/g, "");
  return digits ? digits.slice(-10) : null;
}

function pickBody(p: any): { body: string | null; media_url: string | null; media_type: string | null } {
  if (typeof p?.text?.message === "string") return { body: p.text.message, media_url: null, media_type: null };
  if (typeof p?.message === "string") return { body: p.message, media_url: null, media_type: null };
  if (p?.image?.imageUrl) return { body: p.image.caption ?? null, media_url: p.image.imageUrl, media_type: "image" };
  if (p?.audio?.audioUrl) return { body: null, media_url: p.audio.audioUrl, media_type: "audio" };
  if (p?.video?.videoUrl) return { body: p?.video?.caption ?? null, media_url: p.video.videoUrl, media_type: "video" };
  if (p?.document?.documentUrl) return { body: p.document?.fileName ?? null, media_url: p.document.documentUrl, media_type: "document" };
  if (p?.sticker?.stickerUrl) return { body: null, media_url: p.sticker.stickerUrl, media_type: "sticker" };
  return { body: null, media_url: null, media_type: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }

  let payload: any = null;
  try { payload = await req.json(); } catch { payload = null; }
  if (!payload) return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });

  try {
    const phoneRaw: string | undefined =
      payload.chatId ?? payload.groupId ?? payload.phone ?? payload.from ?? payload.connectedPhone;
    if (!phoneRaw) {
      return new Response(JSON.stringify({ ok: true, ignored: "no_phone" }), { headers: corsHeaders });
    }
    const groupFlag = !!(payload.isGroup || payload.isGroupMsg || isGroupId(String(phoneRaw)));
    const phone = groupFlag ? normalizePhoneOrGroup(String(phoneRaw)) : String(phoneRaw).replace(/\D/g, "");
    const key = phoneKey(phone);
    const fromMe = !!payload.fromMe;
    // For groups, the contact represents the group itself, so prefer the group name (chatName).
    // For 1:1, prefer senderName.
    const contactName: string | null = groupFlag
      ? (payload.chatName ?? payload.groupName ?? payload.senderName ?? null)
      : (payload.senderName ?? payload.chatName ?? null);
    const photoUrl: string | null =
      (groupFlag ? (payload.groupPhoto ?? payload.chat?.photo) : null) ??
      payload.senderPhoto ??
      payload.photo ??
      payload.profilePicture ??
      payload.senderPhotoUrl ??
      payload.chat?.photo ??
      payload.contact?.photo ??
      null;
    const { body, media_url, media_type } = pickBody(payload);
    const zapiMessageId = payload.messageId ?? payload.id ?? null;

    // Dedup by zapi_message_id when available
    if (zapiMessageId) {
      const { data: existing } = await admin
        .from("whatsapp_messages")
        .select("id")
        .eq("zapi_message_id", zapiMessageId)
        .maybeSingle();
      if (existing) return new Response(JSON.stringify({ ok: true, dedup: true }), { headers: corsHeaders });
    }

    await admin.from("whatsapp_messages").insert({
      contact_phone: phone,
      direction: fromMe ? "out" : "in",
      body, media_url, media_type,
      zapi_message_id: zapiMessageId,
      status: fromMe ? "sent" : "received",
      source_type: "webhook",
      raw: payload,
    });

    if (key) {
      // For groups, force origin='grupo' and overwrite name with the group name.
      if (groupFlag) {
        const patch: Record<string, unknown> = { origin: "grupo" };
        if (contactName) patch.name = contactName;
        await admin.from("whatsapp_contacts").update(patch).eq("phone_key", key);
      } else if (contactName) {
        await admin
          .from("whatsapp_contacts")
          .update({ name: contactName })
          .eq("phone_key", key)
          .is("name", null);
      }
    }
    if (key && photoUrl) {
      await admin
        .from("whatsapp_contacts")
        .update({ profile_pic_url: photoUrl })
        .eq("phone_key", key);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-webhook error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
