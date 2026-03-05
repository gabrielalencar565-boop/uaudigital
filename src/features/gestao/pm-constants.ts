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

export const PM_STAGES = [
  { key: "planejamento", label: "Planejamento" },
  { key: "roteiro", label: "Roteiro" },
  { key: "captacao", label: "Captação" },
  { key: "edicao", label: "Edição" },
  { key: "design", label: "Design" },
  { key: "revisao", label: "Revisão" },
  { key: "entrega", label: "Entrega" },
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

export const PM_TEMPLATE_SUBTASKS = PM_STAGES.map((s, i) => ({
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
