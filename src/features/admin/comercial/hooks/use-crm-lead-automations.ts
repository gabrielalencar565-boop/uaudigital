import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CrmWelcomeScenario = "padrao" | "instagram" | "orcamento" | "fora_horario";

export type CrmLeadAutomation = {
  scenario: CrmWelcomeScenario;
  enabled: boolean;
  message_template: string;
  cooldown_days: number;
  followup_minutes: number;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  updated_at: string;
};

const KEY = ["crm_lead_automations"] as const;

export function useCrmLeadAutomations() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<CrmLeadAutomation[]> => {
      const { data, error } = await supabase
        .from("crm_lead_automations" as any)
        .select("*")
        .order("scenario", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CrmLeadAutomation[];
    },
  });
}

export function useUpsertCrmLeadAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CrmLeadAutomation> & { scenario: CrmWelcomeScenario }) => {
      const { error } = await supabase
        .from("crm_lead_automations" as any)
        .update({
          enabled: input.enabled,
          message_template: input.message_template,
          cooldown_days: input.cooldown_days,
          followup_minutes: input.followup_minutes,
          business_hours_start: input.business_hours_start,
          business_hours_end: input.business_hours_end,
          business_days: input.business_days,
        })
        .eq("scenario", input.scenario);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
