import { z } from "zod";
import { FASE_IDS } from "@/data/fases";
import { DIA_IDS, FORMATO_POST_IDS } from "@/data/formulario";
import type { Esqueleto } from "./distribuicao";

/** Schema da resposta (seção 7 do briefing). Usado pela IA (saída estruturada) e pelo plano B. */
export const PostSchema = z.object({
  dia: z.enum(DIA_IDS),
  fase: z.enum(FASE_IDS),
  formato: z.enum(FORMATO_POST_IDS),
  gancho: z.string().min(3).max(140).describe("Título/primeira frase do post, máx. 90 caracteres"),
  ideia: z.string().min(10).max(600).describe("2 a 3 frases explicando o post"),
  cta: z.string().min(2).max(120).describe("Chamada para ação curta"),
  por_que: z.string().min(5).max(300).describe("1 frase ligando o post ao objetivo do mês"),
});

export const PlanoSchema = z.object({
  objetivo_mes: z.string().min(10).max(400),
  metas: z
    .array(z.object({ meta: z.string().min(3).max(200), indicador: z.string().min(3).max(200) }))
    .min(2)
    .max(3),
  publico: z.object({
    perfil: z.string().min(3).max(400),
    dor: z.string().min(3).max(400),
    desejo: z.string().min(3).max(400),
    objecao_principal: z.string().min(3).max(400),
  }),
  tom_de_voz: z.object({
    descricao: z.string().min(3).max(400),
    exemplos: z.array(z.string().min(3).max(200)).min(3).max(3),
  }),
  semanas: z
    .array(
      z.object({
        numero: z.number().int().min(1).max(4),
        foco: z.string().min(3).max(120),
        posts: z.array(PostSchema).min(2).max(5),
      }),
    )
    .length(4),
  stories_recorrentes: z.array(z.string().min(3).max(240)).min(3).max(5),
  frases_para_apresentar: z.array(z.string().min(5).max(400)).min(3).max(3),
});

export type Plano = z.infer<typeof PlanoSchema>;
export type Post = z.infer<typeof PostSchema>;

/** Metadados guardados junto com o plano. */
export type PlanoMeta = {
  mes: string; // "novembro de 2026"
  cliente: string;
  nicho: string;
  fonte: "ia" | "modelo";
};

export type PlanoSalvo = { id: string; criado_em: string; plano: Plano; meta: PlanoMeta };

/**
 * Valida um plano contra o schema e contra o esqueleto do mês
 * (4 semanas, posts por semana certos). Devolve o plano com dia, fase e formato
 * alinhados ao esqueleto, ou null se não der para aproveitar.
 */
export function validarPlano(dados: unknown, esqueleto: Esqueleto): Plano | null {
  const r = PlanoSchema.safeParse(dados);
  if (!r.success) return null;
  const plano = r.data;
  if (plano.semanas.length !== esqueleto.length) return null;
  for (let s = 0; s < esqueleto.length; s++) {
    if (plano.semanas[s].posts.length !== esqueleto[s].length) return null;
  }
  return {
    ...plano,
    semanas: plano.semanas.map((semana, s) => ({
      ...semana,
      numero: s + 1,
      // A distribuição de fases/dias/formatos é nossa: garante que bate com o esqueleto.
      posts: semana.posts.map((post, p) => ({ ...post, ...esqueleto[s][p] })) as Post[],
    })),
  };
}

export function mesAtual(data = new Date()): string {
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  const brt = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  return `${meses[brt.getUTCMonth()]} de ${brt.getUTCFullYear()}`;
}
