// Monta a escala de limpeza a partir de uma lista em texto livre. Reconhece dia (segunda, seg, "segunda a sexta", "todos os dias"),
// quem faz, o que faz e o horário (18h, 17:30, "até as 18h"), em formatos como:
//   Segunda: João - Passar pano; Maria - Varrer
//   Terça
//   Ana: lavar banheiro 17h30
//   Quarta, quinta e sexta - Pedro e Lia - Esvaziar lixeiras
// Nada é gravado aqui: devolve linhas para o usuário conferir antes de confirmar.

export interface TeamPerson { id: string; name: string }
export interface CategoryRef { id: string; name: string }

export interface ParsedRow {
  key: string;
  line: number;
  raw: string;
  day: number | null;
  memberId: string | null;
  /** quando o nome bate com mais de uma pessoa */
  memberCandidates: string[];
  memberText: string;
  categoryId: string | null;
  categoryName: string;
  isNewCategory: boolean;
  time: string;
  problems: string[];
}

export const DEFAULT_TIME = "18:00";

export const norm = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const DAY_WORDS: Record<string, number> = {
  domingo: 0, dom: 0, segunda: 1, seg: 1, terca: 2, ter: 2, quarta: 3, qua: 3, quinta: 4, qui: 4, sexta: 5, sex: 5, sabado: 6, sab: 6,
};

function dayOf(token: string): number | null {
  const t = norm(token).replace(/[-\s]*feira$/, "").replace(/[.:]/g, "").trim();
  return t in DAY_WORDS ? DAY_WORDS[t] : null;
}

/** "segunda", "seg a sex", "terça e quinta", "todos os dias" → dias da semana (0 = domingo), ou null se não for um dia. */
export function parseDaySpec(text: string): number[] | null {
  const t = norm(text).replace(/[:.]+$/g, "").replace(/^de\s+/, "").trim();
  if (!t) return null;
  if (/^(todos os dias|todo dia|diariamente|toda a semana|todos os dias da semana)$/.test(t)) return [0, 1, 2, 3, 4, 5, 6];
  if (/^(dias uteis|de segunda a sexta|segunda a sexta)$/.test(t)) return [1, 2, 3, 4, 5];
  const range = t.match(/^(\S+?)\s*(?:a|ate|à|-|–)\s*(\S+?)$/);
  if (range) {
    const a = dayOf(range[1]);
    const b = dayOf(range[2]);
    if (a !== null && b !== null) {
      const out: number[] = [];
      for (let d = a; ; d = (d + 1) % 7) { out.push(d); if (d === b || out.length > 7) break; }
      return out;
    }
  }
  const parts = t.split(/\s*(?:,|\se\s|\/|\+)\s*/).filter(Boolean);
  const days = parts.map(dayOf);
  if (days.length > 0 && days.every((d) => d !== null)) return [...new Set(days as number[])].sort((a, b) => a - b);
  return null;
}

export function extractTime(text: string): { text: string; time: string | null } {
  const m = text.match(/(?:\b(?:até|ate|às|as|a partir d[aeo]s?)\s*)*\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?\b/i);
  if (!m) return { text, time: null };
  const hh = String(Number(m[1])).padStart(2, "0");
  const mm = m[2] ?? "00";
  const cleaned = (text.slice(0, m.index!) + " " + text.slice(m.index! + m[0].length)).replace(/\s{2,}/g, " ").replace(/\(\s*\)/g, "").trim();
  return { text: cleaned, time: `${hh}:${mm}` };
}

function matchPeople(text: string, people: TeamPerson[]): { ids: string[]; unknown: string[]; ambiguous: Record<string, string[]> } {
  const names = text.split(/\s*(?:,|\se\s|\+|\/)\s*/).map((s) => s.trim()).filter(Boolean);
  const ids: string[] = [];
  const unknown: string[] = [];
  const ambiguous: Record<string, string[]> = {};
  for (const n of names) {
    const q = norm(n);
    const exact = people.filter((p) => norm(p.name) === q);
    const first = people.filter((p) => norm(p.name).split(" ")[0] === q);
    const starts = people.filter((p) => norm(p.name).startsWith(q) || norm(p.name).split(" ").includes(q));
    const found = exact.length ? exact : first.length ? first : starts;
    if (found.length === 1) ids.push(found[0].id);
    else if (found.length > 1) { ambiguous[n] = found.map((p) => p.id); }
    else unknown.push(n);
  }
  return { ids, unknown, ambiguous };
}

function looksLikePeople(text: string, people: TeamPerson[]): boolean {
  const m = matchPeople(text, people);
  return m.ids.length + Object.keys(m.ambiguous).length > 0 && m.unknown.length === 0;
}

function matchCategory(name: string, cats: CategoryRef[]): CategoryRef | null {
  const q = norm(name);
  if (!q) return null;
  const exact = cats.find((c) => norm(c.name) === q);
  if (exact) return exact;
  const loose = cats.filter((c) => { const n = norm(c.name); return n.includes(q) || q.includes(n); });
  return loose.length === 1 ? loose[0] : null;
}

const titleCase = (s: string) => { const t = s.trim().replace(/\s+/g, " "); return t ? t.charAt(0).toUpperCase() + t.slice(1) : t; };

const SEP = /\s*(?:→|=>|->|=|–|—|:)\s*|\s+-\s+/;

export function parseCleaningList(text: string, people: TeamPerson[], categories: CategoryRef[], defaultTime = DEFAULT_TIME): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let currentDays: number[] | null = null;

  const lines = text.split(/\r?\n/);
  lines.forEach((rawLine, idx) => {
    let line = rawLine.replace(/^\s*(?:[*•·–-]|\d+[.)])\s+/, "").trim();
    if (!line) return;

    // 1) "dia" sozinho, ou "dia: conteúdo"
    const wholeDays = parseDaySpec(line);
    if (wholeDays) { currentDays = wholeDays; return; }
    let days = currentDays;
    const firstSep = line.search(/\s*(?::|–|—)\s*|\s+-\s+/);
    if (firstSep > 0) {
      const head = parseDaySpec(line.slice(0, firstSep));
      if (head) {
        days = head;
        currentDays = head;
        line = line.slice(firstSep).replace(/^\s*(?::|–|—|-)\s*/, "").trim();
        if (!line) return;
      }
    }

    // 2) itens da linha
    for (const itemRaw of line.split(/\s*[;|]\s*/).filter((x) => x.trim())) {
      const { text: noTime, time } = extractTime(itemRaw);
      const parts = noTime.split(SEP).map((p) => p.trim()).filter(Boolean);
      let memberText = "";
      let catText = "";
      if (parts.length >= 2) {
        const left = parts[0];
        const rest = parts.slice(1).join(" - ");
        if (looksLikePeople(left, people) || !looksLikePeople(rest, people)) { memberText = left; catText = rest; }
        else { memberText = rest; catText = left; }
      } else if (parts.length === 1) {
        // sem separador: acha o nome de alguém no começo ou no fim ("João passar pano", "Passar pano João")
        const words = parts[0].split(" ");
        let done = false;
        for (const take of [2, 1]) {
          const head = words.slice(0, take).join(" ");
          const tail = words.slice(-take).join(" ");
          if (words.length > take && looksLikePeople(head, people)) { memberText = head; catText = words.slice(take).join(" "); done = true; break; }
          if (words.length > take && looksLikePeople(tail, people)) { memberText = tail; catText = words.slice(0, -take).join(" "); done = true; break; }
        }
        if (!done) catText = parts[0];
      } else continue;

      const who = matchPeople(memberText, people);
      const cats = catText.split(/\s*(?:,|\se\s|\+)\s*/).map((c) => c.trim()).filter(Boolean);
      const memberSlots: Array<{ id: string | null; candidates: string[]; text: string }> = [
        ...who.ids.map((id) => ({ id, candidates: [] as string[], text: people.find((p) => p.id === id)?.name ?? "" })),
        ...Object.entries(who.ambiguous).map(([n, c]) => ({ id: null, candidates: c, text: n })),
        ...who.unknown.map((n) => ({ id: null, candidates: [] as string[], text: n })),
      ];
      if (memberSlots.length === 0) memberSlots.push({ id: null, candidates: [], text: "" });
      const catSlots = cats.length ? cats : [""];
      const targetDays: Array<number | null> = days && days.length ? days : [null];

      for (const d of targetDays) for (const m of memberSlots) for (const c of catSlots) {
        const found = matchCategory(c, categories);
        const problems: string[] = [];
        if (d === null) problems.push("Sem dia: coloque o dia da semana acima ou antes do nome");
        if (!m.id) problems.push(m.candidates.length ? `Mais de uma pessoa com o nome "${m.text}"` : m.text ? `Pessoa não encontrada: "${m.text}"` : "Sem pessoa");
        if (!c) problems.push("Sem tarefa");
        rows.push({
          key: `${idx}-${rows.length}`, line: idx + 1, raw: itemRaw.trim(), day: d, memberId: m.id, memberCandidates: m.candidates, memberText: m.text,
          categoryId: found?.id ?? null, categoryName: found?.name ?? titleCase(c), isNewCategory: !!c && !found,
          time: time ?? defaultTime, problems,
        });
      }
    }
  });
  return rows;
}

export const rowIsReady = (r: ParsedRow): boolean => r.day !== null && !!r.memberId && !!r.categoryName.trim();
