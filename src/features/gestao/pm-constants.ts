import { STAGE_COLOR, STAGES, MAGIC_STAGES } from "@/lib/uau";
import { MAGIC2_STAGES } from "@/features/magic2/magic2-stages";

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

// ── Stages ──
// The built-in pipeline (original Uau/social-media flow). Each agency can rename, recolor, reorder, hide and add
// stages in Configurações → Agência → Fluxo de etapas; the catalog (flow_stages) is applied on top of these at
// runtime by applyStageCatalog() (see StageCatalogProvider). PM_STAGES / PM_ACTIVE_STAGES are mutated in place so
// every importer sees the agency's version on its next render.
export const DEFAULT_PM_STAGES = [
  { key: "captacao", label: "Captação" },
  { key: "planejamento", label: "Planejamento" },
  { key: "design", label: "Design" },
  { key: "edicao_videos", label: "Vídeo" },
  { key: "revisao", label: "Revisão" },
  { key: "pdf", label: "PDF" },
  { key: "agendamento", label: "Agendamento" },
  { key: "entrega", label: "Entregue" },
  // Legacy values kept for backward compat
  { key: "roteiro", label: "Roteiro" },
  { key: "edicao", label: "Edição" },
  { key: "alteracoes", label: "Alterações" },
] as const;

const LEGACY_STAGE_KEYS = ["roteiro", "edicao"];

export const PM_STAGES: { key: string; label: string }[] = DEFAULT_PM_STAGES.map((s) => ({ ...s }));

// Active stages (visible in UI, in display order)
export const PM_ACTIVE_STAGES: { key: string; label: string }[] = PM_STAGES.filter((s) => !LEGACY_STAGE_KEYS.includes(s.key));

export type FlowStageRow = {
  key: string;
  label: string;
  color: string | null;
  kind: string;
  is_system: boolean;
  active: boolean;
  sort_order: number;
};

// Tailwind needs literal class names, so the palette an agency can pick from is spelled out here.
export const STAGE_PALETTE: Record<string, { border: string; bg: string; text: string }> = {
  red: { border: "border-red-500", bg: "bg-red-500", text: "text-red-500" },
  orange: { border: "border-orange-500", bg: "bg-orange-500", text: "text-orange-500" },
  amber: { border: "border-amber-500", bg: "bg-amber-500", text: "text-amber-500" },
  lime: { border: "border-lime-500", bg: "bg-lime-500", text: "text-lime-500" },
  emerald: { border: "border-emerald-500", bg: "bg-emerald-500", text: "text-emerald-500" },
  teal: { border: "border-teal-500", bg: "bg-teal-500", text: "text-teal-500" },
  sky: { border: "border-sky-500", bg: "bg-sky-500", text: "text-sky-500" },
  blue: { border: "border-blue-500", bg: "bg-blue-500", text: "text-blue-500" },
  indigo: { border: "border-indigo-500", bg: "bg-indigo-500", text: "text-indigo-500" },
  violet: { border: "border-violet-500", bg: "bg-violet-500", text: "text-violet-500" },
  fuchsia: { border: "border-fuchsia-500", bg: "bg-fuchsia-500", text: "text-fuchsia-500" },
  pink: { border: "border-pink-500", bg: "bg-pink-500", text: "text-pink-500" },
  rose: { border: "border-rose-500", bg: "bg-rose-500", text: "text-rose-500" },
  zinc: { border: "border-zinc-500", bg: "bg-zinc-500", text: "text-zinc-500" },
};

const stageColorOverrides: Record<string, string> = {};

// null = no catalog (not loaded / failed): keep the built-in pipeline exactly as it always was.
export function applyStageCatalog(rows: FlowStageRow[] | null) {
  for (const k of Object.keys(stageColorOverrides)) delete stageColorOverrides[k];
  if (!rows || rows.length === 0) {
    PM_STAGES.splice(0, PM_STAGES.length, ...DEFAULT_PM_STAGES.map((s) => ({ ...s })));
    PM_ACTIVE_STAGES.splice(0, PM_ACTIVE_STAGES.length, ...PM_STAGES.filter((s) => !LEGACY_STAGE_KEYS.includes(s.key)));
    syncLegacyStageLabels();
    return;
  }
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
  const all = sorted.map((r) => ({ key: r.key, label: r.label }));
  // Legacy keys stay resolvable (old tasks) even though they are never offered.
  for (const legacy of DEFAULT_PM_STAGES) {
    if (!all.some((s) => s.key === legacy.key)) all.push({ key: legacy.key, label: legacy.label });
  }
  PM_STAGES.splice(0, PM_STAGES.length, ...all);
  PM_ACTIVE_STAGES.splice(0, PM_ACTIVE_STAGES.length, ...sorted.filter((r) => r.active).map((r) => ({ key: r.key, label: r.label })));
  for (const r of sorted) if (r.color && STAGE_PALETTE[r.color]) stageColorOverrides[r.key] = r.color;
  syncLegacyStageLabels();
}

// The Magic Number, Agenda, Meu Painel etc. read their names from STAGES / MAGIC_STAGES (src/lib/uau.ts) and MAGIC2_STAGES; keep those
// labels in step with the catalog so renaming a stage in the flow studio renames it everywhere.
function syncLegacyStageLabels() {
  for (const list of [STAGES, MAGIC_STAGES, MAGIC2_STAGES] as unknown as { key: string; label: string }[][]) {
    for (const s of list) s.label = stageLabel(s.key);
  }
}

const DEFAULT_STAGE_ABBR: Record<string, string> = {
  captacao: "CAP", planejamento: "PLAN", design: "DSG", edicao_videos: "VDO",
  revisao: "REV", alteracoes: "ALT", pdf: "PDF", agendamento: "AGN", entrega: "ENT",
};

// Short badge text for a stage: the built-in abbreviation while the stage keeps its original name, otherwise the
// first letters of its (renamed) label.
export function stageAbbr(key: string) {
  const label = stageLabel(key);
  const original = DEFAULT_PM_STAGES.find((s) => s.key === key)?.label;
  if (DEFAULT_STAGE_ABBR[key] && original === label) return DEFAULT_STAGE_ABBR[key];
  const letters = label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return letters.slice(0, 4) || key.toUpperCase().slice(0, 4);
}

// Stage flow: maps each stage to the next one when marked "concluído"
// Planejamento → Revisão (revisão da pauta) → split em Design/Vídeo → Revisão (dos materiais) → PDF → Agendamento → Entrega
export const STAGE_FLOW_NEXT: Record<string, string> = {
  captacao: "planejamento",
  planejamento: "revisao",
  design: "revisao",
  edicao_videos: "revisao",
  revisao: "pdf",
  pdf: "agendamento",
  agendamento: "entrega",
};

export type PmStageKey = (typeof DEFAULT_PM_STAGES)[number]["key"];

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

export const PM_TEMPLATE_SUBTASKS = DEFAULT_PM_STAGES.filter((s) => !LEGACY_STAGE_KEYS.includes(s.key)).map((s, i) => ({
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
// Pipeline stages show the catalog's current name; anything else (periodic "custom_*", tags…) keeps its own label.
export function catalogStageLabel(key: string, fallback?: string | null) {
  return PM_STAGES.find((s) => s.key === key)?.label ?? fallback ?? key;
}

/**
 * Returns the visible stage label for a task, accounting for periodic
 * (custom_*) stages stored in `periodic_stage_key`. The optional
 * `periodicStages` map provides labels for custom keys.
 */
export function taskStageLabel(
  task: { stage_current: string; periodic_stage_key?: string | null } | null | undefined,
  periodicStages?: Array<{ key: string; label: string }>
) {
  if (!task) return "";
  if (task.periodic_stage_key) {
    const found = periodicStages?.find((p) => p.key === task.periodic_stage_key);
    if (found) return found.label;
    // Fallback: prettify the key
    return task.periodic_stage_key.replace(/^custom_/, "").replace(/_/g, " ");
  }
  return stageLabel(task.stage_current);
}
export function priorityMeta(key: string) {
  return PM_PRIORITIES.find((p) => p.key === key) ?? PM_PRIORITIES[1];
}
export function subtaskStatusMeta(key: string) {
  return PM_SUBTASK_STATUSES.find((s) => s.key === key) ?? PM_SUBTASK_STATUSES[0];
}

// ── Stage circle colors (ClickUp style) ──
export const STAGE_CIRCLE_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  captacao: { border: "border-red-500", bg: "bg-red-500", text: "text-red-500" },
  planejamento: { border: "border-orange-500", bg: "bg-orange-500", text: "text-orange-500" },
  design: { border: "border-teal-500", bg: "bg-teal-500", text: "text-teal-500" },
  edicao_videos: { border: "border-blue-500", bg: "bg-blue-500", text: "text-blue-500" },
  revisao: { border: "border-pink-500", bg: "bg-pink-500", text: "text-pink-500" },
  alteracoes: { border: "border-[#ffcc01]", bg: "bg-[#ffcc01]", text: "text-[#ffcc01]" },
  pdf: { border: "border-indigo-500", bg: "bg-indigo-500", text: "text-indigo-500" },
  agendamento: { border: "border-violet-500", bg: "bg-violet-500", text: "text-violet-500" },
  entrega: { border: "border-emerald-500", bg: "bg-emerald-500", text: "text-emerald-500" },
};

export function getStageCircleColor(key: string) {
  const override = stageColorOverrides[key];
  if (override) return STAGE_PALETTE[override];
  return STAGE_CIRCLE_COLORS[key] ?? { border: "border-muted-foreground", bg: "bg-muted-foreground", text: "text-muted-foreground" };
}

// Stage color mapping synced with agenda (from STAGE_COLOR in uau.ts)
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
  { key: "lime", label: "Lima", bg: "bg-lime-500/20", text: "text-lime-400", dot: "bg-lime-500" },
  { key: "fuchsia", label: "Fúcsia", bg: "bg-fuchsia-500/20", text: "text-fuchsia-400", dot: "bg-fuchsia-500" },
  { key: "sky", label: "Céu", bg: "bg-sky-500/20", text: "text-sky-400", dot: "bg-sky-500" },
  { key: "rose", label: "Rosa Escuro", bg: "bg-rose-600/20", text: "text-rose-300", dot: "bg-rose-600" },
  { key: "amber", label: "Âmbar", bg: "bg-amber-500/20", text: "text-amber-300", dot: "bg-amber-500" },
  { key: "emerald", label: "Esmeralda", bg: "bg-emerald-600/20", text: "text-emerald-300", dot: "bg-emerald-600" },
  { key: "slate", label: "Ardósia", bg: "bg-slate-500/20", text: "text-slate-300", dot: "bg-slate-500" },
  { key: "zinc", label: "Zinco", bg: "bg-zinc-500/20", text: "text-gray-950", dot: "bg-zinc-500" },
];

// Tags are stored as "name:colorKey" in the tags array
// colorKey can be a TAG_COLORS key OR a hex color (e.g. "#a3b1ff")
export function parseTag(raw: string): { name: string; colorKey: string } {
  const idx = raw.lastIndexOf(":");
  if (idx > 0) {
    const colorKey = raw.slice(idx + 1);
    if (TAG_COLORS.find(c => c.key === colorKey) || /^#[0-9a-fA-F]{6}$/.test(colorKey)) {
      return { name: raw.slice(0, idx), colorKey };
    }
  }
  return { name: raw, colorKey: "blue" };
}

export function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export function tagColor(raw: string) {
  const { colorKey } = parseTag(raw);
  if (isHexColor(colorKey)) {
    // Custom hex → build inline-style equivalents
    return {
      key: colorKey,
      label: colorKey,
      bg: "",
      text: "",
      dot: "",
      hex: colorKey,
      style: { backgroundColor: `${colorKey}33`, color: colorKey },
      dotStyle: { backgroundColor: colorKey },
    };
  }
  const found = TAG_COLORS.find(c => c.key === colorKey) ?? TAG_COLORS[0];
  return { ...found, hex: undefined, style: undefined, dotStyle: undefined };
}

export function tagDisplay(raw: string) {
  return parseTag(raw).name;
}

