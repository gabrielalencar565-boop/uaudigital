import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as XLSX from "xlsx";
import type { CronogramaPost } from "./types";

const POST_TYPE_LABELS: Record<string, string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  post: "Post",
  foto: "Foto",
};

function htmlToPlain(value: string | null | undefined): string {
  if (!value) return "";
  const withBreaks = value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|ul|ol)\s*>/gi, "\n");
  const withoutTags = withBreaks.replace(/<[^>]+>/g, "");
  const textarea = document.createElement("textarea");
  textarea.innerHTML = withoutTags;
  return textarea.value
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return "—"; }
}

function formatWeekday(d: string | null): string {
  if (!d) return "—";
  try { return format(parseISO(d), "EEEE", { locale: ptBR }); } catch { return "—"; }
}

export interface CanvaExportInput {
  clientName: string;
  posts: CronogramaPost[];
  monthRef?: string;
}

export async function downloadCanvaPackage({ clientName, posts, monthRef }: CanvaExportInput) {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Resumo ──
  const resumo = [
    ["CRONOGRAMA PARA CANVA"],
    [],
    ["Cliente", clientName],
    ["Período", monthRef ?? "—"],
    ["Total de Posts", posts.length],
    ["Gerado em", format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    [],
    ["INSTRUÇÕES PARA USO NO CANVA"],
    ["1. Abra um template no Canva (cronograma mensal, post individual, etc.)"],
    ["2. Use a aba 'Posts' desta planilha como referência para preencher cada slide"],
    ["3. As imagens podem ser baixadas separadamente usando os links na aba 'Imagens'"],
    ["4. Copie as legendas da aba 'Legendas' e cole diretamente no Canva"],
    [],
    ["TIPOS DE POST"],
    ...Object.entries(POST_TYPE_LABELS).map(([k, v]) => [`  ${v} (${k})`]),
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo["!cols"] = [{ wch: 50 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // ── Sheet 2: Posts ──
  const postsHeader = ["#", "Título", "Tipo", "Data", "Dia da Semana", "Horário", "Legenda (resumo)", "Qtd. Imagens"];
  const postsRows = posts.map((p, i) => {
    const caption = htmlToPlain(p.caption);
    const shortCaption = caption.length > 120 ? caption.slice(0, 117) + "..." : caption;
    return [
      i + 1,
      p.title,
      POST_TYPE_LABELS[p.post_type ?? "post"] ?? p.post_type ?? "Post",
      formatDate(p.posting_date),
      formatWeekday(p.posting_date),
      p.posting_time ?? "—",
      shortCaption,
      (p.all_attachment_urls?.length ?? 0) || (p.attachment_url ? 1 : 0),
    ];
  });
  const wsPosts = XLSX.utils.aoa_to_sheet([postsHeader, ...postsRows]);
  wsPosts["!cols"] = [
    { wch: 4 }, { wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
    { wch: 10 }, { wch: 60 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPosts, "Posts");

  // ── Sheet 3: Legendas completas ──
  const legendasHeader = ["#", "Título", "Legenda Completa"];
  const legendasRows = posts.map((p, i) => [
    i + 1,
    p.title,
    htmlToPlain(p.caption) || "(sem legenda)",
  ]);
  const wsLegendas = XLSX.utils.aoa_to_sheet([legendasHeader, ...legendasRows]);
  wsLegendas["!cols"] = [{ wch: 4 }, { wch: 30 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsLegendas, "Legendas");

  // ── Sheet 4: Imagens (links) ──
  const imagensHeader = ["#", "Título", "Tipo", "Imagem #", "URL da Imagem"];
  const imagensRows: (string | number)[][] = [];
  posts.forEach((p, i) => {
    const urls = p.all_attachment_urls?.length
      ? p.all_attachment_urls
      : p.attachment_url
        ? [p.attachment_url]
        : [];
    if (urls.length === 0) {
      imagensRows.push([i + 1, p.title, POST_TYPE_LABELS[p.post_type ?? "post"] ?? "Post", 0, "(sem imagem)"]);
    } else {
      urls.forEach((url, j) => {
        imagensRows.push([i + 1, p.title, POST_TYPE_LABELS[p.post_type ?? "post"] ?? "Post", j + 1, url]);
      });
    }
  });
  const wsImagens = XLSX.utils.aoa_to_sheet([imagensHeader, ...imagensRows]);
  wsImagens["!cols"] = [{ wch: 4 }, { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsImagens, "Imagens");

  // ── Sheet 5: Calendário visual ──
  const calHeader = ["Dia", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  // Group posts by date to create a simple calendar view
  const byDate = new Map<string, string[]>();
  posts.forEach(p => {
    if (!p.posting_date) return;
    const key = p.posting_date;
    const existing = byDate.get(key) ?? [];
    const type = POST_TYPE_LABELS[p.post_type ?? "post"] ?? "Post";
    existing.push(`${p.title} (${type})`);
    byDate.set(key, existing);
  });

  const calRows: string[][] = [];
  const sortedDates = Array.from(byDate.keys()).sort();
  sortedDates.forEach(date => {
    const entries = byDate.get(date) ?? [];
    calRows.push([
      formatDate(date),
      formatWeekday(date),
      entries.join(" | "),
    ]);
  });

  const wsCalendario = XLSX.utils.aoa_to_sheet([
    ["Data", "Dia da Semana", "Posts do Dia"],
    ...calRows,
  ]);
  wsCalendario["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsCalendario, "Calendário");

  // ── Download ──
  const safeClient = (clientName || "cronograma")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const fileName = `canva-${safeClient}-${monthRef ?? format(new Date(), "yyyy-MM")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
