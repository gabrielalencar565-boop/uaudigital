// Sends the WhatsApp messages queued by the new CRM's automation engine (whatsapp_outbox.notification_type = 'crm_automation')
// through the agency's WhatsApp connection (the unofficial Z-API one when it exists, otherwise the Cloud API). Called by the database right after it queues a message.
// Public endpoint (no JWT): it only delivers rows already in the queue and exposes nothing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { data: rows } = await admin
    .from("whatsapp_outbox")
    .select("id, agency_id, target_phone, message, source_ref")
    .eq("status", "queued")
    .eq("notification_type", "crm_automation")
    .order("created_at", { ascending: true })
    .limit(25);

  let sent = 0;
  for (const row of rows ?? []) {
    const claim = await admin.from("whatsapp_outbox").update({ status: "processing", attempts: 1 }).eq("id", row.id).eq("status", "queued").select("id").maybeSingle();
    if (!claim.data) continue;

    const fail = async (reason: string) => {
      await admin.from("whatsapp_outbox").update({ status: "failed", processed_at: new Date().toISOString(), last_error: reason.slice(0, 300) }).eq("id", row.id);
      await admin.rpc("comercial_wa_failed", { p_ref: row.source_ref, p_error: reason });
    };

    const digits = String(row.target_phone ?? "").replace(/\D/g, "");
    if (!digits) { await fail("telefone inválido"); continue; }
    const to = digits.length <= 11 ? `55${digits}` : digits;

    const { data: zc } = await admin.from("whatsapp_zapi_connections").select("instance_id, instance_token, client_token").eq("agency_id", row.agency_id).maybeSingle();
    if (zc) {
      try {
        const zres = await fetch(`https://api.z-api.io/instances/${encodeURIComponent(zc.instance_id)}/token/${encodeURIComponent(zc.instance_token)}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(zc.client_token ? { "Client-Token": zc.client_token } : {}) },
          body: JSON.stringify({ phone: to, message: row.message }),
        });
        const zdata: any = await zres.json().catch(() => null);
        if (!zres.ok || !(zdata?.messageId ?? zdata?.id)) { await fail(String(zdata?.error ?? zdata?.message ?? zres.status)); continue; }
        await admin.from("whatsapp_messages").insert({
          contact_phone: to, direction: "out", body: row.message, status: "sent", source_type: "automation", source_ref: row.source_ref,
          agency_id: row.agency_id, zapi_message_id: zdata?.messageId ?? zdata?.id ?? null, raw: { provider: "zapi" },
        });
        await admin.from("whatsapp_outbox").update({ status: "done", processed_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
        sent++;
      } catch (e) {
        await fail(e instanceof Error ? e.message : String(e));
      }
      continue;
    }

    const { data: conn } = await admin.from("whatsapp_cloud_connections").select("phone_number_id, access_token").eq("agency_id", row.agency_id).maybeSingle();
    if (!conn) { await fail("o WhatsApp não está conectado"); continue; }

    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${conn.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${conn.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: row.message, preview_url: true } }),
      });
      const data: any = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.error?.code;
        await fail(code === 131047
          ? "passaram mais de 24h desde a última mensagem do lead (só dá para enviar com modelo aprovado pela Meta)"
          : String(data?.error?.message ?? res.status));
        continue;
      }
      await admin.from("whatsapp_messages").insert({
        contact_phone: to, direction: "out", body: row.message, status: "sent", source_type: "automation", source_ref: row.source_ref,
        agency_id: row.agency_id, zapi_message_id: data?.messages?.[0]?.id ?? null, raw: { provider: "cloud" },
      });
      await admin.from("whatsapp_outbox").update({ status: "done", processed_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
      sent++;
    } catch (e) {
      await fail(e instanceof Error ? e.message : String(e));
    }
  }
  return json({ ok: true, sent });
});
