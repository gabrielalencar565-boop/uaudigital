import { describe, expect, it } from "vitest";
import { AREAS, QUESTIONS, type AreaId } from "@/data/raiox";
import {
  areaScores,
  bandFor,
  bottleneckFor,
  computeResult,
  isComplete,
  levelFor,
  overallScore,
  shuffledOrder,
  strongestFor,
  type Answers,
  type AreaScores,
} from "@/lib/scoring";

/** Responde todas as perguntas de cada área com a opção de N pontos. */
function answersByArea(points: Partial<Record<AreaId, number>>, fallback = 0): Answers {
  const answers: Answers = {};
  for (const q of QUESTIONS) {
    const p = points[q.area] ?? fallback;
    answers[q.id] = q.options.findIndex((o) => o.points === p);
  }
  return answers;
}

function scores(partial: Partial<AreaScores>, fallback = 50): AreaScores {
  return Object.fromEntries(AREAS.map((a) => [a.id, partial[a.id] ?? fallback])) as AreaScores;
}

describe("banco de perguntas", () => {
  it("tem 6 áreas com 2 perguntas cada e opções de 0 a 3 pontos", () => {
    expect(QUESTIONS).toHaveLength(12);
    for (const area of AREAS) {
      expect(QUESTIONS.filter((q) => q.area === area.id)).toHaveLength(2);
    }
    for (const q of QUESTIONS) {
      expect(q.options.map((o) => o.points).sort()).toEqual([0, 1, 2, 3]);
    }
    expect(QUESTIONS.map((q) => q.id)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });
});

describe("nota por área", () => {
  it("tudo 0 dá 0 e tudo 3 dá 100", () => {
    expect(Object.values(areaScores(answersByArea({}, 0)))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(Object.values(areaScores(answersByArea({}, 3)))).toEqual([100, 100, 100, 100, 100, 100]);
  });

  it("calcula (soma ÷ 6) × 100 arredondado", () => {
    const answers = answersByArea({}, 0);
    // Objetivo: 3 + 2 = 5 -> 83,33 -> 83
    const [a, b] = QUESTIONS.filter((q) => q.area === "objetivo");
    answers[a.id] = a.options.findIndex((o) => o.points === 3);
    answers[b.id] = b.options.findIndex((o) => o.points === 2);
    expect(areaScores(answers).objetivo).toBe(83);
    // Diagnóstico: só 1 ponto -> 16,67 -> 17
    const diag = QUESTIONS.find((q) => q.area === "diagnostico")!;
    answers[diag.id] = 1;
    expect(areaScores(answers).diagnostico).toBe(17);
  });

  it("arredonda pro inteiro mais próximo (2/6 = 33,33 -> 33; 4/6 = 66,67 -> 67)", () => {
    const answers = answersByArea({}, 0);
    const [v1, v2] = QUESTIONS.filter((q) => q.area === "valor");
    answers[v1.id] = 1;
    answers[v2.id] = 1;
    expect(areaScores(answers).valor).toBe(33);
    answers[v1.id] = 2;
    answers[v2.id] = 2;
    expect(areaScores(answers).valor).toBe(67);
  });

  it("pergunta sem resposta vale 0", () => {
    expect(areaScores({}).objetivo).toBe(0);
  });
});

describe("nota geral", () => {
  it("é a média das 6 áreas, arredondada", () => {
    expect(overallScore(scores({ objetivo: 100, diagnostico: 75, concorrentes: 50, conteudo: 25, apresentacao: 0, valor: 58 }))).toBe(51); // 308/6 = 51,33
    expect(overallScore(scores({ objetivo: 67, diagnostico: 67, concorrentes: 67, conteudo: 67, apresentacao: 66, valor: 66 }))).toBe(67); // 66,67
  });

  it("resultado completo bate com o esperado", () => {
    const r = computeResult(answersByArea({ objetivo: 3, diagnostico: 2, concorrentes: 1, conteudo: 2, apresentacao: 0, valor: 1 }));
    expect(r.areas).toEqual({ objetivo: 100, diagnostico: 67, concorrentes: 33, conteudo: 67, apresentacao: 0, valor: 33 });
    expect(r.overall).toBe(50);
    expect(r.level.id).toBe("executor");
    expect(r.bottleneck).toBe("apresentacao");
    expect(r.strongest).toBe("objetivo");
  });
});

describe("nível", () => {
  it.each([
    [0, "fazedor"],
    [39, "fazedor"],
    [40, "executor"],
    [59, "executor"],
    [60, "construcao"],
    [79, "construcao"],
    [80, "estrategista"],
    [100, "estrategista"],
  ])("nota %i -> %s", (score, id) => {
    expect(levelFor(score).id).toBe(id);
  });
});

describe("faixa por área", () => {
  it.each([
    [0, "critico"],
    [39, "critico"],
    [40, "fragil"],
    [59, "fragil"],
    [60, "desenvolvimento"],
    [79, "desenvolvimento"],
    [80, "avancado"],
    [100, "avancado"],
  ])("nota %i -> %s", (score, id) => {
    expect(bandFor(score).id).toBe(id);
  });
});

describe("principal gargalo", () => {
  it("é a área com a menor nota", () => {
    expect(bottleneckFor(scores({ concorrentes: 10 }))).toBe("concorrentes");
    expect(bottleneckFor(scores({ valor: 49 }))).toBe("valor");
  });

  it("empate total segue a prioridade: Objetivo primeiro", () => {
    expect(bottleneckFor(scores({}, 50))).toBe("objetivo");
  });

  it("empate entre Concorrentes e Apresentação -> Apresentação", () => {
    expect(bottleneckFor(scores({ concorrentes: 20, apresentacao: 20 }))).toBe("apresentacao");
  });

  it("empate entre Diagnóstico e Conteúdo -> Diagnóstico", () => {
    expect(bottleneckFor(scores({ conteudo: 8, diagnostico: 8 }))).toBe("diagnostico");
  });

  it("empate entre Valor e Concorrentes -> Valor", () => {
    expect(bottleneckFor(scores({ concorrentes: 0, valor: 0 }))).toBe("valor");
  });

  it("empate entre Conteúdo e Valor -> Conteúdo", () => {
    expect(bottleneckFor(scores({ valor: 25, conteudo: 25 }))).toBe("conteudo");
  });

  it("menor nota vence a prioridade", () => {
    expect(bottleneckFor(scores({ objetivo: 30, concorrentes: 29 }))).toBe("concorrentes");
  });
});

describe("área mais forte", () => {
  it("é a de maior nota; empate segue a ordem das áreas", () => {
    expect(strongestFor(scores({ valor: 90 }))).toBe("valor");
    expect(strongestFor(scores({}, 50))).toBe("objetivo");
    expect(strongestFor(scores({ conteudo: 80, diagnostico: 80 }))).toBe("diagnostico");
  });
});

describe("utilitários", () => {
  it("isComplete exige todas as respostas válidas", () => {
    expect(isComplete(answersByArea({}, 2))).toBe(true);
    const missing = answersByArea({}, 2);
    delete missing[12];
    expect(isComplete(missing)).toBe(false);
    expect(isComplete({ ...answersByArea({}, 2), 3: 7 })).toBe(false);
  });

  it("shuffledOrder devolve uma permutação", () => {
    for (let i = 0; i < 20; i++) {
      expect([...shuffledOrder(4)].sort()).toEqual([0, 1, 2, 3]);
    }
  });
});
