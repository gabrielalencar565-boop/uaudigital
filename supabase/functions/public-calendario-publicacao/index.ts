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

// Perfil do mês montado no Estúdio do feed (foto, nome, destaques e fixados). Só vai para o cliente o que a equipe SALVOU para o
// mês deste calendário (o mês em que o período termina, mesma regra do Estúdio: lib/profile-month.ts → profileMonthKey).
// Fixado de um ciclo anterior vai só com a imagem de capa (sem legenda nem status), e apenas se for deste mesmo cliente.
// deno-lint-ignore no-explicit-any
async function loadProfile(admin: any, calendar: { client_id: string; cycle_end: string }, shownIds: string[]) {
  const month = `${String(calendar.cycle_end).slice(0, 7)}-01`;
  const { data: row, error } = await admin
    .from("client_profile_months")
    .select("photo_url, display_name, highlights, pinned_publication_ids")
    .eq("client_id", calendar.client_id)
    .eq("month", month)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const pinnedIds: string[] = row.pinned_publication_ids ?? [];
  const olderPinned: { id: string; publishDate: string | null; thumbUrl: string | null; isCarousel: boolean; isVideo: boolean }[] = [];
  const outside = pinnedIds.filter((id) => !shownIds.includes(id));
  if (outside.length > 0) {
    const { data: calendars } = await admin.from("publication_calendars").select("id").eq("client_id", calendar.client_id);
    const { data: pubs } = await admin
      .from("calendar_publications")
      .select("id, task_id, content_type, publish_date, cover_attachment_id")
      .in("id", outside)
      .in("calendar_id", (calendars ?? []).map((c: { id: string }) => c.id))
      .is("deleted_at", null)
      .neq("content_type", "story");
    for (const p of pubs ?? []) {
      const { data: atts } = await admin
        .from("pm_attachments")
        .select("id, public_url, file_type")
        .eq("task_id", p.task_id)
        .eq("category", "final")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      const media = (atts ?? []).filter((a: { public_url: string | null }) => a.public_url);
      const images = media.filter((a: { file_type: string | null }) => a.file_type?.startsWith("image/"));
      let cover = p.content_type !== "carrossel" && p.cover_attachment_id ? media.find((a: { id: string }) => a.id === p.cover_attachment_id) : undefined;
      if (!cover && p.content_type !== "carrossel" && p.cover_attachment_id) {
        const { data: external } = await admin.from("pm_attachments").select("id, public_url, file_type").eq("id", p.cover_attachment_id).maybeSingle();
        cover = external?.public_url ? external : undefined;
      }
      if (media.length === 0 && !cover) continue;
      const thumb = cover?.file_type?.startsWith("image/") ? cover : images[0];
      olderPinned.push({
        id: p.id,
        publishDate: p.publish_date,
        thumbUrl: thumb?.public_url ?? null,
        isCarousel: p.content_type === "carrossel" && images.length > 1,
        isVideo: p.content_type === "reel",
      });
    }
  }

  const { data: instagram } = await admin.from("instagram_connections").select("instagram_username").eq("client_id", calendar.client_id).maybeSingle();
  return {
    username: instagram?.instagram_username ?? null,
    photoUrl: row.photo_url,
    displayName: row.display_name,
    highlights: row.highlights,
    pinnedIds,
    olderPinned,
  };
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

      // NOTE: this used to filter `.neq("status", "cancelada")` — "cancelada" was never a
      // real value of the publication_status enum (only em_montagem, aguardando_aprovacao,
      // aprovada, alteracao_solicitada exist), so that comparison threw on every call and
      // silently produced an empty publications list every time (the error was never
      // checked). The actual "exclude this" signal is the soft-delete column, matching how
      // every other calendar_publications query in the app already filters.
      const { data: pubs, error: pubsError } = await admin
        .from("calendar_publications")
        .select("id, task_id, title, content_type, caption, publish_date, publish_time, status, client_note, client_feedback, order_index, cover_attachment_id")
        .eq("calendar_id", calendar.id)
        .is("deleted_at", null)
        .order("order_index", { ascending: true })
        // Same tiebreaker as useCalendarPublications (use-calendar-data.ts) — publications
        // commonly share order_index 0 too, so without this the public page's post order
        // can drift from what the team sees in the Cronograma.
        .order("created_at", { ascending: true });
      if (pubsError) console.error("public-calendario-publicacao pubs query error:", pubsError.message);

      const taskIds = [...new Set((pubs ?? []).map((p: any) => p.task_id))];
      const byTask = new Map<string, { id: string; url: string; type: string | null; name: string | null }[]>();
      if (taskIds.length > 0) {
        const { data: atts } = await admin
          .from("pm_attachments")
          .select("id, task_id, public_url, file_type, file_name, order_index")
          .in("task_id", taskIds)
          // Only "final" content is client-facing — production materials (category
          // "material") are internal working files, same rule as everywhere else that
          // resolves attachments for display (useTaskAttachmentsMap, instagram-publish's
          // fetchMediaForTask). This query never actually ran with real data before (the
          // "cancelada" bug above always left taskIds empty), so this missing filter never
          // surfaced until that was fixed.
          .eq("category", "final")
          .order("order_index", { ascending: true })
          // Every other place in the app that sorts attachments (Cronograma panel,
          // instagram-publish, the other public endpoint) also breaks ties on created_at —
          // this was the one spot missing it. Attachments commonly share order_index 0 until
          // someone actually drags to reorder, so without this tiebreaker Postgres is free to
          // return tied rows in an arbitrary order, out of sync with every other view.
          .order("created_at", { ascending: true });
        for (const a of (atts ?? []) as any[]) {
          if (!a.public_url) continue;
          const list = byTask.get(a.task_id) ?? [];
          list.push({ id: a.id, url: a.public_url, type: a.file_type, name: a.file_name ?? null });
          byTask.set(a.task_id, list);
        }
      }

      // A cover_attachment_id can point at an attachment from a *different* task (e.g.
      // chosen from a sibling "Capa" task during the PDF stage), so it may not be in
      // byTask at all. Fetch any such covers separately so they still resolve below.
      const coverIds = [...new Set((pubs ?? []).map((p: any) => p.cover_attachment_id).filter(Boolean))];
      const coverById = new Map<string, { id: string; url: string; type: string | null; name: string | null }>();
      if (coverIds.length > 0) {
        const { data: coverAtts } = await admin
          .from("pm_attachments")
          .select("id, public_url, file_type, file_name")
          .in("id", coverIds);
        for (const a of (coverAtts ?? []) as any[]) {
          if (a.public_url) coverById.set(a.id, { id: a.id, url: a.public_url, type: a.file_type, name: a.file_name ?? null });
        }
      }

      // uma falha no perfil não pode derrubar o link de aprovação
      const profile = await loadProfile(admin, calendar, (pubs ?? []).map((p: any) => p.id)).catch((e) => {
        console.error("public-calendario-publicacao profile error:", e instanceof Error ? e.message : e?.message ?? e);
        return null;
      });

      // Puts the publication's chosen cover attachment first, so the public page's
      // existing "just show media[0]" logic picks it up with no changes on its side.
      // The `id` is stripped afterward — it's only needed to locate the cover here.
      return json({
        profile,
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
          // Carrossel pages are shown in full, in order (AprovacaoPublic.tsx keeps every
          // image for content_type "carrossel" instead of just media[0]) — moving the
          // chosen cover to the front here would scramble a sequence the team deliberately
          // arranged via "Ordem das páginas do carrossel". Only single-media types (which
          // really do just render media[0]) benefit from front-loading the cover.
          const idx = (cover_attachment_id && p.content_type !== "carrossel")
            ? media.findIndex((m) => m.id === cover_attachment_id)
            : -1;
          let ordered = media;
          if (idx > 0) {
            ordered = [media[idx], ...media.slice(0, idx), ...media.slice(idx + 1)];
          } else if (idx === -1 && p.content_type !== "carrossel" && cover_attachment_id && coverById.has(cover_attachment_id)) {
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
        .is("deleted_at", null)
        .eq("status", "alteracao_solicitada");
      if (pending && pending.length > 0) {
        return json({ error: "pending_changes", count: pending.length }, 409);
      }

      // Same fix as the "load" query above — "cancelada" was never a valid
      // publication_status value, so this filter threw and silently no-op'd the update.
      await admin
        .from("calendar_publications")
        .update({ status: "aprovada", client_responded_at: new Date().toISOString() })
        .eq("calendar_id", calendar.id)
        .is("deleted_at", null);

      await admin.from("publication_calendars").update({ status: "aprovado" }).eq("id", calendar.id);

      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("public-calendario-publicacao error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
