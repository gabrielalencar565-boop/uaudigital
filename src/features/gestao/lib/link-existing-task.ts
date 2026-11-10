// Qual post_type filtrar ao procurar, na agenda, uma tarefa já criada para a próxima etapa (para vincular em vez de duplicar).

/**
 * Em Design e Edição de vídeo a própria etapa já diz o tipo, então não filtra por post_type: a Revisão (Planejamento) que
 * aprova carrega post_type 'planejamento' (nunca casaria com um Design) e tarefa criada à mão na agenda pode nem ter post_type.
 * Era por isso que um Design já existente não era achado e outro era criado.
 */
export function nextStagePostTypeFilter(
  current: { stage_current: string; post_type?: string | null },
  nextStage: string,
): string | undefined {
  if (nextStage === "design" || nextStage === "edicao_videos") return undefined;
  if (current.stage_current === "edicao_videos") return "video";
  if (current.stage_current === "design") return "design";
  if (current.stage_current === "planejamento" && nextStage === "revisao") return "planejamento";
  return current.post_type ?? undefined;
}
