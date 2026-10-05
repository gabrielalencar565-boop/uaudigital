import { addDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

// stage_assignees format: { "stage_key": { "client_id": "user_id" | null | ["assignee_id", "watcher_id", ...] } }
export type StageAssignees = Record<string, Record<string, string | null | (string | null)[]>>;

export interface StageFlow {
  id: string;
  name: string;
  flow_config: Record<string, string | string[]>;
  transition_dates?: Record<string, "pick" | number>;
  stage_assignees?: StageAssignees;
  is_default: boolean;
  created_by: string;
  created_at: string;
}

export function useStageFlows() {
  return useQuery<StageFlow[]>({
    queryKey: ["pm_stage_flows"],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_stage_flows").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Get the default flow's config (backward compat) */
export function useDefaultFlow() {
  const flowsQ = useStageFlows();
  const defaultFlow = (flowsQ.data ?? []).find(f => f.is_default) ?? (flowsQ.data ?? [])[0];
  return defaultFlow?.flow_config ?? {};
}

/** Get the default flow's config AND transition dates AND stage assignees */
export function useDefaultFlowWithDates() {
  const flowsQ = useStageFlows();
  const defaultFlow = (flowsQ.data ?? []).find(f => f.is_default) ?? (flowsQ.data ?? [])[0];
  return {
    flowConfig: defaultFlow?.flow_config ?? {},
    transitionDates: (defaultFlow?.transition_dates ?? {}) as Record<string, "pick" | number>,
    stageAssignees: (defaultFlow?.stage_assignees ?? {}) as StageAssignees,
  };
}

/** Get next stage options for a given stage key from the default flow */
export function getNextStages(flowConfig: Record<string, string | string[]>, stageKey: string): string[] {
  const next = flowConfig[stageKey];
  if (!next) return [];
  if (Array.isArray(next)) return next;
  return [next];
}

/** Get the fixed assignee for a client+stage from the flow config.
 *  Value can be a string (single assignee), null, or an array [assignee, ...watchers]. */
export function getFixedAssignee(stageAssignees: StageAssignees, stageKey: string, clientId: string): string | null | undefined {
  const stageMap = stageAssignees[stageKey];
  if (!stageMap) return undefined;
  if (!(clientId in stageMap)) return undefined;
  const val = stageMap[clientId];
  if (Array.isArray(val)) return val[0] ?? null;
  return val;
}

/** Get the fixed watchers for a client+stage (when value is an array, elements after [0] are watchers) */
export function getFixedWatchers(stageAssignees: StageAssignees, stageKey: string, clientId: string): string[] {
  const stageMap = stageAssignees[stageKey];
  if (!stageMap || !(clientId in stageMap)) return [];
  const val = stageMap[clientId];
  if (Array.isArray(val)) return val.slice(1).filter(Boolean) as string[];
  return [];
}

// De qual etapa a tarefa está saindo → qual chave virtual de stage_assignees usar pra achar
// o revisor fixo. Cada tipo de revisão (Head de Conteúdo/Diretor de Arte/Diretor de Vídeo)
// tem seu próprio responsável por cliente, mesmo a tarefa em si só guardando
// stage_current='revisao' nos três casos.
const REVIEW_KEY_BY_SOURCE_STAGE: Record<string, string> = {
  planejamento: "revisao_pauta",
  design: "revisao_design",
  edicao_videos: "revisao_video",
};

/** Resolve qual chave de stage_assignees usar ao avançar de uma etapa para outra. */
export function resolveAssigneeStageKey(completedStage: string | undefined, nextStage: string): string {
  if (nextStage === "revisao" && completedStage && REVIEW_KEY_BY_SOURCE_STAGE[completedStage]) {
    return REVIEW_KEY_BY_SOURCE_STAGE[completedStage];
  }
  return nextStage;
}

/** Due date to use whenever a task enters "alteracoes" — always relative to TODAY, never to
 *  the task's own (possibly stale) due_date. This matters because the most common way a
 *  Design/Vídeo task re-enters "alteracoes" is by reopening its own old completed snapshot
 *  row, whose due_date is still whatever it was the day that work was originally finished —
 *  basing this off "today" instead of that stale value is what keeps the new deadline sane.
 *  "pick" is treated the same as unconfigured (fallback +1 day) — a full date-picker flow
 *  across every alteração entry point isn't worth it for what's meant to be automatic. */
export function computeAlteracaoDueDate(transitionDates: Record<string, "pick" | number>): string {
  const config = transitionDates["alteracoes"];
  const days = typeof config === "number" ? config : 1;
  return format(addDays(new Date(), days), "yyyy-MM-dd");
}

/** Finds who actually held a given stage in this content's lineage (by origin_task_id),
 *  so "Alteração" can route back to the real previous-stage worker instead of whatever's
 *  pinned as the client's fixed assignee for that stage (which may be a different person,
 *  or not configured at all). Tries the same post_type-scoped match the snapshot-reopen path
 *  already uses, loosens to any post_type if that's empty, and only falls back to the fixed
 *  config if the lineage genuinely has no history at that stage yet. */
export async function findActualPreviousAssignee(
  originId: string,
  stage: string,
  postType: string | null,
  fixedFallback: string | null | undefined,
): Promise<string | null | undefined> {
  const sb = supabase as any;
  const base = () =>
    sb
      .from("pm_tasks")
      .select("assignee_id")
      .or(`id.eq.${originId},origin_task_id.eq.${originId}`)
      .eq("stage_current", stage)
      .is("parent_task_id", null)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1);

  if (postType) {
    const { data } = await base().eq("post_type", postType);
    if (data?.[0]?.assignee_id) return data[0].assignee_id;
  }

  const { data: loose } = await base();
  if (loose?.[0]?.assignee_id) return loose[0].assignee_id;

  return fixedFallback ?? null;
}
