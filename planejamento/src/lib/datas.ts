import type { Dia } from "@/data/formulario";
import type { Plano, Post } from "./plano";

/**
 * Datas sugeridas para os posts do mês.
 * A semana 1 começa na primeira segunda-feira do mês e cada semana seguinte, 7 dias depois.
 * Assim nenhum post cai no mês anterior; se o mês começa no fim de semana, ninguém perde nada.
 */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DESLOCAMENTO: Record<Dia, number> = { Seg: 0, Ter: 1, Qua: 2, Qui: 3, Sex: 4, "Sáb": 5 };
export const DIAS_DA_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export type Data = { dia: number; mes: number; ano: number; foraDoMes: boolean };

/** "novembro de 2026" → { mes: 10, ano: 2026 }. */
export function lerMes(texto: string): { mes: number; ano: number } | null {
  const m = texto.trim().toLowerCase().match(/^([a-zç]+) de (\d{4})$/);
  if (!m) return null;
  const mes = MESES.indexOf(m[1]);
  return mes < 0 ? null : { mes, ano: Number(m[2]) };
}

function data(ano: number, mes: number, dia: number, mesDoPlano: number): Data {
  const d = new Date(Date.UTC(ano, mes, dia));
  return { dia: d.getUTCDate(), mes: d.getUTCMonth(), ano: d.getUTCFullYear(), foraDoMes: d.getUTCMonth() !== mesDoPlano };
}

/** Dia do mês (1 a 7) da primeira segunda-feira. */
function primeiraSegunda(ano: number, mes: number): number {
  const semana = new Date(Date.UTC(ano, mes, 1)).getUTCDay(); // 0 = domingo
  return 1 + ((8 - semana) % 7);
}

/** A grade do calendário: 4 linhas (as 4 semanas do plano) × 7 dias, de segunda a domingo. */
export function gradeDoMes(mesTexto: string): Data[][] | null {
  const m = lerMes(mesTexto);
  if (!m) return null;
  const seg = primeiraSegunda(m.ano, m.mes);
  return [0, 1, 2, 3].map((s) => DIAS_DA_SEMANA.map((_, d) => data(m.ano, m.mes, seg + s * 7 + d, m.mes)));
}

export function dataDoPost(mesTexto: string, semana: number, dia: Dia): Data | null {
  const m = lerMes(mesTexto);
  if (!m) return null;
  return data(m.ano, m.mes, primeiraSegunda(m.ano, m.mes) + (semana - 1) * 7 + DESLOCAMENTO[dia], m.mes);
}

/** "2/11" */
export const curta = (d: Data) => `${d.dia}/${d.mes + 1}`;

/** "Seg 2/11" (ou só "Seg" se o mês não for reconhecido). */
export function rotuloDoPost(mesTexto: string, semana: number, post: Pick<Post, "dia">): string {
  const d = dataDoPost(mesTexto, semana, post.dia);
  return d ? `${post.dia} ${curta(d)}` : post.dia;
}

export type PostDatado = { post: Post; semana: number; indice: number; data: Data | null };

/** Todos os posts do plano em ordem, com a semana, um índice único e a data sugerida. */
export function postsDatados(plano: Plano, mesTexto: string): PostDatado[] {
  const lista: PostDatado[] = [];
  for (const s of plano.semanas) {
    for (const post of s.posts) lista.push({ post, semana: s.numero, indice: lista.length, data: dataDoPost(mesTexto, s.numero, post.dia) });
  }
  return lista;
}

