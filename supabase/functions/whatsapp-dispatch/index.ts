// WhatsApp dispatcher — provider-agnostic
// Supports Evolution API and Z-API stubs. Configure via public.whatsapp_settings.
//
// Actions (POST body { action, ... }):
//   - "send"            { userId?, phone?, type, message }   (admin/service)
//   - "process_outbox"  { limit? }                            (service/cron)
//   - "cron_deadlines"  {}                                    (cron, daily)
//   - "cron_xp_ranking" {}                                    (cron, weekly)
//   - "broadcast"       { message }                           (admin)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizePhone(raw: string, defaultCountry: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // If it already starts with country code, keep it; otherwise prepend.
  if (digits.length >= 12) return digits;
  return defaultCountry + digits;
}

// ---------------------------------------------------------------------------
// Provider adapters — stubs ready for Evolution API and Z-API.
// Reads credentials from edge function secrets (configured via Lovable).
// ---------------------------------------------------------------------------
type SendResult = { ok: boolean; status: number; response: unknown };

async function sendViaEvolution(settings: any, phone: string, message: string): Promise<SendResult> {
  const apiKey = Deno.env.get(settings.api_key_secret || "WHATSAPP_API_KEY");
  if (!settings.base_url || !settings.instance_name || !apiKey) {
    return { ok: false, status: 0, response: { error: "evolution_not_configured" } };
  }
  const url = `${settings.base_url.replace(/\/$/, "")}/message/sendText/${encodeURIComponent(settings.instance_name)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: phone, text: message }),
  });
  let body: unknown;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { ok: res.ok, status: res.status, response: body };
}

async function sendViaZapi(settings: any, phone: string, message: string): Promise<SendResult> {
  const apiKey = Deno.env.get(settings.api_key_secret || "WHATSAPP_API_KEY");
  const clientToken = Deno.env.get(settings.zapi_client_token_secret || "WHATSAPP_ZAPI_CLIENT_TOKEN");
  const instance = settings.instance_name || Deno.env.get("WHATSAPP_ZAPI_INSTANCE_ID");
  if (!instance || !apiKey) {
    return { ok: false, status: 0, response: { error: "zapi_not_configured" } };
  }
  // Z-API URL pattern: https://api.z-api.io/instances/{instance}/token/{token}/send-text
  const baseUrl = settings.base_url?.replace(/\/$/, "") || "https://api.z-api.io";
  const url = `${baseUrl}/instances/${encodeURIComponent(instance)}/token/${encodeURIComponent(apiKey)}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone, message }),
  });
  let body: unknown;
  try { body = await res.json(); } catch { body = await res.text(); }
  return { ok: res.ok, status: res.status, response: body };
}

async function dispatchOne(
  settings: any,
  phone: string,
  message: string,
): Promise<SendResult> {
  if (settings.provider === "zapi") return sendViaZapi(settings, phone, message);
  return sendViaEvolution(settings, phone, message);
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
async function requireAdmin(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user?.id) return json({ error: "unauthorized" }, 401);
  const userId = data.user.id;
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);
  return { userId };
}

function isServiceCall(req: Request): boolean {
  // Cron and the DB trigger call us with the service-role key OR a shared secret header.
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`;
}

// ---------------------------------------------------------------------------
// Outbox processing
// ---------------------------------------------------------------------------
async function processOutbox(limit = 25) {
  const { data: settings } = await admin.from("whatsapp_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings || !settings.enabled) {
    return { processed: 0, reason: "disabled" };
  }

  const { data: rows, error } = await admin
    .from("whatsapp_outbox")
    .select("id, user_id, notification_type, message, source_ref")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  if (!rows || rows.length === 0) return { processed: 0 };

  let processed = 0;
  for (const row of rows) {
    // Mark processing first so concurrent calls don't double-send.
    const claim = await admin
      .from("whatsapp_outbox")
      .update({ status: "processing", attempts: 1 })
      .eq("id", row.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();
    if (!claim.data) continue;

    const { data: pref } = await admin
      .from("user_whatsapp_preferences")
      .select("phone_e164, enabled, notify_new_task, notify_deadline, notify_company, notify_xp_rank")
      .eq("user_id", row.user_id)
      .maybeSingle();

    if (!pref || !pref.enabled || !pref.phone_e164) {
      await admin.from("whatsapp_outbox").update({
        status: "done", processed_at: new Date().toISOString(), last_error: "user_disabled_or_missing_phone",
      }).eq("id", row.id);
      await admin.from("whatsapp_send_log").insert({
        user_id: row.user_id, phone_e164: pref?.phone_e164 ?? null,
        notification_type: row.notification_type, message: row.message,
        status: "skipped", provider: settings.provider, source_ref: row.source_ref,
        error_message: "user_disabled_or_missing_phone",
      });
      continue;
    }

    const phone = normalizePhone(pref.phone_e164, settings.default_country_code || "55");
    if (!phone) {
      await admin.from("whatsapp_outbox").update({
        status: "failed", processed_at: new Date().toISOString(), last_error: "invalid_phone",
      }).eq("id", row.id);
      continue;
    }

    try {
      const result = await dispatchOne(settings, phone, row.message);
      await admin.from("whatsapp_send_log").insert({
        user_id: row.user_id, phone_e164: phone,
        notification_type: row.notification_type, message: row.message,
        status: result.ok ? "sent" : "failed",
        provider: settings.provider, provider_response: result.response,
        error_message: result.ok ? null : String(result.status),
        source_ref: row.source_ref, sent_at: result.ok ? new Date().toISOString() : null,
      });
      await admin.from("whatsapp_outbox").update({
        status: result.ok ? "done" : "failed",
        processed_at: new Date().toISOString(),
        last_error: result.ok ? null : String(result.status),
      }).eq("id", row.id);
      if (result.ok) processed++;
    } catch (e) {
      await admin.from("whatsapp_outbox").update({
        status: "failed", processed_at: new Date().toISOString(),
        last_error: e instanceof Error ? e.message : String(e),
      }).eq("id", row.id);
    }
  }
  return { processed, total: rows.length };
}

// ---------------------------------------------------------------------------
// Cron orchestrators
// ---------------------------------------------------------------------------
async function cronDeadlines() {
  // Enqueue reminders for: due tomorrow, due today, overdue (1+ days).
  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: upcoming } = await admin
    .from("pm_tasks")
    .select("id, title, due_date, assignee_id, client_id")
    .is("deleted_at", null)
    .neq("status_global", "concluido")
    .not("assignee_id", "is", null)
    .in("due_date", [isoToday, tomorrow]);

  const { data: overdue } = await admin
    .from("pm_tasks")
    .select("id, title, due_date, assignee_id, client_id")
    .is("deleted_at", null)
    .neq("status_global", "concluido")
    .not("assignee_id", "is", null)
    .lt("due_date", isoToday);

  const rows = [
    ...(upcoming ?? []).map((t: any) => ({ ...t, _kind: t.due_date === isoToday ? "hoje" : "amanhã" })),
    ...(overdue ?? []).map((t: any) => ({ ...t, _kind: "atrasada" })),
  ];

  let enqueued = 0;
  for (const t of rows) {
    const due = t.due_date ? new Date(t.due_date).toLocaleDateString("pt-BR") : "—";
    const emoji = t._kind === "atrasada" ? "⚠️" : "⏰";
    const msg = `${emoji} Prazo ${t._kind}: ${t.title ?? "—"}\nVencimento: ${due}`;
    const { data: id } = await admin.rpc("whatsapp_enqueue", {
      _user_id: t.assignee_id, _type: "deadline", _message: msg, _source_ref: t.id,
    });
    if (id) enqueued++;
  }
  return { enqueued, scanned: rows.length };
}

async function cronXpRanking() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Top 3 by total monthly performance score.
  const { data } = await admin
    .from("performance_scores")
    .select("user_id, aprendizado_continuo, padrao_qualidade_uau, metas_prazos, ambiente_organizado, comprometimento")
    .eq("year", year)
    .eq("month", month);
  const ranked = (data ?? [])
    .map((r: any) => ({
      user_id: r.user_id,
      total: (r.aprendizado_continuo || 0) + (r.padrao_qualidade_uau || 0) + (r.metas_prazos || 0) +
             (r.ambiente_organizado || 0) + (r.comprometimento || 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  let enqueued = 0;
  for (let i = 0; i < ranked.length; i++) {
    const place = i + 1;
    const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉";
    const msg = `${medal} Ranking semanal — você está em ${place}º lugar com ${ranked[i].total.toFixed(1)} pontos. Continue assim!`;
    const { data: id } = await admin.rpc("whatsapp_enqueue", {
      _user_id: ranked[i].user_id, _type: "xp_rank", _message: msg, _source_ref: `rank_${year}_${month}_${place}`,
    });
    if (id) enqueued++;
  }
  return { enqueued };
}

async function broadcast(message: string, senderId: string) {
  const { data: users } = await admin
    .from("user_whatsapp_preferences")
    .select("user_id")
    .eq("enabled", true)
    .eq("notify_company", true)
    .not("phone_e164", "is", null);

  let enqueued = 0;
  for (const u of users ?? []) {
    const { data: id } = await admin.rpc("whatsapp_enqueue", {
      _user_id: u.user_id, _type: "company", _message: message, _source_ref: `bcast:${senderId}:${Date.now()}`,
    });
    if (id) enqueued++;
  }
  return { enqueued, recipients: users?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = String(payload?.action ?? "");

  try {
    // Service-role calls (cron / DB trigger) bypass admin check.
    const serviceCall = isServiceCall(req);

    if (action === "process_outbox") {
      if (!serviceCall) {
        const auth = await requireAdmin(req);
        if (auth instanceof Response) return auth;
      }
      const limit = Math.max(1, Math.min(100, Number(payload?.limit) || 25));
      const result = await processOutbox(limit);
      return json(result);
    }

    if (action === "cron_deadlines") {
      if (!serviceCall) {
        const auth = await requireAdmin(req);
        if (auth instanceof Response) return auth;
      }
      const r = await cronDeadlines();
      await processOutbox(100); // also drain immediately
      return json(r);
    }

    if (action === "cron_xp_ranking") {
      if (!serviceCall) {
        const auth = await requireAdmin(req);
        if (auth instanceof Response) return auth;
      }
      const r = await cronXpRanking();
      await processOutbox(100);
      return json(r);
    }

    if (action === "broadcast") {
      const auth = await requireAdmin(req);
      if (auth instanceof Response) return auth;
      const message = String(payload?.message ?? "").trim().slice(0, 1500);
      if (!message) return json({ error: "empty_message" }, 400);
      const r = await broadcast(message, auth.userId);
      await processOutbox(100);
      return json(r);
    }

    if (action === "send") {
      const auth = await requireAdmin(req);
      if (auth instanceof Response) return auth;
      const userId = payload?.userId ? String(payload.userId) : null;
      const directPhone = payload?.phone ? String(payload.phone) : null;
      const type = String(payload?.type ?? "manual");
      const message = String(payload?.message ?? "").trim().slice(0, 1500);
      if (!message) return json({ error: "empty_message" }, 400);

      const { data: settings } = await admin.from("whatsapp_settings").select("*").eq("id", 1).maybeSingle();
      if (!settings) return json({ error: "settings_missing" }, 400);
      if (!settings.enabled) return json({ error: "whatsapp_disabled" }, 400);

      let phone: string | null = null;
      if (directPhone) {
        phone = normalizePhone(directPhone, settings.default_country_code || "55");
      } else if (userId) {
        const { data: pref } = await admin
          .from("user_whatsapp_preferences")
          .select("phone_e164, enabled")
          .eq("user_id", userId)
          .maybeSingle();
        if (!pref?.enabled || !pref.phone_e164) return json({ error: "user_not_opted_in" }, 400);
        phone = normalizePhone(pref.phone_e164, settings.default_country_code || "55");
      }
      if (!phone) return json({ error: "invalid_phone" }, 400);

      const result = await dispatchOne(settings, phone, message);
      await admin.from("whatsapp_send_log").insert({
        user_id: userId, phone_e164: phone, notification_type: type, message,
        status: result.ok ? "sent" : "failed", provider: settings.provider,
        provider_response: result.response,
        error_message: result.ok ? null : String(result.status),
        sent_at: result.ok ? new Date().toISOString() : null,
      });
      return json({ ok: result.ok, status: result.status, response: result.response });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("whatsapp-dispatch error:", e);
    return json({ error: "internal_error", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
