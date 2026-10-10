import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resolveStageRoles } from "@/lib/role-stage-mapping";

const sb = supabase as any;

/** Which cargo answers for each stage of the flow (the agency's choice on top of the built-in defaults). */
export function useStageRoles() {
  return useQuery({
    queryKey: ["flow_stage_roles"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await sb.from("flow_stage_roles").select("stage_key, role_title");
      if (error) throw error;
      return resolveStageRoles(data);
    },
  });
}

export function useSaveStageRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roles: Record<string, string | null>) => {
      const { data: agencyId, error: aErr } = await sb.rpc("current_agency_id");
      if (aErr || !agencyId) throw new Error("Não foi possível identificar a agência.");
      const now = new Date().toISOString();
      const rows = Object.entries(roles).map(([stage_key, role_title]) => ({ agency_id: agencyId, stage_key, role_title, updated_at: now }));
      const { error } = await sb.from("flow_stage_roles").upsert(rows, { onConflict: "agency_id,stage_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flow_stage_roles"] }),
    onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar os cargos das etapas"),
  });
}
