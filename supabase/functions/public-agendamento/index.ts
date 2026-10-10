// Public scheduling of "captação" (recording days) for the agency's clients. One shared link per agency
// (capture_settings.share_token); no login. The page only ever learns whether a day is free, full or closed —
// never who booked it. Actions (POST JSON, all carry the link's `token`):
//   load   { month: "YYYY-MM" }                       → agency name + the status of each day of the month
//   book   { date, period, company_name, whatsapp, … } → creates a pending booking (capacity is enforced by the DB)
//   get    { cancel_token }                           → status of one booking, for the person who made it
//   cancel { cancel_token }                           → cancels that booking
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODS = ["manha", "tarde"];
// Free text is trimmed and capped; control characters never reach the team's screens
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// "today" in Brazil, so the cut-off doesn't move at 21h with the server's UTC clock
function todayBR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// 0 = Sunday … 6 = Saturday
function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const token = String(payload?.token ?? "");
  const action = String(payload?.action ?? "");
  if (!UUID_RE.test(token)) return json({ error: "not_found" }, 404);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Same answer whether the link doesn't exist or was turned off
  const { data: settings } = await db
    .from("capture_settings")
    .select("agency_id, weekdays, capacity_per_day, min_lead_days, open_months")
    .eq("share_token", token)
    .eq("enabled", true)
    .maybeSingle();
  if (!settings) return json({ error: "not_found" }, 404);

  const agencyId = settings.agency_id as string;

  // Active load per date (bookings waiting for an answer count, so a pending request already holds its spot)
  async function loadByDate(from: string, to: string) {
    const [{ data: bookings }, { data: blocks }] = await Promise.all([
      db.from("capture_bookings").select("booking_date").eq("agency_id", agencyId).in("status", ["pending", "confirmed"]).gte("booking_date", from).lte("booking_date", to),
      db.from("capture_blocks").select("block_date").eq("agency_id", agencyId).gte("block_date", from).lte("block_date", to),
    ]);
    const taken = new Map<string, number>();
    for (const b of bookings ?? []) taken.set(b.booking_date, (taken.get(b.booking_date) ?? 0) + 1);
    const blocked = new Set((blocks ?? []).map((b: any) => b.block_date as string));
    return { taken, blocked };
  }

  function dayStatus(ymd: string, taken: Map<string, number>, blocked: Set<string>): "free" | "full" | "closed" {
    const lead = addDays(todayBR(), Number(settings!.min_lead_days));
    if (ymd < lead) return "closed";
    if (!(settings!.weekdays as number[]).includes(weekdayOf(ymd))) return "closed";
    if (!(settings!.open_months as string[]).includes(ymd.slice(0, 7))) return "closed";
    if (blocked.has(ymd)) return "closed";
    if ((taken.get(ymd) ?? 0) >= Number(settings!.capacity_per_day)) return "full";
    return "free";
  }

  try {
    if (action === "load") {
      const month = String(payload?.month ?? "");
      if (!MONTH_RE.test(month)) return json({ error: "invalid_month" }, 400);
      const { data: agency } = await db.from("agencies").select("name").eq("id", agencyId).maybeSingle();
      const [y, m] = month.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const from = `${month}-01`;
      const to = `${month}-${String(last).padStart(2, "0")}`;
      const { taken, blocked } = await loadByDate(from, to);
      const days: Record<string, "free" | "full" | "closed"> = {};
      for (let d = 1; d <= last; d++) {
        const ymd = `${month}-${String(d).padStart(2, "0")}`;
        days[ymd] = dayStatus(ymd, taken, blocked);
      }
      return json({ agency_name: agency?.name ?? "", open_months: settings.open_months, days });
    }

    if (action === "book") {
      // A hidden field real people never fill: bots do
      if (clean(payload?.website, 50)) return json({ ok: true });

      const date = String(payload?.date ?? "");
      const period = String(payload?.period ?? "");
      const company = clean(payload?.company_name, 120);
      const contact = clean(payload?.contact_name, 120);
      const whatsapp = String(payload?.whatsapp ?? "").replace(/\D/g, "");
      const location = clean(payload?.location, 300);
      const notes = clean(payload?.notes, 1000);

      if (!DATE_RE.test(date) || !PERIODS.includes(period)) return json({ error: "invalid_request" }, 400);
      if (!company) return json({ error: "company_required" }, 400);
      if (whatsapp.length < 10 || whatsapp.length > 13) return json({ error: "invalid_whatsapp" }, 400);

      const { taken, blocked } = await loadByDate(date, date);
      const status = dayStatus(date, taken, blocked);
      if (status === "closed") return json({ error: "day_closed" }, 409);
      if (status === "full") return json({ error: "day_full" }, 409);

      // Gentle limit: one phone can't hold more than 3 open requests at once
      const { count } = await db
        .from("capture_bookings")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("whatsapp", whatsapp)
        .in("status", ["pending", "confirmed"])
        .gte("booking_date", todayBR());
      if ((count ?? 0) >= 3) return json({ error: "too_many_requests" }, 429);

      const { data: created, error } = await db
        .from("capture_bookings")
        .insert({ agency_id: agencyId, booking_date: date, period, company_name: company, contact_name: contact || null, whatsapp, location: location || null, notes: notes || null })
        .select("cancel_token")
        .single();
      if (error) {
        if (error.message?.includes("day_full")) return json({ error: "day_full" }, 409);
        if (error.message?.includes("day_blocked")) return json({ error: "day_closed" }, 409);
        console.error("public-agendamento insert error:", error.message);
        return json({ error: "server_error" }, 500);
      }
      return json({ ok: true, cancel_token: created.cancel_token });
    }

    if (action === "get" || action === "cancel") {
      const cancelToken = String(payload?.cancel_token ?? "");
      if (!UUID_RE.test(cancelToken)) return json({ error: "not_found" }, 404);
      const { data: booking } = await db
        .from("capture_bookings")
        .select("id, booking_date, period, company_name, status")
        .eq("agency_id", agencyId)
        .eq("cancel_token", cancelToken)
        .maybeSingle();
      if (!booking) return json({ error: "not_found" }, 404);
      if (action === "get") return json({ booking });

      if (!["pending", "confirmed"].includes(booking.status)) return json({ error: "not_cancellable" }, 409);
      if (booking.booking_date < addDays(todayBR(), 1)) return json({ error: "too_late" }, 409);
      const { error } = await db.from("capture_bookings").update({ status: "cancelled", decided_at: new Date().toISOString() }).eq("id", booking.id);
      if (error) return json({ error: "server_error" }, 500);
      return json({ ok: true });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error("public-agendamento error:", e instanceof Error ? e.message : e);
    return json({ error: "server_error" }, 500);
  }
});
