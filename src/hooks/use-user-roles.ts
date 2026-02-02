import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-role";

/**
 * Fetch all roles for a specific user.
 */
export function useUserRoles(userId?: string) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["user_roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

/**
 * Fetch roles for multiple users at once (batch).
 */
export function useBatchUserRoles(userIds: string[]) {
  return useQuery({
    enabled: userIds.length > 0,
    queryKey: ["user_roles_batch", userIds.sort().join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      if (error) throw error;
      
      const map = new Map<string, AppRole[]>();
      for (const row of data ?? []) {
        const existing = map.get(row.user_id) ?? [];
        map.set(row.user_id, [...existing, row.role as AppRole]);
      }
      return map;
    },
  });
}

/**
 * Set roles for a user (replaces existing roles).
 */
export function useSetUserRoles() {
  const qc = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: { userId: string; roles: AppRole[] }) => {
      // Remove existing roles
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", input.userId);
      if (delErr) throw delErr;

      // Add new roles
      if (input.roles.length > 0) {
        const payload = input.roles.map((role) => ({
          user_id: input.userId,
          role,
        }));
        const { error: insErr } = await supabase
          .from("user_roles")
          .insert(payload);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["user_roles", vars.userId] });
      qc.invalidateQueries({ queryKey: ["user_roles_batch"] });
    },
  });
}
