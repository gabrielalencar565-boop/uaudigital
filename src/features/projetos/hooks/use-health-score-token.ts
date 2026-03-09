import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HealthScoreToken {
  id: string;
  client_id: string;
  token: string;
  slug: string | null;
  month: number;
  year: number;
  used_at: string | null;
  created_at: string;
}

export function useHealthScoreToken(clientId: string | null, month: number, year: number) {
  return useQuery({
    queryKey: ["health_score_token", clientId, month, year],
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase
        .from("health_score_tokens" as any)
        .select("*")
        .eq("client_id", clientId)
        .eq("month", month)
        .eq("year", year)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as HealthScoreToken | null;
    },
    enabled: !!clientId,
  });
}

export function useCreateHealthScoreToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { client_id: string; month: number; year: number }) => {
      const { data, error } = await supabase
        .from("health_score_tokens" as any)
        .insert(params as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as HealthScoreToken;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["health_score_token", vars.client_id, vars.month, vars.year] });
      toast.success("Link de avaliação criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
