import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface HealthScore {
  id: string;
  client_id: string;
  evaluated_by: string;
  month: number;
  year: number;
  resultado_percebido: number;
  alinhamento_estrategico: number;
  comunicacao_atendimento: number;
  qualidade_entregas: number;
  satisfacao_geral: number;
  comentario_resultado: string | null;
  comentario_alinhamento: string | null;
  comentario_comunicacao: string | null;
  comentario_qualidade: string | null;
  comentario_satisfacao: string | null;
  created_at: string;
  updated_at: string;
}

export function useHealthScores(month: number, year: number) {
  return useQuery({
    queryKey: ["health_scores", year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_scores" as any)
        .select("*")
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as HealthScore[];
    },
  });
}

export function useUpsertHealthScore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (score: Omit<HealthScore, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("health_scores" as any)
        .upsert(score as any, { onConflict: "client_id,month,year" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["health_scores", vars.year, vars.month] });
      toast.success("Health Score salvo!");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
