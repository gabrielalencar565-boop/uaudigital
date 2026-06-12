import { useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CrmTaskType, CrmTaskStatus } from "../crm-constants";

export interface CrmTask {
  id: string;
  lead_id: string;
  tipo: CrmTaskType;
  titulo: string;
  descricao: string | null;
  due_at: string | null;
  status: CrmTaskStatus;
  assigned_user_id: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useCrmTasks(leadId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["crm-tasks", leadId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("crm_tasks" as any).select("*").order("due_at", { ascending: true, nullsFirst: false });
      if (leadId) q = q.eq("lead_id", leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as CrmTask[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("crm-tasks-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_tasks" }, () => {
        qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return query;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<CrmTask>) => {
      const { error } = await supabase.from("crm_tasks" as any).insert(t as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CrmTask> }) => {
      const { error } = await supabase.from("crm_tasks" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_tasks" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }),
  });
}
