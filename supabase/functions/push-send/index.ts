// Sends Web Push notifications (VAPID) to a user's subscribed devices. Two entry points:
//   - action "dispatch": one user, one notification — called by the pm_tasks/pm_comments
//     triggers (see 20260916205406_push_notifications_infra.sql) right after an
//     assignment or a @mention lands.
//   - action "daily_digest": scans everyone's due-today/overdue root tasks and sends one
//     summary push per person — called by a daily pg_cron job (X-Cron-Secret gated, see
//     project follow-up notes; registering the schedule itself is a manual dashboard step,
//     same pattern as instagram-publish's run_schedules/refresh_tokens).
// Both actions require X-Cron-Secret: "dispatch" takes an arbitrary user_id/title/body
// straight from the caller, so — unlike whatsapp-dispatch's process_outbox, which only
// flushes an already-validated queued row — an apikey-only call here would let anyone
// holding the public anon key spam any user with fake push notifications.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

// VAPID keys live in Vault (not Edge Function secrets — see get_vapid_config() in the
// same migration), fetched once per cold start.
let vapidReady: Promise<void> | null = null;
function ensureVapid(db: ReturnType<typeof createClient>) {
  if (!vapidReady) {
    vapidReady = (async () => {
      const { data, error } = await db.rpc("get_vapid_config");
      if (error) throw error;
      const cfg = (Array.isArray(data) ? data[0] : data) as { public_key: string; private_key: string; subject: string } | null;
      if (!cfg?.public_key || !cfg?.private_key) throw new Error("VAPID keys not configured in Vault");
      webpush.setVapidDetails(cfg.subject || "mailto:uaucomunicacaodigital@gmail.com", cfg.public_key, cfg.private_key);
    })();
  }
  return vapidReady;
}

type PushPayload = { title: string; body: string; task_id?: string };

async function sendToUser(db: ReturnType<typeof createClient>, userId: string, payload: PushPayload) {
  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId);
  if (error) throw error;
  if (!subs || subs.length === 0) return { sent: 0 };

  let sent = 0;
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify(payload),
        );
        sent++;
      } catch (e) {
        // 404/410 = the browser/OS dropped this subscription (uninstalled, expired,
        // permission revoked) — Meta's push services return these permanently, so
        // clean up instead of retrying forever.
        const statusCode = (e as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await db.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    }),
  );
  return { sent };
}

async function handleDispatch(db: ReturnType<typeof createClient>, body: { user_id?: string; title?: string; body?: string; task_id?: string }) {
  const { user_id, title, body: message, task_id } = body;
  if (!user_id || !title || !message) return json({ error: "user_id, title and body are required" }, 400);
  const result = await sendToUser(db, user_id, { title, body: message, task_id });
  return json(result);
}

async function handleDailyDigest(db: ReturnType<typeof createClient>) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: tasks, error } = await db
    .from("pm_tasks")
    .select("id, assignee_id, due_date")
    .is("parent_task_id", null)
    .is("deleted_at", null)
    .not("status_global", "in", "(concluido,cancelado)")
    .not("is_draft", "is", true)
    .not("due_date", "is", null)
    .lte("due_date", todayIso);
  if (error) throw error;

  const byUser = new Map<string, { overdue: number; today: number }>();
  for (const t of (tasks ?? []) as { assignee_id: string | null; due_date: string }[]) {
    if (!t.assignee_id) continue;
    const entry = byUser.get(t.assignee_id) ?? { overdue: 0, today: 0 };
    if (t.due_date === todayIso) entry.today++;
    else entry.overdue++;
    byUser.set(t.assignee_id, entry);
  }

  const results = await Promise.allSettled(
    Array.from(byUser.entries()).map(([userId, counts]) => {
      const parts: string[] = [];
      if (counts.overdue > 0) parts.push(`${counts.overdue} atrasada${counts.overdue > 1 ? "s" : ""}`);
      if (counts.today > 0) parts.push(`${counts.today} vencendo hoje`);
      return sendToUser(db, userId, { title: "Bora ver o que te espera hoje? 👀", body: `${parts.join(" e ")} — dá uma conferida!` });
    }),
  );

  return json({ users: byUser.size, sent: results.filter((r) => r.status === "fulfilled").length });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const db = admin();

    const cronSecret = req.headers.get("X-Cron-Secret");
    const { data: validSecret } = await db.rpc("verify_push_cron_secret", { candidate: cronSecret });
    if (!validSecret) return json({ error: "unauthorized" }, 401);

    await ensureVapid(db);

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action === "dispatch") return await handleDispatch(db, body);
    if (action === "daily_digest") return await handleDailyDigest(db);

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
