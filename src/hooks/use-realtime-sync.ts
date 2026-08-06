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
  | "financial_opening_balances"
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
    ["overdue_tasks_for_dayview"],
    ["overdue_task_assignees_for_dayview"],
    ["agenda_tasks_overview"],
  ],
  clients: [["clients"], ["clients_all"], ["clients_admin_all"], ["active_client_ids"]],
  client_cycles: [["client_cycles"]],
  task_assignees: [["task_assignees"], ["task_assignees_month"], ["overdue_task_assignees_for_dayview"], ["tasks"], ["performance_scores"]],
  magic2_cycles: [["magic2"], ["client_contract_months"], ["magic2_squad_speed_v2"]],
  magic2_cycle_stages: [["magic2"], ["magic2_squad_speed_v2"]],
  magic2_clients: [["magic2"], ["magic2_squad_speed_v2"]],
  magic2_client_links: [["magic2"], ["magic2_squad_speed_v2"]],
  user_roles: [["user_roles"], ["user_roles_batch"], ["admin_users"]],
  access_requests: [["admin_users"]],
  team_members: [["team_members"], ["admin_users"]],
  profiles: [["profiles"], ["admin_users"], ["my_profile"]],
  performance_scores: [
    ["performance_scores"],
    ["performance_scores_annual"],
    ["performance_scores_team_avg"],
    ["my_monthly_rank"],
    ["my_annual_rank"],
    ["my_qualitative_scores"],
    ["my_qualitative_annual"],
  ],
  task_deadline_overrides: [["deadline_report_overrides"], ["performance_scores"]],
  task_activity_log: [["task_activity_log"]],
  cleaning_categories: [["cleaning_categories"]],
  cleaning_schedules: [["cleaning_schedules"]],
  cleaning_completions: [["cleaning_completions"]],
  pm_tasks: [["pm_tasks"], ["pm_child_tasks"], ["pm_child_tasks_all"], ["notifications_assigned"], ["all_pending_pm_tasks_for_podium"], ["all_my_pending_tasks"], ["pm_tasks_for_dayview"], ["overdue_pm_tasks_for_dayview"], ["pm_child_count_for_dayview_v2"], ["pm_tasks_overview"]],
  pm_subtasks: [["pm_subtasks"], ["pm_subtasks_all"], ["pm_subtasks_for_podium"]],
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
  financial_clients: [["fin-clients"]],
  financial_expenses: [["fin-expenses"], ["fin-expenses-year"]],
  financial_revenues: [["fin-revenues"], ["fin-revenues-year"]],
  financial_goals: [["fin-goals"]],
  financial_transactions: [["fin-transactions"], ["fin-transactions-year"]],
  financial_credit_cards: [["fin-cards"]],
  financial_opening_balances: [["fin-opening-balances"]],
  mrr_movements: [["mrr-movements"]],
  squads: [["squads"]],
  squad_members: [["squad_members"]],
  client_squads: [["client_squads"]],
  notification_reads: [["notification_reads"]],
};

// PR-A: removidas pm_attachments e app_settings de CORE (mudam pouco / fetchadas sob demanda).
const CORE_TABLES: RealtimeTable[] = [
  "tasks",
  "clients",
  "task_assignees",
  "pm_tasks",
  "pm_subtasks",
  "pm_comments",
  "profiles",
  "team_members",
  "notification_reads",
];

// PR-A: tabelas raramente alteradas foram removidas da publicação supabase_realtime no banco.
// Mantemos no client apenas o que realmente recebe eventos.
// Dashboards (Financeiro, Squads, Magic2, Desempenho) precisam ficar "ao vivo" mesmo fora
// da aba onde antes eram assinadas sob demanda — por isso entram aqui, não só no DayView.
const SECONDARY_TABLES: RealtimeTable[] = [
  "user_roles",
  "financial_clients",
  "financial_expenses",
  "financial_revenues",
  "financial_goals",
  "financial_transactions",
  "financial_credit_cards",
  "financial_opening_balances",
  "mrr_movements",
  "performance_scores",
  "magic2_cycles",
  "magic2_cycle_stages",
  "magic2_clients",
  "magic2_client_links",
  "squads",
  "client_cycles",
  "client_cycle_stages",
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
