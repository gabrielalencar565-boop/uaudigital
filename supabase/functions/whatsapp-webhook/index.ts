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

// A chat is a group when:
// - Z-API flags it (isGroup / isGroupMsg)
// - the raw id ends with @g.us
// - the raw id contains a '-' (legacy <creator>-<timestamp>)
// - the digits-only id is longer than 15 (E.164 max), e.g. 120363... new groups
function isGroupId(raw: string, flag?: boolean): boolean {
  if (flag) return true;
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return false;
  if (s.endsWith("@lid") || s.endsWith("-lid")) return false;
  if (s.endsWith("@g.us")) return true;
  if (s.includes("-")) return true;
  const digits = s.replace(/\D/g, "");
  return digits.length > 15;
}

function isLidId(raw: string): boolean {
  return String(raw ?? "").toLowerCase().trim().endsWith("@lid");
}

// Returns the canonical identifier used both as contact_phone and contact_phone_key.
function canonicalId(raw: string, isGroup: boolean): string {
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return "";
  if (isGroup) {
    // Legacy format already has '-' — strip @g.us only.
    if (s.includes("-") && !s.endsWith("@g.us")) return s.replace(/@g\.us$/, "");
    const digits = s.replace(/\D/g, "");
    return digits ? `${digits}-group` : "";
  }
  if (isLidId(s)) {
    const digits = s.replace(/\D/g, "");
    return digits ? `${digits}-lid` : "";
  }
  return s.replace(/\D/g, "");
}

function isLidLikeKey(key: string | null | undefined, chatLid?: string | null): boolean {
  const k = String(key ?? "").toLowerCase().trim();
  if (!k) return false;
  if (k.endsWith("-lid")) return true;
  const lidDigits = String(chatLid ?? "").replace(/\D/g, "");
  return !!lidDigits && (k === lidDigits || k === lidDigits.slice(-10));
}

async function resolveKnownContactByLid(chatLid?: string | null, currentKey?: string | null) {
  if (!chatLid) return null;
  const { data: rows } = await admin
    .from("whatsapp_messages")
    .select("contact_phone_key")
    .eq("raw->>chatLid", chatLid)
    .not("contact_phone_key", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const knownKey = (rows ?? [])
    .map((row: any) => String(row.contact_phone_key ?? ""))
    .find((key) => key && key !== currentKey && !isLidLikeKey(key, chatLid));
  if (!knownKey) return null;

  const { data: contact } = await admin
    .from("whatsapp_contacts")
    .select("phone_e164,phone_key")
    .eq("phone_key", knownKey)
    .maybeSingle();

  return contact?.phone_e164 ? String(contact.phone_e164) : knownKey;
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
    // Prefer the chat identifier (group id for groups, phone for 1:1).
    // For groups the participant id may appear in `participant`/`senderPhone`; never use it as the chat key.
    const groupFlag = !!(payload.isGroup || payload.isGroupMsg);
    const rawChat: string | undefined =
      payload.chatId ?? payload.groupId ?? (groupFlag ? payload.phone : undefined) ?? payload.phone ?? payload.from ?? payload.connectedPhone;
    if (!rawChat) {
      return new Response(JSON.stringify({ ok: true, ignored: "no_phone" }), { headers: corsHeaders });
    }
    const isGroup = isGroupId(String(rawChat), groupFlag);
    let canonical = canonicalId(String(rawChat), isGroup);
    if (!canonical) {
      return new Response(JSON.stringify({ ok: true, ignored: "empty_id" }), { headers: corsHeaders });
    }
    if (!isGroup) {
      const knownContact = await resolveKnownContactByLid(payload.chatLid ?? payload.lid ?? null, canonical);
      if (knownContact) canonical = knownContact;
    }
    const fromMe = !!payload.fromMe;

    // Name to display for the CONTACT (chat), never the sender of an outbound echo.
    const contactName: string | null = isGroup
      ? (payload.chatName ?? payload.groupName ?? null)
      : fromMe
        ? null // own messages echo our own senderName ("Uau Digital"); don't overwrite the contact
        : (payload.senderName ?? payload.chatName ?? null);

    const photoUrl: string | null = fromMe
      ? null
      : (isGroup ? (payload.groupPhoto ?? payload.chat?.photo) : null) ??
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
      contact_phone: canonical,
      direction: fromMe ? "out" : "in",
      body, media_url, media_type,
      zapi_message_id: zapiMessageId,
      status: fromMe ? "sent" : "received",
      source_type: "webhook",
      raw: payload,
    });

    // Upsert the contact (single row per chat). The trigger canonicalizes phone_e164/phone_key.
    const baseRow: Record<string, unknown> = {
      phone_e164: canonical,
      origin: isGroup ? "grupo" : undefined,
    };
    if (contactName) baseRow.name = contactName;
    if (photoUrl) baseRow.profile_pic_url = photoUrl;

    await admin
      .from("whatsapp_contacts")
      .upsert(baseRow, { onConflict: "phone_key", ignoreDuplicates: false });

    // For groups, always reflect the latest group name/photo.
    if (isGroup && (contactName || photoUrl)) {
      const patch: Record<string, unknown> = {};
      if (contactName) patch.name = contactName;
      if (photoUrl) patch.profile_pic_url = photoUrl;
      await admin.from("whatsapp_contacts").update(patch).eq("phone_key", canonical);
    } else if (!isGroup && !fromMe && contactName) {
      // For 1:1 inbound only: fill name if still empty (don't overwrite a manually edited one).
      await admin
        .from("whatsapp_contacts")
        .update({ name: contactName })
        .eq("phone_key", canonical)
        .is("name", null);
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
