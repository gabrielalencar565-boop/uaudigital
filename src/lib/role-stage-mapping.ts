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
  // alteracao_* are the three kinds of alteration (planejamento / design / vídeo): each follows the cargo of the work it comes from
  "Social Media": ["planejamento", "pdf", "alteracoes", "agendamento", "alteracao_pauta"],
  "Designer": ["design", "alteracao_design"],
  "Editor de Vídeo": ["captacao", "edicao_videos", "alteracao_video"],
  "Head de Conteúdo": ["revisao_pauta"],
  "Diretor de Arte": ["revisao_design"],
  "Diretor de Vídeo": ["revisao_video"],
};

/** Stage → cargo as it always worked (the starting point; each agency can change it in Configuração de fluxos). */
export const DEFAULT_STAGE_ROLES: Record<string, string> = Object.fromEntries(
  Object.entries(ROLE_TO_STAGES).flatMap(([role, stages]) => stages.map((s) => [s, role])),
);

/** Overrides saved by the agency (flow_stage_roles) on top of the defaults. A saved null means "no cargo on purpose". */
export function resolveStageRoles(rows: { stage_key: string; role_title: string | null }[] | null | undefined): Record<string, string | null> {
  const map: Record<string, string | null> = { ...DEFAULT_STAGE_ROLES };
  for (const r of rows ?? []) map[r.stage_key] = r.role_title && r.role_title.trim() ? r.role_title : null;
  return map;
}

/** cargo → stages, from a stage → cargo map. */
export function stagesByRole(stageRoles: Record<string, string | null>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [stage, role] of Object.entries(stageRoles)) {
    if (!role) continue;
    (out[role] ??= []).push(stage);
  }
  return out;
}

// cargos.label agora é a fonte da verdade (role_titles é travado nessa lista via trigger
// no banco — ver migration validate_role_titles_against_cargos), então o match aqui é
// exato, sem normalização/substring como a cópia antiga em SquadDashboardDialog.tsx fazia.
// Uma pessoa pode ter mais de um cargo -- devolve a união (deduplicada) das etapas de
// todos eles. `roleToStages` vem da configuração da agência; sem ela vale o padrão.
export function getStagesForRoles(roleTitles: string[] | undefined | null, roleToStages: Record<string, string[]> = ROLE_TO_STAGES): string[] {
  if (!roleTitles || roleTitles.length === 0) return [];
  const stages = new Set<string>();
  for (const roleTitle of roleTitles) {
    for (const stage of roleToStages[roleTitle] ?? []) stages.add(stage);
  }
  return Array.from(stages);
}

/**
 * When two people of a squad share a cargo, the one who joined the squad first takes the stages (same date: alphabetical by
 * name). This used to depend on whatever order the database returned, so two screens could disagree about who was "the first".
 */
export function sortForAssignment<T extends { joined_at?: string | null; display_name?: string | null }>(people: T[]): T[] {
  return [...people].sort((a, b) => {
    const byDate = new Date(a.joined_at ?? 0).getTime() - new Date(b.joined_at ?? 0).getTime();
    return byDate || (a.display_name ?? "").localeCompare(b.display_name ?? "", "pt-BR");
  });
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
  members: SquadMemberWithRole[],
  roleToStages: Record<string, string[]> = ROLE_TO_STAGES,
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const member of members) {
    const stages = getStagesForRoles(member.role_titles, roleToStages);
    for (const stage of stages) {
      // first member with the role wins
      if (!result[stage]) {
        result[stage] = member.user_id;
      }
    }
  }

  return result;
}

/** Everyone of the squads who could take each stage (has its cargo), in the order they would be picked. */
export function buildCandidatesForClient(
  members: SquadMemberWithRole[],
  roleToStages: Record<string, string[]> = ROLE_TO_STAGES,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const member of members) {
    for (const stage of getStagesForRoles(member.role_titles, roleToStages)) {
      const list = (result[stage] ??= []);
      if (!list.includes(member.user_id)) list.push(member.user_id);
    }
  }
  return result;
}

/**
 * Who ends up on a stage: the explicit choice (when that person is a candidate), else whoever already holds it if they are
 * still a candidate (so a choice made earlier survives later squad changes), else the first candidate.
 */
export function pickAssignee(candidates: string[], current: string | null | undefined, choice?: string | null): string | null {
  if (candidates.length === 0) return null;
  if (choice && candidates.includes(choice)) return choice;
  if (current && candidates.includes(current)) return current;
  return candidates[0];
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
export async function autoAssignStagesForClient(sb: any, clientId: string, squadIds: string[], choices: Record<string, string> = {}): Promise<void> {
  if (squadIds.length === 0) return;
  const { data: squadMembers } = await sb.from("squad_members").select("user_id, created_at").in("squad_id", squadIds);
  if (!squadMembers || squadMembers.length === 0) return;

  const memberUserIds = squadMembers.map((sm: any) => sm.user_id);
  const joinedAt = new Map<string, string>();
  for (const sm of squadMembers as any[]) {
    const prev = joinedAt.get(sm.user_id);
    if (!prev || sm.created_at < prev) joinedAt.set(sm.user_id, sm.created_at);
  }
  const { data: tmRows } = await sb
    .from("team_members")
    .select("user_id, display_name, role_titles")
    .in("user_id", memberUserIds)
    .eq("is_active", true);
  if (!tmRows || tmRows.length === 0) return;
  const tms = sortForAssignment((tmRows as any[]).map((tm) => ({ ...tm, joined_at: joinedAt.get(tm.user_id) ?? null })));

  // which cargo answers for each stage is the agency's setting (Configuração de fluxos), not fixed in code
  const { data: roleRows } = await sb.from("flow_stage_roles").select("stage_key, role_title");
  const roleToStages = stagesByRole(resolveStageRoles(roleRows));
  const candidates = buildCandidatesForClient(tms.map((tm: any) => ({ user_id: tm.user_id, role_titles: tm.role_titles ?? [] })), roleToStages);
  if (Object.keys(candidates).length === 0) return;

  const { data: flows } = await sb
    .from("pm_stage_flows")
    .select("id, stage_assignees, is_default")
    .order("is_default", { ascending: false })
    .limit(1);
  const defaultFlow = flows?.[0];
  if (!defaultFlow) return;

  const existing = (defaultFlow.stage_assignees ?? {}) as Record<string, Record<string, any>>;
  const perStage: Record<string, string> = {};
  for (const [stage, cands] of Object.entries(candidates)) {
    const raw = existing[stage]?.[clientId];
    const current = Array.isArray(raw) ? raw[0] : raw;
    const picked = pickAssignee(cands, current, choices[stage]);
    if (picked && picked !== current) perStage[stage] = picked;
  }
  if (Object.keys(perStage).length === 0) return;

  const merged = mergeClientAssignees(existing, clientId, perStage);
  // keep the watchers of a stage that was stored as [assignee, ...watchers]
  for (const stage of Object.keys(perStage)) {
    const raw = existing[stage]?.[clientId];
    if (Array.isArray(raw)) merged[stage][clientId] = [perStage[stage], ...raw.slice(1)];
  }
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
