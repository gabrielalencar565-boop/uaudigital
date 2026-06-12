export type CrmStage =
  | "novo_lead"
  | "primeiro_contato"
  | "qualificacao"
  | "diagnostico"
  | "proposta_enviada"
  | "follow_up"
  | "fechado"
  | "perdido";

export type CrmLossReason =
  | "preco"
  | "sem_retorno"
  | "concorrente"
  | "sem_orcamento"
  | "nao_era_momento"
  | "sem_perfil";

export type CrmTaskType = "ligacao" | "proposta" | "follow_up" | "reuniao";
export type CrmTaskStatus = "pendente" | "concluida" | "cancelada";
export type CrmProposalStatus = "rascunho" | "enviada" | "aceita" | "recusada" | "expirada";
export type CrmUrgencia = "baixa" | "media" | "alta";
export type CrmPotencial = "baixo" | "medio" | "alto";

export const STAGES: { value: CrmStage; label: string; color: string; bg: string }[] = [
  { value: "novo_lead", label: "Novo lead", color: "text-sky-500", bg: "bg-sky-500/10 border-sky-500/30" },
  { value: "primeiro_contato", label: "Primeiro contato", color: "text-cyan-500", bg: "bg-cyan-500/10 border-cyan-500/30" },
  { value: "qualificacao", label: "Qualificação", color: "text-indigo-500", bg: "bg-indigo-500/10 border-indigo-500/30" },
  { value: "diagnostico", label: "Diagnóstico", color: "text-violet-500", bg: "bg-violet-500/10 border-violet-500/30" },
  { value: "proposta_enviada", label: "Proposta enviada", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/30" },
  { value: "follow_up", label: "Follow-up", color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30" },
  { value: "fechado", label: "Fechado", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/30" },
  { value: "perdido", label: "Perdido", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/30" },
];

export const STAGE_LABEL: Record<CrmStage, string> = Object.fromEntries(
  STAGES.map((s) => [s.value, s.label]),
) as Record<CrmStage, string>;

export const LOSS_REASONS: { value: CrmLossReason; label: string }[] = [
  { value: "preco", label: "Preço" },
  { value: "sem_retorno", label: "Sem retorno" },
  { value: "concorrente", label: "Fechou com concorrente" },
  { value: "sem_orcamento", label: "Sem orçamento" },
  { value: "nao_era_momento", label: "Não era o momento" },
  { value: "sem_perfil", label: "Lead sem perfil" },
];

export const LOSS_LABEL: Record<CrmLossReason, string> = Object.fromEntries(
  LOSS_REASONS.map((r) => [r.value, r.label]),
) as Record<CrmLossReason, string>;

export const TASK_TYPES: { value: CrmTaskType; label: string; emoji: string }[] = [
  { value: "ligacao", label: "Ligação", emoji: "📞" },
  { value: "proposta", label: "Envio de proposta", emoji: "📄" },
  { value: "follow_up", label: "Follow-up", emoji: "🔁" },
  { value: "reuniao", label: "Reunião", emoji: "📅" },
];

export const TASK_TYPE_LABEL: Record<CrmTaskType, string> = Object.fromEntries(
  TASK_TYPES.map((t) => [t.value, t.label]),
) as Record<CrmTaskType, string>;

export const PROPOSAL_STATUS: { value: CrmProposalStatus; label: string; color: string }[] = [
  { value: "rascunho", label: "Rascunho", color: "bg-muted text-muted-foreground" },
  { value: "enviada", label: "Enviada", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { value: "aceita", label: "Aceita", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { value: "recusada", label: "Recusada", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  { value: "expirada", label: "Expirada", color: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400" },
];

export const ORIGEM_OPTIONS = [
  "whatsapp",
  "instagram",
  "indicação",
  "site",
  "anúncio",
  "evento",
  "outro",
];

export const SEGMENTO_OPTIONS = [
  "Restaurante",
  "Saúde",
  "Moda",
  "Serviços",
  "Tecnologia",
  "Beleza",
  "Educação",
  "E-commerce",
  "Outro",
];

export function fmtCurrency(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

export function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}
