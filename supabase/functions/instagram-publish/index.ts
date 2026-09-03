// Publishes a Cronograma publication to its client's Instagram, via the Instagram Graph
// API's two-step container flow (create container -> [poll until processed] -> publish).
// Two entry points share the same core logic (see whatsapp-dispatch for the precedent of
// one function handling both a manual action and a cron-driven scan):
//   - action "publish_one": manual "Publicar agora" button, one publication, requires a
//     real user session.
//   - action "run_schedules": called by pg_cron via pg_net on a timer, scans everything
//     due AND explicitly cleared (calendar_publications.instagram_scheduled = true — set by
//     the team via the per-publication "Agendar" button or the cycle-wide "Agendar
//     publicações" action) and publishes each in turn. Authenticated by a shared secret
//     header instead of a Supabase JWT, since pg_net has no user session to attach.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GRAPH_VERSION = "v21.0";

// Video/Reels containers process asynchronously on Meta's side; this bounds how long a
// single item can block one function invocation before giving up (the item stays
// retryable on the next cron tick either way, see the backoff logic in handleRunSchedules).
// A real ~33MB Reel was observed taking noticeably longer than the old 80s budget to
// finish processing, so this is generous — 45 * 4s = 180s — while still comfortably
// inside Supabase's own platform execution ceiling (150s+, see drive-upload's own note
// on this) so a genuinely-stuck poll hits *this* timeout and gets a real error recorded,
// instead of the whole function being killed externally first with nothing written down.
const POLL_INTERVAL_MS = 4000;
const POLL_MAX_ATTEMPTS = 45;
const RETRY_BACKOFF_MS = 15 * 60 * 1000;
// Every single Graph API call gets its own bound — without this, a stalled connection to
// Meta (not an error, just silence) hangs the `fetch` indefinitely with no JS exception
// ever thrown, so the try/catch below never runs and the row is left stuck on
// "publishing" forever with no error recorded. This is exactly what was happening.
const REQUEST_TIMEOUT_MS = 25_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if (controller.signal.aborted) throw new Error(`request to ${url} timed out after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function graphPost(path: string, accessToken: string, params: Record<string, string>) {
  const res = await fetchWithTimeout(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: "POST",
    body: new URLSearchParams({ ...params, access_token: accessToken }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Graph API error on ${path}: ${JSON.stringify(data.error ?? data)}`);
  return data;
}

async function graphGet(path: string, accessToken: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetchWithTimeout(url.toString(), {});
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Graph API error on ${path}: ${JSON.stringify(data.error ?? data)}`);
  return data;
}

async function waitUntilFinished(creationId: string, accessToken: string) {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    const status = await graphGet(creationId, accessToken, { fields: "status_code" });
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") throw new Error(`processamento falhou no Instagram (creation ${creationId})`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`tempo esgotado esperando o Instagram processar a mídia (creation ${creationId})`);
}

type MediaItem = { url: string; type: string | null };

async function fetchMediaForTask(admin: ReturnType<typeof createClient>, taskId: string): Promise<MediaItem[]> {
  // Only "final" content is client-facing/publishable — production materials
  // (category "material") are internal working files, same rule as the calendar's own
  // useTaskAttachmentsMap (src/features/calendario/hooks/use-calendar-data.ts).
  const { data, error } = await admin
    .from("pm_attachments")
    .select("public_url, file_type, order_index, created_at")
    .eq("task_id", taskId)
    .eq("category", "final")
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as { public_url: string | null; file_type: string | null }[])
    .filter((a) => a.public_url)
    .map((a) => ({ url: a.public_url as string, type: a.file_type }));
}

// The chosen Reel cover can point at an attachment that isn't even one of this task's own
// media items (see PublicationPreviewPanel.tsx's "pinnedCandidate" — a cover can be pinned
// in from a different, PDF-stage task), so this has to look it up by id directly rather than
// reusing fetchMediaForTask's task-scoped query.
async function fetchCoverUrl(admin: ReturnType<typeof createClient>, coverAttachmentId: string | null): Promise<string | null> {
  if (!coverAttachmentId) return null;
  const { data } = await admin.from("pm_attachments").select("public_url").eq("id", coverAttachmentId).maybeSingle();
  return (data as { public_url: string | null } | null)?.public_url ?? null;
}

async function markFailed(admin: ReturnType<typeof createClient>, publicationId: string, message: string) {
  await admin
    .from("calendar_publications")
    .update({ instagram_status: "failed", instagram_error: message })
    .eq("id", publicationId);
  return { success: false, error: message };
}

// deno-lint-ignore no-explicit-any
async function publishToInstagram(admin: ReturnType<typeof createClient>, publication: any) {
  const { data: calendar } = await admin
    .from("publication_calendars")
    .select("client_id")
    .eq("id", publication.calendar_id)
    .maybeSingle();
  if (!calendar) return markFailed(admin, publication.id, "calendário da publicação não encontrado");

  const { data: connection } = await admin
    .from("instagram_connections")
    .select("instagram_business_account_id, access_token, status")
    .eq("client_id", calendar.client_id)
    .maybeSingle();
  if (!connection || connection.status !== "active") {
    return markFailed(admin, publication.id, "cliente sem conexão ativa com o Instagram");
  }

  const igUserId = connection.instagram_business_account_id as string;
  const accessToken = connection.access_token as string;

  await admin
    .from("calendar_publications")
    .update({ instagram_status: "publishing", instagram_publish_attempted_at: new Date().toISOString(), instagram_error: null })
    .eq("id", publication.id);

  try {
    if (publication.content_type === "outro") throw new Error("tipo de conteúdo não suportado para publicação automática");

    const media = await fetchMediaForTask(admin, publication.task_id);
    if (media.length === 0) throw new Error("nenhum anexo final encontrado para publicar");

    let creationId: string;

    if (publication.content_type === "story") {
      // Stories only take a single image or video, and the Graph API rejects a caption
      // param on this media_type (no text-overlay support via the Content Publishing API).
      const item = media[0];
      const isVideo = item.type?.startsWith("video/") ?? false;
      const container = await graphPost(`${igUserId}/media`, accessToken, {
        media_type: "STORIES",
        ...(isVideo ? { video_url: item.url } : { image_url: item.url }),
      });
      // Written now, before the (potentially long) wait below, so a video that's still
      // processing when this invocation gets cut off leaves a trail — the container isn't
      // silently orphaned with nothing in the DB pointing at it.
      if (isVideo) {
        await admin.from("calendar_publications").update({ instagram_creation_id: container.id }).eq("id", publication.id);
        await waitUntilFinished(container.id, accessToken);
      }
      creationId = container.id;
    } else if (publication.content_type === "carrossel") {
      if (media.length < 2) throw new Error("carrossel precisa de pelo menos 2 mídias");
      const childIds: string[] = [];
      for (const item of media) {
        const isVideo = item.type?.startsWith("video/") ?? false;
        const child = await graphPost(`${igUserId}/media`, accessToken, {
          is_carousel_item: "true",
          ...(isVideo ? { video_url: item.url, media_type: "VIDEO" } : { image_url: item.url }),
        });
        if (isVideo) await waitUntilFinished(child.id, accessToken);
        childIds.push(child.id);
      }
      const parent = await graphPost(`${igUserId}/media`, accessToken, {
        media_type: "CAROUSEL",
        children: childIds.join(","),
        caption: publication.caption ?? "",
      });
      creationId = parent.id;
    } else {
      const isReel = publication.content_type === "reel";
      // Prefer the actual video attachment over media[0] — a cover image uploaded to the
      // same task can share the "final" category and sort ahead of the video (same
      // order_index/created_at tie), which would otherwise send an image as video_url.
      const item = (isReel ? media.find((m) => m.type?.startsWith("video/")) : undefined) ?? media[0];
      const isVideo = isReel || (item.type?.startsWith("video/") ?? false);
      // Reels support a custom cover image (cover_url takes priority over Meta's own
      // auto-picked frame) — the team's chosen "Capa do Reel" was being uploaded and shown
      // in-app but never actually sent to Meta, so posts always used Instagram's own
      // auto-selected frame instead of the chosen cover.
      const coverUrl = isReel ? await fetchCoverUrl(admin, publication.cover_attachment_id) : null;
      const container = await graphPost(`${igUserId}/media`, accessToken, {
        caption: publication.caption ?? "",
        ...(isVideo ? { video_url: item.url, media_type: isReel ? "REELS" : "VIDEO" } : { image_url: item.url }),
        ...(coverUrl ? { cover_url: coverUrl } : {}),
      });
      // Same reasoning as the Stories branch above — persist before the wait, not after.
      if (isVideo) {
        await admin.from("calendar_publications").update({ instagram_creation_id: container.id }).eq("id", publication.id);
        await waitUntilFinished(container.id, accessToken);
      }
      creationId = container.id;
    }

    await admin.from("calendar_publications").update({ instagram_creation_id: creationId }).eq("id", publication.id);

    const published = await graphPost(`${igUserId}/media_publish`, accessToken, { creation_id: creationId });

    let permalink: string | null = null;
    try {
      const info = await graphGet(published.id, accessToken, { fields: "permalink" });
      permalink = info.permalink ?? null;
    } catch {
      // Best-effort only — the publish itself already succeeded.
    }

    await admin
      .from("calendar_publications")
      .update({
        instagram_status: "published",
        instagram_media_id: published.id,
        instagram_permalink: permalink,
        instagram_published_at: new Date().toISOString(),
        instagram_error: null,
      })
      .eq("id", publication.id);

    return { success: true, media_id: published.id, permalink };
  } catch (e) {
    return markFailed(admin, publication.id, String((e as Error)?.message ?? e));
  }
}

async function handlePublishOne(admin: ReturnType<typeof createClient>, body: { publication_id?: string }) {
  const publicationId = body.publication_id;
  if (!publicationId) return json({ error: "publication_id is required" }, 400);
  const { data: publication } = await admin.from("calendar_publications").select("*").eq("id", publicationId).maybeSingle();
  if (!publication) return json({ error: "publicação não encontrada" }, 404);
  const result = await publishToInstagram(admin, publication);
  return json(result, result.success ? 200 : 502);
}

async function handleRunSchedules(admin: ReturnType<typeof createClient>) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const { data: candidates, error } = await admin
    .from("calendar_publications")
    .select("*")
    .not("publish_date", "is", null)
    .not("publish_time", "is", null)
    .eq("instagram_scheduled", true)
    .in("instagram_status", ["not_published", "failed", "publishing"])
    .lte("publish_date", todayIso);
  if (error) throw error;

  const now = Date.now();
  // publish_date/publish_time are naive wall-clock values entered by the team via the same
  // picker used everywhere else in the Cronograma, meaning America/Sao_Paulo local time —
  // the agency is Brazil-only. Edge Functions run with TZ=UTC, so parsing the bare string
  // (no offset) would silently read it as UTC and fire 3h early. Brazil has had no DST
  // since 2019, so the -03:00 offset is safe to hardcode rather than needing a TZ database.
  const due = ((candidates ?? []) as { id: string; publish_date: string; publish_time: string; instagram_status: string; instagram_publish_attempted_at: string | null }[]).filter((p) => {
    const scheduledAt = new Date(`${p.publish_date}T${p.publish_time}-03:00`).getTime();
    if (scheduledAt > now) return false;
    if (p.instagram_status !== "not_published") {
      // "failed" or stuck "publishing" (e.g. the function was killed mid-flight) — only
      // retry after a cooldown, so a persistently broken item doesn't get hammered every
      // cron tick.
      if (!p.instagram_publish_attempted_at) return true;
      return now - new Date(p.instagram_publish_attempted_at).getTime() > RETRY_BACKOFF_MS;
    }
    return true;
  });

  // Processed concurrently, not one at a time — each video/reel can take up to
  // POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS (~3 minutes) to finish processing, and this scan
  // only gets 5 minutes before the next cron tick starts a fresh one. On a day with several
  // Reels due in the same slot, a sequential loop meant only the first one or two ever got
  // touched — the rest sat at instagram_status "not_published" with no attempt recorded at
  // all, for hours, until they happened to reach the front of the queue. Every candidate
  // here belongs to a different publication (own row, own client), so there's no shared
  // state to race on, and different clients' Instagram accounts don't share rate limits.
  const results = await Promise.allSettled(
    // deno-lint-ignore no-explicit-any
    (due as any[]).map(async (publication) => {
      const { data: full } = await admin.from("calendar_publications").select("*").eq("id", publication.id).maybeSingle();
      if (!full) return null;
      const result = await publishToInstagram(admin, full);
      return { id: full.id, ...result };
    }),
  );

  const processed = results
    .map((r) => (r.status === "fulfilled" ? r.value : { success: false, error: String(r.reason) }))
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return json({ processed: processed.length, results: processed });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "run_schedules") {
      const cronSecret = req.headers.get("X-Cron-Secret");
      // Verified against Vault (the same secret pg_cron itself reads to send this header)
      // instead of a separate Deno.env var, so the two can't drift out of sync again.
      const { data: validSecret } = await admin.rpc("verify_instagram_cron_secret", { candidate: cronSecret });
      if (!validSecret) return json({ error: "unauthorized" }, 401);
      return await handleRunSchedules(admin);
    }

    if (action === "publish_one") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "missing authorization" }, 401);
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user) return json({ error: "invalid session" }, 401);
      return await handlePublishOne(admin, body);
    }

    return json({ error: `unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
