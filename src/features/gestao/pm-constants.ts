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
// Using solid background colors matching agenda badges
const STAGE_FULL_COLOR_MAP: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  brand: "bg-[hsl(var(--brand))] text-[hsl(var(--brand-foreground))]",
  secondary: "bg-secondary text-secondary-foreground",
  warning: "bg-warning text-warning-foreground",
};

export function stageColorClass(key: string): string {
  const color = (STAGE_COLOR as Record<string, string>)[key];
  return STAGE_FULL_COLOR_MAP[color] ?? "bg-muted text-muted-foreground";
}

// Predefined tag color palette for user selection
export const TAG_COLORS = [
  { key: "blue", label: "Azul", bg: "bg-blue-500/20", text: "text-blue-400", dot: "bg-blue-500" },
  { key: "green", label: "Verde", bg: "bg-emerald-500/20", text: "text-emerald-400", dot: "bg-emerald-500" },
  { key: "purple", label: "Roxo", bg: "bg-violet-500/20", text: "text-violet-400", dot: "bg-violet-500" },
  { key: "yellow", label: "Amarelo", bg: "bg-amber-500/20", text: "text-amber-400", dot: "bg-amber-500" },
  { key: "red", label: "Vermelho", bg: "bg-rose-500/20", text: "text-rose-400", dot: "bg-rose-500" },
  { key: "cyan", label: "Ciano", bg: "bg-cyan-500/20", text: "text-cyan-400", dot: "bg-cyan-500" },
  { key: "orange", label: "Laranja", bg: "bg-orange-500/20", text: "text-orange-400", dot: "bg-orange-500" },
  { key: "pink", label: "Rosa", bg: "bg-pink-500/20", text: "text-pink-400", dot: "bg-pink-500" },
  { key: "teal", label: "Teal", bg: "bg-teal-500/20", text: "text-teal-400", dot: "bg-teal-500" },
  { key: "indigo", label: "Índigo", bg: "bg-indigo-500/20", text: "text-indigo-400", dot: "bg-indigo-500" },
];

// Tags are stored as "name:colorKey" in the tags array
export function parseTag(raw: string): { name: string; colorKey: string } {
  const idx = raw.lastIndexOf(":");
  if (idx > 0) {
    const colorKey = raw.slice(idx + 1);
    if (TAG_COLORS.find(c => c.key === colorKey)) {
      return { name: raw.slice(0, idx), colorKey };
    }
  }
  return { name: raw, colorKey: "blue" };
}

export function tagColor(raw: string) {
  const { colorKey } = parseTag(raw);
  return TAG_COLORS.find(c => c.key === colorKey) ?? TAG_COLORS[0];
}

export function tagDisplay(raw: string) {
  return parseTag(raw).name;
}
