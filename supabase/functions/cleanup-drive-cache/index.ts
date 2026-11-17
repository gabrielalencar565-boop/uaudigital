// One-off maintenance utility: empties the drive-media-cache bucket to reclaim Storage
// quota. Safe to run any time — every cached file is regenerated on-demand from Google
// Drive the next time it's requested (see drive-file-proxy/index.ts), so this never loses
// real data, only the byte-level cache copy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "drive-media-cache";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let totalDeleted = 0;
  try {
    while (true) {
      const { data: files, error } = await admin.storage.from(BUCKET).list("", { limit: 1000 });
      if (error) throw error;
      if (!files || files.length === 0) break;

      const names = files.map((f) => f.name);
      const { error: delErr } = await admin.storage.from(BUCKET).remove(names);
      if (delErr) throw delErr;

      totalDeleted += names.length;
      if (files.length < 1000) break;
    }
    return new Response(JSON.stringify({ totalDeleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), totalDeleted }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
