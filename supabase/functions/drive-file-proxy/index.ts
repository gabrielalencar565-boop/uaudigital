// Streams a Google Drive file that has been fully locked down (no public permission).
// Authorization is a per-attachment opaque capability token (pm_attachments.access_token),
// not a Supabase session — this lets both the authenticated app and the unauthenticated
// /cronograma/:taskId public-approval page keep using a plain string URL (att.public_url)
// with zero frontend auth plumbing, while the underlying Drive file stays private.
//
// Forwards the incoming Range header to Drive so <video> playback can seek/scrub without
// downloading the whole file — important for video attachments; harmless no-op for images.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
const REFRESH_TOKEN = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

async function getAccessToken(): Promise<string> {
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
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const segments = url.pathname.split("/").filter(Boolean);
    // URLs generated after this fix carry a file extension (".../{fileId}.mp4") so
    // in-app browsers that sniff media type off the URL will actually play <video>;
    // older rows still have a bare file ID with no extension, so only strip one if present.
    const fileId = segments[segments.length - 1]?.replace(/\.[a-zA-Z0-9]+$/, "");
    const token = url.searchParams.get("t");

    if (!fileId || !token) {
      return new Response("missing id or token", { status: 400, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: attachment } = await admin
      .from("pm_attachments")
      .select("drive_file_id, file_type")
      .eq("drive_file_id", fileId)
      .eq("access_token", token)
      .eq("storage_provider", "drive")
      .maybeSingle();

    if (!attachment) {
      return new Response("not found", { status: 404, headers: corsHeaders });
    }

    const accessToken = await getAccessToken();

    const driveHeaders: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) driveHeaders["Range"] = rangeHeader;

    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    let driveRes = await fetch(driveUrl, { headers: driveHeaders });
    // Google's API occasionally hiccups on individual requests (transient 5xx/network
    // errors) — a client mid-playback would otherwise see a hard failure for something
    // that a single retry resolves almost every time.
    if (!driveRes.ok || !driveRes.body) {
      driveRes = await fetch(driveUrl, { headers: driveHeaders });
    }

    if (!driveRes.ok || !driveRes.body) {
      return new Response(`upstream error (${driveRes.status})`, { status: 502, headers: corsHeaders });
    }

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": attachment.file_type || driveRes.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "private, max-age=86400",
      "Accept-Ranges": "bytes",
    };
    const contentRange = driveRes.headers.get("content-range");
    if (contentRange) responseHeaders["Content-Range"] = contentRange;
    const contentLength = driveRes.headers.get("content-length");
    if (contentLength) responseHeaders["Content-Length"] = contentLength;

    return new Response(driveRes.body, {
      status: driveRes.status,
      headers: responseHeaders,
    });
  } catch (e) {
    return new Response(String(e), { status: 500, headers: corsHeaders });
  }
});
