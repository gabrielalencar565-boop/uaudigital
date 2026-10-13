import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useInstagramConnections } from "./use-instagram";

const sb = supabase as any;

// Instagram profiles that are not clients but get invited as collaborators. An invite goes to whoever owns the typed @, so a profile
// only counts as `verified` after someone looked at it on Instagram and confirmed it (agency-wide). The database refuses to schedule
// a publication with an unconfirmed collaborator, and instagram-publish refuses to send it.
export type Partner = { username: string; photo_url: string | null; verified_at: string | null; verified_by: string | null };
export type CollaboratorStatus = "client" | "verified" | "pending";

export function usePartners() {
  return useQuery({
    queryKey: ["instagram_partners"],
    queryFn: async (): Promise<Partner[]> => {
      const { data, error } = await sb.from("instagram_partners").select("username, photo_url, verified_at, verified_by").order("username");
      if (error) throw error;
      return (data ?? []) as Partner[];
    },
  });
}

export function useSavePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ username, photo, verify }: { username: string; photo?: File | null; verify?: boolean }) => {
      const row: Record<string, unknown> = { username };
      if (photo) {
        const ext = (photo.name.split(".").pop() || "jpg").toLowerCase();
        const path = `partner-photos/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("app-assets").upload(path, photo, { upsert: true, contentType: photo.type });
        if (up.error) throw up.error;
        row.photo_url = supabase.storage.from("app-assets").getPublicUrl(path).data.publicUrl;
      }
      if (verify) {
        const { data: { user } } = await supabase.auth.getUser();
        row.verified_at = new Date().toISOString();
        row.verified_by = user?.id ?? null;
      }
      // agency_id comes from the column default; only the columns sent are changed on an existing row
      const { error } = await sb.from("instagram_partners").upsert(row, { onConflict: "agency_id,username" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instagram_partners"] }),
    onError: (e: Error) => toast.error(e.message || "Não consegui salvar o perfil."),
  });
}

/** Which collaborators are confirmed: an own client's @, or a partner someone confirmed. Everything else is `pending`. */
export function useCollaboratorStatus(collaborators: string[]) {
  const partnersQ = usePartners();
  const connectionsQ = useInstagramConnections();
  const clientNames = new Set((connectionsQ.data ?? []).map((c) => c.instagram_username?.toLowerCase()).filter((n): n is string => !!n));
  const verified = new Set((partnersQ.data ?? []).filter((p) => p.verified_at).map((p) => p.username));
  const statusOf = (name: string): CollaboratorStatus => (clientNames.has(name) ? "client" : verified.has(name) ? "verified" : "pending");
  // while the lists are still loading nothing is flagged, so the warning doesn't flash on open
  const ready = partnersQ.isSuccess && connectionsQ.isSuccess;
  const pending = ready ? collaborators.filter((c) => statusOf(c) === "pending") : [];
  return { statusOf, pending, ready, partners: partnersQ.data ?? [] };
}
