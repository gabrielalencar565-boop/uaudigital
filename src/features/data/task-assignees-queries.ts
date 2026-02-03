import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaskAssigneeRow = {
  id: string;
  task_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
};

/**
 * Busca todos os assignees de uma ou mais tarefas
 */
export function useTaskAssignees(taskIds?: string[]) {
  return useQuery({
    enabled: !!taskIds && taskIds.length > 0,
    queryKey: ["task_assignees", taskIds],
    queryFn: async (): Promise<TaskAssigneeRow[]> => {
      if (!taskIds || taskIds.length === 0) return [];
      const { data, error } = await supabase
        .from("task_assignees")
        .select("id, task_id, user_id, added_by, created_at")
        .in("task_id", taskIds);
      if (error) throw error;
      return (data ?? []) as TaskAssigneeRow[];
    },
  });
}

/**
 * Busca assignees por mês (para exibição na agenda)
 */
export function useTaskAssigneesByMonth(month?: string) {
  return useQuery({
    enabled: !!month,
    queryKey: ["task_assignees_month", month],
    queryFn: async (): Promise<TaskAssigneeRow[]> => {
      if (!month) return [];
      // Primeiro busca os task_ids do mês
      const [y, m] = month.split("-");
      const year = Number(y);
      const monthNum = Number(m) - 1;
      if (!Number.isFinite(year) || !Number.isFinite(monthNum)) return [];
      
      const startDate = new Date(year, monthNum, 1);
      const endDate = new Date(year, monthNum + 1, 0);
      const startStr = startDate.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];

      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("id")
        .is("deleted_at", null)
        .gte("due_date", startStr)
        .lte("due_date", endStr);
      if (tErr) throw tErr;
      
      const taskIds = (tasks ?? []).map((t: any) => t.id as string);
      if (taskIds.length === 0) return [];

      const { data, error } = await supabase
        .from("task_assignees")
        .select("id, task_id, user_id, added_by, created_at")
        .in("task_id", taskIds);
      if (error) throw error;
      return (data ?? []) as TaskAssigneeRow[];
    },
  });
}

/**
 * Adiciona múltiplos assignees a uma tarefa
 */
export function useAddTaskAssignees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; userIds: string[]; addedBy: string }) => {
      const payload = input.userIds.map((userId) => ({
        task_id: input.taskId,
        user_id: userId,
        added_by: input.addedBy,
      }));
      const { error } = await supabase.from("task_assignees").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_assignees"] });
      qc.invalidateQueries({ queryKey: ["task_assignees_month"] });
    },
  });
}

/**
 * Remove um assignee específico
 */
export function useRemoveTaskAssignee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; userId: string }) => {
      const { error } = await supabase
        .from("task_assignees")
        .delete()
        .eq("task_id", input.taskId)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_assignees"] });
      qc.invalidateQueries({ queryKey: ["task_assignees_month"] });
    },
  });
}

/**
 * Substitui todos os assignees de uma tarefa
 */
export function useSetTaskAssignees() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; userIds: string[]; addedBy: string }) => {
      // Remove todos os existentes
      const { error: delErr } = await supabase
        .from("task_assignees")
        .delete()
        .eq("task_id", input.taskId);
      if (delErr) throw delErr;

      // Adiciona os novos
      if (input.userIds.length > 0) {
        const payload = input.userIds.map((userId) => ({
          task_id: input.taskId,
          user_id: userId,
          added_by: input.addedBy,
        }));
        const { error: insErr } = await supabase.from("task_assignees").insert(payload);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_assignees"] });
      qc.invalidateQueries({ queryKey: ["task_assignees_month"] });
    },
  });
}
