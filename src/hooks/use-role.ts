import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "collaborator" | "planner" | "developer";

export function useRole(userId?: string) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRoles([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setRoles([]);
          return;
        }
        setRoles((data ?? []).map((r) => r.role as AppRole));
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const isAdmin = useMemo(() => roles.includes("admin"), [roles]);
  const isPlanner = useMemo(() => roles.includes("planner"), [roles]);
  // Quem mantém a plataforma em si (você) — distinto de "admin", que no modelo multi-tenant
  // futuro será o dono de cada agência cliente. Relatos de problema e o conteúdo da Central
  // de Ajuda (changelog/FAQ) são gerenciados só por developers, nunca por admins de agência.
  const isDeveloper = useMemo(() => roles.includes("developer"), [roles]);
  const canManageTasks = isAdmin || isPlanner;

  return { roles, isAdmin, isPlanner, isDeveloper, canManageTasks, loading };
}
