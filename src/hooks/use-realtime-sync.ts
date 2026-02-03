import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type RealtimeTable =
  | "client_cycle_stages"
  | "client_stages"
  | "tasks"
  | "clients"
  | "client_cycles"
  | "task_assignees"
  | "magic2_cycles"
  | "magic2_cycle_stages"
  | "user_roles"
  | "access_requests"
  | "team_members"
  | "profiles"
  | "performance_scores"
  | "task_deadline_overrides";

const TABLE_TO_QUERY_KEYS: Record<RealtimeTable, string[][]> = {
  client_cycle_stages: [["client_cycle_stages"], ["magic2"]],
  client_stages: [["client_stages"]],
  // Quando tasks muda, invalida também performance, dashboard e relatórios
  tasks: [
    ["tasks"],
    ["deleted_tasks"],
    ["performance_scores"],
    ["performance_scores_annual"],
    ["deadline_report_tasks"],
    ["my_monthly_rank"],
    ["my_annual_rank"],
  ],
  clients: [["clients"], ["clients_all"]],
  client_cycles: [["client_cycles"]],
  task_assignees: [["task_assignees"], ["task_assignees_month"], ["tasks"], ["performance_scores"]],
  magic2_cycles: [["magic2"], ["client_contract_months"]],
  magic2_cycle_stages: [["magic2"]],
  user_roles: [["user_roles"], ["user_roles_batch"], ["admin_users"]],
  access_requests: [["admin_users"]],
  team_members: [["team_members"], ["admin_users"]],
  profiles: [["profiles"], ["admin_users"], ["my_profile"]],
  performance_scores: [
    ["performance_scores"],
    ["performance_scores_annual"],
    ["my_monthly_rank"],
    ["my_annual_rank"],
  ],
  task_deadline_overrides: [["deadline_report_overrides"], ["performance_scores"]],
};

/**
 * Hook que sincroniza dados em tempo real via Supabase Realtime.
 * Quando qualquer mudança ocorre nas tabelas monitoradas, invalida as queries correspondentes.
 */
export function useRealtimeSync(tables: RealtimeTable[] = []) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (tables.length === 0) return;

    const channel = supabase.channel("realtime-sync");

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          const queryKeys = TABLE_TO_QUERY_KEYS[table] ?? [[table]];
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: key });
          });
        }
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tables.join(",")]);
}

/**
 * Hook pré-configurado para sincronizar todas as tabelas principais.
 * Use este hook em layouts ou componentes de alto nível.
 */
export function useRealtimeSyncAll() {
  useRealtimeSync([
    "client_cycle_stages",
    "client_stages",
    "tasks",
    "clients",
    "client_cycles",
    "task_assignees",
    "magic2_cycles",
    "magic2_cycle_stages",
    "user_roles",
    "access_requests",
    "team_members",
    "profiles",
    "performance_scores",
    "task_deadline_overrides",
  ]);
}
