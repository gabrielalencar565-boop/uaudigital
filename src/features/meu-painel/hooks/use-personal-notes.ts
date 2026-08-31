import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface PersonalNote {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useMyNotes(userId?: string) {
  return useQuery({
    queryKey: ["personal_notes", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PersonalNote[]> => {
      const { data, error } = await sb
        .from("personal_notes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId }: { userId: string }): Promise<PersonalNote> => {
      const { data, error } = await sb
        .from("personal_notes")
        .insert({ user_id: userId, title: "", content: "" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal_notes"] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: string }) => {
      const { error } = await sb.from("personal_notes").update({ title, content }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal_notes"] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("personal_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal_notes"] }),
  });
}
