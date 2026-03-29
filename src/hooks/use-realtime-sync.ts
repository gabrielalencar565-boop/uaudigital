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
  | "magic2_clients"
  | "magic2_client_links"
  | "user_roles"
  | "access_requests"
  | "team_members"
  | "profiles"
  | "performance_scores"
  | "task_deadline_overrides"
  | "task_activity_log"
  | "cleaning_categories"
  | "cleaning_schedules"
  | "cleaning_completions"
  | "pm_tasks"
  | "pm_subtasks"
  | "pm_comments"
  | "pm_attachments"
  | "pm_activity_log"
  | "pm_projects"
  | "pm_stage_flows"
  | "pm_tags"
  | "pm_pdf_settings"
  | "pm_cronograma_feedback"
  | "scoring_config"
  | "internal_dates"
  | "app_settings"
  | "health_scores"
  | "health_score_tokens"
  | "financial_clients"
  | "financial_expenses"
  | "financial_revenues"
  | "financial_goals"
  | "financial_transactions"
  | "financial_credit_cards"
  | "mrr_movements"
  | "squads"
  | "squad_members"
  | "client_squads"
  | "notification_reads";

const TABLE_TO_QUERY_KEYS: Record<RealtimeTable, string[][]> = {
  client_cycle_stages: [["client_cycle_stages"], ["magic2"]],
  client_stages: [["client_stages"]],
  tasks: [
    ["tasks"],
    ["deleted_tasks"],
    ["magic2"],
    ["performance_scores"],
    ["performance_scores_annual"],
    ["deadline_report_tasks"],
    ["my_monthly_rank"],
    ["my_annual_rank"],
  ],
  clients: [["clients"], ["clients_all"], ["clients_admin_all"]],
  client_cycles: [["client_cycles"]],
  task_assignees: [["task_assignees"], ["task_assignees_month"], ["tasks"], ["performance_scores"]],
  magic2_cycles: [["magic2"], ["client_contract_months"]],
  magic2_cycle_stages: [["magic2"]],
  magic2_clients: [["magic2"]],
  magic2_client_links: [["magic2"]],
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
  task_activity_log: [["task_activity_log"]],
  cleaning_categories: [["cleaning_categories"]],
  cleaning_schedules: [["cleaning_schedules"]],
  cleaning_completions: [["cleaning_completions"]],
  pm_tasks: [["pm_tasks"], ["pm_child_tasks"], ["pm_child_tasks_all"], ["notifications_assigned"]],
  pm_subtasks: [["pm_subtasks"], ["pm_subtasks_all"]],
  pm_comments: [["pm_comments"], ["notifications_mentions"]],
  pm_attachments: [["pm_attachments"]],
  pm_activity_log: [["pm_activity_log"]],
  pm_projects: [["pm_projects"]],
  pm_stage_flows: [["pm_stage_flows"]],
  pm_tags: [["pm_tags"]],
  pm_pdf_settings: [["pm_pdf_settings"]],
  pm_cronograma_feedback: [["pm_cronograma_feedback"]],
  scoring_config: [["scoring_config"]],
  internal_dates: [["internal_dates"]],
  app_settings: [["app_settings"]],
  health_scores: [["health_scores"]],
  health_score_tokens: [["health_score_tokens"]],
  financial_clients: [["financial_clients"]],
  financial_expenses: [["financial_expenses"]],
  financial_revenues: [["financial_revenues"]],
  financial_goals: [["financial_goals"]],
  financial_transactions: [["financial_transactions"]],
  financial_credit_cards: [["financial_credit_cards"]],
  mrr_movements: [["mrr_movements"]],
  squads: [["squads"]],
  squad_members: [["squad_members"]],
  client_squads: [["client_squads"]],
  notification_reads: [["notification_reads"]],
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
        (payload) => {
          console.log(`[Realtime] ${table} changed:`, payload.eventType);
          
          const queryKeys = TABLE_TO_QUERY_KEYS[table] ?? [[table]];
          queryKeys.forEach((key) => {
            queryClient.invalidateQueries({
              predicate: (query) => {
                const qk = query.queryKey;
                if (!Array.isArray(qk)) return false;
                return key.every((k, i) => qk[i] === k);
              },
            });
          });
        }
      );
    });

    channel.subscribe((status) => {
      console.log(`[Realtime] Channel status: ${status}`);
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tables.join(",")]);
}

/**
 * Hook pré-configurado para sincronizar TODAS as tabelas.
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
    "magic2_clients",
    "magic2_client_links",
    "user_roles",
    "access_requests",
    "team_members",
    "profiles",
    "performance_scores",
    "task_deadline_overrides",
    "task_activity_log",
    "cleaning_categories",
    "cleaning_schedules",
    "cleaning_completions",
    "pm_tasks",
    "pm_subtasks",
    "pm_comments",
    "pm_attachments",
    "pm_activity_log",
    "pm_projects",
    "pm_stage_flows",
    "pm_tags",
    "pm_pdf_settings",
    "pm_cronograma_feedback",
    "scoring_config",
    "internal_dates",
    "app_settings",
    "health_scores",
    "health_score_tokens",
    "financial_clients",
    "financial_expenses",
    "financial_revenues",
    "financial_goals",
    "financial_transactions",
    "financial_credit_cards",
    "mrr_movements",
    "squads",
    "squad_members",
    "client_squads",
  ]);
}
