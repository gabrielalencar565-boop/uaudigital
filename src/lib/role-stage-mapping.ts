/**
 * Maps role_title values to their corresponding PM stages.
 *
 * - Social Media  → planejamento, revisao, pdf, alteracoes, agendamento
 * - Designer      → design
 * - Editor de Vídeo → captacao, edicao_videos
 */

const ROLE_TO_STAGES: Record<string, string[]> = {
  "Social Media": ["planejamento", "revisao", "pdf", "alteracoes", "agendamento"],
  "Designer": ["design"],
  "Editor de Vídeo": ["captacao", "edicao_videos"],
};

export interface SquadMemberWithRole {
  user_id: string;
  role_title: string;
}

/**
 * Given a list of squad members (with role_title), builds a stage_assignees
 * map for a single client: { stageKey: userId | null }.
 *
 * If multiple members share the same role, the first one wins (deterministic
 * by order received). Stages with no matching member are left out.
 */
export function buildAssigneesForClient(
  members: SquadMemberWithRole[]
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const member of members) {
    const stages = ROLE_TO_STAGES[member.role_title];
    if (!stages) continue;
    for (const stage of stages) {
      // first member with the role wins
      if (!result[stage]) {
        result[stage] = member.user_id;
      }
    }
  }

  return result;
}

/**
 * Merges auto-generated assignees for a client into the existing
 * stage_assignees object (full flow-level map).
 */
export function mergeClientAssignees(
  existing: Record<string, Record<string, any>>,
  clientId: string,
  perStage: Record<string, string>
): Record<string, Record<string, any>> {
  const copy = { ...existing };

  for (const [stageKey, userId] of Object.entries(perStage)) {
    if (!copy[stageKey]) copy[stageKey] = {};
    copy[stageKey] = { ...copy[stageKey], [clientId]: userId };
  }

  return copy;
}
