export const ALL_MAGIC2_STAGES = [
  { key: "planejamento", label: "Planejamento" },
  { key: "captacao", label: "Captação" },
  { key: "edicao_videos", label: "Vídeo" },
  { key: "design", label: "Design" },
  { key: "pdf", label: "PDF" },
  { key: "alteracoes", label: "Alterações" },
  { key: "agendamento", label: "Agendamento" },
] as const;

export type Magic2StageKey = (typeof ALL_MAGIC2_STAGES)[number]["key"];
type Magic2Stage = { key: Magic2StageKey; label: string };

const CACHE_KEY = "magic2-disabled-stages";

/**
 * Etapas que CONTAM no Magic Number (as que a agência não desligou em Configurações do Magic Number).
 * É uma lista única lida por todas as telas e cálculos; ela é ajustada no lugar quando o app abre (cópia guardada no navegador)
 * e, se a configuração mudar, a página recarrega uma vez para tudo recalcular com a lista nova. Nada é apagado no banco:
 * as linhas da etapa desligada continuam guardadas e voltam a contar quando ela é religada.
 */
export const MAGIC2_STAGES: Magic2Stage[] = [...ALL_MAGIC2_STAGES];

/** Aplica a lista de etapas desligadas. Sempre sobra ao menos uma etapa ativa. Devolve true se a lista de ativas mudou. */
export function applyDisabledMagic2Stages(disabled: readonly string[]): boolean {
  const before = MAGIC2_STAGES.map((s) => s.key).join(",");
  let next: Magic2Stage[] = ALL_MAGIC2_STAGES.filter((s) => !disabled.includes(s.key));
  if (next.length === 0) next = [ALL_MAGIC2_STAGES[0]];
  MAGIC2_STAGES.splice(0, MAGIC2_STAGES.length, ...next);
  return before !== MAGIC2_STAGES.map((s) => s.key).join(",");
}

export const isMagic2StageActive = (key: string) => MAGIC2_STAGES.some((s) => s.key === key);

export function readCachedDisabledMagic2Stages(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch { return []; }
}
export function cacheDisabledMagic2Stages(disabled: readonly string[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(disabled)); } catch { /* sem armazenamento */ }
}

applyDisabledMagic2Stages(readCachedDisabledMagic2Stages());
