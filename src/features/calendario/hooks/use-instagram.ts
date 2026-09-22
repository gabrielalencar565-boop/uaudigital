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
