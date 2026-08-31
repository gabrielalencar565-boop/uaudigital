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
  // ISO weekday (1=segunda .. 7=domingo) for the widget's weekly kanban view; null means
  // the note isn't placed on any day and only shows in the plain list.
  day_of_week: number | null;
  done: boolean;
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
    mutationFn: async ({ userId, dayOfWeek }: { userId: string; dayOfWeek?: number | null }): Promise<PersonalNote> => {
      const { data, error } = await sb
        .from("personal_notes")
        .insert({ user_id: userId, title: "", content: "", day_of_week: dayOfWeek ?? null })
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

// Separate from useUpdateNote (content autosave) so dragging a card between kanban
// columns — or changing the day from the editor — doesn't need to round-trip the whole
// note body just to change one field.
export function useMoveNoteToDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dayOfWeek }: { id: string; dayOfWeek: number | null }) => {
      const { error } = await sb.from("personal_notes").update({ day_of_week: dayOfWeek }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["personal_notes"] }),
  });
}

// Separate from useUpdateNote for the same reason as useMoveNoteToDay — checking a note
// off shouldn't need to round-trip its whole text body.
export function useToggleNoteDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await sb.from("personal_notes").update({ done }).eq("id", id);
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
