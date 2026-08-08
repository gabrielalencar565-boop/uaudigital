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

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
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
  const q = `name='${escapeDriveQueryValue(name)}' and mimeType='application/vnd.google-apps.folder' and '${ROOT_FOLDER_ID}' in parents and trashed=false`;

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const searchData = await searchRes.json();
  let folderId: string;
  if (searchData.files?.length > 0) {
    folderId = searchData.files[0].id;
  } else {
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [ROOT_FOLDER_ID] }),
    });
    if (!createRes.ok) throw new Error(`folder create failed: ${await createRes.text()}`);
    folderId = (await createRes.json()).id;
  }

  await admin.from("drive_client_folders").upsert({ client_id: clientId, drive_folder_id: folderId });
  return folderId;
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

    let parentId = ROOT_FOLDER_ID;
    if (typeof taskId === "string" && taskId) {
      const { data: task } = await admin.from("pm_tasks").select("client_id").eq("id", taskId).maybeSingle();
      if (task?.client_id) {
        parentId = await findOrCreateClientFolder(accessToken, admin, task.client_id);
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const fileId = await uploadToDrive(accessToken, file.name, file.type || "application/octet-stream", bytes, parentId);

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
