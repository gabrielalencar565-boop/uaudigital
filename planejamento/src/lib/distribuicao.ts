import { FASE_IDS, FASES, type FaseId } from "@/data/fases";
import {
  DIAS,
  OBJETIVOS,
  type Dia,
  PREFERENCIA_FORMATO,
  type FormatoId,
  type FormatoPostId,
  type ObjetivoId,
  type PostsPorSemana,
} from "@/data/formulario";

export const SEMANAS = 4;

export type Slot = { dia: Dia; fase: FaseId; formato: FormatoPostId };
export type Esqueleto = Slot[][]; // [semana][post]

/**
 * Quantos posts de cada fase no mês.
 * Proporção do objetivo, arredondada pelo maior resto (a soma fecha no total).
 * Com 12 posts ou mais, toda fase aparece pelo menos uma vez.
 */
export function contagemFases(objetivo: ObjetivoId, total: number): Record<FaseId, number> {
  const pesos = OBJETIVOS.find((o) => o.id === objetivo)!.pesos;
  const brutos = FASE_IDS.map((id) => ({ id, valor: pesos[id] * total }));
  const contagem = Object.fromEntries(brutos.map((b) => [b.id, Math.floor(b.valor)])) as Record<FaseId, number>;

  let faltam = total - Object.values(contagem).reduce((a, b) => a + b, 0);
  // Maior resto primeiro; empate pelo maior peso, depois pela ordem das fases.
  const porResto = [...brutos].sort(
    (a, b) =>
      b.valor - Math.floor(b.valor) - (a.valor - Math.floor(a.valor)) ||
      pesos[b.id] - pesos[a.id] ||
      FASE_IDS.indexOf(a.id) - FASE_IDS.indexOf(b.id),
  );
  for (let i = 0; faltam > 0; i = (i + 1) % porResto.length, faltam--) contagem[porResto[i].id]++;

  if (total >= FASE_IDS.length * 2) {
    for (const id of FASE_IDS) {
      if (contagem[id] > 0) continue;
      // Tira de quem tem mais (empate: menor peso perde primeiro).
      const doador = [...FASE_IDS]
        .filter((f) => contagem[f] > 1)
        .sort((a, b) => contagem[b] - contagem[a] || pesos[a] - pesos[b])[0];
      if (!doador) break;
      contagem[doador]--;
      contagem[id]++;
    }
  }
  return contagem;
}

export function diasDaSemana(postsPorSemana: PostsPorSemana): Dia[] {
  return DIAS[postsPorSemana];
}

/**
 * Ordem das fases no mês: cada fase espalha seus posts ao longo do mês,
 * puxada para a sua posição preferida (Identificação/Solução no começo;
 * Resistência/Prova social/Recompensa no fim). Depois evita a mesma fase seguida.
 */
export function ordenarFases(contagem: Record<FaseId, number>): FaseId[] {
  const itens: { fase: FaseId; alvo: number }[] = [];
  for (const id of FASE_IDS) {
    const n = contagem[id];
    for (let i = 0; i < n; i++) {
      const espalhado = (i + 0.5) / n;
      itens.push({ fase: id, alvo: 0.55 * FASES[id].posicao + 0.45 * espalhado });
    }
  }
  itens.sort((a, b) => a.alvo - b.alvo || FASE_IDS.indexOf(a.fase) - FASE_IDS.indexOf(b.fase));
  return separarRepetidas(itens.map((i) => i.fase));
}

/**
 * Mantém a ordem o máximo possível, mas nunca coloca a mesma fase seguida
 * quando dá para evitar: a cada posição pega o próximo da fila que não repete
 * a anterior, sem deixar sobrar uma fase "acumulada" para o fim.
 */
export function separarRepetidas(fases: FaseId[]): FaseId[] {
  const fila = [...fases];
  const resultado: FaseId[] = [];
  while (fila.length > 0) {
    const anterior = resultado[resultado.length - 1];
    const restantes = fila.length;
    // Se uma fase ocupa mais da metade do que sobrou, ela precisa entrar agora.
    const contagem = new Map<FaseId, number>();
    for (const f of fila) contagem.set(f, (contagem.get(f) ?? 0) + 1);
    const urgente = [...contagem.entries()].find(([f, n]) => n > Math.ceil((restantes - 1) / 2) && f !== anterior)?.[0];
    let indice = urgente ? fila.indexOf(urgente) : fila.findIndex((f) => f !== anterior);
    if (indice === -1) indice = 0;
    resultado.push(fila.splice(indice, 1)[0]);
  }
  return resultado;
}

/** Formato de cada post: o preferido da fase que o cliente topa, alternando entre os dois melhores. */
export function escolherFormato(fase: FaseId, permitidos: FormatoId[], ocorrencia: number): FormatoPostId {
  const opcoes = PREFERENCIA_FORMATO[fase].filter((f) => permitidos.includes(f));
  if (opcoes.length === 0) return "carrossel";
  const top = opcoes.slice(0, 2);
  return top[ocorrencia % top.length];
}

/** Monta o esqueleto do mês: dia, fase e formato de cada post, semana a semana. */
export function montarEsqueleto(input: {
  objetivo: ObjetivoId;
  postsPorSemana: PostsPorSemana;
  formatos: FormatoId[];
}): Esqueleto {
  const total = input.postsPorSemana * SEMANAS;
  const fases = ordenarFases(contagemFases(input.objetivo, total));
  const dias = diasDaSemana(input.postsPorSemana);
  const ocorrencias: Partial<Record<FaseId, number>> = {};
  const semanas: Esqueleto = [];
  for (let s = 0; s < SEMANAS; s++) {
    const posts: Slot[] = [];
    for (let p = 0; p < input.postsPorSemana; p++) {
      const fase = fases[s * input.postsPorSemana + p];
      const n = ocorrencias[fase] ?? 0;
      ocorrencias[fase] = n + 1;
      posts.push({ dia: dias[p], fase, formato: escolherFormato(fase, input.formatos, n) });
    }
    semanas.push(posts);
  }
  return semanas;
}

/** Em que semana cai a data especial ("dia 20" → semana 3). Sem número de dia, semana 3. */
export function semanaDaData(texto: string): number | null {
  if (!texto.trim()) return null;
  const m = texto.match(/\bdia\s*(\d{1,2})\b/i) ?? texto.match(/\b(\d{1,2})\s*\/\s*\d{1,2}\b/) ?? texto.match(/\b(\d{1,2})\b/);
  const dia = m ? Number(m[1]) : NaN;
  if (!Number.isFinite(dia) || dia < 1 || dia > 31) return 3;
  return Math.min(SEMANAS, Math.max(1, Math.ceil(dia / 7.75)));
}
