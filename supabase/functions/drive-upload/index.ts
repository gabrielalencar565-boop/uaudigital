// Uploads a file to Google Drive (used for pm_attachments — client photos/videos —
// to avoid consuming Supabase Storage quota). Files are kept private (owner-only);
// access is granted via an opaque per-file capability token served by drive-file-proxy,
// never via Drive's own "anyone with link" sharing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
const REFRESH_TOKEN = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN")!;
const ROOT_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID")!;
const PROXY_BASE = `${Deno.env.get("SUPABASE_URL")}/functions/v1/drive-file-proxy`;

// Control-plane calls (auth, folder search/create, resumable-session init) should
// normally resolve in well under a second. When Google's API is slow or a request
// just hangs, leaving them unbounded means the whole function silently sits there
// until Supabase's own platform timeout kills it 150s+ later — which the browser
// only ever sees as a bare "network error", with no clue what actually stalled.
// A tight timeout here turns that into a fast, specific failure the client can
// retry (see uploadWithRetry in PmAttachmentsSection.tsx) instead of a long hang.
const CONTROL_CALL_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = CONTROL_CALL_TIMEOUT_MS): Promise<Response> {
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

async function getAccessToken(): Promise<string> {
  const res = await fetchWithTimeout("https://oauth2.googleapis.com/token", {
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

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// resolveTargetFolder walks Cliente/Ano/Mês/Tipo for every single upload — without
// caching that's 3 extra live Drive search-then-maybe-create round-trips (year, month,
// type) on top of the client-folder lookup, every time. Under normal Drive API latency
// that's a few seconds; under any slowness/rate-limiting it stacks up fast and has been
// observed pushing requests past Supabase's function timeout (a video upload that hangs
// here surfaces to the browser as a generic "network error during upload"). Caching each
// (parent, name) -> folder id pair in drive_folder_cache means only the FIRST upload to a
// given client/month/type pays for the live lookup; everything after is a single DB read.
async function findOrCreateFolder(
  accessToken: string,
  admin: ReturnType<typeof createClient>,
  parentId: string,
  name: string,
): Promise<string> {
  const { data: cached } = await admin
    .from("drive_folder_cache")
    .select("drive_folder_id")
    .eq("parent_id", parentId)
    .eq("name", name)
    .maybeSingle();
  if (cached) return cached.drive_folder_id;

  const q = `name='${escapeDriveQueryValue(name)}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;

  const searchRes = await fetchWithTimeout(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const searchData = await searchRes.json();
  let folderId: string;
  if (searchData.files?.length > 0) {
    folderId = searchData.files[0].id;
  } else {
    const createRes = await fetchWithTimeout("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
    });
    if (!createRes.ok) throw new Error(`folder create failed: ${await createRes.text()}`);
    folderId = (await createRes.json()).id;
  }

  await admin.from("drive_folder_cache").upsert({ parent_id: parentId, name, drive_folder_id: folderId });
  return folderId;
}

async function findOrCreateClientFolder(accessToken: string, admin: ReturnType<typeof createClient>, clientId: string): Promise<string> {
  const { data: existing } = await admin
    .from("drive_client_folders")
    .select("drive_folder_id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing) return existing.drive_folder_id;

  const { data: client } = await admin.from("clients").select("name").eq("id", clientId).maybeSingle();
  const name = client?.name || clientId;
  const folderId = await findOrCreateFolder(accessToken, admin, ROOT_FOLDER_ID, name);

  await admin.from("drive_client_folders").upsert({ client_id: clientId, drive_folder_id: folderId });
  return folderId;
}

const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// Resolves the Drive folder a new attachment should land in: Cliente / Ano / Mês / Vídeos|Posts.
// The date is the publication's scheduled date (calendar_publications.publish_date) when the
// task has one; most tasks predate the Cronograma feature and won't, so this falls back to
// today's date.
async function resolveTargetFolder(accessToken: string, admin: ReturnType<typeof createClient>, taskId: string, mimeType: string): Promise<string> {
  const { data: task } = await admin.from("pm_tasks").select("client_id").eq("id", taskId).maybeSingle();
  if (!task?.client_id) return ROOT_FOLDER_ID;

  const clientFolderId = await findOrCreateClientFolder(accessToken, admin, task.client_id);

  const { data: pub } = await admin
    .from("calendar_publications")
    .select("publish_date")
    .eq("task_id", taskId)
    .maybeSingle();
  const date = pub?.publish_date ? new Date(`${pub.publish_date}T00:00:00Z`) : new Date();
  const yearFolderId = await findOrCreateFolder(accessToken, admin, clientFolderId, String(date.getUTCFullYear()));
  const monthName = `${String(date.getUTCMonth() + 1).padStart(2, "0")} ${MONTH_NAMES_PT[date.getUTCMonth()]}`;
  const monthFolderId = await findOrCreateFolder(accessToken, admin, yearFolderId, monthName);

  const typeName = mimeType.startsWith("video/") ? "Vídeos" : "Posts";
  return findOrCreateFolder(accessToken, admin, monthFolderId, typeName);
}

async function uploadToDrive(accessToken: string, fileName: string, mimeType: string, bytes: Uint8Array, parentId: string): Promise<string> {
  const boundary = "uaudigital-drive-upload-boundary";
  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });

  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const closing = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(preamble.length + bytes.length + closing.length);
  body.set(preamble, 0);
  body.set(bytes, preamble.length);
  body.set(closing, preamble.length + bytes.length);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) throw new Error(`drive upload failed: ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Opens a Google Drive resumable upload session and returns the session URI the
// browser should PUT bytes to directly — used for video, where funnelling the
// whole file through this Edge Function (memory/time limited) would be unsafe.
async function initResumableUpload(accessToken: string, fileName: string, mimeType: string, fileSize: number, parentId: string): Promise<string> {
  const res = await fetchWithTimeout("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mimeType,
      "X-Upload-Content-Length": String(fileSize),
    },
    body: JSON.stringify({ name: fileName, parents: [parentId] }),
  });
  if (!res.ok) throw new Error(`resumable init failed: ${await res.text()}`);
  const location = res.headers.get("Location");
  if (!location) throw new Error("resumable init: missing Location header");
  return location;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Streaming relay (video): the browser POSTs the raw file as the request body
    // (metadata in the query string, since a streamed binary body can't carry JSON
    // alongside it) and this function pipes req.body straight into the outgoing PUT
    // to Drive's resumable session — at no point is the whole file held in memory,
    // so file size isn't bounded by this function's memory ceiling. A true
    // browser→Drive direct upload was tried first but Google's resumable endpoint
    // is CORS-locked to this OAuth client's registered origins (none registered),
    // so the browser can only ever reach it through here.
    const url = new URL(req.url);
    if (url.searchParams.get("mode") === "stream") {
      const taskId = url.searchParams.get("task_id") ?? "";
      const fileName = url.searchParams.get("file_name") ?? "upload.bin";
      const mimeType = url.searchParams.get("mime_type") || "application/octet-stream";
      const fileSize = Number(url.searchParams.get("file_size") ?? "0");

      if (!fileSize || !req.body) {
        return new Response(JSON.stringify({ error: "file_size required and body must be present" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const accessToken = await getAccessToken();
      const parentId = taskId
        ? await resolveTargetFolder(accessToken, admin, taskId, mimeType)
        : ROOT_FOLDER_ID;

      const uploadUrl = await initResumableUpload(accessToken, fileName, mimeType, fileSize, parentId);

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType, "Content-Length": String(fileSize) },
        body: req.body,
        // Required by the Fetch spec whenever the body is a stream instead of a
        // fully-buffered value — tells the runtime not to wait for it to finish
        // before starting the request.
        duplex: "half",
      } as RequestInit);

      if (!putRes.ok) {
        return new Response(JSON.stringify({ error: `drive upload failed: ${await putRes.text()}` }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const driveFile = await putRes.json();
      const token = randomToken();
      const publicUrl = `${PROXY_BASE}/${driveFile.id}?t=${token}`;
      return new Response(
        JSON.stringify({ drive_file_id: driveFile.id, public_url: publicUrl, access_token: token }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Small-file path (images/PDFs): whole file relayed through this function, unchanged ──
    const formData = await req.formData();
    const file = formData.get("file");
    const taskId = formData.get("task_id");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "file field required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accessToken = await getAccessToken();
    const mimeType = file.type || "application/octet-stream";

    const parentId = typeof taskId === "string" && taskId
      ? await resolveTargetFolder(accessToken, admin, taskId, mimeType)
      : ROOT_FOLDER_ID;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileId = await uploadToDrive(accessToken, file.name, mimeType, bytes, parentId);

    const token = randomToken();
    const publicUrl = `${PROXY_BASE}/${fileId}?t=${token}`;

    return new Response(
      JSON.stringify({ drive_file_id: fileId, public_url: publicUrl, access_token: token }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
