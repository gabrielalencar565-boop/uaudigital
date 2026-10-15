// O que acontece com uma DEMANDA EXTRA quando é concluída em uma etapa. A regra é editada no Fluxo (Configurações → Agência → Fluxo de
// etapas) e guardada em pm_stage_flows.extra_rules; aqui fica só a leitura, com o padrão para etapa sem regra.
//   deliver   → a tarefa vai para a etapa final (Entregue) já concluída
//   complete  → fica concluída na própria etapa (como era antes)
//   flow      → segue o fluxo normal, passando pelas etapas seguintes como uma tarefa comum

import { inferPmPostType } from "../utils/infer-pm-post-type";

export type ExtraOutcome = "deliver" | "complete" | "flow";

export const EXTRA_OUTCOMES: Array<{ key: ExtraOutcome; label: string; hint: string }> = [
  { key: "deliver", label: "Vai para Entregue", hint: "Ao concluir, a demanda extra já aparece como entregue." },
  { key: "complete", label: "Fica concluída na etapa", hint: "Ao concluir, continua na etapa, só marcada como concluída." },
  { key: "flow", label: "Segue o fluxo normal", hint: "Passa pelas próximas etapas, como uma tarefa comum." },
];

export const EXTRA_RULES_KEYS: readonly string[] = EXTRA_OUTCOMES.map((o) => o.key);

/** Etapa que só aparece como "Entregue"; nela a demanda já está pronta e não há o que decidir. */
export const EXTRA_FINAL_STAGE = "entrega";

// Concluída = continua na própria etapa (DSG, VDO…) só marcada como concluída; quem quiser mandar para Entregue escolhe no Fluxo.
export function defaultExtraOutcome(stage: string): ExtraOutcome {
  return stage === "planejamento" ? "flow" : "complete";
}

export function extraOutcome(rules: Record<string, unknown> | null | undefined, stage: string): ExtraOutcome {
  const v = rules?.[stage];
  return typeof v === "string" && EXTRA_RULES_KEYS.includes(v) ? (v as ExtraOutcome) : defaultExtraOutcome(stage);
}

// Demanda extra concluída mostra O QUE ela é (design, vídeo), não por qual etapa passou: uma extra de design criada em Agendamento
// ou mandada ao PDF aparece como DSG com o check, não como AGN/PDF.
const TYPE_STAGE: Record<string, string> = { design: "design", video: "edicao_videos" };
const PASS_THROUGH_STAGES = ["agendamento", "pdf", "revisao", "entrega"];

export function extraDisplayStage(task: {
  is_extra_demand?: boolean | null; status_global?: string | null; stage_current?: string | null; periodic_stage_key?: string | null;
  post_type?: string | null; tags?: string[] | null; title?: string | null;
}): string | null {
  if (!task.is_extra_demand || task.status_global !== "concluido" || task.periodic_stage_key) return null;
  if (!PASS_THROUGH_STAGES.includes(task.stage_current ?? "")) return null;
  const type = inferPmPostType({ post_type: task.post_type, tags: task.tags, title: task.title });
  return type ? TYPE_STAGE[type] : null;
}
