import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRole, type AppRole } from "@/hooks/use-role";
import { useMyProfile } from "@/hooks/use-my-profile";

export type FeaturePermission = {
  key: string;
  label: string;
  area: string;
  allowed_roles: AppRole[];
  allowed_cargos: string[];
};

// One shared query backs every usePermission() call on screen — feature_permissions rarely
// changes and every gate check needs the same rows, so this avoids a query per gate.
export function useFeaturePermissions() {
  return useQuery({
    queryKey: ["feature_permissions"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<FeaturePermission[]> => {
      const { data, error } = await supabase
        .from("feature_permissions")
        .select("key, label, area, allowed_roles, allowed_cargos")
        .order("area")
        .order("label");
      if (error) throw error;
      return (data ?? []) as FeaturePermission[];
    },
  });
}

function cargoMatches(myCargo: string | null | undefined, allowedCargos: string[]): boolean {
  const normalized = (myCargo ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return allowedCargos.some((c) => c.trim().toLowerCase() === normalized);
}

// Gates a feature by its feature_permissions key. Admin always passes — the Permissões screen
// (AdminPermissoesPanel) never lets "admin" be unchecked, so this is just a safety net against
// a row with an accidentally-empty allowed_roles locking every admin out of their own settings.
// A key with no matching row (not yet migrated to this system) defaults to admin-only, matching
// every gate's original hardcoded behavior before this table existed.
export function usePermission(key: string): boolean {
  const { user } = useSession();
  const { roles } = useRole(user?.id);
  const myProfileQ = useMyProfile();
  const permsQ = useFeaturePermissions();

  return useMemo(() => {
    if (roles.includes("admin")) return true;
    const perm = permsQ.data?.find((p) => p.key === key);
    if (!perm) return false;
    const roleMatch = perm.allowed_roles.some((r) => roles.includes(r));
    return roleMatch || cargoMatches(myProfileQ.data?.role_title, perm.allowed_cargos);
  }, [roles, myProfileQ.data, permsQ.data, key]);
}
