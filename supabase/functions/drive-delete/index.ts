// Deletes a file from Google Drive when its pm_attachments row is removed —
// keeps the Drive folder structure in sync with what the app shows, instead
// of leaving orphaned files behind. Mirrors drive-upload's auth model: caller
// must be an authenticated staff session, not just holding the anon key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CLIENT_ID = Deno.env.get("GOOGLE_DRIVE_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("GOOGLE_DRIVE_CLIENT_SECRET")!;
const REFRESH_TOKEN = Deno.env.get("GOOGLE_DRIVE_REFRESH_TOKEN")!;

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
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { drive_file_id, attachment_id } = await req.json();
    if (!drive_file_id || typeof drive_file_id !== "string") {
      return new Response(JSON.stringify({ error: "drive_file_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Task-cloning can leave multiple pm_attachments rows pointing at the same
    // physical Drive file (only the access_token differs). Deleting the real file
    // out from under a sibling row would permanently 404 it, so if another row
    // still references this drive_file_id, only drop the one being removed here —
    // the caller deletes its own pm_attachments row right after this call returns.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    let othersQuery = admin
      .from("pm_attachments")
      .select("id", { count: "exact", head: true })
      .eq("drive_file_id", drive_file_id);
    if (attachment_id && typeof attachment_id === "string") {
      othersQuery = othersQuery.neq("id", attachment_id);
    }
    const { count: othersCount } = await othersQuery;
    if (othersCount && othersCount > 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "shared_with_other_rows" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort — an orphaned cache entry just wastes a little storage, not worth
    // failing the whole delete over.
    await admin.storage.from("drive-media-cache").remove([drive_file_id]).catch(() => {});

    const accessToken = await getAccessToken();
    const driveRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(drive_file_id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    // Drive returns 204 on success and 404 if the file is already gone —
    // both count as "the file isn't there anymore", which is the goal.
    if (!driveRes.ok && driveRes.status !== 404) {
      const text = await driveRes.text();
      return new Response(JSON.stringify({ error: `drive delete failed: ${text}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
