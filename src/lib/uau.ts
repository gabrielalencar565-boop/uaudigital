export const STAGES = [
  { key: "captacao", label: "Captação" },
  { key: "edicao_videos", label: "Vídeo" },
  { key: "planejamento", label: "Planejamento" },
  { key: "design", label: "Design" },
  { key: "revisao", label: "Revisão" },
  { key: "pdf", label: "PDF" },
  { key: "entrega", label: "Entrega" },
  { key: "alteracoes", label: "Alterações" },
  { key: "agendamento", label: "Agendamento" },
] as const;

export type StageKey = (typeof STAGES)[number]["key"];

// Etapas usadas especificamente no Magic Number (sem Revisão e Entrega)
export const MAGIC_STAGES = [
  { key: "captacao", label: "Captação" },
  { key: "edicao_videos", label: "Vídeo" },
  { key: "planejamento", label: "Planejamento" },
  { key: "design", label: "Design" },
  { key: "pdf", label: "PDF" },
  { key: "alteracoes", label: "Alterações" },
  { key: "agendamento", label: "Agendamento" },
] as const;

export type MagicStageKey = (typeof MAGIC_STAGES)[number]["key"];

export const STAGE_COLOR: Record<StageKey, "primary" | "brand" | "secondary" | "warning"> = {
  captacao: "secondary",
  edicao_videos: "primary",
  planejamento: "secondary",
  design: "brand",
  revisao: "warning",
  pdf: "secondary",
  entrega: "brand",
  alteracoes: "warning",
  agendamento: "secondary",
};

export function levelFromScore(total: number) {
  if (total <= 3) return { label: "Alerta", tone: "danger" as const, emoji: "🚨" };
  if (total <= 6) return { label: "Regular", tone: "warning" as const, emoji: "⚠️" };
  return { label: "Alto Desempenho", tone: "success" as const, emoji: "🔥" };
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
