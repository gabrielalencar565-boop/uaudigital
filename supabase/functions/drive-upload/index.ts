// Uploads a file to Google Drive (used for pm_attachments — client photos/videos —
// to avoid consuming Supabase Storage quota) and returns a public link.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET") ?? "";
const REFRESH_TOKEN = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN") ?? "";
const FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_FOLDER_ID") ?? "";
const DRIVE_CONFIGURED = !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN && FOLDER_ID);
const STORAGE_BUCKET = "pm-attachments";

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

async function uploadToDrive(accessToken: string, fileName: string, mimeType: string, bytes: Uint8Array): Promise<string> {
  const boundary = "uaudigital-drive-upload-boundary";
  const metadata = JSON.stringify({ name: fileName, parents: [FOLDER_ID] });

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

async function makePublic(accessToken: string, fileId: string) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
  if (!res.ok) throw new Error(`permission update failed: ${await res.text()}`);
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

    // Verify caller has a valid Supabase session (any authenticated user).
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

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "file field required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Fallback: when Google Drive credentials are not configured, store the file
    // in the public Supabase Storage bucket so uploads keep working.
    if (!DRIVE_CONFIGURED) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${userData.user.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await admin.storage.from(STORAGE_BUCKET).upload(path, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) {
        console.error("storage upload failed:", upErr.message);
        return new Response(JSON.stringify({ error: `storage upload failed: ${upErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: pub } = admin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      return new Response(
        JSON.stringify({ storage_provider: "supabase", storage_path: path, public_url: pub.publicUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getAccessToken();
    const fileId = await uploadToDrive(accessToken, file.name, file.type || "application/octet-stream", bytes);
    await makePublic(accessToken, fileId);

    const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return new Response(
      JSON.stringify({ storage_provider: "drive", drive_file_id: fileId, public_url: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("drive-upload error:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
