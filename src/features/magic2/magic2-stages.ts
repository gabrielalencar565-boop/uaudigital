export const MAGIC2_STAGES = [
  { key: "planejamento", label: "Planejamento" },
  { key: "captacao", label: "Captação" },
  { key: "edicao_videos", label: "Vídeo" },
  { key: "design", label: "Design" },
  { key: "pdf", label: "PDF" },
  { key: "alteracoes", label: "Alterações" },
  { key: "agendamento", label: "Agendamento" },
] as const;

export type Magic2StageKey = (typeof MAGIC2_STAGES)[number]["key"];
