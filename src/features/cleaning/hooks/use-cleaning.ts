import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types
export interface CleaningCategory {
  id: string;
  name: string;
  is_active: boolean;
}

export interface CleaningSchedule {
  id: string;
  day_of_week: number;
  user_id: string;
  category_id: string;
  is_active: boolean;
}

export interface CleaningCompletion {
  id: string;
  schedule_id: string;
  completed_date: string;
  completed_by: string;
  completed_at: string;
}

const DAYS_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export { DAYS_PT };

// ─── Categories ───
export function useCleaningCategories() {
  return useQuery({
    queryKey: ["cleaning_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cleaning_categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CleaningCategory[];
    },
  });
}

export function useCreateCleaningCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("cleaning_categories")
        .insert({ name } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cleaning_categories"] }),
  });
}

export function useDeleteCleaningCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cleaning_categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cleaning_categories"] });
      qc.invalidateQueries({ queryKey: ["cleaning_schedules"] });
    },
  });
}

// ─── Schedules ───
export function useCleaningSchedules() {
  return useQuery({
    queryKey: ["cleaning_schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cleaning_schedules")
        .select("*")
        .eq("is_active", true)
        .order("day_of_week");
      if (error) throw error;
      return (data ?? []) as CleaningSchedule[];
    },
  });
}

export function useCreateCleaningSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { day_of_week: number; user_id: string; category_id: string }) => {
      const { error } = await supabase
        .from("cleaning_schedules")
        .insert(params as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cleaning_schedules"] }),
  });
}

export function useDeleteCleaningSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cleaning_schedules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cleaning_schedules"] }),
  });
}

// ─── Completions ───
export function useCleaningCompletions(date: string) {
  return useQuery({
    queryKey: ["cleaning_completions", date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cleaning_completions")
        .select("*")
        .eq("completed_date", date);
      if (error) throw error;
      return (data ?? []) as CleaningCompletion[];
    },
  });
}

export function useToggleCleaningCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { scheduleId: string; date: string; userId: string; isCompleted: boolean }) => {
      if (params.isCompleted) {
        // Remove completion
        const { error } = await supabase
          .from("cleaning_completions")
          .delete()
          .eq("schedule_id", params.scheduleId)
          .eq("completed_date", params.date);
        if (error) throw error;
      } else {
        // Add completion
        const { error } = await supabase
          .from("cleaning_completions")
          .insert({
            schedule_id: params.scheduleId,
            completed_date: params.date,
            completed_by: params.userId,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["cleaning_completions", vars.date] });
    },
  });
}
