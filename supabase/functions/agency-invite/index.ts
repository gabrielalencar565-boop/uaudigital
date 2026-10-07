import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Creates an invite for the caller's agency (the RPC enforces admin-only, seat limit and "email already in use")
// and then tries to e-mail the person through Supabase Auth. The link is always returned so the admin can also
// share it by hand — e-mail delivery is best-effort.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

    const caller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData?.user?.id) return json({ error: "unauthorized" }, 401);

    const { email, role, role_titles, origin, send_email } = await req.json();
    if (typeof email !== "string" || typeof origin !== "string" || !/^https?:\/\//.test(origin)) {
      return json({ error: "invalid_request" }, 400);
    }

    const { data, error } = await caller.rpc("create_agency_invite", {
      p_email: email,
      p_role: role === "admin" ? "admin" : "collaborator",
      p_role_titles: Array.isArray(role_titles) ? role_titles : [],
    });
    if (error) return json({ error: error.message }, 400);
    const invite = Array.isArray(data) ? data[0] : data;
    if (!invite?.token) return json({ error: "invite_failed" }, 500);

    const link = `${origin.replace(/\/$/, "")}/convite/${invite.token}`;
    let emailed = false;
    let emailError: string | null = null;

    if (send_email !== false) {
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      // who is inviting and to which agency: the invitation e-mail says "Ana, da Uau Digital, convidou você"
      // (separate keys from the owner-signup metadata, which the onboarding step reads)
      let inviterName: string | null = null;
      let agencyName: string | null = null;
      try {
        const { data: agencyId } = await caller.rpc("current_agency_id");
        const [{ data: prof }, { data: ag }] = await Promise.all([
          admin.from("profiles").select("full_name").eq("user_id", userData.user.id).maybeSingle(),
          agencyId ? admin.from("agencies").select("name").eq("id", agencyId).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        inviterName = (prof as any)?.full_name ?? null;
        agencyName = (ag as any)?.name ?? null;
      } catch { /* names are cosmetic: the invite goes out without them */ }
      const sent = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
        redirectTo: link,
        data: { signup_type: "invite", inviter_name: inviterName, invite_agency_name: agencyName },
      });
      if (sent.error) emailError = sent.error.message;
      else emailed = true;
    }

    return json({ id: invite.id, link, expires_at: invite.expires_at, emailed, email_error: emailError });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
