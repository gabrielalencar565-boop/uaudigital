import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClientStageRow } from "@/features/data/queries";

export type ClientCycleRow = {
  id: string;
  client_id: string;
  year: number;
  month: number;
  due_date: string;
  is_active: boolean;
};

export type ClientCycleStageRow = {
  id: string;
  cycle_id: string;
  client_id: string;
  year: number;
  month: number;
  stage: string;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
};

export function useAllClientStages() {
  return useQuery({
    queryKey: ["client_stages", "all"],
    queryFn: async (): Promise<ClientStageRow[]> => {
      const { data, error } = await supabase
        .from("client_stages")
        .select("id, client_id, stage, completed, completed_at, completed_by");
      if (error) throw error;
      return (data ?? []) as ClientStageRow[];
    },
  });
}

export function useClientCycles(year: number) {
  return useQuery({
    queryKey: ["client_cycles", year],
    queryFn: async (): Promise<ClientCycleRow[]> => {
      const { data, error } = await supabase
        .from("client_cycles")
        .select("id, client_id, year, month, due_date, is_active")
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as ClientCycleRow[];
    },
  });
}

export function useAllClientCycleStages(year: number) {
  return useQuery({
    queryKey: ["client_cycle_stages", { year }],
    queryFn: async (): Promise<ClientCycleStageRow[]> => {
      // join via client_cycles to filter by year
      const { data, error } = await supabase
        .from("client_cycle_stages")
        .select(
          "id, cycle_id, stage, completed, completed_at, completed_by, client_cycles!inner(year, month, client_id)",
        )
        .eq("client_cycles.year", year);
      if (error) throw error;
      // supabase returns extra join key; we strip via mapping
      return (data ?? []).map((r: any) => ({
        id: r.id,
        cycle_id: r.cycle_id,
        client_id: r.client_cycles?.client_id,
        year: r.client_cycles?.year,
        month: r.client_cycles?.month,
        stage: r.stage,
        completed: r.completed,
        completed_at: r.completed_at,
        completed_by: r.completed_by,
      })) as ClientCycleStageRow[];
    },
  });
}
