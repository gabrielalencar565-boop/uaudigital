import { describe, expect, it } from "vitest";
import { AUTO_TPL, BLOCKS, FORM_TPL, condTrue, countSteps, fillText, findList, findStep, linkFormSteps, makeSlug, makeStep, reid, sendsMessages, slugify, type Step } from "./builder";

const ctx = { stageByName: (n: string) => `id-${n}` };

describe("árvore de passos", () => {
  const steps: Step[] = [
    makeStep("tag"),
    { ...makeStep("cond"), yes: [makeStep("msg"), makeStep("tag")], no: [makeStep("task")] },
    makeStep("human"),
  ];

  it("conta os blocos, inclusive os dos dois caminhos da condição", () => {
    expect(countSteps(steps)).toBe(6);
  });

  it("acha um bloco dentro de um caminho e devolve a lista onde ele mora", () => {
    const inner = steps[1].yes![1];
    const found = findStep(inner.id, steps);
    expect(found?.step.id).toBe(inner.id);
    expect(found?.list).toBe(steps[1].yes);
    expect(found?.index).toBe(1);
  });

  it("acha a lista de um caminho pela chave '<id>:yes|no' e a raiz por 'root'", () => {
    expect(findList("root", steps)).toBe(steps);
    expect(findList(`${steps[1].id}:yes`, steps)).toBe(steps[1].yes);
    expect(findList(`${steps[1].id}:no`, steps)).toBe(steps[1].no);
    expect(findList("naoexiste:yes", steps)).toBeNull();
  });

  it("reid dá ids novos em toda a árvore sem mexer no resto", () => {
    const copy = reid(steps);
    const ids = (l: Step[]): string[] => l.flatMap((s) => [s.id, ...(s.type === "cond" ? [...ids(s.yes ?? []), ...ids(s.no ?? [])] : [])]);
    const before = ids(steps);
    const after = ids(copy);
    expect(after).toHaveLength(before.length);
    expect(after.some((i) => before.includes(i))).toBe(false);
    expect(copy[1].yes![0].text).toBe(steps[1].yes![0].text);
  });
});

describe("condição e texto", () => {
  const lead = { services: ["Conteúdo"], tags: ["Prioritário"], segment: "Saúde", source: "WhatsApp" };
  it("verifica serviço, etiqueta, segmento e origem ignorando maiúsculas", () => {
    expect(condTrue({ ...makeStep("cond"), field: "services", value: "conteúdo" }, lead, {})).toBe(true);
    expect(condTrue({ ...makeStep("cond"), field: "tags", value: "prior" }, lead, {})).toBe(true);
    expect(condTrue({ ...makeStep("cond"), field: "segment", value: "varejo" }, lead, {})).toBe(false);
    expect(condTrue({ ...makeStep("cond"), field: "source", value: "whats" }, lead, {})).toBe(true);
  });
  it("usa a última resposta e o 'respondeu'", () => {
    expect(condTrue({ ...makeStep("cond"), field: "answer", value: "Redes" }, lead, { answer: "Redes sociais" })).toBe(true);
    expect(condTrue({ ...makeStep("cond"), field: "answer", value: "Redes" }, lead, {})).toBe(false);
    expect(condTrue({ ...makeStep("cond"), field: "replied", value: "sim" }, lead, { replied: true })).toBe(true);
    expect(condTrue({ ...makeStep("cond"), field: "replied", value: "sim" }, lead, {})).toBe(false);
  });
  it("{nome} usa o primeiro nome sem Dr./Dra.", () => {
    expect(fillText("Oi, {nome}! ({empresa})", { name: "Dra. Helena Prado", company: "Clínica Prado" })).toBe("Oi, Helena! (Clínica Prado)");
    expect(fillText("Oi, {nome}!")).toBe("Oi, Fulano!");
  });
});

describe("links dos formulários", () => {
  it("slug sem acento e com trecho aleatório para não ser adivinhável", () => {
    expect(slugify("Diagnóstico comercial")).toBe("diagnostico-comercial");
    const a = makeSlug("Captação de leads");
    const b = makeSlug("Captação de leads");
    expect(a).toMatch(/^captacao-de-leads-[a-z0-9]{1,4}$/);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9][a-z0-9-]{2,80}$/);
  });
});

describe("modelos prontos", () => {
  const types = Object.keys(BLOCKS);
  const check = (steps: Step[]) => {
    for (const s of steps) {
      expect(types).toContain(s.type);
      if (s.type === "cond") {
        expect(Array.isArray(s.yes)).toBe(true);
        expect(Array.isArray(s.no)).toBe(true);
        check(s.yes!);
        check(s.no!);
      }
    }
  };
  it.each(Object.entries(AUTO_TPL))("automação %s tem blocos válidos e gatilho conhecido", (_k, t) => {
    check(t.steps(ctx));
    expect(["new", "msg_in", "msg_back", "form", "stage", "won", "idle", "schedule"]).toContain(t.trigger(ctx).type);
  });
  it("os modelos que dependem de etapa usam o id da etapa da agência", () => {
    expect(AUTO_TPL.follow.trigger(ctx).stage).toBe("id-Reunião feita");
    expect(AUTO_TPL.meet.steps(ctx).find((s) => s.type === "deal")?.stage).toBe("id-Reunião agendada");
  });
  it.each(Object.entries(FORM_TPL))("formulário %s tem perguntas com tipo, rótulo e opções coerentes", (_k, t) => {
    const fields = t.fields();
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      expect(f.label.length).toBeGreaterThan(0);
      if (f.type === "choice" || f.type === "multi") expect(f.options.length).toBeGreaterThan(0);
    }
    expect(new Set(fields.map((f) => f.id)).size).toBe(fields.length);
  });
  it("o formulário de captação mapeia nome, WhatsApp e serviços para o lead", () => {
    const maps = FORM_TPL.capt.fields().map((f) => f.map);
    expect(maps).toEqual(expect.arrayContaining(["name", "phone", "services"]));
  });
});

describe("modelos aplicados", () => {
  it("liga o passo de formulário do modelo ao formulário da agência de mesma chave", () => {
    const steps = AUTO_TPL.onboard.steps(ctx);
    const linked = linkFormSteps(steps, [{ id: "f1", key: "onb" }]);
    expect(linked.find((s) => s.type === "form")?.formId).toBe("f1");
    expect(linkFormSteps(steps, []).find((s) => s.type === "form")?.formId).toBeUndefined();
  });
  it("avisa que o fluxo envia mensagem só quando há passo que fala com o lead", () => {
    expect(sendsMessages([makeStep("tag"), makeStep("human")])).toBe(false);
    expect(sendsMessages([{ ...makeStep("cond"), yes: [makeStep("msg")], no: [] }])).toBe(true);
  });
});
