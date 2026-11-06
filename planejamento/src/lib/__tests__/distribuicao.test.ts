import { describe, expect, it } from "vitest";
import { FASE_IDS, type FaseId } from "@/data/fases";
import { OBJETIVO_IDS, OBJETIVOS, POSTS_POR_SEMANA, type FormatoId } from "@/data/formulario";
import {
  contagemFases,
  diasDaSemana,
  escolherFormato,
  montarEsqueleto,
  ordenarFases,
  semanaDaData,
  separarRepetidas,
} from "@/lib/distribuicao";

const soma = (c: Record<FaseId, number>) => Object.values(c).reduce((a, b) => a + b, 0);

describe("contagem de fases", () => {
  for (const objetivo of OBJETIVO_IDS) {
    for (const porSemana of POSTS_POR_SEMANA) {
      const total = porSemana * 4;
      it(`${objetivo} · ${total} posts: soma fecha e segue a proporção`, () => {
        const c = contagemFases(objetivo, total);
        expect(soma(c)).toBe(total);
        const pesos = OBJETIVOS.find((o) => o.id === objetivo)!.pesos;
        for (const id of FASE_IDS) {
          // Nunca se afasta mais de 1 post da proporção (o mínimo de 1 por fase pode somar mais 1).
          expect(Math.abs(c[id] - pesos[id] * total)).toBeLessThanOrEqual(1.5);
          expect(c[id]).toBeGreaterThanOrEqual(0);
        }
        if (total >= 12) for (const id of FASE_IDS) expect(c[id]).toBeGreaterThanOrEqual(1);
      });
    }
  }

  it("vender mais com 12 posts (exemplo do briefing)", () => {
    expect(contagemFases("vender", 12)).toEqual({
      identificacao: 2,
      solucao: 2,
      resistencia: 3,
      autoridade: 1,
      prova_social: 3,
      recompensa: 1,
    });
  });

  it("8 posts pode deixar fase de fora (menos de 12)", () => {
    const c = contagemFases("conhecido", 8);
    expect(soma(c)).toBe(8);
    expect(c.recompensa).toBe(0);
  });
});

describe("ordem no mês", () => {
  for (const objetivo of OBJETIVO_IDS) {
    for (const porSemana of POSTS_POR_SEMANA) {
      it(`${objetivo} · ${porSemana}/semana: sem fase repetida colada e começo puxa identificação`, () => {
        const total = porSemana * 4;
        const contagem = contagemFases(objetivo, total);
        const ordem = ordenarFases(contagem);
        expect(ordem).toHaveLength(total);
        // Mesmas quantidades da contagem.
        for (const id of FASE_IDS) expect(ordem.filter((f) => f === id)).toHaveLength(contagem[id]);
        // Nenhuma fase colada em si mesma (com estas proporções sempre dá pra evitar).
        for (let i = 1; i < ordem.length; i++) expect(ordem[i]).not.toBe(ordem[i - 1]);
        // Primeira metade tem mais Identificação+Solução; segunda, mais Resistência+Prova+Recompensa.
        const metade = total / 2;
        const conta = (lista: FaseId[], fases: FaseId[]) => lista.filter((f) => fases.includes(f)).length;
        const inicio = ordem.slice(0, metade);
        const fim = ordem.slice(metade);
        expect(conta(inicio, ["identificacao", "solucao"])).toBeGreaterThanOrEqual(conta(fim, ["identificacao", "solucao"]));
        expect(conta(fim, ["resistencia", "prova_social", "recompensa"])).toBeGreaterThanOrEqual(
          conta(inicio, ["resistencia", "prova_social", "recompensa"]),
        );
      });
    }
  }

  it("separarRepetidas evita colar iguais quando dá", () => {
    const r = separarRepetidas(["solucao", "solucao", "identificacao", "identificacao"]);
    for (let i = 1; i < r.length; i++) expect(r[i]).not.toBe(r[i - 1]);
  });

  it("separarRepetidas não quebra quando é impossível evitar", () => {
    expect(separarRepetidas(["solucao", "solucao", "solucao"])).toEqual(["solucao", "solucao", "solucao"]);
  });
});

describe("dias sugeridos", () => {
  it.each([
    [2, ["Ter", "Qui"]],
    [3, ["Seg", "Qua", "Sex"]],
    [4, ["Seg", "Ter", "Qui", "Sáb"]],
    [5, ["Seg", "Ter", "Qua", "Qui", "Sex"]],
  ] as const)("%i posts -> %j", (n, dias) => {
    expect(diasDaSemana(n)).toEqual(dias);
  });
});

describe("formatos", () => {
  it("usa só formatos que o cliente topa", () => {
    const permitidos: FormatoId[] = ["carrossel", "stories"];
    for (const fase of FASE_IDS) expect(escolherFormato(fase, permitidos, 0)).toBe("carrossel");
  });

  it("prefere Reels para identificação e Carrossel para solução", () => {
    const todos: FormatoId[] = ["reels_com_rosto", "reels_sem_rosto", "carrossel", "estatico"];
    expect(escolherFormato("identificacao", todos, 0)).toBe("reels_com_rosto");
    expect(escolherFormato("solucao", todos, 0)).toBe("carrossel");
    expect(escolherFormato("autoridade", ["reels_sem_rosto", "estatico"], 0)).toBe("reels_sem_rosto");
  });

  it("esqueleto respeita dias, quantidade e formatos", () => {
    const esq = montarEsqueleto({ objetivo: "vender", postsPorSemana: 3, formatos: ["reels_sem_rosto", "carrossel"] });
    expect(esq).toHaveLength(4);
    for (const semana of esq) {
      expect(semana.map((p) => p.dia)).toEqual(["Seg", "Qua", "Sex"]);
      for (const p of semana) expect(["reels_sem_rosto", "carrossel"]).toContain(p.formato);
    }
    // Imprime pra conferência visual no terminal.
    console.log(esq.map((s, i) => `S${i + 1}: ` + s.map((p) => `${p.dia} ${p.fase}/${p.formato}`).join(" · ")).join("\n"));
  });
});

describe("data especial", () => {
  it.each([
    ["promoção de aniversário dia 20", 3],
    ["dia 3 é dia do cliente", 1],
    ["Black Friday 28/11", 4],
    ["campanha do mês", 3],
    ["", null],
  ])("%s -> semana %s", (texto, semana) => {
    expect(semanaDaData(texto)).toBe(semana);
  });
});
