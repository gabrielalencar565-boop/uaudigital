import { z } from "zod";
import {
  FORMATOS,
  NICHOS,
  OBJECAO_IDS,
  OBJETIVO_IDS,
  TOM_IDS,
  type FormatoId,
} from "@/data/formulario";
import { isValidInstagram, isValidName, isValidWhatsApp } from "./validation";

const texto = (max: number) => z.string().trim().max(max);

/** Respostas do formulário (sem o contato). */
export const FormSchema = z
  .object({
    cliente: texto(80).min(1, "Coloca o nome do cliente ou da marca."),
    nicho: z.enum(NICHOS.map((n) => n.id) as [string, ...string[]]),
    nichoOutro: texto(60).optional().default(""),
    servico: texto(120).min(2, "Conta qual serviço ou produto ele quer vender mais."),
    cidade: texto(80).optional().default(""),
    objetivo: z.enum(OBJETIVO_IDS),
    publico: texto(160).min(2, "Descreve rapidinho quem é o cliente ideal."),
    dor: texto(200).min(2, "Qual a maior dor ou vontade dessa pessoa?"),
    objecoes: z.array(z.enum(OBJECAO_IDS)).max(6).default([]),
    objecaoOutro: texto(120).optional().default(""),
    postsPorSemana: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    formatos: z
      .array(z.enum(FORMATOS.map((f) => f.id) as [FormatoId, ...FormatoId[]]))
      .refine((f) => f.some((id) => id !== "stories"), "Escolhe pelo menos um formato de post (Reels, Carrossel ou Estático)."),
    tom: z.enum(TOM_IDS),
    dataEspecial: texto(160).optional().default(""),
  })
  .refine((f) => f.nicho !== "outro" || f.nichoOutro.length > 0, {
    message: "Qual é o nicho?",
    path: ["nichoOutro"],
  })
  .refine((f) => f.objecoes.length > 0 || f.objecaoOutro.length > 0, {
    message: "Marca pelo menos uma coisa que faz a pessoa hesitar.",
    path: ["objecoes"],
  });

export type FormInput = z.infer<typeof FormSchema>;

export const ContatoSchema = z.object({
  nome: z.string().trim().refine(isValidName, "Coloca seu nome."),
  whatsapp: z.string().trim().refine(isValidWhatsApp, "Confere o seu WhatsApp."),
  instagram: z.string().trim().max(60).refine(isValidInstagram, "Confere o seu @.").default(""),
  consentimento: z.literal(true, { error: "Precisamos do seu aceite pra continuar." }),
});

export type ContatoInput = z.infer<typeof ContatoSchema>;

export function nomeDoNicho(form: Pick<FormInput, "nicho" | "nichoOutro">): string {
  if (form.nicho === "outro") return form.nichoOutro || "Outro";
  return NICHOS.find((n) => n.id === form.nicho)?.nome ?? form.nicho;
}

export function grupoDoNicho(nicho: string) {
  return NICHOS.find((n) => n.id === nicho)?.grupo ?? "geral";
}
