import { STAGE_COLOR } from "@/lib/uau";

export const PM_STATUSES = [
  { key: "backlog", label: "Backlog", color: "bg-muted text-muted-foreground" },
  { key: "em_andamento", label: "Em Andamento", color: "bg-primary/20 text-primary" },
  { key: "em_aprovacao", label: "Em Aprovação", color: "bg-warning/20 text-warning" },
  { key: "concluido", label: "Concluído", color: "bg-success/20 text-success" },
  { key: "pausado", label: "Pausado", color: "bg-muted text-muted-foreground" },
  { key: "cancelado", label: "Cancelado", color: "bg-destructive/20 text-destructive" },
] as const;

export type PmStatusKey = (typeof PM_STATUSES)[number]["key"];

export const PM_KANBAN_COLUMNS: PmStatusKey[] = ["backlog", "em_andamento", "em_aprovacao", "concluido"];

// Synced with agenda/magic stages (stage_type enum)
export const PM_STAGES = [
  { key: "captacao", label: "Captação" },
  { key: "edicao_videos", label: "Vídeo" },
  { key: "planejamento", label: "Planejamento" },
  { key: "design", label: "Design" },
  { key: "revisao", label: "Revisão" },
  { key: "pdf", label: "PDF" },
  { key: "entrega", label: "Entrega" },
  { key: "alteracoes", label: "Alterações" },
  { key: "agendamento", label: "Agendamento" },
  // Legacy values kept for backward compat
  { key: "roteiro", label: "Roteiro" },
  { key: "edicao", label: "Edição" },
] as const;

export type PmStageKey = (typeof PM_STAGES)[number]["key"];

export const PM_PRIORITIES = [
  { key: "baixa", label: "Baixa", color: "text-muted-foreground", bg: "bg-muted" },
  { key: "media", label: "Média", color: "text-foreground", bg: "bg-secondary" },
  { key: "alta", label: "Alta", color: "text-warning", bg: "bg-warning/20" },
  { key: "urgente", label: "Urgente", color: "text-destructive", bg: "bg-destructive/20" },
] as const;

export type PmPriorityKey = (typeof PM_PRIORITIES)[number]["key"];

export const PM_SUBTASK_STATUSES = [
  { key: "nao_iniciado", label: "Não Iniciado", color: "bg-muted text-muted-foreground" },
  { key: "em_producao", label: "Em Produção", color: "bg-primary/20 text-primary" },
  { key: "aguardando", label: "Aguardando", color: "bg-warning/20 text-warning" },
  { key: "em_revisao", label: "Em Revisão", color: "bg-accent text-accent-foreground" },
  { key: "aprovado", label: "Aprovado", color: "bg-success/20 text-success" },
  { key: "concluido", label: "Concluído", color: "bg-success/20 text-success" },
  { key: "bloqueado", label: "Bloqueado", color: "bg-destructive/20 text-destructive" },
] as const;

export type PmSubtaskStatusKey = (typeof PM_SUBTASK_STATUSES)[number]["key"];

export const PM_TEMPLATE_SUBTASKS = PM_STAGES.filter(
  (s) => !["roteiro", "edicao"].includes(s.key)
).map((s, i) => ({
  title: s.label,
  stage: s.key,
  order_index: i,
  is_required: true,
}));

export function statusLabel(key: string) {
  return PM_STATUSES.find((s) => s.key === key)?.label ?? key;
}
export function statusColor(key: string) {
  return PM_STATUSES.find((s) => s.key === key)?.color ?? "bg-muted text-muted-foreground";
}
export function stageLabel(key: string) {
  return PM_STAGES.find((s) => s.key === key)?.label ?? key;
}
export function priorityMeta(key: string) {
  return PM_PRIORITIES.find((p) => p.key === key) ?? PM_PRIORITIES[1];
}
export function subtaskStatusMeta(key: string) {
  return PM_SUBTASK_STATUSES.find((s) => s.key === key) ?? PM_SUBTASK_STATUSES[0];
}

// Stage color mapping synced with agenda (from STAGE_COLOR in uau.ts)
const STAGE_BG_MAP: Record<string, string> = {
  primary: "bg-primary/20 text-primary",
  brand: "bg-accent text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  warning: "bg-warning/20 text-warning",
};

export function stageColorClass(key: string): string {
  const color = (STAGE_COLOR as Record<string, string>)[key];
  return STAGE_BG_MAP[color] ?? "bg-muted text-muted-foreground";
}

// Tag color palette (auto-assigned based on tag name)
export const TAG_COLORS = [
  { bg: "bg-blue-500/20", text: "text-blue-600", dot: "bg-blue-500" },
  { bg: "bg-emerald-500/20", text: "text-emerald-600", dot: "bg-emerald-500" },
  { bg: "bg-violet-500/20", text: "text-violet-600", dot: "bg-violet-500" },
  { bg: "bg-amber-500/20", text: "text-amber-600", dot: "bg-amber-500" },
  { bg: "bg-rose-500/20", text: "text-rose-600", dot: "bg-rose-500" },
  { bg: "bg-cyan-500/20", text: "text-cyan-600", dot: "bg-cyan-500" },
  { bg: "bg-orange-500/20", text: "text-orange-600", dot: "bg-orange-500" },
  { bg: "bg-pink-500/20", text: "text-pink-600", dot: "bg-pink-500" },
  { bg: "bg-teal-500/20", text: "text-teal-600", dot: "bg-teal-500" },
  { bg: "bg-indigo-500/20", text: "text-indigo-600", dot: "bg-indigo-500" },
];

export function tagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
