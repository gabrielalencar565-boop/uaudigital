// Prazo da etapa seguinte quando a etapa anterior foi concluída com atraso. A regra é uma configuração do fluxo (Fluxos → "Etapa concluída com atraso"),
// guardada em pm_stage_flows.late_rule:
//   keep        → soma os dias da etapa ao prazo que a etapa anterior tinha (se estava atrasada, a próxima já nasce atrasada)
//   from_today  → se a etapa anterior estava atrasada, soma os dias a partir de hoje
import { addDays, format } from "date-fns";

export type LateRule = "keep" | "from_today";

export const LATE_RULES: Array<{ key: LateRule; label: string; hint: string }> = [
  { key: "keep", label: "Segue o prazo planejado", hint: "A próxima etapa soma os dias ao prazo da anterior, mesmo que ela tenha atrasado." },
  { key: "from_today", label: "Conta a partir de hoje", hint: "Se a etapa anterior atrasou, a próxima soma os dias a partir da data em que foi concluída, para não nascer atrasada." },
];

export const normalizeLateRule = (v: unknown): LateRule => (v === "from_today" ? "from_today" : "keep");

/** Data-base (meio-dia, para não virar de dia por fuso) à qual se somam os dias da etapa seguinte. */
export function nextDueBase(dueDate: string | null | undefined, rule: LateRule, today: Date = new Date()): Date {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  if (!dueDate) return now;
  const due = new Date(`${dueDate.slice(0, 10)}T12:00:00`);
  return rule === "from_today" && due < now ? now : due;
}

export const nextDueKey = (dueDate: string | null | undefined, days: number, rule: LateRule, today?: Date): string =>
  format(addDays(nextDueBase(dueDate, rule, today), days), "yyyy-MM-dd");
