// Importação em massa de contatos para o funil: lê uma lista colada (WhatsApp, planilha, notas) e separa cada linha em
// nome, especialidade, Instagram e telefone. Funções puras, para poder testar. Cada linha é um contato.

export interface ParsedContact {
  /** texto original da linha, para mostrar quando algo não foi entendido */
  raw: string;
  name: string;
  specialty: string;
  /** "@usuario" ou "" */
  instagram: string;
  /** só números; com DDD quando veio com DDD */
  phone: string;
}

export interface ExistingContact {
  id: string;
  name: string;
  phone: string | null;
  instagram: string | null;
}

export const MAX_IMPORT_ROWS = 300;

/** "instagram.com/usuario", "https://www.instagram.com/usuario/?hl=pt" ou "@usuario" → "@usuario" (minúsculo); sem perfil → "". */
export function normalizeInstagram(input: string | null | undefined): string {
  const s = String(input ?? "").trim();
  if (!s) return "";
  const link = s.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const user = (link ? link[1] : s.replace(/^@+/, "")).replace(/[/?#].*$/, "").replace(/\.+$/, "");
  return /^[A-Za-z0-9._]{2,30}$/.test(user) ? "@" + user.toLowerCase() : "";
}

/** Só números, sem o 55 do país. Aceita com ou sem DDD (8–9 dígitos sem DDD ficam como vieram). Fora disso, devolve "". */
export function normalizePhone(input: string | null | undefined): string {
  let d = String(input ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) d = d.slice(2);
  if (d.length >= 8 && d.length <= 11) return d;
  return "";
}

/** Os 8 últimos dígitos: mesma chave que o "Novo lead" usa para achar duplicado (com ou sem DDD, com ou sem o 9). */
export const phoneKey8 = (s: string | null | undefined): string => String(s ?? "").replace(/\D/g, "").slice(-8);

export function phoneHasDdd(phone: string): boolean {
  return phone.length === 10 || phone.length === 11;
}

const INSTAGRAM_LINK = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[A-Za-z0-9._]+\/?(?:\?[^\s,;|]*)?/i;
const INSTAGRAM_AT = /(?<![\w.@])@[A-Za-z0-9._]{2,30}/;
const PHONE_CANDIDATE = /(?<![\d@])[+(]*\d[\d\s().-]{6,}\d(?!\d)/g;

// Tira marcadores de lista ("1.", "2)", "•", "-", "*") do começo da linha.
const stripBullet = (line: string) => line.replace(/^\s*(?:[•·*▪●◦-]+\s+|\d{1,3}[.)]\s+)/, "").trim();

function takeInstagram(text: string): { instagram: string; rest: string } {
  const link = text.match(INSTAGRAM_LINK);
  if (link) return { instagram: normalizeInstagram(link[0]), rest: text.replace(link[0], " ") };
  const at = text.match(INSTAGRAM_AT);
  if (at) return { instagram: normalizeInstagram(at[0]), rest: text.replace(at[0], " ") };
  return { instagram: "", rest: text };
}

function takePhone(text: string): { phone: string; rest: string } {
  for (const m of text.matchAll(PHONE_CANDIDATE)) {
    const phone = normalizePhone(m[0]);
    if (phone) return { phone, rest: text.replace(m[0], " ") };
  }
  return { phone: "", rest: text };
}

// Separadores: tab, ";", "|", " - " (hífen com espaço, para não quebrar "Maria-Clara"), "–", "—" e ",".
const SPLIT = /\t|;|\||\s[-–—]\s|,/;

function splitFields(text: string): string[] {
  return text.split(SPLIT).map((p) => p.replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "").trim()).filter((p) => /[\p{L}\p{N}]/u.test(p));
}

/** Uma linha de texto livre: Instagram e telefone saem por padrão de escrita; o que sobra é nome e, em seguida, especialidade. */
export function parseLine(line: string): ParsedContact | null {
  const raw = line.trim();
  const text = stripBullet(raw);
  if (!text) return null;
  const ig = takeInstagram(text);
  const ph = takePhone(ig.rest);
  const parts = splitFields(ph.rest);
  return {
    raw,
    name: parts[0] ?? "",
    // o que vier depois da especialidade (empresa, cidade…) não se perde: entra junto, separado por " · "
    specialty: parts.slice(1).join(" · "),
    instagram: ig.instagram,
    phone: ph.phone,
  };
}

// Cabeçalho de planilha → campo
const HEADER_FIELD: Array<[RegExp, "name" | "specialty" | "instagram" | "phone"]> = [
  [/^(nome|name|contato)$/i, "name"],
  [/^(especialidade|area|área|segmento|profiss[aã]o|ramo|cargo)/i, "specialty"],
  [/^(instagram|insta|ig|perfil|@)/i, "instagram"],
  [/^(telefone|celular|whats|whatsapp|fone|tel|contato telef)/i, "phone"],
];

/** Divide uma linha de CSV/TSV respeitando aspas. */
export function splitDelimited(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function headerMap(line: string): { delimiter: string; cols: Array<"name" | "specialty" | "instagram" | "phone" | null> } | null {
  const delimiter = ["\t", ";", "|", ","].find((d) => line.includes(d));
  if (!delimiter) return null;
  const cols = splitDelimited(line, delimiter).map((h) => HEADER_FIELD.find(([re]) => re.test(h.trim()))?.[1] ?? null);
  // é cabeçalho quando reconhece "nome" e mais algum campo
  return cols.includes("name") && cols.filter(Boolean).length >= 2 ? { delimiter, cols } : null;
}

/** Texto colado ou arquivo → contatos. Se a primeira linha for cabeçalho (Nome, Especialidade, Instagram, Telefone), lê por colunas; senão, linha a linha. */
export function parseContacts(text: string): ParsedContact[] {
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = headerMap(lines[0]);
  const out: ParsedContact[] = [];
  if (header) {
    for (const line of lines.slice(1)) {
      const cells = splitDelimited(line, header.delimiter);
      const c: ParsedContact = { raw: line, name: "", specialty: "", instagram: "", phone: "" };
      header.cols.forEach((field, i) => {
        const v = (cells[i] ?? "").trim();
        if (!field || !v) return;
        if (field === "instagram") c.instagram = normalizeInstagram(v);
        else if (field === "phone") c.phone = normalizePhone(v);
        else c[field] = v;
      });
      if (c.name || c.specialty || c.instagram || c.phone) out.push(c);
    }
    return out;
  }
  for (const line of lines) {
    const c = parseLine(line);
    if (c) out.push(c);
  }
  return out;
}

// ───────────── duplicados ─────────────

export interface DuplicateOf {
  kind: "crm" | "lista";
  by: "instagram" | "telefone";
  /** nome do contato que já existe (ou número da linha, quando é repetido dentro da própria lista) */
  label: string;
}

export interface DupInput { phone: string; instagram: string }

/** Marca quem já existe no CRM (mesmo Instagram ou mesmo telefone) e quem se repete dentro da própria lista (a primeira ocorrência vale). */
export function findDuplicates(rows: DupInput[], existing: ExistingContact[]): Array<DuplicateOf | null> {
  const byIg = new Map<string, ExistingContact>();
  const byPhone = new Map<string, ExistingContact>();
  for (const l of existing) {
    const ig = normalizeInstagram(l.instagram);
    if (ig && !byIg.has(ig)) byIg.set(ig, l);
    const k = phoneKey8(l.phone);
    if (k.length >= 8 && !byPhone.has(k)) byPhone.set(k, l);
  }
  const seenIg = new Map<string, number>();
  const seenPhone = new Map<string, number>();
  return rows.map((r, i) => {
    const ig = normalizeInstagram(r.instagram);
    const k = phoneKey8(r.phone);
    let dup: DuplicateOf | null = null;
    if (ig && byIg.has(ig)) dup = { kind: "crm", by: "instagram", label: byIg.get(ig)!.name };
    else if (k.length >= 8 && byPhone.has(k)) dup = { kind: "crm", by: "telefone", label: byPhone.get(k)!.name };
    else if (ig && seenIg.has(ig)) dup = { kind: "lista", by: "instagram", label: `linha ${seenIg.get(ig)! + 1}` };
    else if (k.length >= 8 && seenPhone.has(k)) dup = { kind: "lista", by: "telefone", label: `linha ${seenPhone.get(k)! + 1}` };
    if (ig && !seenIg.has(ig)) seenIg.set(ig, i);
    if (k.length >= 8 && !seenPhone.has(k)) seenPhone.set(k, i);
    return dup;
  });
}
