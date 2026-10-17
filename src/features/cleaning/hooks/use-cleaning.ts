import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types
export interface CleaningCategory {
  id: string;
  name: string;
  emoji: string | null;
  is_active: boolean;
}

export interface CleaningSchedule {
  id: string;
  day_of_week: number;
  user_id: string;
  category_id: string;
  is_active: boolean;
  due_time: string; // e.g. "18:00:00"
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
      return (data ?? []) as unknown as CleaningCategory[];
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

export function useSetCleaningCategoryEmoji() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, emoji }: { id: string; emoji: string | null }) => {
      const { error } = await supabase.from("cleaning_categories").update({ emoji } as never).eq("id", id);
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
    mutationFn: async (params: { day_of_week: number; user_id: string; category_id: string; due_time?: string }) => {
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

export function useUpdateCleaningSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; user_id?: string; category_id?: string; due_time?: string }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from("cleaning_schedules")
        .update(updates as any)
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

// ─── Importar a escala montada a partir de texto ───
export interface CleaningImportRow { day: number; userId: string; categoryId: string | null; categoryName: string; time: string }

const normName = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Cria as categorias que faltam e as escalas da lista. Quem já existe (mesmo dia, pessoa e categoria) é só reativado e ajustado no horário.
 * Com `replace`, o que estava na escala e não veio na lista é desativado (não apagado: o histórico de conclusões fica).
 */
export function useImportCleaningSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rows, replace }: { rows: CleaningImportRow[]; replace: boolean }) => {
      const { data: cats, error: catErr } = await supabase.from("cleaning_categories").select("id, name");
      if (catErr) throw catErr;
      const catByName = new Map<string, string>(((cats ?? []) as { id: string; name: string }[]).map((c) => [normName(c.name), c.id]));
      let newCategories = 0;
      for (const r of rows) {
        const key = normName(r.categoryName);
        if (r.categoryId || catByName.has(key)) continue;
        const { data, error } = await supabase.from("cleaning_categories").insert({ name: r.categoryName.trim() } as never).select("id").single();
        if (error) throw error;
        catByName.set(key, (data as { id: string }).id);
        newCategories++;
      }

      const wanted = new Map<string, { day: number; userId: string; categoryId: string; time: string }>();
      for (const r of rows) {
        const categoryId = r.categoryId ?? catByName.get(normName(r.categoryName));
        if (!categoryId) continue;
        wanted.set(`${r.day}|${r.userId}|${categoryId}`, { day: r.day, userId: r.userId, categoryId, time: r.time });
      }

      const { data: existing, error: exErr } = await supabase.from("cleaning_schedules").select("id, day_of_week, user_id, category_id, is_active, due_time");
      if (exErr) throw exErr;
      const byKey = new Map(((existing ?? []) as CleaningSchedule[]).map((s) => [`${s.day_of_week}|${s.user_id}|${s.category_id}`, s]));

      let created = 0;
      let updated = 0;
      for (const [key, w] of wanted) {
        const due = `${w.time}:00`;
        const found = byKey.get(key);
        if (!found) {
          const { error } = await supabase.from("cleaning_schedules").insert({ day_of_week: w.day, user_id: w.userId, category_id: w.categoryId, due_time: due } as never);
          if (error) throw error;
          created++;
        } else if (!found.is_active || found.due_time?.slice(0, 5) !== w.time) {
          const { error } = await supabase.from("cleaning_schedules").update({ is_active: true, due_time: due } as never).eq("id", found.id);
          if (error) throw error;
          updated++;
        }
      }

      let removed = 0;
      if (replace) {
        const stale = [...byKey.entries()].filter(([key, s]) => s.is_active && !wanted.has(key)).map(([, s]) => s.id);
        if (stale.length) {
          const { error } = await supabase.from("cleaning_schedules").update({ is_active: false } as never).in("id", stale);
          if (error) throw error;
          removed = stale.length;
        }
      }
      return { created, updated, removed, newCategories };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cleaning_schedules"] });
      qc.invalidateQueries({ queryKey: ["cleaning_categories"] });
    },
  });
}
