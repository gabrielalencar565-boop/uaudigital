import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmStage, CrmLossReason } from "../crm-constants";

export interface CrmLead {
  id: string;
  nome: string;
  telefone: string | null;
  phone_key: string | null;
  empresa: string | null;
  cidade: string | null;
  segmento: string | null;
  interesse: string | null;
  origem: string | null;
  responsavel_id: string | null;
  stage: CrmStage;
  stage_changed_at: string;
  valor_estimado: number | null;
  observacoes: string | null;
  loss_reason: CrmLossReason | null;
  ja_investe_marketing: boolean | null;
  orcamento_aproximado: number | null;
  principal_problema: string | null;
  urgencia: "baixa" | "media" | "alta" | null;
  nivel_interesse: number | null;
  potencial_fechamento: "baixo" | "medio" | "alto" | null;
  whatsapp_contact_id: string | null;
  last_message_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCrmLeads() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["crm-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_leads" as any)
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CrmLead[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("crm-leads-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_leads" },
        () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CrmLead> }) => {
      const { error } = await supabase.from("crm_leads" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Partial<CrmLead>) => {
      const { data, error } = await supabase
        .from("crm_leads" as any)
        .insert(lead as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CrmLead;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_leads" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-leads"] }),
  });
}

export function useLeadActivity(leadId: string | null) {
  return useQuery({
    enabled: !!leadId,
    queryKey: ["crm-activity", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_activity_log" as any)
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}
