import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type InstagramConnection = {
  client_id: string;
  status: "active" | "revoked" | "expired" | "error";
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

export function useConnectInstagram() {
  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      const { data, error } = await supabase.functions.invoke("instagram-connect", {
        body: { action: "start", client_id: clientId },
      });
      if (error) throw error;
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
      if (error) throw error;
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
