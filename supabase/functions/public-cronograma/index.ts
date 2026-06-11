import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  try {
    if (action === "load") {
      const taskId = String(payload?.taskId ?? "");
      const clientFilterId = payload?.clientFilterId ? String(payload.clientFilterId) : null;
      if (!UUID_RE.test(taskId)) return json({ error: "invalid_taskId" }, 400);
      if (clientFilterId && !UUID_RE.test(clientFilterId)) return json({ error: "invalid_clientFilterId" }, 400);

      let clientName: string | null = null;
      let parentTitle: string | null = null;
      let resolvedClientId = clientFilterId;

      if (resolvedClientId) {
        const { data: client } = await admin.from("clients").select("name").eq("id", resolvedClientId).maybeSingle();
        clientName = client?.name ?? null;
        parentTitle = client?.name ?? null;
      } else {
        const { data: parent } = await admin
          .from("pm_tasks")
          .select("title, client_id")
          .eq("id", taskId)
          .maybeSingle();
        if (parent) {
          parentTitle = parent.title;
          resolvedClientId = parent.client_id;
          if (parent.client_id) {
            const { data: client } = await admin.from("clients").select("name").eq("id", parent.client_id).maybeSingle();
            clientName = client?.name ?? null;
          }
        }
      }

      let childrenQuery = admin
        .from("pm_tasks")
        .select("id, title, post_type, posting_date, posting_time, caption, cover_url, client_id, parent_task_id")
        .not("posting_date", "is", null)
        .order("posting_date", { ascending: true });

      if (clientFilterId) {
        childrenQuery = childrenQuery.eq("client_id", clientFilterId).not("parent_task_id", "is", null);
      } else {
        childrenQuery = childrenQuery.eq("parent_task_id", taskId);
      }

      const { data: children } = await childrenQuery;
      const childRows = (children ?? []).map((c: any) => ({
        id: c.id, title: c.title, post_type: c.post_type,
        posting_date: c.posting_date, posting_time: c.posting_time,
        caption: c.caption, cover_url: c.cover_url,
      }));

      let attachments: any[] = [];
      let feedbacks: any[] = [];
      if (childRows.length > 0) {
        const childIds = childRows.map((c: any) => c.id);
        const { data: atts } = await admin
          .from("pm_attachments")
          .select("task_id, public_url, file_type, order_index, created_at")
          .in("task_id", childIds)
          .order("order_index", { ascending: true })
          .order("created_at", { ascending: true });
        attachments = atts ?? [];

        const { data: fbs } = await admin
          .from("pm_cronograma_feedback")
          .select("id, task_id, status, feedback_text")
          .in("task_id", childIds);
        feedbacks = fbs ?? [];
      }

      return json({ clientName, parentTitle, posts: childRows, attachments, feedbacks });
    }

    if (action === "feedback") {
      const postId = String(payload?.postId ?? "");
      const status = String(payload?.status ?? "");
      const text = payload?.text ? String(payload.text).slice(0, 2000) : null;
      if (!UUID_RE.test(postId)) return json({ error: "invalid_postId" }, 400);
      if (!["aprovado", "alteracao"].includes(status)) return json({ error: "invalid_status" }, 400);

      // Verify the task exists (legitimate target) before allowing public feedback
      const { data: task } = await admin.from("pm_tasks").select("id").eq("id", postId).maybeSingle();
      if (!task) return json({ error: "task_not_found" }, 404);

      const { data: existing } = await admin
        .from("pm_cronograma_feedback")
        .select("id")
        .eq("task_id", postId)
        .maybeSingle();

      if (existing) {
        await admin
          .from("pm_cronograma_feedback")
          .update({ status, feedback_text: text, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await admin
          .from("pm_cronograma_feedback")
          .insert({ task_id: postId, status, feedback_text: text });
      }

      const { data } = await admin
        .from("pm_cronograma_feedback")
        .select("id, task_id, status, feedback_text")
        .eq("task_id", postId)
        .maybeSingle();
      return json({ feedback: data });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("public-cronograma error:", e);
    return json({ error: "internal_error" }, 500);
  }
});
