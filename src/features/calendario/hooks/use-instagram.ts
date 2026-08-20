import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
    },
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
