/**
 * Maps role_title values to their corresponding PM stages (or, for the review-only
 * cargos, to the virtual stage_assignees key their review type resolves to — see
 * resolveAssigneeStageKey() in PmStageFlowConfig.tsx).
 *
 * - Social Media    → planejamento, pdf, alteracoes, agendamento
 * - Designer        → design
 * - Editor de Vídeo → captacao, edicao_videos
 * - Head de Conteúdo → revisao_pauta (revisão do planejamento)
 * - Diretor de Arte  → revisao_design (revisão do design)
 * - Diretor de Vídeo → revisao_video (revisão do vídeo)
 *
 * "revisao" (a etapa genérica em pm_tasks.stage_current) deliberadamente não aparece
 * aqui como chave própria — antes disso a Social Media auto-preenchia esse slot
 * indiscriminadamente; agora cada tipo de revisão tem cargo e chave dedicados.
 */

const ROLE_TO_STAGES: Record<string, string[]> = {
  "Social Media": ["planejamento", "pdf", "alteracoes", "agendamento"],
  "Designer": ["design"],
  "Editor de Vídeo": ["captacao", "edicao_videos"],
  "Head de Conteúdo": ["revisao_pauta"],
  "Diretor de Arte": ["revisao_design"],
  "Diretor de Vídeo": ["revisao_video"],
};

// cargos.label agora é a fonte da verdade (role_titles é travado nessa lista via trigger
// no banco — ver migration validate_role_titles_against_cargos), então o match aqui é
// exato, sem normalização/substring como a cópia antiga em SquadDashboardDialog.tsx fazia.
// Uma pessoa pode ter mais de um cargo -- devolve a união (deduplicada) das etapas de
// todos eles.
export function getStagesForRoles(roleTitles: string[] | undefined | null): string[] {
  if (!roleTitles || roleTitles.length === 0) return [];
  const stages = new Set<string>();
  for (const roleTitle of roleTitles) {
    for (const stage of ROLE_TO_STAGES[roleTitle] ?? []) stages.add(stage);
  }
  return Array.from(stages);
}

export interface SquadMemberWithRole {
  user_id: string;
  role_titles: string[];
}

/**
 * Given a list of squad members (with role_titles), builds a stage_assignees
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
    const stages = getStagesForRoles(member.role_titles);
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

/**
 * Recomputa e grava os responsáveis fixos de UM cliente a partir do cargo dos membros
 * dos squads informados (deve ser a lista COMPLETA de squads do cliente, não só o que
 * mudou — "primeiro membro com o cargo vence" depende de ver todo mundo de uma vez).
 * Usada tanto ao editar um cliente (troca de squads) quanto ao editar os membros de um
 * squad (ver autoAssignStagesForSquad abaixo). Falhas aqui nunca devem travar a ação
 * principal do chamador — quem chama decide se envolve isso num try/catch.
 */
export async function autoAssignStagesForClient(sb: any, clientId: string, squadIds: string[]): Promise<void> {
  if (squadIds.length === 0) return;
  const { data: squadMembers } = await sb.from("squad_members").select("user_id").in("squad_id", squadIds);
  if (!squadMembers || squadMembers.length === 0) return;

  const memberUserIds = squadMembers.map((sm: any) => sm.user_id);
  const { data: tms } = await sb
    .from("team_members")
    .select("user_id, role_titles")
    .in("user_id", memberUserIds)
    .eq("is_active", true);
  if (!tms || tms.length === 0) return;

  const perStage = buildAssigneesForClient(tms.map((tm: any) => ({ user_id: tm.user_id, role_titles: tm.role_titles ?? [] })));
  if (Object.keys(perStage).length === 0) return;

  const { data: flows } = await sb
    .from("pm_stage_flows")
    .select("id, stage_assignees, is_default")
    .order("is_default", { ascending: false })
    .limit(1);
  const defaultFlow = flows?.[0];
  if (!defaultFlow) return;

  const existing = (defaultFlow.stage_assignees ?? {}) as Record<string, Record<string, any>>;
  const merged = mergeClientAssignees(existing, clientId, perStage);
  await sb.from("pm_stage_flows").update({ stage_assignees: merged, updated_at: new Date().toISOString() }).eq("id", defaultFlow.id);
}

/**
 * Recomputa os responsáveis de TODO cliente vinculado a um squad — usada quando a
 * composição do squad muda (useUpdateSquadMembers), já que antes disso só uma edição de
 * cliente (troca de squads dele) disparava a sincronização, deixando os responsáveis
 * desatualizados sempre que alguém trocava de squad em vez do cliente trocar de squad.
 */
export async function autoAssignStagesForSquad(sb: any, squadId: string): Promise<void> {
  const { data: clientLinks } = await sb.from("client_squads").select("client_id").eq("squad_id", squadId);
  const rawClientIds: string[] = ((clientLinks ?? []) as any[]).map((c: any) => c.client_id as string);
  const clientIds: string[] = Array.from(new Set(rawClientIds));
  if (clientIds.length === 0) return;

  // Cada cliente pode estar em mais de um squad — precisa da lista completa dos squads
  // dele (não só o que mudou) pra recomputar certo.
  const { data: allLinks } = await sb.from("client_squads").select("client_id, squad_id").in("client_id", clientIds);
  const squadIdsByClient = new Map<string, string[]>();
  (allLinks ?? []).forEach((l: any) => {
    const arr = squadIdsByClient.get(l.client_id) ?? [];
    arr.push(l.squad_id);
    squadIdsByClient.set(l.client_id, arr);
  });

  for (const clientId of clientIds) {
    try {
      await autoAssignStagesForClient(sb, clientId, squadIdsByClient.get(clientId) ?? [squadId]);
    } catch (e) {
      console.warn("autoAssignStagesForSquad: falhou pro cliente", clientId, e);
    }
  }
}
