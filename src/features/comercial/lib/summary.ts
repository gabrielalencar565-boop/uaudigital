// Textos curtos que descrevem um gatilho ou um bloco (lista de automações, editor e teste).
import type { Stage } from "./rules";
import { fillText, TRIGGERS, COND_FIELDS, type ComercialForm, type Step, type Trigger } from "./builder";
import type { TeamMember } from "../hooks/use-comercial";

export interface SummaryCtx {
  stages: Stage[];
  team: TeamMember[];
  forms: ComercialForm[];
}

export const ownerName = (o: string | undefined, ctx: SummaryCtx): string =>
  !o || o === "lead" ? "responsável do lead" : ctx.team.find((m) => m.user_id === o)?.display_name ?? "alguém da equipe";

export function triggerText(t: Trigger, ctx: SummaryCtx): string {
  const base = TRIGGERS[t.type];
  if (t.type === "form") return `${base}: ${ctx.forms.find((f) => f.id === t.formId)?.name ?? "qualquer formulário"}`;
  if (t.type === "stage") return `${base}: ${ctx.stages.find((s) => s.id === t.stage)?.name ?? "escolher etapa"}`;
  if (t.type === "msg_back") return `Lead volta a falar depois de ${t.hours || 24}h sem contato`;
  if (t.type === "idle") return `Negócio parado há ${t.days || 7} dias`;
  if (t.type === "schedule") return `${base}: ${t.every || "definir"}`;
  return base;
}

/** `main` é a linha principal do bloco; `sub` (opcional) uma segunda linha mais discreta. */
export function blockSummary(s: Step, ctx: SummaryCtx): { main: string; sub?: string } {
  switch (s.type) {
    case "msg": return { main: `“${fillText(s.text)}”` };
    case "ask": return { main: `“${s.text ?? ""}”`, sub: s.options?.length ? `Opções: ${s.options.join(" · ")}` : "Resposta livre" };
    case "cond": return { main: `Se ${COND_FIELDS[s.field ?? "answer"]} ${s.field === "replied" ? "= sim" : `contém “${s.value ?? ""}”`}` };
    case "wait": return { main: s.until === "resposta" ? `Espera a resposta por até ${s.amount} ${s.unit}` : `Espera ${s.amount} ${s.unit}` };
    case "tag": return { main: `Etiqueta “${s.tag ?? ""}”` };
    case "deal": {
      const parts = [s.stage && `Mover para ${ctx.stages.find((x) => x.id === s.stage)?.name ?? "etapa"}`, s.owner && `Responsável: ${ownerName(s.owner, ctx)}`].filter(Boolean);
      return { main: parts.join(" · ") || "Definir o que muda" };
    }
    case "task": return { main: `${s.ttype}: ${s.title} · ${s.days ? `em ${s.days} dia${(s.days ?? 0) > 1 ? "s" : ""}` : "hoje"} · ${ownerName(s.owner, ctx)}` };
    case "meet": return { main: `“${s.text ?? ""}”`, sub: (s.options ?? []).join(" · ") };
    case "form": {
      const f = s.formId ? ctx.forms.find((x) => x.id === s.formId) : undefined;
      return { main: `Link: ${f?.name ?? "escolher formulário"}` };
    }
    case "human": return { main: `Passa pra ${ownerName(s.owner, ctx)}` };
  }
}
