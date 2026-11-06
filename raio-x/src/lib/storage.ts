/** localStorage seguro: em aba anônima ou com storage bloqueado, não quebra. */

const KEY = "raiox-uau:v1";

export type UTM = Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content", string>>;

export type Step =
  | { kind: "intro" }
  | { kind: "question"; index: number }
  | { kind: "areaDone"; areaIndex: number }
  | { kind: "lead" }
  | { kind: "result" };

export type SavedState = {
  step: Step;
  answers: Record<number, number>;
  /** id da pergunta -> ordem embaralhada dos índices das opções */
  orders: Record<number, number[]>;
  name?: string;
  utm?: UTM;
  pixelCompleted?: boolean;
};

export function loadState(): SavedState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    if (!parsed || typeof parsed !== "object" || !parsed.step || !parsed.answers) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: SavedState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // sem storage: segue só em memória
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

export function readUtmFromUrl(): UTM {
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
