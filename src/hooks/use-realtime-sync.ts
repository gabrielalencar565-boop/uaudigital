import { useEffect, useRef } from "react";
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
    ["all_pending_tasks_for_podium"],
    ["all_my_pending_tasks"],
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
  pm_tasks: [["pm_tasks"], ["pm_child_tasks"], ["pm_child_tasks_all"], ["notifications_assigned"], ["all_pending_pm_tasks_for_podium"], ["all_my_pending_tasks"], ["pm_tasks_for_dayview"]],
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

const CORE_TABLES: RealtimeTable[] = [
  "tasks",
  "clients",
  "task_assignees",
  "pm_tasks",
  "pm_subtasks",
  "pm_comments",
  "pm_attachments",
  "profiles",
  "team_members",
  "notification_reads",
  "app_settings",
];

const SECONDARY_TABLES: RealtimeTable[] = [
  "client_cycle_stages",
  "client_stages",
  "client_cycles",
  "magic2_cycles",
  "magic2_cycle_stages",
  "magic2_clients",
  "magic2_client_links",
  "user_roles",
  "access_requests",
  "performance_scores",
  "task_deadline_overrides",
  "task_activity_log",
  "cleaning_categories",
  "cleaning_schedules",
  "cleaning_completions",
  "pm_activity_log",
  "pm_projects",
  "pm_stage_flows",
  "pm_tags",
  "pm_pdf_settings",
  "pm_cronograma_feedback",
  "scoring_config",
  "internal_dates",
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
];

const CORE_TABLE_SET = new Set<RealtimeTable>(CORE_TABLES);
const DEBOUNCE_MS = 500;

function buildGroups(tables: RealtimeTable[]) {
  const unique = Array.from(new Set(tables));
  const core = unique.filter((table) => CORE_TABLE_SET.has(table));
  const secondary = unique.filter((table) => !CORE_TABLE_SET.has(table));
  return [core, secondary].filter((group) => group.length > 0);
}

/**
 * Hook que sincroniza dados em tempo real via Realtime.
 * Mantém um único hook call para evitar problemas com Fast Refresh,
 * mas divide internamente em grupos de canais para reduzir overhead.
 */
export function useRealtimeSync(tables: RealtimeTable[] = []) {
  const queryClient = useQueryClient();
  const pendingKeysRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tables.length === 0) return;

    const flush = () => {
      const keys = Array.from(pendingKeysRef.current);
      pendingKeysRef.current.clear();
      timerRef.current = null;

      const seen = new Set<string>();
      keys.forEach((serializedKey) => {
        if (seen.has(serializedKey)) return;
        seen.add(serializedKey);
        const parsedKey = JSON.parse(serializedKey) as string[];
        queryClient.invalidateQueries({
          predicate: (query) => {
            const qk = query.queryKey;
            if (!Array.isArray(qk)) return false;
            return parsedKey.every((segment, index) => qk[index] === segment);
          },
        });
      });
    };

    const enqueue = (table: RealtimeTable) => {
      const queryKeys = TABLE_TO_QUERY_KEYS[table] ?? [[table]];
      queryKeys.forEach((key) => pendingKeysRef.current.add(JSON.stringify(key)));
      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, DEBOUNCE_MS);
      }
    };

    const channels = buildGroups(tables).map((group, index) => {
      const channel = supabase.channel(index === 0 ? "realtime-sync-core" : "realtime-sync-secondary");
      group.forEach((table) => {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => enqueue(table)
        );
      });
      channel.subscribe();
      return channel;
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      pendingKeysRef.current.clear();
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [queryClient, tables.join(",")]);
}

/**
 * Hook pré-configurado para sincronizar todas as tabelas.
 */
export function useRealtimeSyncAll() {
  useRealtimeSync([...CORE_TABLES, ...SECONDARY_TABLES]);
}
