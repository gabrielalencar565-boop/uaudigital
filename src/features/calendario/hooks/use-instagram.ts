import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type InstagramConnection = {
  client_id: string;
  status: "active" | "revoked" | "expired" | "error";
  auth_provider: "facebook_login" | "instagram_login";
  facebook_page_name: string | null;
  instagram_username: string | null;
  token_expires_at: string;
  last_error: string | null;
};

// Connection status never carries access_token — instagram-connect's "status" action
// selects only the non-secret columns, so the frontend can never hold the real credential.
export function useInstagramConnections(clientId?: string) {
  return useQuery({
    queryKey: ["instagram_connections", clientId ?? "all"],
    queryFn: async (): Promise<InstagramConnection[]> => {
      const { data, error } = await supabase.functions.invoke("instagram-connect", {
        body: { action: "status", ...(clientId ? { client_id: clientId } : {}) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.connections ?? [];
    },
  });
}

// Both mutations below used to fail completely silently on error (no onError anywhere,
// including at the call sites) — a stale/revoked session, for example, would 401 and the
// UI would just look like nothing happened, with no way to tell "it failed" from "it's still
// connecting". These toasts are the fix: any failure is now visible instead of silent.
function instagramErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("session_not_found") || message.includes("invalid session")) {
    return "Sua sessão expirou — recarregue a página e faça login de novo.";
  }
  return message;
}

// supabase-js throws a FunctionsHttpError for any non-2xx response whose own `.message` is
// always the generic "Edge Function returned a non-2xx status code" — the JSON body our edge
// function actually returned (the real reason, e.g. "admin role required") only lives on
// `error.context` (the raw Response), unread by default. Without this, every failure from
// instagram-connect surfaced as that one generic toast no matter what actually went wrong.
async function resolveFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) return body.error as string;
    } catch {
      // context body wasn't JSON — fall through to the generic message below.
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export function useConnectInstagram() {
  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      // "start_ig_login" is the direct Instagram Login flow (Instagram API with Instagram
      // Login) — no Facebook Page involved. Accounts connected via the older Facebook-Page
      // flow keep working unchanged; only new connections use this from now on.
      const { data, error } = await supabase.functions.invoke("instagram-connect", {
        body: { action: "start_ig_login", client_id: clientId },
      });
      if (error) throw new Error(await resolveFunctionError(error));
      if (data?.error) throw new Error(data.error);
      return data.url as string;
    },
    onError: (error) => toast.error(instagramErrorMessage(error)),
  });
}

export function useDisconnectInstagram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      const { data, error } = await supabase.functions.invoke("instagram-connect", {
        body: { action: "disconnect", client_id: clientId },
      });
      if (error) throw new Error(await resolveFunctionError(error));
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instagram_connections"] });
      toast.success("Instagram desconectado.");
    },
    onError: (error) => toast.error(instagramErrorMessage(error)),
  });
}

/** Copies the connected Instagram account's profile picture into the client's photo. */
export function useSyncInstagramPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      const { data, error } = await supabase.functions.invoke("instagram-profile-photo", {
        body: { client_id: clientId, force: true },
      });
      if (error) throw new Error(await resolveFunctionError(error));
      if (data?.error) throw new Error(data.error);
      return data as { updated: boolean; reason?: string };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients_admin_all"] });
      if (res.updated) toast.success("Foto do Instagram aplicada.");
      else toast.error(res.reason === "no_picture" ? "O Instagram não devolveu a foto desta conta." : "Não foi possível buscar a foto agora.");
    },
    onError: (error) => toast.error(instagramErrorMessage(error)),
  });
}

export function usePublishToInstagram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ publicationId, calendarId }: { publicationId: string; calendarId: string }) => {
      const { data, error } = await supabase.functions.invoke("instagram-publish", {
        body: { action: "publish_one", publication_id: publicationId },
      });
      if (error) throw error;
      if (data?.error && !data?.success) throw new Error(data.error);
      return { ...data, calendarId };
    },
    onSuccess: ({ calendarId }) => {
      qc.invalidateQueries({ queryKey: ["calendar_publications", calendarId] });
    },
  });
}

// ── Posts em espera: ficaram atrasados enquanto o Instagram estava desconectado; ao reconectar o cron não os publica
// até alguém escolher publicar, reagendar ou cancelar (instagram_hold, ver instagram-connect). ──

export type HeldPublication = {
  id: string;
  calendar_id: string;
  title: string;
  caption: string | null;
  content_type: string;
  publish_date: string;
  publish_time: string;
  cover_url: string | null;
};

export function useHeldPublications(clientId: string | null) {
  return useQuery({
    queryKey: ["instagram_held", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<HeldPublication[]> => {
      const sb = supabase as any;
      const { data: cals, error: e1 } = await sb.from("publication_calendars").select("id").eq("client_id", clientId);
      if (e1) throw e1;
      const calendarIds = (cals ?? []).map((c: { id: string }) => c.id);
      if (calendarIds.length === 0) return [];
      const { data: posts, error } = await sb
        .from("calendar_publications")
        .select("id, calendar_id, title, caption, content_type, publish_date, publish_time, cover_attachment_id")
        .in("calendar_id", calendarIds)
        .eq("instagram_hold", true)
        .is("deleted_at", null)
        .order("publish_date")
        .order("publish_time");
      if (error) throw error;
      const rows = (posts ?? []) as (Omit<HeldPublication, "cover_url"> & { cover_attachment_id: string | null })[];
      const coverIds = rows.map((r) => r.cover_attachment_id).filter((v): v is string => !!v);
      const covers = new Map<string, string>();
      if (coverIds.length > 0) {
        const { data: atts } = await sb.from("pm_attachments").select("id, public_url").in("id", coverIds);
        (atts ?? []).forEach((a: { id: string; public_url: string | null }) => { if (a.public_url) covers.set(a.id, a.public_url); });
      }
      return rows.map(({ cover_attachment_id, ...r }) => ({ ...r, cover_url: cover_attachment_id ? covers.get(cover_attachment_id) ?? null : null }));
    },
  });
}

export type HeldDecision =
  | { id: string; action: "pub" }
  | { id: string; action: "cancel" }
  | { id: string; action: "re"; date: string; time: string };

/** Aplica as escolhas. Publicar/reagendar/cancelar tiram o post da espera; a publicação em si segue em segundo plano (pode levar minutos num vídeo). */
export function useResolveHeldPublications(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (decisions: HeldDecision[]) => {
      const sb = supabase as any;
      const clean = { instagram_hold: false, instagram_status: "not_published", instagram_error: null, instagram_publish_attempted_at: null };
      const toPublish: string[] = [];
      for (const d of decisions) {
        let patch: Record<string, unknown>;
        if (d.action === "cancel") patch = { ...clean, instagram_scheduled: false };
        else if (d.action === "re") patch = { ...clean, publish_date: d.date, publish_time: d.time.length === 5 ? `${d.time}:00` : d.time };
        else { patch = clean; toPublish.push(d.id); }
        const { error } = await sb.from("calendar_publications").update(patch).eq("id", d.id);
        if (error) throw error;
      }
      return toPublish;
    },
    onSuccess: (toPublish) => {
      qc.invalidateQueries({ queryKey: ["instagram_held", clientId] });
      qc.invalidateQueries({ queryKey: ["calendar_publications"] });
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      if (toPublish.length > 0) {
        toast.info(toPublish.length === 1 ? "Publicando 1 post…" : `Publicando ${toPublish.length} posts…`);
        void Promise.allSettled(
          toPublish.map(async (id) => {
            const { data, error } = await supabase.functions.invoke("instagram-publish", { body: { action: "publish_one", publication_id: id } });
            if (error) throw new Error(await resolveFunctionError(error));
            if (data?.error && !data?.success) throw new Error(data.error);
          }),
        ).then((results) => {
          const failed = results.filter((r) => r.status === "rejected").length;
          if (failed > 0) toast.error(`${failed} ${failed > 1 ? "posts não saíram" : "post não saiu"} — veja o motivo no Cronograma.`);
          else toast.success(toPublish.length === 1 ? "Post publicado." : "Posts publicados.");
          qc.invalidateQueries({ queryKey: ["calendar_publications"] });
        });
      }
    },
    onError: (error) => toast.error(instagramErrorMessage(error)),
  });
}
