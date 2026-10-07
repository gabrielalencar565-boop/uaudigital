// Automatic category for bank-statement lines: first from what the agency already categorized (history),
// whatever is left goes to the AI (edge function finance-categorize). Nothing is saved without the user's review.

export type TxType = "entrada" | "saida";
export type CatSource = "historico" | "ia" | "manual" | "revisar";

export const ENTRADA_CATEGORIES = ["receita_recorrente", "receita_variavel", "receita_outros"] as const;
export const SAIDA_CATEGORIES = [
  "impostos", "despesa_operacional", "despesa_administrativa", "despesa_financeira",
  "despesa_comercial", "despesa_outros", "despesa_variavel", "investimentos",
] as const;

export const categoriesForType = (type: TxType): readonly string[] => (type === "entrada" ? ENTRADA_CATEGORIES : SAIDA_CATEGORIES);

// Words that appear in almost every bank line and say nothing about who/what it is.
const NOISE = new Set([
  "pix", "ted", "doc", "transf", "transferencia", "transferência", "enviada", "enviado", "recebida", "recebido",
  "recebimento", "recebimentos", "pagamento", "pagto", "pgto", "pag", "compra", "debito", "débito", "credito", "crédito", "cartao", "cartão",
  "de", "da", "do", "das", "dos", "para", "por", "em", "no", "na", "a", "o", "e", "via", "ref", "cod", "lanc",
  // Sicoob statement boilerplate ("PIX RECEB.OUTRA IF", "TRANSF.RECEB-PIX SI REM.:", "TRANSF. PIX SICOOB FAV.:")
  "receb", "emit", "outra", "out", "if", "msm", "si", "rem", "fav", "sicoob",
]);

export function normalizeDescription(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\d+([.,/-]\d+)*/g, " ")
    .replace(/[^a-z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NOISE.has(w))
    .join(" ")
    .trim();
}


type Counts = Map<string, number>;
export type HistoryRow = { description: string; category: string | null; type: string };
// Every prefix (up to MAX_PREFIX words) of every categorized description, with how often each category was used.
// Bank lines often add or drop words around the same name ("Recebimento Pix MARIA SILVA" vs "MARIA SILVA SOUZA"), so
// a line is matched through its leading words instead of requiring the whole text to be identical.
export type HistoryIndex = { prefixes: Map<string, Counts> };
const MAX_PREFIX = 6;

export function buildHistoryIndex(rows: HistoryRow[]): HistoryIndex {
  const prefixes = new Map<string, Counts>();
  for (const r of rows) {
    if (!r.category || r.category === "caixa" || (r.type !== "entrada" && r.type !== "saida")) continue;
    const words = normalizeDescription(r.description).split(" ").filter(Boolean);
    for (let n = 1; n <= Math.min(words.length, MAX_PREFIX); n++) {
      // a single word only counts as a key when the whole description is that one word (e.g. "bucallcenter")
      if (n === 1 && words.length > 1) continue;
      const key = `${r.type}|${words.slice(0, n).join(" ")}`;
      const c = prefixes.get(key) ?? new Map<string, number>();
      c.set(r.category, (c.get(r.category) ?? 0) + 1);
      prefixes.set(key, c);
    }
  }
  return { prefixes };
}

function pick(counts: Counts | undefined, minShare: number, allowed: readonly string[]): string | null {
  if (!counts) return null;
  let total = 0, best: string | null = null, bestN = 0;
  for (const [cat, n] of counts) { total += n; if (n > bestN) { best = cat; bestN = n; } }
  if (!best || bestN / total < minShare || !allowed.includes(best)) return null;
  return best;
}

/** Category learned from the history, or null when it can't be decided safely. */
export function categoryFromHistory(index: HistoryIndex, description: string, type: TxType): string | null {
  const words = normalizeDescription(description).split(" ").filter(Boolean);
  if (words.length === 0) return null;
  const allowed = categoriesForType(type);
  // longest shared leading words first; one word only when the line itself is a single word
  for (let n = Math.min(words.length, MAX_PREFIX); n >= (words.length === 1 ? 1 : 2); n--) {
    const hit = pick(index.prefixes.get(`${type}|${words.slice(0, n).join(" ")}`), 0.8, allowed);
    if (hit) return hit;
  }
  return null;
}

/** A few labeled lines from the history to guide the AI (distinct counterparts, spread across categories). */
export function pickExamples(rows: HistoryRow[], max = 60): Array<{ description: string; category: string }> {
  const seen = new Set<string>();
  const perCat = new Map<string, number>();
  const out: Array<{ description: string; category: string }> = [];
  for (const r of rows) {
    if (!r.category || r.category === "caixa") continue;
    const norm = normalizeDescription(r.description);
    if (!norm || seen.has(norm)) continue;
    const n = perCat.get(r.category) ?? 0;
    if (n >= Math.ceil(max / 6)) continue;
    seen.add(norm);
    perCat.set(r.category, n + 1);
    out.push({ description: r.description.slice(0, 80), category: r.category });
    if (out.length >= max) break;
  }
  return out;
}
