import type { FormInput } from "@/lib/input";

/** Exemplo do briefing: Clínica Aurora, clareamento dental, vender mais. */
export const AURORA: FormInput = {
  cliente: "Clínica Aurora",
  nicho: "odontologia",
  nichoOutro: "",
  servico: "Clareamento dental",
  cidade: "Teresina",
  objetivo: "vender",
  publico: "Mulheres de 25 a 45 anos",
  dor: "Vergonha de sorrir nas fotos",
  objecoes: ["preco", "medo"],
  objecaoOutro: "",
  postsPorSemana: 3,
  formatos: ["reels_com_rosto", "carrossel", "estatico", "stories"],
  tom: "acolhedor",
  dataEspecial: "Semana do sorriso dia 20",
};
