import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useSquads() {
  return useQuery({
    queryKey: ["squads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squads" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useSquadMembers() {
  return useQuery({
    queryKey: ["squad_members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("squad_members" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useCreateSquad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color, userId }: { name: string; color: string; userId: string }) => {
      const { data, error } = await supabase
        .from("squads" as any)
        .insert({ name, color, created_by: userId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squads"] });
      toast.success("Squad criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteSquad() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("squads" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squads"] });
      qc.invalidateQueries({ queryKey: ["squad_members"] });
      toast.success("Squad removido");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateSquadMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ squadId, userIds }: { squadId: string; userIds: string[] }) => {
      // Delete existing
      await supabase.from("squad_members" as any).delete().eq("squad_id", squadId);
      // Insert new
      if (userIds.length > 0) {
        const rows = userIds.map((uid) => ({ squad_id: squadId, user_id: uid }));
        const { error } = await supabase.from("squad_members" as any).insert(rows as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["squad_members"] });
      toast.success("Membros atualizados");
    },
    onError: (e: any) => toast.error(e.message),
  });
}
