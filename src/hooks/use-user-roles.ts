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
 * Set the roles of a user to exactly `roles`.
 * Only the difference is written: roles are added first and removed after, never "delete everything and insert again".
 * (That older way made an admin who saved their own profile lose the admin role: the delete worked, then the insert
 * was refused because they were no longer an admin.)
 */
export function useSetUserRoles() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; roles: AppRole[] }) => {
      const { data: current, error: readErr } = await supabase.from("user_roles").select("role").eq("user_id", input.userId);
      if (readErr) throw readErr;
      const have = new Set((current ?? []).map((r) => r.role as AppRole));
      const want = new Set(input.roles);
      const toAdd = input.roles.filter((r) => !have.has(r));
      const toRemove = [...have].filter((r) => !want.has(r));

      if (toRemove.includes("admin")) {
        const { data: me } = await supabase.auth.getUser();
        if (me.user?.id === input.userId) {
          throw new Error("Você não pode tirar o seu próprio acesso de administrador. Peça para outro administrador fazer isso.");
        }
      }

      if (toAdd.length > 0) {
        const { error: insErr } = await supabase.from("user_roles").insert(toAdd.map((role) => ({ user_id: input.userId, role })));
        if (insErr) throw insErr;
      }
      if (toRemove.length > 0) {
        const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", input.userId).in("role", toRemove);
        if (delErr) throw delErr;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["user_roles", vars.userId] });
      qc.invalidateQueries({ queryKey: ["user_roles_batch"] });
    },
  });
}
