// O que acontece com uma DEMANDA EXTRA quando é concluída em uma etapa. A regra é editada no Fluxo (Configurações → Agência → Fluxo de
// etapas) e guardada em pm_stage_flows.extra_rules; aqui fica só a leitura, com o padrão para etapa sem regra.
//   deliver   → a tarefa vai para a etapa final (Entregue) já concluída
//   complete  → fica concluída na própria etapa (como era antes)
//   flow      → segue o fluxo normal, passando pelas etapas seguintes como uma tarefa comum

export type ExtraOutcome = "deliver" | "complete" | "flow";

export const EXTRA_OUTCOMES: Array<{ key: ExtraOutcome; label: string; hint: string }> = [
  { key: "deliver", label: "Vai para Entregue", hint: "Ao concluir, a demanda extra já aparece como entregue." },
  { key: "complete", label: "Fica concluída na etapa", hint: "Ao concluir, continua na etapa, só marcada como concluída." },
  { key: "flow", label: "Segue o fluxo normal", hint: "Passa pelas próximas etapas, como uma tarefa comum." },
];

export const EXTRA_RULES_KEYS: readonly string[] = EXTRA_OUTCOMES.map((o) => o.key);

/** Etapa que só aparece como "Entregue"; nela a demanda já está pronta e não há o que decidir. */
export const EXTRA_FINAL_STAGE = "entrega";

export function defaultExtraOutcome(stage: string): ExtraOutcome {
  return stage === "planejamento" ? "flow" : "deliver";
}

export function extraOutcome(rules: Record<string, unknown> | null | undefined, stage: string): ExtraOutcome {
  const v = rules?.[stage];
  return typeof v === "string" && EXTRA_RULES_KEYS.includes(v) ? (v as ExtraOutcome) : defaultExtraOutcome(stage);
}
