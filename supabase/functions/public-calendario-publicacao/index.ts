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
      const { data: client } = await admin.from("clients").select("name, logo_url").eq("id", calendar.client_id).maybeSingle();

      const { data: pubs } = await admin
        .from("calendar_publications")
        .select("id, task_id, title, content_type, caption, publish_date, publish_time, status, client_note, client_feedback, order_index, cover_attachment_id")
        .eq("calendar_id", calendar.id)
        .neq("status", "cancelada")
        .order("order_index", { ascending: true });

      const taskIds = [...new Set((pubs ?? []).map((p: any) => p.task_id))];
      const byTask = new Map<string, { id: string; url: string; type: string | null }[]>();
      if (taskIds.length > 0) {
        const { data: atts } = await admin
          .from("pm_attachments")
          .select("id, task_id, public_url, file_type, order_index")
          .in("task_id", taskIds)
          .order("order_index", { ascending: true });
        for (const a of (atts ?? []) as any[]) {
          if (!a.public_url) continue;
          const list = byTask.get(a.task_id) ?? [];
          list.push({ id: a.id, url: a.public_url, type: a.file_type });
          byTask.set(a.task_id, list);
        }
      }

      // A cover_attachment_id can point at an attachment from a *different* task (e.g.
      // chosen from a sibling "Capa" task during the PDF stage), so it may not be in
      // byTask at all. Fetch any such covers separately so they still resolve below.
      const coverIds = [...new Set((pubs ?? []).map((p: any) => p.cover_attachment_id).filter(Boolean))];
      const coverById = new Map<string, { id: string; url: string; type: string | null }>();
      if (coverIds.length > 0) {
        const { data: coverAtts } = await admin
          .from("pm_attachments")
          .select("id, public_url, file_type")
          .in("id", coverIds);
        for (const a of (coverAtts ?? []) as any[]) {
          if (a.public_url) coverById.set(a.id, { id: a.id, url: a.public_url, type: a.file_type });
        }
      }

      // Puts the publication's chosen cover attachment first, so the public page's
      // existing "just show media[0]" logic picks it up with no changes on its side.
      // The `id` is stripped afterward — it's only needed to locate the cover here.
      return json({
        clientName: client?.name ?? "Cliente",
        clientLogoUrl: client?.logo_url ?? null,
        calendar: {
          cycleStart: calendar.cycle_start,
          cycleEnd: calendar.cycle_end,
          status: calendar.status,
          updatedAt: calendar.updated_at,
        },
        publications: (pubs ?? []).map(({ task_id, cover_attachment_id, ...p }: any) => {
          const media = byTask.get(task_id) ?? [];
          const idx = cover_attachment_id ? media.findIndex((m) => m.id === cover_attachment_id) : -1;
          let ordered = media;
          if (idx > 0) {
            ordered = [media[idx], ...media.slice(0, idx), ...media.slice(idx + 1)];
          } else if (idx === -1 && cover_attachment_id && coverById.has(cover_attachment_id)) {
            ordered = [coverById.get(cover_attachment_id)!, ...media];
          }
          return { ...p, media: ordered.map(({ id, ...m }) => m) };
        }),
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
