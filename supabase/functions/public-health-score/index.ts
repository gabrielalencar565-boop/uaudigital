import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SCORE_KEYS = [
  "resultado_percebido",
  "alinhamento_estrategico",
  "comunicacao_atendimento",
  "qualidade_entregas",
  "satisfacao_geral",
] as const;
const COMMENT_KEYS = [
  "comentario_resultado",
  "comentario_alinhamento",
  "comentario_comunicacao",
  "comentario_qualidade",
  "comentario_satisfacao",
] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const slug = typeof payload?.slug === "string" ? payload.slug.trim() : "";
  if (!slug || slug.length > 200 || !/^[A-Za-z0-9_-]+$/.test(slug)) {
    return json({ error: "invalid_slug" }, 400);
  }

  try {
    const { data: tokenRow } = await admin
      .from("health_score_tokens")
      .select("id, client_id, month, year, used_at")
      .eq("slug", slug)
      .maybeSingle();

    if (!tokenRow) return json({ error: "token_not_found" }, 404);

    if (action === "load") {
      let client_name: string | null = null;
      if (tokenRow.client_id) {
        const { data: client } = await admin
          .from("clients")
          .select("name")
          .eq("id", tokenRow.client_id)
          .maybeSingle();
        client_name = client?.name ?? null;
      }
      return json({
        token: {
          id: tokenRow.id,
          client_id: tokenRow.client_id,
          month: tokenRow.month,
          year: tokenRow.year,
          used_at: tokenRow.used_at,
          client_name,
        },
      });
    }

    if (action === "submit") {
      if (tokenRow.used_at) return json({ error: "token_already_used" }, 409);

      const values: Record<string, number> = {};
      for (const k of SCORE_KEYS) {
        const v = Number(payload?.values?.[k]);
        if (!Number.isFinite(v) || v < 0 || v > 10) return json({ error: `invalid_${k}` }, 400);
        values[k] = Math.round(v);
      }
      const comments: Record<string, string | null> = {};
      for (const k of COMMENT_KEYS) {
        const raw = payload?.comments?.[k];
        comments[k] = typeof raw === "string" ? raw.slice(0, 1000) : null;
      }

      const { error: insertError } = await admin.from("health_scores").insert({
        client_id: tokenRow.client_id,
        evaluated_by: "00000000-0000-0000-0000-000000000000",
        month: tokenRow.month,
        year: tokenRow.year,
        ...values,
        ...comments,
      });
      if (insertError) {
        console.error("health_scores insert error:", insertError);
        return json({ error: "insert_failed" }, 500);
      }

      await admin
        .from("health_score_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("id", tokenRow.id);

      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("public-health-score error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
