import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";

const DESIGN_W = 1684;
const DESIGN_H = 1190;

type BlockId = "cover" | "cards" | "footer";
type PdfImageFormat = "PNG" | "JPEG";

interface PdfImageAsset {
  dataUrl: string;
  format: PdfImageFormat;
}

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
  footer_title_font_size?: number | null;
  footer_subtitle_font_size?: number | null;
  footer_contact_font_size?: number | null;
  card_image_width_pct?: number | null;
  carousel_cols?: number | null;
  carousel_rows?: number | null;
  carousel_title_font_size?: number | null;
  carousel_caption_font_size?: number | null;
  carousel_date_font_size?: number | null;
  carousel_image_height_pct?: number | null;
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
  footer_title_font_size: 32,
  footer_subtitle_font_size: 18,
  footer_contact_font_size: 11,
  card_image_width_pct: 45,
  carousel_cols: 4,
  carousel_rows: 2,
  carousel_title_font_size: 14,
  carousel_caption_font_size: 11,
  carousel_date_font_size: 12,
  carousel_image_height_pct: 65,
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function detectImageKind(dataUrl: string): "png" | "jpeg" | "svg" | "other" {
  const lower = dataUrl.slice(0, 80).toLowerCase();
  if (lower.startsWith("data:image/png")) return "png";
  if (lower.startsWith("data:image/jpeg") || lower.startsWith("data:image/jpg")) return "jpeg";
  if (lower.startsWith("data:image/svg+xml")) return "svg";
  return "other";
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function rasterizeToPng(dataUrl: string): Promise<string | null> {
  const img = await loadImage(dataUrl);
  if (!img) return null;
  const width = Math.max(1, img.naturalWidth || img.width || 1200);
  const height = Math.max(1, img.naturalHeight || img.height || 900);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

/**
 * Draws an image on a canvas with object-contain (no cropping) and rounded corners,
 * then returns a PNG dataUrl ready for jsPDF.
 */
async function renderContainImage(
  imageDataUrl: string,
  targetW: number,
  targetH: number,
  borderRadius: number,
): Promise<string | null> {
  const img = await loadImage(imageDataUrl);
  if (!img) return null;

  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;

  const scale = 2;
  const cW = Math.round(targetW * scale);
  const cH = Math.round(targetH * scale);
  const r = borderRadius * scale;

  const canvas = document.createElement("canvas");
  canvas.width = cW;
  canvas.height = cH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Clip to rounded rect
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(cW - r, 0);
  ctx.quadraticCurveTo(cW, 0, cW, r);
  ctx.lineTo(cW, cH - r);
  ctx.quadraticCurveTo(cW, cH, cW - r, cH);
  ctx.lineTo(r, cH);
  ctx.quadraticCurveTo(0, cH, 0, cH - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.clip();

  // Fill background
  ctx.fillStyle = "#1a1d27";
  ctx.fillRect(0, 0, cW, cH);

  // Object-contain: fit image inside canvas preserving aspect ratio
  const imgRatio = natW / natH;
  const canvasRatio = cW / cH;
  let drawW: number, drawH: number, drawX: number, drawY: number;

  if (imgRatio > canvasRatio) {
    // Image wider → fit width
    drawW = cW;
    drawH = cW / imgRatio;
    drawX = 0;
    drawY = (cH - drawH) / 2;
  } else {
    // Image taller → fit height
    drawH = cH;
    drawW = cH * imgRatio;
    drawX = (cW - drawW) / 2;
    drawY = 0;
  }

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  return canvas.toDataURL("image/png");
}

function addPdfImage(doc: jsPDF, image: PdfImageAsset, x: number, y: number, w: number, h: number): boolean {
  try {
    doc.addImage(image.dataUrl, image.format, x, y, w, h, undefined, "FAST");
    return true;
  } catch {
    return false;
  }
}

async function toPdfImage(url: string): Promise<PdfImageAsset | null> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    const kind = detectImageKind(dataUrl);
    if (kind === "png") return { dataUrl, format: "PNG" };
    if (kind === "jpeg") return { dataUrl, format: "JPEG" };
    const rasterized = await rasterizeToPng(dataUrl);
    if (!rasterized) return null;
    return { dataUrl: rasterized, format: "PNG" };
  } catch {
    return null;
  }
}

const BRICOLAGE_URLS: Record<"normal" | "bold", string> = {
  normal: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bricolagegrotesque/BricolageGrotesque-Regular.ttf",
  bold: "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bricolagegrotesque/BricolageGrotesque-Bold.ttf",
};

let fontLoaded = false;
let loadedStyles = new Set<"normal" | "bold">();

async function loadBricolageFont(doc: jsPDF) {
  if (fontLoaded) return;

  loadedStyles = new Set<"normal" | "bold">();

  try {
    for (const [style, url] of Object.entries(BRICOLAGE_URLS) as ["normal" | "bold", string][]) {
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
      loadedStyles.add(style);
    }

    fontLoaded = loadedStyles.size > 0;
  } catch {
    fontLoaded = false;
    loadedStyles.clear();
  }
}

function setFont(doc: jsPDF, style: "normal" | "bold") {
  if (fontLoaded && loadedStyles.has(style)) {
    doc.setFont("Bricolage", style);
    return;
  }

  if (fontLoaded && loadedStyles.has("normal")) {
    doc.setFont("Bricolage", "normal");
    return;
  }

  doc.setFont("helvetica", style);
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

  fontLoaded = false;
  loadedStyles.clear();
  await loadBricolageFont(doc);

  const sx = (x: number) => (x / DESIGN_W) * pageW;
  const sy = (y: number) => (y / DESIGN_H) * pageH;
  const margin = sx(form.margin_size);
  const imgWidthPct = (form.card_image_width_pct ?? 45) / 100;

  const blocksOrder = (form.blocks_order as BlockId[]).filter((b) => ["cover", "cards", "footer"].includes(b));
  const blocksEnabled = form.blocks_enabled as Record<BlockId, boolean>;

  let hasPage = false;
  const ensurePage = () => {
    if (hasPage) doc.addPage("a4", "landscape");
    hasPage = true;
  };

  const imageCache = new Map<string, PdfImageAsset | null>();
  const getCachedImage = async (url?: string | null) => {
    if (!url) return null;
    if (imageCache.has(url)) return imageCache.get(url) ?? null;
    const data = await toPdfImage(url);
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
        addPdfImage(doc, bgImage, 0, 0, pageW, pageH);
      }

      const coverLogo = await getCachedImage(form.cover_logo_url);
      if (coverLogo) {
        const logoW = sx(260);
        const logoH = sy(120);
        addPdfImage(doc, coverLogo, pageW / 2 - logoW / 2, sy(140), logoW, logoH);
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
        if (addPdfImage(doc, agencyLogo, pageW / 2 - logoW / 2, footerY - sy(30), logoW, logoH)) {
          footerY += sy(34);
        }
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
        const isCarousel = post.post_type === "carrossel" && (post.all_attachment_urls?.length ?? 0) > 1;

        ensurePage();
        drawBg(doc, pageW, pageH, form);

        const contentW = pageW - margin * 2;
        const contentH = pageH - margin * 2;
        const gap = sx(40);
        const cornerRadius = sx(20);

        const [titleR, titleG, titleB] = parseHex(form.title_color, [255, 255, 255]);
        const [subR, subG, subB] = parseHex(form.subtitle_color, [170, 170, 170]);
        const [accR, accG, accB] = parseHex(form.accent_color, [124, 92, 255]);
        const postTypeLabel = POST_TYPE_LABELS[post.post_type ?? "post"] ?? "Post";

        if (isCarousel) {
          // ── Carousel layout: grid on TOP, info bar on BOTTOM ──
          const carouselImages = post.all_attachment_urls ?? [];
          const COLS = form.carousel_cols ?? 4;
          const ROWS = form.carousel_rows ?? 2;
          const PER_PAGE = COLS * ROWS;
          const imgGap = sx(12);
          const imgHeightPct = (form.carousel_image_height_pct ?? 65) / 100;

          // Top area for images, bottom for info
          const gridH = contentH * imgHeightPct;
          const infoH = contentH - gridH - sy(20); // 20px gap between grid and info
          const gridY = margin;
          const infoY = margin + gridH + sy(20);

          const gridColW = (contentW - imgGap * (COLS - 1)) / COLS;
          const gridRowH = (gridH - imgGap * (ROWS - 1)) / ROWS;

          // Render first page of images
          const firstPageImgs = carouselImages.slice(0, PER_PAGE);
          for (let idx = 0; idx < firstPageImgs.length; idx++) {
            const col = idx % COLS;
            const row = Math.floor(idx / COLS);
            const cx = margin + col * (gridColW + imgGap);
            const cy = gridY + row * (gridRowH + imgGap);

            doc.setFillColor(26, 29, 39);
            doc.roundedRect(cx, cy, gridColW, gridRowH, cornerRadius, cornerRadius, "F");

            const rawAsset = await getCachedImage(firstPageImgs[idx]);
            if (rawAsset) {
              const containPng = await renderContainImage(rawAsset.dataUrl, gridColW, gridRowH, cornerRadius);
              if (containPng) {
                addPdfImage(doc, { dataUrl: containPng, format: "PNG" }, cx, cy, gridColW, gridRowH);
              }
            }
          }

          // Bottom info bar: Post N + Badge | Caption | Date + Time
          const cTitleFontSize = form.carousel_title_font_size ?? form.card_font_size ?? 14;
          const cCaptionFontSize = form.carousel_caption_font_size ?? form.card_caption_font_size ?? 11;
          const cDateFontSize = form.carousel_date_font_size ?? form.card_date_font_size ?? 12;

          // Left column: Post number + type
          const leftColW = contentW * 0.2;
          const centerColW = contentW * 0.5;
          const rightColW = contentW * 0.3;
          const leftX = margin;
          const centerX = margin + leftColW;
          const rightX = margin + leftColW + centerColW;

          setFont(doc, "bold");
          doc.setTextColor(titleR, titleG, titleB);
          doc.setFontSize(Math.max(10, sx(cTitleFontSize * 3)));
          doc.text(`Post ${i + 1}`, leftX, infoY + sy(50));

          // Type badge below post number
          const badgeText = postTypeLabel;
          setFont(doc, "normal");
          doc.setFontSize(sx(16));
          doc.setTextColor(accR, accG, accB);
          doc.text(badgeText, leftX, infoY + sy(90));

          // Center: caption
          doc.setTextColor(titleR, titleG, titleB);
          setFont(doc, "normal");
          doc.setFontSize(Math.max(9, sx(cCaptionFontSize * 1.8)));
          const caption = post.caption?.trim() || "Sem legenda";
          const wrappedCaption = doc.splitTextToSize(caption, centerColW - sx(20));
          doc.text(wrappedCaption, centerX, infoY + sy(30), { baseline: "top" });

          // Right: date + time badges
          const formattedDate = post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yyyy") : "—";
          const dateBadgeW = rightColW - sx(20);
          const dateBadgeH = sy(50);
          const dateBadgeX = rightX;
          const dateBadgeY = infoY + sy(10);

          doc.setFillColor(accR, accG, accB);
          doc.roundedRect(dateBadgeX, dateBadgeY, dateBadgeW, dateBadgeH, sy(10), sy(10), "F");
          doc.setTextColor(255, 255, 255);
          setFont(doc, "bold");
          doc.setFontSize(Math.max(10, sx(cDateFontSize * 1.8)));
          doc.text(`Data: ${formattedDate}`, dateBadgeX + dateBadgeW / 2, dateBadgeY + dateBadgeH / 2, { align: "center", baseline: "middle" });

          if (form.show_time_on_card && post.posting_time) {
            const timeBadgeY = dateBadgeY + dateBadgeH + sy(12);
            doc.setFillColor(accR, accG, accB);
            doc.roundedRect(dateBadgeX, timeBadgeY, dateBadgeW, dateBadgeH, sy(10), sy(10), "F");
            doc.setTextColor(255, 255, 255);
            doc.text(`Horário: ${post.posting_time}`, dateBadgeX + dateBadgeW / 2, timeBadgeY + dateBadgeH / 2, { align: "center", baseline: "middle" });
          }

          // Additional pages for remaining carousel images
          for (let pageStart = PER_PAGE; pageStart < carouselImages.length; pageStart += PER_PAGE) {
            ensurePage();
            drawBg(doc, pageW, pageH, form);

            setFont(doc, "bold");
            doc.setTextColor(titleR, titleG, titleB);
            doc.setFontSize(Math.max(10, sx(cTitleFontSize * 2.4)));
            doc.text(`Post ${i + 1} (cont.)`, margin, margin + sy(50));

            const chunk = carouselImages.slice(pageStart, pageStart + PER_PAGE);
            const fullW = pageW - margin * 2;
            const fullH = contentH - sy(80);
            const cColW = (fullW - imgGap * (COLS - 1)) / COLS;
            const cRowH = (fullH - imgGap * (ROWS - 1)) / ROWS;
            const startY = margin + sy(80);

            for (let idx = 0; idx < chunk.length; idx++) {
              const col = idx % COLS;
              const row = Math.floor(idx / COLS);
              const cx = margin + col * (cColW + imgGap);
              const cy = startY + row * (cRowH + imgGap);

              doc.setFillColor(26, 29, 39);
              doc.roundedRect(cx, cy, cColW, cRowH, cornerRadius, cornerRadius, "F");

              const rawAsset = await getCachedImage(chunk[idx]);
              if (rawAsset) {
                const containPng = await renderContainImage(rawAsset.dataUrl, cColW, cRowH, cornerRadius);
                if (containPng) {
                  addPdfImage(doc, { dataUrl: containPng, format: "PNG" }, cx, cy, cColW, cRowH);
                }
              }
            }
          }
        } else {
          // ── Standard single-image layout ──
          const imageW = contentW * imgWidthPct;
          const textW = contentW - imageW - gap;
          const imageX = margin;
          const imageY = margin;
          const textX = imageX + imageW + gap;
          const textY = margin;

          doc.setDrawColor(255, 255, 255);
          doc.setFillColor(26, 29, 39);
          doc.roundedRect(imageX, imageY, imageW, contentH, cornerRadius, cornerRadius, "F");

          const postImageUrl = getPostImage(post);
          let imageRendered = false;
          if (postImageUrl) {
            const rawAsset = await getCachedImage(postImageUrl);
            if (rawAsset) {
              const containPng = await renderContainImage(rawAsset.dataUrl, imageW, contentH, cornerRadius);
              if (containPng) {
                imageRendered = addPdfImage(doc, { dataUrl: containPng, format: "PNG" }, imageX, imageY, imageW, contentH);
              }
            }
          }
          if (!imageRendered) {
            doc.setTextColor(110, 117, 138);
            setFont(doc, "bold");
            doc.setFontSize(sx(28));
            doc.text("Imagem do Post", imageX + imageW / 2, imageY + contentH / 2, { align: "center" });
          }

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
          doc.text(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2, { align: "center", baseline: "middle" });

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
          setFont(doc, "bold");
          doc.setFontSize(sx(14));
          doc.text("Data", textX, footerTop + sy(32));

          doc.setTextColor(titleR, titleG, titleB);
          setFont(doc, "normal");
          doc.setFontSize(Math.max(10, sx(form.card_date_font_size * 2.1)));
          const formattedDate = post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yyyy") : "—";
          doc.text(formattedDate, textX, footerTop + sy(68));

          if (form.show_time_on_card && post.posting_time) {
            const dateTextW = doc.getTextWidth(formattedDate);
            const timeX = Math.min(
              Math.max(textX + dateTextW + sx(80), textX + textW * 0.55),
              textX + textW - sx(220),
            );
            doc.setTextColor(subR, subG, subB);
            setFont(doc, "bold");
            doc.setFontSize(sx(14));
            doc.text("Horário", timeX, footerTop + sy(32));
            doc.setTextColor(titleR, titleG, titleB);
            setFont(doc, "normal");
            doc.setFontSize(Math.max(10, sx(form.card_date_font_size * 2.1)));
            doc.text(post.posting_time, timeX, footerTop + sy(68));
          }
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
        addPdfImage(doc, agencyLogo, pageW / 2 - logoW / 2, pageH / 2 - sy(190), logoW, logoH);
      }

      setFont(doc, "bold");
      doc.setTextColor(titleR, titleG, titleB);
      doc.setFontSize(Math.max(12, sx((form.footer_title_font_size ?? 32) * 1.25)));
      doc.text(form.agency_name || "Nome da Agência", pageW / 2, pageH / 2 - sy(20), { align: "center" });

      doc.setDrawColor(accR, accG, accB);
      doc.setLineWidth(2);
      doc.line(pageW / 2 - sx(160), pageH / 2 + sy(5), pageW / 2 + sx(160), pageH / 2 + sy(5));

      doc.setTextColor(subR, subG, subB);
      setFont(doc, "normal");
      doc.setFontSize(Math.max(10, sx((form.footer_subtitle_font_size ?? 18) * 1.5)));
      doc.text(form.footer_text || "Cronograma de Conteúdo", pageW / 2, pageH / 2 + sy(50), { align: "center" });

      doc.setTextColor(subR, subG, subB);
      doc.setFontSize(Math.max(9, sx((form.footer_contact_font_size ?? 11) * 1.6)));
      doc.text(form.footer_contact || "@agencia • contato@agencia.com", pageW / 2, pageH / 2 + sy(95), { align: "center" });
    }
  }

  if (!hasPage) {
    ensurePage();
    drawBg(doc, pageW, pageH, form);
    doc.setTextColor(255, 255, 255);
    setFont(doc, "bold");
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
