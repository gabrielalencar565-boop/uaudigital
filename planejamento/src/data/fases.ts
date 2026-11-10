/**
 * As 6 fases da jornada do público e os pesos por objetivo.
 * Edite aqui sem mexer nos componentes.
 */

export const FASE_IDS = [
  "identificacao",
  "solucao",
  "resistencia",
  "autoridade",
  "prova_social",
  "recompensa",
] as const;

export type FaseId = (typeof FASE_IDS)[number];

export type Fase = {
  id: FaseId;
  nome: string;
  /** Função curta, usada nos chips da legenda: "Resistência · derruba o medo". */
  funcao: string;
  /** Explicação de uma linha, usada no prompt da IA. */
  descricao: string;
  /** Cor de destaque (etiquetas e bordas), nunca fundo de página. */
  cor: string;
  /** Cor do texto sobre a etiqueta. */
  corTexto: string;
  /**
   * Posição preferida no mês (0 = início, 1 = fim).
   * Identificação e Solução puxam para o começo; Resistência, Prova social e Recompensa, para o fim.
   */
  posicao: number;
};

export const FASES: Record<FaseId, Fase> = {
  identificacao: {
    id: "identificacao",
    nome: "Identificação",
    funcao: "faz o público se reconhecer",
    descricao: "o público se reconhece no problema (ex.: \"Você evita sorrir nas fotos?\")",
    cor: "#FFD23F",
    corTexto: "#08080A",
    posicao: 0.15,
  },
  solucao: {
    id: "solucao",
    nome: "Solução",
    funcao: "mostra que tem saída",
    descricao: "mostra que existe saída e como ela funciona",
    cor: "#B98CFF",
    corTexto: "#08080A",
    posicao: 0.35,
  },
  resistencia: {
    id: "resistencia",
    nome: "Resistência",
    funcao: "derruba o medo",
    descricao: "derruba medos e objeções (preço, dor, tempo, confiança)",
    cor: "#FF8A5B",
    corTexto: "#08080A",
    posicao: 0.68,
  },
  autoridade: {
    id: "autoridade",
    nome: "Autoridade",
    funcao: "mostra quem faz",
    descricao: "mostra quem faz, o processo, o cuidado e o bastidor",
    cor: "#7A35D6",
    corTexto: "#FFFFFF",
    posicao: 0.5,
  },
  prova_social: {
    id: "prova_social",
    nome: "Prova social",
    funcao: "outros confirmam",
    descricao: "outras pessoas confirmam (depoimento, antes e depois com autorização, prints)",
    cor: "#4ADE80",
    corTexto: "#08080A",
    posicao: 0.78,
  },
  recompensa: {
    id: "recompensa",
    nome: "Recompensa",
    funcao: "faz querer indicar",
    descricao: "faz o cliente se sentir especial e com vontade de indicar (quadro de clientes, agradecimento, benefício)",
    cor: "#FF5FA2",
    corTexto: "#08080A",
    posicao: 0.9,
  },
};

export const FASES_LISTA: Fase[] = FASE_IDS.map((id) => FASES[id]);
