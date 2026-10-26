import { stageAbbr } from "@/features/gestao/pm-constants";

// O Cronograma (PDF) de design e o de vídeo nascem separados. Enquanto a tarefa só tem um dos dois, o selo diz qual é (CRO/DSG, CRO/VDO),
// igual a REV/DSG e REV/VDO na Revisão; quando já tem os dois, volta ao selo simples do Cronograma.

export type PdfKind = "design" | "video";

/** "design" ou "video" quando as subtarefas são só de um tipo; null se tem os dois, ou nenhum. */
export function pdfKindFromTypes(types: Iterable<string | null | undefined>): PdfKind | null {
  const set = new Set<string>();
  for (const t of types) if (t) set.add(t);
  const hasDesign = set.has("design");
  const hasVideo = set.has("video");
  if (hasDesign === hasVideo) return null;
  return hasDesign ? "design" : "video";
}

// A metade "CRO" tem a cor do Cronograma nas telas (índigo, a mesma do selo CRON e da coluna do Cronograma); a outra metade é a cor do Design ou do Vídeo.
export const PDF_KIND_GRADIENT: Record<PdfKind, string> = {
  design: "bg-gradient-to-r from-indigo-500 to-stage-design",
  video: "bg-gradient-to-r from-indigo-500 to-stage-edicao_videos",
};

/** Sigla do selo: 3 primeiras letras da sigla da etapa (CRO enquanto a etapa se chama Cronograma) + /DSG ou /VDO */
export function pdfKindAbbr(kind: PdfKind): string {
  return `${stageAbbr("pdf").slice(0, 3)}/${kind === "video" ? "VDO" : "DSG"}`;
}
