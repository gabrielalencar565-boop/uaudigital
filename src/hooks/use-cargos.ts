import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Cargo = {
  id: string;
  key: string;
  label: string;
  order_index: number;
  is_active: boolean;
};

// Lista fechada de cargos (Social Media, Designer, ...), editável por admin em
// Configurações → Cargos — substitui a antiga constante fixa ROLE_OPTIONS, que exigia
// publicar código toda vez que a operação precisasse de um cargo novo.
export function useCargos() {
  return useQuery<Cargo[]>({
    queryKey: ["cargos"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id, key, label, order_index, is_active")
        .eq("is_active", true)
        .order("order_index");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Igual acima, mas inclui cargos desativados — usado só na tela de administração dos
// próprios cargos, onde reativar um cargo desativado precisa ser possível.
export function useAllCargos() {
  return useQuery<Cargo[]>({
    queryKey: ["cargos_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id, key, label, order_index, is_active")
        .order("order_index");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function slugifyKey(label: string): string {
  return label
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function useCreateCargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ label, orderIndex }: { label: string; orderIndex: number }) => {
      const { error } = await supabase
        .from("cargos")
        .insert({ key: slugifyKey(label), label: label.trim(), order_index: orderIndex });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cargos"] });
      qc.invalidateQueries({ queryKey: ["cargos_all"] });
    },
  });
}

export function useUpdateCargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, label, orderIndex, isActive }: { id: string; label?: string; orderIndex?: number; isActive?: boolean }) => {
      const patch: Record<string, unknown> = {};
      if (label !== undefined) patch.label = label.trim();
      if (orderIndex !== undefined) patch.order_index = orderIndex;
      if (isActive !== undefined) patch.is_active = isActive;
      const { error } = await supabase.from("cargos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cargos"] });
      qc.invalidateQueries({ queryKey: ["cargos_all"] });
    },
  });
}
