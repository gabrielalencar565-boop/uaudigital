import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";

const DESIGN_W = 1684;
const DESIGN_H = 1190;

type BlockId = "cover" | "cards" | "footer";

export interface PdfExportSettings {
  background_color?: string | null;
  background_image_url?: string | null;
  cover_logo_url?: string | null;
  title_font_size?: number | null;
  title_color?: string | null;
  subtitle_font_size?: number | null;
  subtitle_color?: string | null;
  card_font_size?: number | null;
  card_date_font_size?: number | null;
  card_caption_font_size?: number | null;
  show_time_on_card?: boolean | null;
  accent_color?: string | null;
  blocks_order?: string[] | null;
  blocks_enabled?: Record<string, boolean> | null;
  agency_logo_url?: string | null;
  agency_name?: string | null;
  footer_text?: string | null;
  footer_contact?: string | null;
  margin_size?: number | null;
}

export interface PdfExportPost {
  id: string;
  title: string;
  post_type: string | null;
  posting_date: string | null;
  posting_time: string | null;
  caption: string | null;
  cover_url?: string | null;
  attachment_url?: string | null;
  all_attachment_urls?: string[];
}

interface ExportInput {
  clientName: string;
  posts: PdfExportPost[];
  settings?: PdfExportSettings | null;
}

const DEFAULT_SETTINGS: Required<PdfExportSettings> = {
  background_color: "#0B0D12",
  background_image_url: null,
  cover_logo_url: null,
  title_font_size: 32,
  title_color: "#FFFFFF",
  subtitle_font_size: 18,
  subtitle_color: "#AAAAAA",
  card_font_size: 14,
  card_date_font_size: 12,
  card_caption_font_size: 11,
  show_time_on_card: true,
  accent_color: "#7C5CFF",
  blocks_order: ["cover", "cards", "footer"],
  blocks_enabled: { cover: true, cards: true, footer: true },
  agency_logo_url: null,
  agency_name: "",
  footer_text: "",
  footer_contact: "",
  margin_size: 60,
};

const POST_TYPE_LABELS: Record<string, string> = {
  reels: "Reels",
  carrossel: "Carrossel",
  post: "Post",
  foto: "Foto",
};

function parseHex(hex: string, fallback: [number, number, number]): [number, number, number] {
  const value = (hex || "").trim();
  const normalized = value.startsWith("#") ? value.slice(1) : value;
  if (![3, 6].includes(normalized.length)) return fallback;

  const expanded = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized;

  const num = Number.parseInt(expanded, 16);
  if (Number.isNaN(num)) return fallback;

  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function withDefaults(settings?: PdfExportSettings | null): Required<PdfExportSettings> {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    blocks_order: (settings?.blocks_order ?? DEFAULT_SETTINGS.blocks_order).filter(Boolean),
    blocks_enabled: { ...DEFAULT_SETTINGS.blocks_enabled, ...(settings?.blocks_enabled ?? {}) },
  };
}

function getPostImage(post: PdfExportPost): string | null {
  if (post.post_type === "carrossel" && (post.all_attachment_urls?.length ?? 0) > 0) {
    return post.all_attachment_urls?.[0] ?? null;
  }
  return post.attachment_url ?? post.cover_url ?? post.all_attachment_urls?.[0] ?? null;
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const BRICOLAGE_URLS = {
  normal: "https://fonts.gstatic.com/s/bricolagegrotesque/v10/3y9U6as8bTXq_nANBjzKo3IeZx8z6up5BeSl5jBNz_19PpbpMXuECpwUxJBOm_OJWiSBoA.ttf",
  bold: "https://fonts.gstatic.com/s/bricolagegrotesque/v10/3y9U6as8bTXq_nANBjzKo3IeZx8z6up5BeSl5jBNz_19PpbpMXuECpwUxJBOm_OJTCOBoA.ttf",
};

let fontLoaded = false;

async function loadBricolageFont(doc: jsPDF) {
  if (fontLoaded) return;
  try {
    for (const [style, url] of Object.entries(BRICOLAGE_URLS)) {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      const fileName = `Bricolage-${style}.ttf`;
      doc.addFileToVFS(fileName, b64);
      doc.addFont(fileName, "Bricolage", style);
    }
    fontLoaded = true;
  } catch {
    // fallback to helvetica
  }
}

function setFont(doc: jsPDF, style: "normal" | "bold") {
  if (fontLoaded) {
    doc.setFont("Bricolage", style);
  } else {
    doc.setFont("helvetica", style);
  }
}

function drawBg(doc: jsPDF, pageW: number, pageH: number, settings: Required<PdfExportSettings>) {
  const [r, g, b] = parseHex(settings.background_color, [11, 13, 18]);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pageW, pageH, "F");
}

export async function downloadCronogramaPdf({ clientName, posts, settings }: ExportInput) {
  const form = withDefaults(settings);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Load custom font
  fontLoaded = false;
  await loadBricolageFont(doc);

  const sx = (x: number) => (x / DESIGN_W) * pageW;
  const sy = (y: number) => (y / DESIGN_H) * pageH;
  const margin = sx(form.margin_size);

  const blocksOrder = (form.blocks_order as BlockId[]).filter((b) => ["cover", "cards", "footer"].includes(b));
  const blocksEnabled = form.blocks_enabled as Record<BlockId, boolean>;

  let hasPage = false;
  const ensurePage = () => {
    if (hasPage) doc.addPage("a4", "landscape");
    hasPage = true;
  };

  const imageCache = new Map<string, string | null>();
  const getCachedImage = async (url?: string | null) => {
    if (!url) return null;
    if (imageCache.has(url)) return imageCache.get(url) ?? null;
    const data = await toDataUrl(url);
    imageCache.set(url, data);
    return data;
  };

  for (const block of blocksOrder) {
    if (!blocksEnabled[block]) continue;

    if (block === "cover") {
      ensurePage();
      drawBg(doc, pageW, pageH, form);

      const bgImage = await getCachedImage(form.background_image_url);
      if (bgImage) {
        doc.addImage(bgImage, "JPEG", 0, 0, pageW, pageH, undefined, "FAST");
      }

      const coverLogo = await getCachedImage(form.cover_logo_url);
      if (coverLogo) {
        const logoW = sx(260);
        const logoH = sy(120);
        doc.addImage(coverLogo, "PNG", pageW / 2 - logoW / 2, sy(140), logoW, logoH, undefined, "FAST");
      }

      const [titleR, titleG, titleB] = parseHex(form.title_color, [255, 255, 255]);
      const [subR, subG, subB] = parseHex(form.subtitle_color, [170, 170, 170]);
      const [accR, accG, accB] = parseHex(form.accent_color, [124, 92, 255]);

      doc.setTextColor(titleR, titleG, titleB);
      setFont(doc, "bold");
      doc.setFontSize(Math.max(14, sx(form.title_font_size * 2.5)));
      doc.text(clientName || "Cronograma", pageW / 2, pageH / 2 - sy(50), { align: "center" });

      const baseDate = posts[0]?.posting_date ? parseISO(posts[0].posting_date) : new Date();
      doc.setTextColor(subR, subG, subB);
      setFont(doc, "normal");
      doc.setFontSize(Math.max(10, sx(form.subtitle_font_size * 2)));
      doc.text(`Cronograma de Conteúdo — ${format(baseDate, "MMMM yyyy", { locale: ptBR })}`, pageW / 2, pageH / 2 + sy(20), { align: "center" });

      doc.setFillColor(accR, accG, accB);
      doc.roundedRect(pageW / 2 - sx(100), pageH / 2 + sy(40), sx(200), sy(8), sy(4), sy(4), "F");

      const agencyLogo = await getCachedImage(form.agency_logo_url);
      let footerY = pageH - sy(85);
      if (agencyLogo) {
        const logoW = sx(130);
        const logoH = sy(52);
        doc.addImage(agencyLogo, "PNG", pageW / 2 - logoW / 2, footerY - sy(30), logoW, logoH, undefined, "FAST");
        footerY += sy(34);
      }

      if (form.agency_name) {
        setFont(doc, "bold");
        doc.setTextColor(subR, subG, subB);
        doc.setFontSize(Math.max(10, sx(form.title_font_size * 0.85)));
        doc.text(form.agency_name, pageW / 2, footerY, { align: "center" });
      }
    }

    if (block === "cards") {
      for (let i = 0; i < posts.length; i += 1) {
        const post = posts[i];
        ensurePage();
        drawBg(doc, pageW, pageH, form);

        const contentW = pageW - margin * 2;
        const gap = sx(40);
        const imageW = contentW * 0.45;
        const textW = contentW - imageW - gap;
        const contentH = pageH - margin * 2;
        const imageX = margin;
        const imageY = margin;
        const textX = imageX + imageW + gap;
        const textY = margin;

        doc.setDrawColor(255, 255, 255);
        doc.setFillColor(26, 29, 39);
        doc.roundedRect(imageX, imageY, imageW, contentH, sx(20), sx(20), "F");

        const postImageUrl = getPostImage(post);
        const postImage = await getCachedImage(postImageUrl);
        if (postImage) {
          doc.addImage(postImage, "JPEG", imageX, imageY, imageW, contentH, undefined, "FAST");
        } else {
          doc.setTextColor(110, 117, 138);
          setFont(doc, "bold");
          doc.setFontSize(sx(28));
          doc.text("Imagem do Post", imageX + imageW / 2, imageY + contentH / 2, { align: "center" });
        }

        const [titleR, titleG, titleB] = parseHex(form.title_color, [255, 255, 255]);
        const [subR, subG, subB] = parseHex(form.subtitle_color, [170, 170, 170]);
        const [accR, accG, accB] = parseHex(form.accent_color, [124, 92, 255]);
        const postTypeLabel = POST_TYPE_LABELS[post.post_type ?? "post"] ?? "Post";

        setFont(doc, "bold");
        doc.setTextColor(titleR, titleG, titleB);
        doc.setFontSize(Math.max(10, sx(form.card_font_size * 2.4)));
        doc.text(`Post ${i + 1}`, textX, textY + sy(60));

        const badgeText = postTypeLabel;
        doc.setFontSize(sx(18));
        const badgeTextW = doc.getTextWidth(badgeText);
        const badgePadX = sx(24);
        const badgeW = badgeTextW + badgePadX * 2;
        const badgeH = sy(44);
        const badgeX = textX + sx(180);
        const badgeY = textY + sy(24);
        doc.setFillColor(accR, accG, accB);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, sy(22), sy(22), "F");
        doc.setTextColor(255, 255, 255);
        doc.text(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2 + sx(6), { align: "center" });

        doc.setTextColor(subR, subG, subB);
        setFont(doc, "bold");
        doc.setFontSize(sx(16));
        doc.text("Legenda:", textX, textY + sy(130));

        doc.setTextColor(titleR, titleG, titleB);
        setFont(doc, "normal");
        doc.setFontSize(Math.max(9, sx(form.card_caption_font_size * 1.8)));
        const caption = post.caption?.trim() || "Sem legenda";
        const wrappedCaption = doc.splitTextToSize(caption, textW);
        doc.text(wrappedCaption, textX, textY + sy(170), { baseline: "top" });

        const footerTop = pageH - margin - sy(100);
        doc.setDrawColor(accR, accG, accB);
        doc.setLineWidth(1.4);
        doc.line(textX, footerTop, textX + textW, footerTop);

        doc.setTextColor(subR, subG, subB);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(sx(14));
        doc.text("Data", textX, footerTop + sy(32));

        doc.setTextColor(titleR, titleG, titleB);
        doc.setFontSize(Math.max(10, sx(form.card_date_font_size * 2.1)));
        const formattedDate = post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yyyy") : "—";
        doc.text(formattedDate, textX, footerTop + sy(68));

        if (form.show_time_on_card && post.posting_time) {
          const timeX = textX + sx(210);
          doc.setTextColor(subR, subG, subB);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(sx(14));
          doc.text("Horário", timeX, footerTop + sy(32));
          doc.setTextColor(titleR, titleG, titleB);
          doc.setFontSize(Math.max(10, sx(form.card_date_font_size * 2.1)));
          doc.text(post.posting_time, timeX, footerTop + sy(68));
        }
      }
    }

    if (block === "footer") {
      ensurePage();
      drawBg(doc, pageW, pageH, form);

      const [titleR, titleG, titleB] = parseHex(form.title_color, [255, 255, 255]);
      const [subR, subG, subB] = parseHex(form.subtitle_color, [170, 170, 170]);
      const [accR, accG, accB] = parseHex(form.accent_color, [124, 92, 255]);

      const agencyLogo = await getCachedImage(form.agency_logo_url);
      if (agencyLogo) {
        const logoW = sx(210);
        const logoH = sy(110);
        doc.addImage(agencyLogo, "PNG", pageW / 2 - logoW / 2, pageH / 2 - sy(190), logoW, logoH, undefined, "FAST");
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(titleR, titleG, titleB);
      doc.setFontSize(Math.max(12, sx(form.title_font_size * 1.25)));
      doc.text(form.agency_name || "Nome da Agência", pageW / 2, pageH / 2 - sy(20), { align: "center" });

      doc.setDrawColor(accR, accG, accB);
      doc.setLineWidth(2);
      doc.line(pageW / 2 - sx(160), pageH / 2 + sy(5), pageW / 2 + sx(160), pageH / 2 + sy(5));

      doc.setTextColor(subR, subG, subB);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.max(10, sx(form.subtitle_font_size * 1.5)));
      doc.text(form.footer_text || "Cronograma de Conteúdo", pageW / 2, pageH / 2 + sy(50), { align: "center" });

      doc.setTextColor(subR, subG, subB);
      doc.setFontSize(Math.max(9, sx(form.card_caption_font_size * 1.6)));
      doc.text(form.footer_contact || "@agencia • contato@agencia.com", pageW / 2, pageH / 2 + sy(95), { align: "center" });
    }
  }

  if (!hasPage) {
    ensurePage();
    drawBg(doc, pageW, pageH, form);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Nenhuma postagem agendada para exportar.", pageW / 2, pageH / 2, { align: "center" });
  }

  const safeClient = (clientName || "cronograma")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const monthRef = posts[0]?.posting_date
    ? format(parseISO(posts[0].posting_date), "yyyy-MM")
    : format(new Date(), "yyyy-MM");

  doc.save(`${safeClient || "cronograma"}-${monthRef}.pdf`);
}
