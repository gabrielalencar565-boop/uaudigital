import type { FaseId } from "./fases";

/* ------------------------------------------------------------------ */
/* Nichos                                                              */
/* ------------------------------------------------------------------ */

/** Grupo de regras de publicidade do nicho (usado na IA e no plano B). */
export type GrupoNicho = "saude" | "advocacia" | "geral";

export type Nicho = { id: string; nome: string; grupo: GrupoNicho };

export const NICHOS: Nicho[] = [
  { id: "odontologia", nome: "Clínica odontológica", grupo: "saude" },
  { id: "estetica", nome: "Clínica de estética", grupo: "saude" },
  { id: "medico", nome: "Médico(a)", grupo: "saude" },
  { id: "psicologo", nome: "Psicólogo(a)", grupo: "saude" },
  { id: "nutricionista", nome: "Nutricionista", grupo: "saude" },
  { id: "advogado", nome: "Advogado(a)", grupo: "advocacia" },
  { id: "loja_roupas", nome: "Loja de roupas", grupo: "geral" },
  { id: "restaurante", nome: "Restaurante/Delivery", grupo: "geral" },
  { id: "academia", nome: "Academia/Personal", grupo: "geral" },
  { id: "salao", nome: "Salão de beleza/Barbearia", grupo: "geral" },
  { id: "imobiliaria", nome: "Imobiliária/Corretor", grupo: "geral" },
  { id: "contabilidade", nome: "Contabilidade", grupo: "geral" },
  { id: "escola", nome: "Escola/Curso", grupo: "geral" },
  { id: "pet", nome: "Pet shop/Veterinário", grupo: "geral" },
  { id: "infoprodutor", nome: "Infoprodutor(a)", grupo: "geral" },
  { id: "outro", nome: "Outro", grupo: "geral" },
];

/* ------------------------------------------------------------------ */
/* Objetivos e pesos das fases                                         */
/* ------------------------------------------------------------------ */

export const OBJETIVO_IDS = ["conhecido", "autoridade", "vender", "lancar", "seguidores"] as const;
export type ObjetivoId = (typeof OBJETIVO_IDS)[number];

export type Objetivo = {
  id: ObjetivoId;
  nome: string;
  emoji: string;
  /** Proporção aproximada de cada fase no mês (soma 1). */
  pesos: Record<FaseId, number>;
};

export const OBJETIVOS: Objetivo[] = [
  {
    id: "conhecido",
    nome: "Ser mais conhecido na região / no nicho",
    emoji: "📣",
    pesos: { identificacao: 0.3, solucao: 0.2, resistencia: 0.1, autoridade: 0.25, prova_social: 0.1, recompensa: 0.05 },
  },
  {
    id: "autoridade",
    nome: "Ser visto como referência / autoridade",
    emoji: "🏆",
    pesos: { identificacao: 0.15, solucao: 0.2, resistencia: 0.15, autoridade: 0.35, prova_social: 0.1, recompensa: 0.05 },
  },
  {
    id: "vender",
    nome: "Vender mais / gerar mais agendamentos",
    emoji: "💰",
    pesos: { identificacao: 0.15, solucao: 0.2, resistencia: 0.25, autoridade: 0.1, prova_social: 0.25, recompensa: 0.05 },
  },
  {
    id: "lancar",
    nome: "Lançar um serviço ou produto novo",
    emoji: "🚀",
    pesos: { identificacao: 0.2, solucao: 0.3, resistencia: 0.2, autoridade: 0.1, prova_social: 0.15, recompensa: 0.05 },
  },
  {
    id: "seguidores",
    nome: "Ganhar mais seguidores qualificados",
    emoji: "👥",
    pesos: { identificacao: 0.35, solucao: 0.2, resistencia: 0.05, autoridade: 0.2, prova_social: 0.1, recompensa: 0.1 },
  },
];

/* ------------------------------------------------------------------ */
/* Público, perfil e formatos                                          */
/* ------------------------------------------------------------------ */

export const OBJECAO_IDS = ["preco", "medo", "tempo", "confianca", "nao_precisa", "experiencia_ruim"] as const;
export type ObjecaoId = (typeof OBJECAO_IDS)[number];

export const OBJECOES: { id: ObjecaoId; nome: string }[] = [
  { id: "preco", nome: "Preço" },
  { id: "medo", nome: "Medo/insegurança" },
  { id: "tempo", nome: "Falta de tempo" },
  { id: "confianca", nome: "Não confia ainda" },
  { id: "nao_precisa", nome: "Acha que não precisa" },
  { id: "experiencia_ruim", nome: "Já teve experiência ruim" },
];

export const POSTS_POR_SEMANA = [2, 3, 4, 5] as const;
export type PostsPorSemana = (typeof POSTS_POR_SEMANA)[number];

export const FORMATO_POST_IDS = ["reels_com_rosto", "reels_sem_rosto", "carrossel", "estatico"] as const;
export type FormatoPostId = (typeof FORMATO_POST_IDS)[number];
export type FormatoId = FormatoPostId | "stories";

export const FORMATOS: { id: FormatoId; nome: string; curto: string; icone: string }[] = [
  { id: "reels_com_rosto", nome: "Reels com o cliente aparecendo", curto: "Reels com rosto", icone: "🎥" },
  { id: "reels_sem_rosto", nome: "Reels sem rosto", curto: "Reels sem rosto", icone: "🎬" },
  { id: "carrossel", nome: "Carrossel", curto: "Carrossel", icone: "🗂️" },
  { id: "estatico", nome: "Post estático", curto: "Estático", icone: "🖼️" },
  { id: "stories", nome: "Stories", curto: "Stories", icone: "⏱️" },
];

export const TOM_IDS = ["profissional", "acolhedor", "divertido", "didatico"] as const;
export type TomId = (typeof TOM_IDS)[number];

export const TONS: { id: TomId; nome: string }[] = [
  { id: "profissional", nome: "Profissional e sério" },
  { id: "acolhedor", nome: "Próximo e acolhedor" },
  { id: "divertido", nome: "Divertido e leve" },
  { id: "didatico", nome: "Técnico e didático" },
];

export const DIA_IDS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export type Dia = (typeof DIA_IDS)[number];

/** Dias sugeridos por quantidade de posts na semana. */
export const DIAS: Record<PostsPorSemana, Dia[]> = {
  2: ["Ter", "Qui"],
  3: ["Seg", "Qua", "Sex"],
  4: ["Seg", "Ter", "Qui", "Sáb"],
  5: ["Seg", "Ter", "Qua", "Qui", "Sex"],
};

/**
 * Formato preferido por fase (o primeiro que o cliente topa é o usado).
 * Reels para Identificação e Autoridade, Carrossel para Solução e Resistência,
 * Reels/estático para Prova social.
 */
export const PREFERENCIA_FORMATO: Record<FaseId, FormatoPostId[]> = {
  identificacao: ["reels_com_rosto", "reels_sem_rosto", "carrossel", "estatico"],
  solucao: ["carrossel", "reels_com_rosto", "reels_sem_rosto", "estatico"],
  resistencia: ["carrossel", "reels_com_rosto", "reels_sem_rosto", "estatico"],
  autoridade: ["reels_com_rosto", "reels_sem_rosto", "carrossel", "estatico"],
  prova_social: ["reels_com_rosto", "estatico", "reels_sem_rosto", "carrossel"],
  recompensa: ["estatico", "carrossel", "reels_com_rosto", "reels_sem_rosto"],
};

export const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
