import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface PmTag {
  id: string;
  name: string;
  color_key: string;
  created_by: string;
  created_at: string;
}

export function usePmTags() {
  return useQuery<PmTag[]>({
    queryKey: ["pm_tags"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("pm_tags")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreatePmTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; color_key: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await sb
        .from("pm_tags")
        .insert({ ...payload, created_by: user.id })
        .select()
        .single();
      if (error) throw error;
      return data as PmTag;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tags"] });
    },
  });
}

export function useDeletePmTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tagId, tagValue }: { tagId: string; tagValue: string }) => {
      // 1. Delete the global tag
      const { error } = await sb.from("pm_tags").delete().eq("id", tagId);
      if (error) throw error;

      // 2. Remove from all pm_tasks that have this tag
      const { data: tasksWithTag } = await sb
        .from("pm_tasks")
        .select("id, tags")
        .contains("tags", [tagValue]);

      if (tasksWithTag && tasksWithTag.length > 0) {
        for (const t of tasksWithTag) {
          const newTags = (t.tags ?? []).filter((tag: string) => tag !== tagValue);
          await sb.from("pm_tasks").update({ tags: newTags }).eq("id", t.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tags"] });
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
    },
  });
}
