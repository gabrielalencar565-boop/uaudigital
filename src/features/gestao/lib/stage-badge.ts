import type { CSSProperties } from "react";

import type { PmTask } from "@/features/gestao/pm-types";
import { stageAbbr, isHexColor, TAG_COLORS } from "@/features/gestao/pm-constants";
import { extraDisplayStage } from "./extra-rules";
import { PDF_KIND_GRADIENT, pdfKindAbbr, pdfKindFromTypes } from "./pdf-kind";

// Selo da etapa (sigla + cor) de uma tarefa. É o único lugar onde isso é decidido: o cartão do Mês, as visões Semana e Dia
// da Agenda e a lista Minhas tarefas, do Meu Painel, usam esta função e por isso mostram o mesmo selo.

export const STAGE_BADGE_BG: Record<string, string> = {
  captacao: "bg-red-500", planejamento: "bg-blue-500", design: "bg-stage-design",
  edicao_videos: "bg-purple-500", revisao: "bg-pink-500", alteracoes: "bg-stage-alteracoes", pdf: "bg-indigo-500",
  agendamento: "bg-lime-500", entrega: "bg-emerald-500",
};

const PERIODIC_TIME_RE = /\s-\s(\d{1,2}:\d{2})\s*$/;

/** Título de uma tarefa periódica sem o " - 17:00" do final. */
export function stripPeriodicTime(title: string) {
  const match = title.match(PERIODIC_TIME_RE);
  return match ? title.slice(0, match.index).trim() : title;
}

/** Hora que uma tarefa periódica já carrega (campo de postagem ou "- HH:MM" no título). */
export function getPeriodicTime(task: PmTask) {
  return task.posting_time ?? task.title.match(PERIODIC_TIME_RE)?.[1] ?? null;
}

export function getPeriodicStageFallbackLabel(key: string) {
  return key
    .replace(/^custom_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export interface PeriodicStageInfo {
  key: string;
  label: string;
  color_key?: string | null;
}

export interface StageBadge {
  abbr: string;
  /** classe de fundo (a cor real do selo) */
  bg: string;
  /** usado quando a cor da etapa periódica é um hex */
  style?: CSSProperties;
}

/**
 * @param childTasks subtarefas desta tarefa (define a origem de Revisão/Alterações: Planejamento, Vídeo, Design)
 * @param periodicStages etapas periódicas cadastradas (reuniões etc.), com a cor de cada uma
 */
export function getStageBadgeFor(t: PmTask, childTasks: PmTask[] = [], periodicStages: PeriodicStageInfo[] = []): StageBadge {
  const periodic = t.periodic_stage_key ? periodicStages.find((p) => p.key === t.periodic_stage_key) : null;
  const isAlteracao = t.stage_current === "alteracoes";
  const isRevisao = t.stage_current === "revisao";
  // Detect mixed children (parent has both video and design subtasks)
  const childPostTypes = new Set(childTasks.map((c) => c.post_type).filter(Boolean) as string[]);
  const isMixed = childPostTypes.has("video") && childPostTypes.has("design");
  const isAlteracaoParent = isAlteracao && childTasks.length > 0;
  const isAlteracaoPlanejamento = isAlteracao && t.post_type === "planejamento";
  // ALT with explicit video/design post_type — these are NOT plan alterations
  const isAlteracaoWithOrigin = isAlteracao && (t.post_type === "video" || t.post_type === "design");
  // A task is "plan" alteration only when it has no specific video/design post_type
  // (parent with mixed children, or origin without post_type)
  const isAlteracaoMixed = isAlteracao && !isAlteracaoPlanejamento && !isAlteracaoWithOrigin && (isAlteracaoParent || !!t.origin_task_id);
  const isRevisaoMixed = isRevisao && isMixed;
  // Revisão (Planejamento): parent task on revisão stage with post_type='planejamento'
  // OR parent task on revisão without any design/video children yet (initial pauta review)
  const isRevisaoPlanejamento = isRevisao && !t.parent_task_id && (
    t.post_type === "planejamento" ||
    (!t.post_type && childTasks.length === 0) ||
    (childTasks.length > 0 && !childPostTypes.has("video") && !childPostTypes.has("design"))
  ) && t.post_type !== "video" && t.post_type !== "design";
  const isRevisaoVideo = isRevisao && !isRevisaoMixed && !isRevisaoPlanejamento && t.post_type === "video";
  const isRevisaoDesign = isRevisao && !isRevisaoMixed && !isRevisaoPlanejamento && !isRevisaoVideo;

  const gradientClass = isAlteracaoPlanejamento
    ? "bg-gradient-to-r from-stage-alteracoes to-stage-planejamento"
    : isAlteracaoMixed
    ? "bg-gradient-to-r from-stage-alteracoes via-stage-design to-stage-edicao_videos"
    : isAlteracaoWithOrigin
    ? (t.post_type === "video"
      ? "bg-gradient-to-r from-stage-alteracoes to-stage-edicao_videos"
      : "bg-gradient-to-r from-stage-alteracoes to-stage-design")
    : isRevisaoPlanejamento
    ? "bg-gradient-to-r from-pink-400 to-stage-planejamento"
    : isRevisaoMixed
    ? "bg-gradient-to-r from-pink-400 via-stage-design to-stage-edicao_videos"
    : isRevisaoVideo
    ? "bg-gradient-to-r from-pink-400 to-stage-edicao_videos"
    : isRevisaoDesign
    ? "bg-gradient-to-r from-pink-400 to-stage-design"
    : undefined;
  const gradientAbbr = isAlteracaoPlanejamento || isAlteracaoMixed
    ? "ALT/PLAN"
    : isAlteracaoWithOrigin
    ? (t.post_type === "video" ? "ALT/VDO" : "ALT/DSG")
    : isRevisaoPlanejamento || isRevisaoMixed
    ? "REV/PLAN"
    : isRevisaoVideo
    ? "REV/VDO"
    : isRevisaoDesign
    ? "REV/DSG"
    : undefined;

  // Extra concluded in Agendamento/PDF/Revisão shows what it is (DSG/VDO), not the stage it passed through
  const typeStage = extraDisplayStage(t);
  const shownStage = typeStage ?? t.stage_current;

  if (t.periodic_stage_key) {
    const abbr = (periodic?.label ?? getPeriodicStageFallbackLabel(t.periodic_stage_key)).slice(0, 3).toUpperCase();
    const ck = periodic?.color_key;
    const isHex = ck ? isHexColor(ck) : false;
    const bg = periodic ? (ck && !isHex ? (TAG_COLORS.find((c) => c.key === ck)?.dot ?? "bg-black") : (isHex ? "" : "bg-black")) : "bg-black";
    return { abbr, bg, style: periodic && isHex ? { backgroundColor: ck! } : undefined };
  }
  // Cronograma (PDF) só de design ou só de vídeo: CRO/DSG ou CRO/VDO com degradê; já unido, fica o selo simples
  const pdfKind = !typeStage && t.stage_current === "pdf" && !t.parent_task_id ? pdfKindFromTypes(childTasks.map((c) => c.post_type)) : null;
  if (pdfKind) return { abbr: pdfKindAbbr(pdfKind), bg: PDF_KIND_GRADIENT[pdfKind] };
  return {
    abbr: (typeStage ? undefined : gradientAbbr) ?? stageAbbr(shownStage),
    bg: (typeStage ? undefined : gradientClass) ?? (STAGE_BADGE_BG[shownStage] ?? "bg-muted"),
  };
}
