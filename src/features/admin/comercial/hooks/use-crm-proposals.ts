import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmProposalStatus } from "../crm-constants";

export interface CrmProposal {
  id: string;
  lead_id: string;
  valor: number | null;
  enviada_em: string | null;
  status: CrmProposalStatus;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  resultado: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCrmProposals(leadId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["crm-proposals", leadId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("crm_proposals" as any).select("*").order("created_at", { ascending: false });
      if (leadId) q = q.eq("lead_id", leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmProposal[];
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel("crm-proposals-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_proposals" }, () => {
        qc.invalidateQueries({ queryKey: ["crm-proposals"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
  return query;
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Partial<CrmProposal>) => {
      const { data, error } = await supabase.from("crm_proposals" as any).insert(p as any).select().single();
      if (error) throw error;
      return data as unknown as CrmProposal;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-proposals"] }),
  });
}

export function useUpdateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CrmProposal> }) => {
      const { error } = await supabase.from("crm_proposals" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-proposals"] }),
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_proposals" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-proposals"] }),
  });
}

export async function uploadProposalFile(leadId: string, file: File): Promise<{ url: string; nome: string }> {
  const path = `${leadId}/${crypto.randomUUID()}-${file.name}`;
  const up = await supabase.storage.from("crm-proposals").upload(path, file, { upsert: false });
  if (up.error) throw up.error;
  const signed = await supabase.storage.from("crm-proposals").createSignedUrl(path, 60 * 60 * 24 * 365);
  if (signed.error) throw signed.error;
  return { url: signed.data.signedUrl, nome: file.name };
}
