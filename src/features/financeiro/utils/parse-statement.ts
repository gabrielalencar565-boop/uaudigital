// Bank-statement CSV reader. Understands files with a header row (columns found by name) and keeps the older
// headerless layout working (date;description;x;signed value). Sicoob exports come in two shapes:
//   "Data;Histórico de Movimentação;Valor (R$);Tipo (C/D)"                      (one text column)
//   "Data;Histórico;Modalidade;Contraparte;CPF/CNPJ;Descrição;Documento;Tipo;Valor"  (text spread over several columns)
// For the second one the description is rebuilt from every descriptive column, in file order, so it reads like the
// first shape: "PIX RECEB.OUTRA IF Recebimento Pix NOME DA PESSOA 12.345.678 0001-90 observação".

export type ParsedStatementRow = { date: string; description: string; amount: number; type: "entrada" | "saida" };

/** Decodes bytes as UTF-8, falling back to Windows-1252 when the file was exported in the old Windows encoding. */
export function decodeText(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(buf) : utf8.replace(/^﻿/, "");
}

const toIsoDate = (raw: string): string => {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!m) return "";
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};

/** "1.234,56" / "-1234.56" / "R$ 10,00 D" -> number (sign kept) */
export function parseMoney(raw: string): number {
  let s = raw.replace(/R\$|\s/g, "").replace(/[CD]$/i, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

export function parseStatementCsv(text: string): ParsedStatementRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const delim = lines[0].includes(";") ? ";" : ",";
  const split = (l: string) => l.split(delim).map((c) => c.trim().replace(/^"|"$/g, ""));

  const header = split(lines[0]).map((h) => h.toLowerCase());
  const col = (re: RegExp) => header.findIndex((h) => re.test(h));
  const iDate = col(/^data/), iVal = col(/valor/), iType = col(/tipo|c\/d|d\/c|natureza/);
  // every column that says who/what the line is, in file order (Histórico, Modalidade, Contraparte, CPF/CNPJ, Descrição…)
  const textCols = header.map((h, k) => (/^(hist[oó]rico|descri[cç][aã]o|lan[cç]amento|modalidade|contraparte|favorecido|benefici[aá]rio|pagador|remetente|cpf\/cnpj|cpf|cnpj)/.test(h) ? k : -1)).filter((k) => k >= 0);
  const hasHeader = iDate >= 0 && textCols.length > 0 && iVal >= 0;

  const rows: ParsedStatementRow[] = [];
  for (const line of lines.slice(1)) {
    const c = split(line);
    const dateRaw = hasHeader ? c[iDate] : c[0];
    const description = hasHeader
      ? textCols.reduce((acc, k) => { const v = (c[k] ?? "").trim(); return v && !acc.includes(v) ? `${acc} ${v}`.trim() : acc; }, "")
      : (c[1] ?? "");
    const valueRaw = (hasHeader ? c[iVal] : c[3]) ?? "";
    if (!description || /^saldo/i.test(description) || /saldo (do dia|anterior|final|parcial)/i.test(description)) continue;
    const value = parseMoney(valueRaw);
    const date = toIsoDate(dateRaw ?? "");
    if (isNaN(value) || value === 0 || !date) continue;

    // C/D column when the file has one ("C" = credit/entrada, "D" = debit/saída); otherwise the sign of the value
    const flag = hasHeader && iType >= 0 ? (c[iType] ?? "").trim().toUpperCase() : "";
    const type: "entrada" | "saida" = flag.startsWith("C") ? "entrada" : flag.startsWith("D") ? "saida" : value >= 0 ? "entrada" : "saida";
    rows.push({ date, description: description.replace(/\s+/g, " ").trim(), amount: Math.abs(value), type });
  }
  return rows;
}
