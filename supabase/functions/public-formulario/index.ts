// Public lead-capture forms of the CRM (page /f/:slug). No login. The page only learns the form's questions and the thank-you text;
// where the lead goes (stage, owner, tag) and which automations run stay on the server. Actions (POST JSON, all carry `slug`):
//   load    {}                          → name, description and questions of a published form
//   submit  { answers: {label: text} }  → validates, creates/updates the lead and stores the answers (comercial_submit_form)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,80}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const slug = String(payload?.slug ?? "");
  const action = String(payload?.action ?? "");
  if (!SLUG_RE.test(slug)) return json({ error: "not_found" }, 404);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    if (action === "load") {
      const { data: form } = await db
        .from("comercial_forms")
        .select("name, description, fields, agency_id")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (!form) return json({ error: "not_found" }, 404);
      const { data: agency } = await db.from("agencies").select("name").eq("id", form.agency_id).maybeSingle();
      const fields = ((form.fields as any[]) ?? []).map((f) => ({
        type: f.type, label: f.label, required: !!f.required, options: Array.isArray(f.options) ? f.options : [],
      }));
      return json({ name: form.name, description: form.description, fields, agency_name: agency?.name ?? "" });
    }

    if (action === "submit") {
      // A hidden field real people never fill: bots do
      if (String(payload?.website ?? "").trim()) return json({ ok: true });
      const answers = payload?.answers;
      if (!answers || typeof answers !== "object" || Array.isArray(answers)) return json({ error: "invalid_request" }, 400);
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
        clean[String(k).slice(0, 300)] = String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").slice(0, 3000);
      }
      const { data, error } = await db.rpc("comercial_submit_form", { p_slug: slug, p_answers: clean });
      if (error) {
        const msg = error.message ?? "";
        if (msg.includes("form_not_found")) return json({ error: "not_found" }, 404);
        if (msg.includes("too_many")) return json({ error: "too_many_requests" }, 429);
        if (msg.includes("required:")) return json({ error: "required", field: msg.split("required:")[1]?.trim() }, 400);
        console.error("public-formulario submit error:", msg);
        return json({ error: "server_error" }, 500);
      }
      return json({ ok: true, thanks: (data as any)?.thanks ?? "" });
    }

    return json({ error: "invalid_action" }, 400);
  } catch (e) {
    console.error("public-formulario error:", e instanceof Error ? e.message : e);
    return json({ error: "server_error" }, 500);
  }
});
