import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const action = String(payload?.action ?? "");
  const token = String(payload?.token ?? "");
  if (!UUID_RE.test(token)) return json({ error: "invalid_token" }, 400);

  // Same generic error whether the token doesn't exist or is disabled, so a
  // caller can't tell those two cases apart.
  const { data: calendar } = await admin
    .from("publication_calendars")
    .select("id, client_id, cycle_start, cycle_end, status, updated_at")
    .eq("share_token", token)
    .eq("share_enabled", true)
    .maybeSingle();
  if (!calendar) return json({ error: "not_found" }, 404);

  try {
    if (action === "load") {
      const { data: client } = await admin.from("clients").select("name").eq("id", calendar.client_id).maybeSingle();

      const { data: pubs } = await admin
        .from("calendar_publications")
        .select("id, task_id, title, content_type, caption, publish_date, publish_time, status, client_note, client_feedback, order_index")
        .eq("calendar_id", calendar.id)
        .neq("status", "cancelada")
        .order("order_index", { ascending: true });

      const taskIds = [...new Set((pubs ?? []).map((p: any) => p.task_id))];
      const byTask = new Map<string, { url: string; type: string | null }[]>();
      if (taskIds.length > 0) {
        const { data: atts } = await admin
          .from("pm_attachments")
          .select("task_id, public_url, file_type, order_index")
          .in("task_id", taskIds)
          .order("order_index", { ascending: true });
        for (const a of (atts ?? []) as any[]) {
          if (!a.public_url) continue;
          const list = byTask.get(a.task_id) ?? [];
          list.push({ url: a.public_url, type: a.file_type });
          byTask.set(a.task_id, list);
        }
      }

      return json({
        clientName: client?.name ?? "Cliente",
        calendar: {
          cycleStart: calendar.cycle_start,
          cycleEnd: calendar.cycle_end,
          status: calendar.status,
          updatedAt: calendar.updated_at,
        },
        publications: (pubs ?? []).map(({ task_id, ...p }: any) => ({
          ...p,
          media: byTask.get(task_id) ?? [],
        })),
      });
    }

    if (action === "respond") {
      const publicationId = String(payload?.publicationId ?? "");
      const respAction = String(payload?.respAction ?? "");
      const text = payload?.text ? String(payload.text).slice(0, 2000) : null;
      if (!UUID_RE.test(publicationId)) return json({ error: "invalid_publicationId" }, 400);
      if (!["aprovar", "alteracao"].includes(respAction)) return json({ error: "invalid_action" }, 400);
      if (respAction === "alteracao" && !text?.trim()) return json({ error: "text_required" }, 400);

      const { data: pub } = await admin
        .from("calendar_publications")
        .select("id, calendar_id")
        .eq("id", publicationId)
        .maybeSingle();
      // Authorization check: the publication must belong to *this* token's calendar.
      if (!pub || pub.calendar_id !== calendar.id) return json({ error: "not_found" }, 404);

      const updates = respAction === "aprovar"
        ? { status: "aprovada", client_responded_at: new Date().toISOString() }
        : { status: "alteracao_solicitada", client_feedback: text, client_responded_at: new Date().toISOString() };

      const { data: updated, error } = await admin
        .from("calendar_publications")
        .update(updates)
        .eq("id", publicationId)
        .select("id, status, client_feedback")
        .single();
      if (error) throw error;

      return json({ publication: updated });
    }

    if (action === "approve_all") {
      const { data: pending } = await admin
        .from("calendar_publications")
        .select("id")
        .eq("calendar_id", calendar.id)
        .eq("status", "alteracao_solicitada");
      if (pending && pending.length > 0) {
        return json({ error: "pending_changes", count: pending.length }, 409);
      }

      await admin
        .from("calendar_publications")
        .update({ status: "aprovada", client_responded_at: new Date().toISOString() })
        .eq("calendar_id", calendar.id)
        .neq("status", "cancelada");

      await admin.from("publication_calendars").update({ status: "aprovado" }).eq("id", calendar.id);

      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("public-calendario-publicacao error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
