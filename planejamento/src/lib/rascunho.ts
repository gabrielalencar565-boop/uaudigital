import type { FormatoId, ObjecaoId, ObjetivoId, PostsPorSemana, TomId } from "@/data/formulario";
import type { FormInput } from "./input";
import { isValidInstagram, isValidName, isValidWhatsApp } from "./validation";

/** Respostas enquanto a pessoa preenche (campos podem estar vazios). */
export type Rascunho = {
  cliente: string;
  nicho: string;
  nichoOutro: string;
  servico: string;
  cidade: string;
  objetivo: ObjetivoId | "";
  publico: string;
  dor: string;
  objecoes: ObjecaoId[];
  objecaoOutro: string;
  postsPorSemana: PostsPorSemana | 0;
  formatos: FormatoId[];
  tom: TomId | "";
  dataEspecial: string;
};

export type Contato = { nome: string; whatsapp: string; instagram: string; consentimento: boolean };

export const RASCUNHO_VAZIO: Rascunho = {
  cliente: "",
  nicho: "",
  nichoOutro: "",
  servico: "",
  cidade: "",
  objetivo: "",
  publico: "",
  dor: "",
  objecoes: [],
  objecaoOutro: "",
  postsPorSemana: 0,
  formatos: [],
  tom: "",
  dataEspecial: "",
};

export const CONTATO_VAZIO: Contato = { nome: "", whatsapp: "", instagram: "", consentimento: false };

export type Erros = Partial<Record<string, string>>;

/** Validação de cada etapa (0 a 3) do formulário. */
export function validarEtapa(etapa: number, r: Rascunho): Erros {
  const e: Erros = {};
  if (etapa === 0) {
    if (!r.cliente.trim()) e.cliente = "Coloca o nome do cliente ou da marca.";
    if (!r.nicho) e.nicho = "Escolhe o nicho do cliente.";
    if (r.nicho === "outro" && !r.nichoOutro.trim()) e.nichoOutro = "Qual é o nicho?";
    if (r.servico.trim().length < 2) e.servico = "Conta qual serviço ou produto ele quer vender mais.";
  }
  if (etapa === 1 && !r.objetivo) e.objetivo = "Escolhe o objetivo do mês.";
  if (etapa === 2) {
    if (r.publico.trim().length < 2) e.publico = "Descreve rapidinho quem é o cliente ideal.";
    if (r.dor.trim().length < 2) e.dor = "Qual a maior dor ou vontade dessa pessoa?";
    if (r.objecoes.length === 0 && !r.objecaoOutro.trim()) e.objecoes = "Marca pelo menos uma coisa que faz a pessoa hesitar.";
  }
  if (etapa === 3) {
    if (!r.postsPorSemana) e.postsPorSemana = "Quantos posts por semana dá pra fazer?";
    if (!r.formatos.some((f) => f !== "stories")) e.formatos = "Escolhe pelo menos um formato de post (Reels, Carrossel ou Estático).";
    if (!r.tom) e.tom = "Escolhe o tom de voz da marca.";
  }
  return e;
}

export function validarContato(c: Contato): Erros {
  const e: Erros = {};
  if (!isValidName(c.nome)) e.nome = "Coloca seu nome pra gente saber com quem tá falando.";
  if (!c.whatsapp.trim()) e.whatsapp = "Preenche seu WhatsApp com DDD.";
  else if (!isValidWhatsApp(c.whatsapp)) e.whatsapp = "Esse número não parece certo. Confere o DDD e os dígitos.";
  if (!isValidInstagram(c.instagram)) e.instagram = "Esse @ não parece válido. Pode deixar em branco se preferir.";
  if (!c.consentimento) e.consentimento = "Marca essa opção pra liberar o planejamento.";
  return e;
}

/** Primeira pergunta (0 a 3) com erro; 3 se todas estiverem respondidas. */
export function primeiraEtapaIncompleta(r: Rascunho): number {
  for (let i = 0; i < 4; i++) if (Object.keys(validarEtapa(i, r)).length) return i;
  return 3;
}

export function paraFormInput(r: Rascunho): FormInput {
  return r as unknown as FormInput;
}
