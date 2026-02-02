import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminUserRow = {
  user_id: string;
  email: string;
  display_name: string;
  role_title: string;
  avatar_url: string | null;
  is_active: boolean;
  access_status: "pending" | "approved" | "rejected" | null;
  requested_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  access_request_id: string | null;
};

/**
 * Hook para listar todos os usuários válidos do sistema (apenas os que existem em auth.users)
 * Usa a RPC list_users_admin que faz JOIN com auth.users
 */
export function useAdminUsers() {
  return useQuery({
    queryKey: ["admin_users"],
    queryFn: async (): Promise<AdminUserRow[]> => {
      const { data, error } = await supabase.rpc("list_users_admin");
      if (error) throw error;
      return (data ?? []) as AdminUserRow[];
    },
  });
}

/**
 * Hook para verificar se um nome de cliente já existe
 */
export function useCheckClientExists() {
  return useMutation({
    mutationFn: async (name: string): Promise<boolean> => {
      const { data, error } = await supabase.rpc("check_client_exists", {
        _name: name,
      });
      if (error) throw error;
      return Boolean(data);
    },
  });
}
