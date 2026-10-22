// Z-API (unofficial WhatsApp, QR code) webhook for the CRM. Public endpoint (no JWT): Z-API calls it.
//   POST ?k=<webhook_key>   the key identifies the agency's connection (public.whatsapp_zapi_connections)
// Stores inbound messages (and the ones sent from the phone itself) in public.whatsapp_messages — the database trigger creates or updates the
// lead — and updates the delivery status of sent messages. Groups, status updates and broadcasts are ignored: the CRM only handles leads.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ok = (extra: Record<string, unknown> = {}) => new Response(JSON.stringify({ ok: true, ...extra }), { headers: { "Content-Type": "application/json" } });

function pickBody(p: any): { body: string | null; media_url: string | null; media_type: string | null } {
  if (typeof p?.text?.message === "string") return { body: p.text.message, media_url: null, media_type: null };
  if (p?.image?.imageUrl) return { body: p.image.caption ?? "[Imagem]", media_url: p.image.imageUrl, media_type: "image" };
  if (p?.audio?.audioUrl) return { body: "[Áudio]", media_url: p.audio.audioUrl, media_type: "audio" };
  if (p?.video?.videoUrl) return { body: p.video.caption ?? "[Vídeo]", media_url: p.video.videoUrl, media_type: "video" };
  if (p?.document?.documentUrl) return { body: p.document.fileName ?? "[Documento]", media_url: p.document.documentUrl, media_type: "document" };
  if (p?.sticker?.stickerUrl) return { body: "[Figurinha]", media_url: p.sticker.stickerUrl, media_type: "sticker" };
  if (p?.location) return { body: "[Localização]", media_url: null, media_type: "location" };
  if (p?.contact) return { body: "[Contato]", media_url: null, media_type: "contact" };
  if (typeof p?.reaction?.value === "string") return { body: null, media_url: null, media_type: "reaction" };
  return { body: null, media_url: null, media_type: null };
}

const STATUS: Record<string, string> = { SENT: "sent", RECEIVED: "delivered", READ: "read", PLAYED: "read" };

// Short diary of the calls (last 50) to diagnose why a message did or did not show up; no message text is kept.
async function note(agencyId: string | null, outcome: string, p: any) {
  try {
    const summary = p ? {
      type: p.type ?? null, phone: p.phone ?? null, fromMe: p.fromMe ?? null, isGroup: p.isGroup ?? null, messageId: p.messageId ?? null,
      chatLid: p.chatLid ?? null, status: p.status ?? null, keys: Object.keys(p).slice(0, 40),
    } : null;
    await admin.from("whatsapp_zapi_events").insert({ agency_id: agencyId, outcome, summary });
    const { data: old } = await admin.from("whatsapp_zapi_events").select("id").order("id", { ascending: false }).range(50, 50).maybeSingle();
    if (old) await admin.from("whatsapp_zapi_events").delete().lte("id", old.id);
  } catch { /* o diário nunca atrapalha o webhook */ }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok();
  const key = new URL(req.url).searchParams.get("k") ?? "";
  if (!key) { await note(null, "forbidden:sem_chave", null); return new Response("forbidden", { status: 403 }); }
  const { data: conn } = await admin.from("whatsapp_zapi_connections").select("agency_id").eq("webhook_key", key).maybeSingle();
  if (!conn) { await note(null, "forbidden:chave_invalida", null); return new Response("forbidden", { status: 403 }); }

  let p: any = null;
  try { p = await req.json(); } catch { await note(conn.agency_id, "ignorado:json_invalido", null); return ok(); }
  if (!p) { await note(conn.agency_id, "ignorado:vazio", null); return ok(); }

  let outcome = "guardada";
  try {
    if (p.type === "MessageStatusCallback") {
      outcome = "status";
      const status = STATUS[String(p.status ?? "").toUpperCase()];
      if (status) for (const id of p.ids ?? []) await admin.from("whatsapp_messages").update({ status }).eq("zapi_message_id", String(id)).eq("agency_id", conn.agency_id);
      return ok();
    }
    if (p.type !== "ReceivedCallback") { outcome = `ignorado:tipo_${p.type ?? "desconhecido"}`; return ok({ ignored: p.type ?? "unknown" }); }
    if (p.isGroup || p.isStatusReply || p.isStatus || p.isNewsletter || p.broadcast || p.waitingMessage) { outcome = "ignorado:grupo_status_ou_transmissao"; return ok({ ignored: "not_a_lead_chat" }); }

    const raw = String(p.phone ?? "");
    if (raw.includes("-")) { outcome = "ignorado:id_interno"; return ok({ ignored: "internal_id" }); }
    // O que o celular envia chega com o LID do contato no lugar do número ("1234@lid"); o número vem nas mensagens recebidas
    // (phone + chatLid juntos). Aprende o par aqui e usa quando só o LID aparece.
    const lid = String(p.chatLid ?? (raw.includes("@lid") ? raw : "")).trim();
    let phone = "";
    if (raw.includes("@lid")) {
      if (lid) {
        const { data: map } = await admin.from("whatsapp_zapi_lids").select("phone").eq("agency_id", conn.agency_id).eq("lid", lid).maybeSingle();
        phone = map?.phone ?? "";
      }
      if (!phone) {
        // Follow-up mandado do celular para alguém que ainda não conhecemos: guarda o código para reconhecer a resposta depois
        if (p.fromMe && lid) {
          const nowIso = new Date().toISOString();
          const { data: prev } = await admin.from("whatsapp_zapi_outreach").select("lid").eq("agency_id", conn.agency_id).eq("lid", lid).maybeSingle();
          if (prev) await admin.from("whatsapp_zapi_outreach").update({ last_at: nowIso }).eq("agency_id", conn.agency_id).eq("lid", lid);
          else await admin.from("whatsapp_zapi_outreach").insert({ agency_id: conn.agency_id, lid, first_at: nowIso, last_at: nowIso });
        }
        outcome = "ignorado:lid_sem_numero";
        return ok({ ignored: "unmapped_lid" });
      }
    } else {
      phone = raw.replace(/\D/g, "");
      if (lid && phone && phone.length <= 15) {
        await admin.from("whatsapp_zapi_lids").upsert({ agency_id: conn.agency_id, lid, phone, updated_at: new Date().toISOString() }, { onConflict: "agency_id,lid" });
      }
    }
    if (!phone || phone.length > 15) { outcome = "ignorado:telefone_invalido"; return ok({ ignored: "bad_phone" }); }

    const messageId = p.messageId ? String(p.messageId) : null;
    if (messageId) {
      const { data: existing } = await admin.from("whatsapp_messages").select("id").eq("zapi_message_id", messageId).maybeSingle();
      if (existing) { outcome = "ignorado:repetida"; return ok({ dedup: true }); }
    }

    // Quem responde a um follow-up nosso (mandado antes, só com o código interno) não é contato novo: a mensagem leva essa marca
    let afterOutreach = false;
    if (!p.fromMe && lid) {
      const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
      const { data: o } = await admin.from("whatsapp_zapi_outreach").select("lid").eq("agency_id", conn.agency_id).eq("lid", lid).gte("last_at", since).maybeSingle();
      afterOutreach = !!o;
    }

    const { body, media_url, media_type } = pickBody(p);
    if (media_type === "reaction" || (!body && !media_url)) { outcome = "ignorado:sem_conteudo"; return ok({ ignored: "empty" }); }
    const fromMe = !!p.fromMe;
    const ts = Number(p.momment);

    const { error } = await admin.from("whatsapp_messages").insert({
      contact_phone: phone, direction: fromMe ? "out" : "in", body, media_url, media_type, zapi_message_id: messageId,
      status: fromMe ? "sent" : "received", source_type: fromMe ? "manual" : "webhook", agency_id: conn.agency_id,
      raw: { provider: "zapi", type: p.type, profile_name: fromMe ? null : (p.senderName ?? p.chatName ?? null), ...(afterOutreach ? { after_outreach: true } : {}) },
      ...(ts ? { created_at: new Date(ts).toISOString() } : {}),
    });
    if (error) { outcome = `erro:insert_${error.message.slice(0, 80)}`; console.error("insert message:", error.message); return ok({ error: "insert_failed" }); }

    const name = !fromMe ? (p.senderName ?? p.chatName ?? null) : null;
    if (name) {
      const { data: key2 } = await admin.rpc("whatsapp_phone_key", { _raw: phone });
      await admin.from("whatsapp_contacts").update({ name: String(name) }).eq("agency_id", conn.agency_id).eq("phone_key", String(key2 ?? phone)).is("name", null);
    }
  } catch (e) {
    outcome = `erro:${e instanceof Error ? e.message.slice(0, 80) : "desconhecido"}`;
    console.error("whatsapp-zapi-webhook error:", e instanceof Error ? e.message : e);
  } finally {
    await note(conn.agency_id, outcome, p);
  }
  return ok();
});
