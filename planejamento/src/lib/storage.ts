/** localStorage seguro: em aba anônima ou com storage bloqueado, não quebra. */
import type { PlanoSalvo } from "./plano";

const CHAVE = "planejamento-uau:v1";
const CHAVE_PLANO = (id: string) => `planejamento-uau:plano:${id}`;

export type UTM = Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content", string>>;

export function ler<T>(chave = CHAVE): T | null {
  try {
    const raw = window.localStorage.getItem(chave);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function gravar(valor: unknown, chave = CHAVE) {
  try {
    window.localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // sem storage: segue só em memória
  }
}

export function guardarPlano(salvo: PlanoSalvo) {
  gravar(salvo, CHAVE_PLANO(salvo.id));
}

export function lerPlano(id: string): PlanoSalvo | null {
  return ler<PlanoSalvo>(CHAVE_PLANO(id));
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export function utmDaUrl(): UTM {
  const utm: UTM = {};
  try {
    const params = new URLSearchParams(window.location.search);
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) utm[k] = v.slice(0, 200);
    }
  } catch {
    // ignora
  }
  return utm;
}
