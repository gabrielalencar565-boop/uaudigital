import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface PeriodicStage {
  key: string;   // e.g. "custom_reuniao_semanal"
  label: string; // human-readable
}

/**
 * Fetches periodic (custom) stages defined in the Pontuação admin panel.
 * These are stored in scoring_config with stage prefix `custom_` and are
 * isolated from the standard workflow (Planejamento → PDF).
 */
export function usePeriodicStages() {
  return useQuery({
    queryKey: ["scoring_config", "periodic_stages"],
    queryFn: async (): Promise<PeriodicStage[]> => {
      const { data, error } = await sb
        .from("scoring_config")
        .select("stage, label")
        .like("stage", "custom_%")
        .order("label");
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ key: r.stage, label: r.label }));
    },
    staleTime: 60_000,
  });
}

export function isPeriodicStageKey(key: string | null | undefined): boolean {
  return !!key && key.startsWith("custom_");
}
