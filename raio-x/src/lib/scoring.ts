import {
  AREAS,
  BANDS,
  BOTTLENECK_PRIORITY,
  LEVELS,
  QUESTIONS,
  type AreaId,
  type Band,
  type Level,
} from "@/data/raiox";

/**
 * Respostas: id da pergunta -> índice da opção ORIGINAL (0..3) no banco
 * de perguntas (não o índice embaralhado exibido na tela).
 */
export type Answers = Record<number, number>;

export type AreaScores = Record<AreaId, number>;

export type RaioXResult = {
  overall: number;
  areas: AreaScores;
  level: Level;
  bottleneck: AreaId;
  strongest: AreaId;
};

export function pointsFor(questionId: number, optionIndex: number | undefined): number {
  if (optionIndex === undefined) return 0;
  const question = QUESTIONS.find((q) => q.id === questionId);
  const option = question?.options[optionIndex];
  return option ? option.points : 0;
}

/**
 * Nota da área = (soma dos pontos da área ÷ máximo possível) × 100, arredondada.
 * Máximo = nº de perguntas da área × 3 (hoje: 2 perguntas → 6 pontos).
 */
export function areaScores(answers: Answers): AreaScores {
  const scores = {} as AreaScores;
  for (const area of AREAS) {
    const questions = QUESTIONS.filter((q) => q.area === area.id);
    const sum = questions.reduce((acc, q) => acc + pointsFor(q.id, answers[q.id]), 0);
    const max = questions.length * 3;
    scores[area.id] = max ? Math.round((sum / max) * 100) : 0;
  }
  return scores;
}

/** Nota geral = média das 6 notas de área, arredondada. */
export function overallScore(scores: AreaScores): number {
  const values = AREAS.map((a) => scores[a.id]);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

function clamp(score: number) {
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function levelFor(overall: number): Level {
  const s = clamp(overall);
  return LEVELS.find((l) => s >= l.min && s <= l.max) ?? LEVELS[0];
}

export function bandFor(score: number): Band {
  const s = clamp(score);
  return BANDS.find((b) => s >= b.min && s <= b.max) ?? BANDS[0];
}

/** Menor nota; empate resolvido pela ordem de BOTTLENECK_PRIORITY. */
export function bottleneckFor(scores: AreaScores): AreaId {
  let best: AreaId = BOTTLENECK_PRIORITY[0];
  for (const id of BOTTLENECK_PRIORITY) {
    if (scores[id] < scores[best]) best = id;
  }
  return best;
}

/** Áreas da menor para a maior nota; empate segue BOTTLENECK_PRIORITY. Usado no plano de ação. */
export function rankedAreas(scores: AreaScores): AreaId[] {
  return [...BOTTLENECK_PRIORITY].sort(
    (a, b) => scores[a] - scores[b] || BOTTLENECK_PRIORITY.indexOf(a) - BOTTLENECK_PRIORITY.indexOf(b),
  );
}

/** Maior nota; empate resolvido pela ordem das áreas (01 a 06). */
export function strongestFor(scores: AreaScores): AreaId {
  let best: AreaId = AREAS[0].id;
  for (const area of AREAS) {
    if (scores[area.id] > scores[best]) best = area.id;
  }
  return best;
}

export function computeResult(answers: Answers): RaioXResult {
  const areas = areaScores(answers);
  const overall = overallScore(areas);
  return {
    overall,
    areas,
    level: levelFor(overall),
    bottleneck: bottleneckFor(areas),
    strongest: strongestFor(areas),
  };
}

export function isComplete(answers: Answers): boolean {
  return QUESTIONS.every((q) => {
    const v = answers[q.id];
    return Number.isInteger(v) && v >= 0 && v < q.options.length;
  });
}

/** Ordem embaralhada (Fisher–Yates) dos índices das opções. */
export function shuffledOrder(length: number, random: () => number = Math.random): number[] {
  const order = Array.from({ length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
