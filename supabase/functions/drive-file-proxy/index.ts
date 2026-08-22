// Streams a Google Drive file that has been fully locked down (no public permission).
// Authorization is a per-attachment opaque capability token (pm_attachments.access_token),
// not a Supabase session — this lets both the authenticated app and the unauthenticated
// /cronograma/:taskId public-approval page keep using a plain string URL (att.public_url)
// with zero frontend auth plumbing, while the underlying Drive file stays private.
//
// Backed by a byte-level cache in Supabase Storage (drive-media-cache): the first request
// for a given file fetches the whole thing from Drive and stores a copy; every request after
// that — from any viewer, any session, including the client opening the public approval
// link — is served straight from Storage, skipping Google's ~700ms-1s per-request API
// latency entirely. Safe to cache indefinitely: a drive_file_id's content never changes in
// this app (replacing media always creates a new file id, see drive-delete).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
const REFRESH_TOKEN = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN")!;
const CACHE_BUCKET = "drive-media-cache";
// Attachments uploaded before the client-side compression pipeline existed (or via a path
// that skipped it) can be much larger than anything the app produces today — one measured
// at 95MB. Buffering a file that size into an Edge Function's memory to cache it risks
// blowing past its memory/time limits, so anything over this cap skips the cache entirely
// and falls back to the old behavior (forward the client's Range straight to Drive, stream
// the response through). Comfortably above what the compression pipeline actually outputs.
const MAX_CACHEABLE_BYTES = 25 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Token cached in Postgres (not a module-level var) because Supabase Edge Functions don't
// reliably reuse the same warm isolate between separate client requests — measured live,
// every request was paying a fresh ~250ms Google OAuth round-trip without this.
async function getAccessToken(admin: ReturnType<typeof createClient>): Promise<string> {
  const { data: cached } = await admin
    .from("drive_oauth_token_cache")
    .select("access_token, expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
    return cached.access_token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: REFRESH_TOKEN,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${await res.text()}`);
  const data = await res.json();
  const expiresAt = new Date(Date.now() + (Math.max(data.expires_in ?? 3600, 120) - 60) * 1000).toISOString();
  // Best-effort — if the write races with another cold invocation refreshing at the same
  // time, whichever lands last just overwrites with an equally-valid token.
  await admin.from("drive_oauth_token_cache").upsert({ id: 1, access_token: data.access_token, expires_at: expiresAt });
  return data.access_token;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Serves the client's requested byte range out of an in-memory copy of the whole file —
// used for both a cache hit and a freshly-cached cache miss, since both end up holding the
// complete file the same way.
function sliceResponse(
  bytes: Uint8Array,
  contentType: string,
  rangeHeader: string | null,
  timing: string[],
  t0: number,
  cors: Record<string, string>,
): Response {
  const total = bytes.length;
  let status = 200;
  let start = 0;
  let end = total - 1;

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (match) {
      if (match[1]) start = parseInt(match[1], 10);
      if (match[2]) end = Math.min(parseInt(match[2], 10), total - 1);
      if (Number.isNaN(start) || start > end || start >= total) {
        return new Response(null, { status: 416, headers: { ...cors, "Content-Range": `bytes */${total}` } });
      }
      status = 206;
    }
  }

  const slice = bytes.subarray(start, end + 1);
  const responseHeaders: Record<string, string> = {
    ...cors,
    "Content-Type": contentType,
    // "public" (not "private") lets any shared/CDN cache in front of this function reuse a
    // response across different users/sessions requesting the exact same URL — safe here
    // because the URL's own opaque token IS the access control (same model as any
    // signed-URL CDN).
    "Cache-Control": "public, max-age=86400",
    "Accept-Ranges": "bytes",
    "Content-Length": String(slice.length),
    "Server-Timing": [...timing, `total;dur=${Date.now() - t0}`].join(", "),
  };
  if (status === 206) responseHeaders["Content-Range"] = `bytes ${start}-${end}/${total}`;

  return new Response(slice, { status, headers: responseHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const t0 = Date.now();
  const timing: string[] = [];
  const mark = (label: string, start: number) => timing.push(`${label};dur=${Date.now() - start}`);

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // URLs generated after this fix carry a file extension (".../{fileId}.mp4") so
    // in-app browsers that sniff media type off the URL will actually play <video>;
    // older rows still have a bare file ID with no extension, so only strip one if present.
    const fileId = segments[segments.length - 1]?.replace(/\.[a-zA-Z0-9]+$/, "");
    const token = url.searchParams.get("t");

    if (!fileId || !token) {
      return jsonResponse({ error: "missing id or token" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // The token-capability lookup and the cache-file lookup don't depend on each other —
    // running them concurrently shaves off whichever one is slower.
    let tStep = Date.now();
    const [{ data: attachment }, cachedFile] = await Promise.all([
      admin
        .from("pm_attachments")
        .select("drive_file_id, file_type")
        .eq("drive_file_id", fileId)
        .eq("access_token", token)
        .eq("storage_provider", "drive")
        .maybeSingle(),
      admin.storage.from(CACHE_BUCKET).download(fileId),
    ]);
    mark("db_and_cache_lookup", tStep);

    if (!attachment) {
      return jsonResponse({ error: "not found" }, 404);
    }

    const rangeHeader = req.headers.get("range");

    if (cachedFile.data) {
      const contentType = attachment.file_type || cachedFile.data.type || "application/octet-stream";
      const bytes = new Uint8Array(await cachedFile.data.arrayBuffer());
      mark("served_from_cache", t0);
      return sliceResponse(bytes, contentType, rangeHeader, timing, t0, corsHeaders);
    }

    const accessToken = await getAccessToken(admin);
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

    // Cheap probe (1 byte) to learn the file's total size before deciding whether it's
    // safe to buffer the whole thing for caching — see MAX_CACHEABLE_BYTES above.
    tStep = Date.now();
    const probeRes = await fetch(driveUrl, { headers: { Authorization: `Bearer ${accessToken}`, Range: "bytes=0-0" } });
    mark("drive_probe", tStep);
    const probeRange = probeRes.headers.get("content-range");
    const totalSize = probeRange ? Number(probeRange.split("/")[1]) : Number(probeRes.headers.get("content-length") ?? NaN);

    if (!probeRes.ok || Number.isNaN(totalSize)) {
      return jsonResponse({ error: `upstream error (${probeRes.status})` }, 502);
    }

    if (totalSize > MAX_CACHEABLE_BYTES) {
      // Too big to safely buffer — fall back to the old behavior: forward whatever Range
      // the client asked for straight to Drive and stream its response through uncached.
      const driveHeaders: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
      if (rangeHeader) driveHeaders["Range"] = rangeHeader;
      tStep = Date.now();
      let driveRes = await fetch(driveUrl, { headers: driveHeaders });
      mark("drive_fetch_uncached", tStep);
      if (!driveRes.ok || !driveRes.body) {
        tStep = Date.now();
        driveRes = await fetch(driveUrl, { headers: driveHeaders });
        mark("drive_fetch_uncached_retry", tStep);
      }
      if (!driveRes.ok || !driveRes.body) {
        return jsonResponse({ error: `upstream error (${driveRes.status})` }, 502);
      }
      const responseHeaders: Record<string, string> = {
        ...corsHeaders,
        "Content-Type": attachment.file_type || driveRes.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "public, max-age=86400",
        "Accept-Ranges": "bytes",
        "Server-Timing": [...timing, `total;dur=${Date.now() - t0}`].join(", "),
      };
      const contentRange = driveRes.headers.get("content-range");
      if (contentRange) responseHeaders["Content-Range"] = contentRange;
      const contentLength = driveRes.headers.get("content-length");
      if (contentLength) responseHeaders["Content-Length"] = contentLength;
      return new Response(driveRes.body, { status: driveRes.status, headers: responseHeaders });
    }

    // Small enough to cache — fetch the *whole* file (no Range) so there's a complete copy
    // to store, then slice out whatever this particular request asked for.
    tStep = Date.now();
    let driveRes = await fetch(driveUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    mark("drive_fetch", tStep);
    if (!driveRes.ok || !driveRes.body) {
      tStep = Date.now();
      driveRes = await fetch(driveUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      mark("drive_fetch_retry", tStep);
    }
    if (!driveRes.ok || !driveRes.body) {
      return jsonResponse({ error: `upstream error (${driveRes.status})` }, 502);
    }

    const contentType = attachment.file_type || driveRes.headers.get("content-type") || "application/octet-stream";
    const bytes = new Uint8Array(await driveRes.arrayBuffer());

    const cacheWrite = admin.storage.from(CACHE_BUCKET).upload(fileId, bytes, { contentType, upsert: true });
    // Supabase Edge Functions can keep running a background task after the response is sent
    // via EdgeRuntime.waitUntil — use it so the cache write doesn't add to this (already
    // slow, cache-miss) request's latency. Falls back to awaiting inline where that global
    // isn't available.
    const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (runtime) runtime.waitUntil(cacheWrite);
    else await cacheWrite;

    return sliceResponse(bytes, contentType, rangeHeader, timing, t0, corsHeaders);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
