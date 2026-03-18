import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { buildAdaptiveCarouselGridFrames } from "./carousel-grid";

const DESIGN_W = 1684;
const DESIGN_H = 1190;

type BlockId = "cover" | "cards" | "carousel" | "footer";
type PdfImageFormat = "PNG" | "JPEG";
type ImageFitMode = "contain" | "cover";

interface PdfImageAsset {
  dataUrl: string;
  format: PdfImageFormat;
}

interface LayoutPoint {
  x: number;
  y: number;
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
  layout_overrides?: Record<string, LayoutPoint> | null;
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
  blocks_order: ["cover", "cards", "carousel", "footer"],
  blocks_enabled: { cover: true, cards: true, carousel: true, footer: true },
  layout_overrides: {},
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

const DEFAULT_LAYOUT_POINTS: Record<string, LayoutPoint> = {
  cover_title: { x: 50, y: 45 },
  cover_subtitle: { x: 50, y: 53 },
  cards_info: { x: 73, y: 50 },
  cards_title: { x: 73, y: 12 },
  cards_caption: { x: 73, y: 45 },
  cards_date: { x: 88, y: 82 },
  cards_time: { x: 88, y: 90 },
  carousel_info: { x: 50, y: 83 },
  carousel_title: { x: 14, y: 78 },
  carousel_caption: { x: 45, y: 80 },
  carousel_date: { x: 85, y: 88 },
  carousel_time: { x: 85, y: 94 },
  footer_group: { x: 50, y: 50 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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

function readLayoutPoint(raw: unknown): LayoutPoint | null {
  if (!raw || typeof raw !== "object") return null;
  const x = Number((raw as any).x);
  const y = Number((raw as any).y);
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return { x, y };
}

function getLayoutPoint(layout: unknown, key: string, fallback: LayoutPoint): LayoutPoint {
  if (!layout || typeof layout !== "object") return fallback;
  const parsed = readLayoutPoint((layout as Record<string, unknown>)[key]);
  return parsed ?? fallback;
}

function normalizeBlocksOrder(order?: string[] | null): BlockId[] {
  const required: BlockId[] = ["cover", "cards", "carousel", "footer"];
  const incoming = (order ?? DEFAULT_SETTINGS.blocks_order)
    .filter((value): value is BlockId => required.includes(value as BlockId));

  const unique: BlockId[] = [];
  for (const block of incoming) {
    if (!unique.includes(block)) unique.push(block);
  }

  for (const block of required) {
    if (unique.includes(block)) continue;
    if (block === "carousel" && unique.includes("cards")) {
      unique.splice(unique.indexOf("cards") + 1, 0, block);
    } else {
      unique.push(block);
    }
  }

  return unique;
}

function getCardsInfoPoint(layout: unknown): LayoutPoint {
  const fallback = DEFAULT_LAYOUT_POINTS.cards_info;
  if (!layout || typeof layout !== "object") return fallback;

  const rawLayout = layout as Record<string, unknown>;
  const direct = readLayoutPoint(rawLayout.cards_info);
  if (direct) return direct;

  const legacySources: Array<{ key: "cards_title" | "cards_caption" | "cards_date" | "cards_time"; base: LayoutPoint }> = [
    { key: "cards_title", base: DEFAULT_LAYOUT_POINTS.cards_title },
    { key: "cards_caption", base: DEFAULT_LAYOUT_POINTS.cards_caption },
    { key: "cards_date", base: DEFAULT_LAYOUT_POINTS.cards_date },
    { key: "cards_time", base: DEFAULT_LAYOUT_POINTS.cards_time },
  ];

  for (const source of legacySources) {
    const point = readLayoutPoint(rawLayout[source.key]);
    if (!point) continue;
    return {
      x: point.x + (fallback.x - source.base.x),
      y: point.y + (fallback.y - source.base.y),
    };
  }

  return fallback;
}

function withDefaults(settings?: PdfExportSettings | null): Required<PdfExportSettings> {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    blocks_order: normalizeBlocksOrder(settings?.blocks_order),
    blocks_enabled: { ...DEFAULT_SETTINGS.blocks_enabled, ...(settings?.blocks_enabled ?? {}) },
    layout_overrides: { ...DEFAULT_SETTINGS.layout_overrides, ...(settings?.layout_overrides ?? {}) },
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
 * Draws an image on a canvas preserving proportion with object-fit logic.
 * - contain: image inteira sem distorção
 * - cover: preenche frame sem achatamento (com corte central)
 */
async function renderFittedImage(
  imageDataUrl: string,
  targetW: number,
  targetH: number,
  borderRadius: number,
  options?: { backgroundMode?: "solid" | "blur"; fitMode?: ImageFitMode },
): Promise<string | null> {
  const img = await loadImage(imageDataUrl);
  if (!img) return null;

  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;

  const scale = targetW < 220 || targetH < 220 ? 3 : 2;
  const cW = Math.round(targetW * scale);
  const cH = Math.round(targetH * scale);
  const r = borderRadius * scale;

  const canvas = document.createElement("canvas");
  canvas.width = cW;
  canvas.height = cH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

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

  const fitMode = options?.fitMode ?? "contain";

  if (fitMode === "contain" && options?.backgroundMode === "blur") {
    const coverScale = Math.max(cW / natW, cH / natH);
    const bgW = natW * coverScale;
    const bgH = natH * coverScale;
    const bgX = (cW - bgW) / 2;
    const bgY = (cH - bgH) / 2;

    ctx.save();
    ctx.filter = `blur(${Math.round(12 * scale)}px)`;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, bgX, bgY, bgW, bgH);
    ctx.restore();

    ctx.fillStyle = "rgba(8, 10, 14, 0.28)";
    ctx.fillRect(0, 0, cW, cH);
  } else if (fitMode === "contain") {
    ctx.fillStyle = "#1a1d27";
    ctx.fillRect(0, 0, cW, cH);
  }

  const ratioScale = fitMode === "cover"
    ? Math.max(cW / natW, cH / natH)
    : Math.min(cW / natW, cH / natH);

  const drawW = natW * ratioScale;
  const drawH = natH * ratioScale;
  const drawX = (cW - drawW) / 2;
  const drawY = (cH - drawH) / 2;

  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  return canvas.toDataURL("image/png");
}

function addPdfImage(doc: jsPDF, image: PdfImageAsset, x: number, y: number, w: number, h: number): boolean {
  try {
    doc.addImage(image.dataUrl, image.format, x, y, w, h, undefined, "MEDIUM");
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

const BRICOLAGE_URLS: Record<"normal" | "bold", string[]> = {
  normal: [
    "/fonts/BricolageGrotesque-Regular.ttf",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf",
  ],
  bold: [
    "/fonts/BricolageGrotesque-Bold.ttf",
    "/fonts/BricolageGrotesque-Regular.ttf",
    "https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz%2Cwdth%2Cwght%5D.ttf",
  ],
};

let fontCache: Partial<Record<"normal" | "bold", string>> | null = null;

async function ensureBrowserFontsLoaded() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([
    document.fonts.ready,
    document.fonts.load('400 16px "Bricolage Grotesque"'),
    document.fonts.load('700 16px "Bricolage Grotesque"'),
  ]);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function fetchFontBase64(urls: string[]) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      return arrayBufferToBase64(buf);
    } catch {
      continue;
    }
  }
  return null;
}

async function loadBricolageFont(doc: jsPDF): Promise<boolean> {
  if (!fontCache) {
    const [normal, bold] = await Promise.all([
      fetchFontBase64(BRICOLAGE_URLS.normal),
      fetchFontBase64(BRICOLAGE_URLS.bold),
    ]);

    if (!normal || !bold) {
      fontCache = null;
      return false;
    }

    fontCache = { normal, bold };
  }

  for (const style of ["normal", "bold"] as const) {
    const b64 = fontCache?.[style];
    if (!b64) return false;
    const fileName = `Bricolage-${style}.ttf`;
    doc.addFileToVFS(fileName, b64);
    doc.addFont(fileName, "Bricolage", style);
  }

  return true;
}

function setFont(doc: jsPDF, style: "normal" | "bold") {
  doc.setFont("Bricolage", style);
}

function drawBg(doc: jsPDF, pageW: number, pageH: number, settings: Required<PdfExportSettings>) {
  const [r, g, b] = parseHex(settings.background_color, [11, 13, 18]);
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, pageW, pageH, "F");
}

function decodeHtmlEntities(value: string) {
  if (typeof document === "undefined") return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function htmlToPlainText(value: string) {
  const withBreaks = value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|ul|ol)\s*>/gi, "\n");

  const withoutTags = withBreaks.replace(/<[^>]+>/g, "");
  return decodeHtmlEntities(withoutTags)
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toPdfText(value: string | null | undefined, fallback: string) {
  const raw = (value ?? "").trim();
  if (!raw) return fallback;

  const maybeHtml = /<[^>]+>|&[a-zA-Z#0-9]+;/.test(raw);
  const parsed = maybeHtml
    ? htmlToPlainText(raw)
    : decodeHtmlEntities(raw).replace(/\u00a0/g, " ").trim();

  return parsed || fallback;
}

function fitTextLines(
  doc: jsPDF,
  text: string,
  maxWidth: number,
  maxHeight: number,
  lineHeightFactor: number,
) {
  const safeWidth = Math.max(20, maxWidth);
  const collected: string[] = [];

  for (const paragraph of text.split("\n")) {
    const chunk = paragraph.trim();
    if (!chunk) {
      if (collected.length > 0 && collected[collected.length - 1] !== "") {
        collected.push("");
      }
      continue;
    }

    const wrapped = doc.splitTextToSize(chunk, safeWidth) as string[];
    if (wrapped.length) {
      collected.push(...wrapped);
    } else {
      collected.push(chunk);
    }
  }

  if (!collected.length) return [""];

  const lineHeight = Math.max(1, doc.getFontSize() * lineHeightFactor);
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));

  if (collected.length <= maxLines) return collected;

  const trimmed = collected.slice(0, maxLines);
  const ellipsis = "…";
  let tail = trimmed[maxLines - 1] ?? "";

  while (tail && doc.getTextWidth(`${tail}${ellipsis}`) > safeWidth) {
    tail = tail.slice(0, -1).trimEnd();
  }

  trimmed[maxLines - 1] = `${tail}${ellipsis}`;
  return trimmed;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const safeSize = Math.max(1, size);
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += safeSize) {
    chunks.push(items.slice(i, i + safeSize));
  }
  return chunks;
}

function formatPostingDate(dateValue: string | null) {
  if (!dateValue) return "—";
  try {
    return format(parseISO(dateValue), "dd/MM/yyyy");
  } catch {
    return "—";
  }
}

export async function downloadCronogramaPdf({ clientName, posts, settings }: ExportInput) {
  const form = withDefaults(settings);
  await ensureBrowserFontsLoaded();

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const fontReady = await loadBricolageFont(doc);
  if (!fontReady) {
    throw new Error("Não foi possível carregar a fonte do PDF. Tente novamente em instantes.");
  }

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const sx = (x: number) => (x / DESIGN_W) * pageW;
  const sy = (y: number) => (y / DESIGN_H) * pageH;
  const margin = sx(form.margin_size);
  const imgWidthPct = (form.card_image_width_pct ?? 45) / 100;

  const blocksOrder = normalizeBlocksOrder(form.blocks_order);
  const blocksEnabled = {
    cover: true,
    cards: true,
    carousel: true,
    footer: true,
    ...(form.blocks_enabled as Record<string, boolean>),
  } as Record<BlockId, boolean>;

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

  const preloadUrls = new Set<string>();
  if (form.background_image_url) preloadUrls.add(form.background_image_url);
  if (form.cover_logo_url) preloadUrls.add(form.cover_logo_url);
  if (form.agency_logo_url) preloadUrls.add(form.agency_logo_url);

  for (const post of posts) {
    const mainImage = getPostImage(post);
    if (mainImage) preloadUrls.add(mainImage);
    for (const carouselImg of post.all_attachment_urls ?? []) {
      if (carouselImg) preloadUrls.add(carouselImg);
    }
  }

  await Promise.all(Array.from(preloadUrls).map((url) => getCachedImage(url)));

  for (const block of blocksOrder) {
    if (!blocksEnabled[block]) continue;

    if (block === "cover") {
      ensurePage();
      drawBg(doc, pageW, pageH, form);

      const bgImage = await getCachedImage(form.background_image_url);
      if (bgImage) {
        const coveredBg = await renderFittedImage(bgImage.dataUrl, pageW, pageH, 0, { fitMode: "cover" });
        if (coveredBg) {
          addPdfImage(doc, { dataUrl: coveredBg, format: "PNG" }, 0, 0, pageW, pageH);
        }
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

      const coverTitlePoint = getLayoutPoint(form.layout_overrides, "cover_title", DEFAULT_LAYOUT_POINTS.cover_title);
      const coverSubtitlePoint = getLayoutPoint(form.layout_overrides, "cover_subtitle", DEFAULT_LAYOUT_POINTS.cover_subtitle);

      doc.setTextColor(titleR, titleG, titleB);
      setFont(doc, "bold");
      doc.setFontSize(Math.max(14, sx(form.title_font_size * 2.5)));
      doc.text(toPdfText(clientName, "Cronograma"), (coverTitlePoint.x / 100) * pageW, (coverTitlePoint.y / 100) * pageH, { align: "center", baseline: "middle" });

      const baseDate = posts[0]?.posting_date ? parseISO(posts[0].posting_date) : new Date();
      doc.setTextColor(subR, subG, subB);
      setFont(doc, "normal");
      doc.setFontSize(Math.max(10, sx(form.subtitle_font_size * 2)));
      doc.text(
        `Cronograma de Conteúdo — ${format(baseDate, "MMMM yyyy", { locale: ptBR })}`,
        (coverSubtitlePoint.x / 100) * pageW,
        (coverSubtitlePoint.y / 100) * pageH,
        { align: "center", baseline: "middle" }
      );

      doc.setFillColor(accR, accG, accB);
      doc.roundedRect(pageW / 2 - sx(100), (coverSubtitlePoint.y / 100) * pageH + sy(32), sx(200), sy(8), sy(4), sy(4), "F");

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
        doc.text(toPdfText(form.agency_name, ""), pageW / 2, footerY, { align: "center" });
      }
    }

    if (block === "cards" || block === "carousel") {
      for (let i = 0; i < posts.length; i += 1) {
        const post = posts[i];
        const isCarousel = post.post_type === "carrossel" && (post.all_attachment_urls?.length ?? 0) > 1;

        if (block === "cards" && isCarousel) continue;
        if (block === "carousel" && !isCarousel) continue;

        const [titleR, titleG, titleB] = parseHex(form.title_color, [255, 255, 255]);
        const [subR, subG, subB] = parseHex(form.subtitle_color, [170, 170, 170]);
        const [accR, accG, accB] = parseHex(form.accent_color, [124, 92, 255]);
        const postTypeLabel = POST_TYPE_LABELS[post.post_type ?? "post"] ?? "Post";

        const contentW = pageW - margin * 2;
        const contentH = pageH - margin * 2;
        const gap = sx(40);
        const cornerRadius = sx(20);

        if (isCarousel) {
          const maxCols = Math.max(1, form.carousel_cols ?? 4);
          const maxRows = Math.max(1, form.carousel_rows ?? 2);
          const perPage = maxCols * maxRows;
          const imgGap = sx(12);
          const imgHeightPct = (form.carousel_image_height_pct ?? 65) / 100;

          const fallbackCarouselImage = getPostImage(post);
          const baseCarouselImages = (post.all_attachment_urls ?? []).filter((url): url is string => Boolean(url));
          const carouselImages = baseCarouselImages.length
            ? baseCarouselImages
            : fallbackCarouselImage
              ? [fallbackCarouselImage]
              : [];

          const chunks = chunkArray(carouselImages, perPage);
          const pages = chunks.length ? chunks : [[]];

          for (let chunkIndex = 0; chunkIndex < pages.length; chunkIndex += 1) {
            ensurePage();
            drawBg(doc, pageW, pageH, form);

            const pageImages = pages[chunkIndex];
            const gridH = contentH * imgHeightPct;
            const infoH = contentH - gridH - sy(20);
            const gridY = margin;

            const fallbackCarouselInfoPoint: LayoutPoint = {
              x: 50,
              y: ((margin + gridH + sy(20) + infoH / 2) / pageH) * 100,
            };
            const carouselInfoPoint = getLayoutPoint(form.layout_overrides, "carousel_info", fallbackCarouselInfoPoint);
            const defaultCarouselCenterX = (fallbackCarouselInfoPoint.x / 100) * pageW;
            const defaultCarouselCenterY = (fallbackCarouselInfoPoint.y / 100) * pageH;
            const carouselCenterX = (carouselInfoPoint.x / 100) * pageW;
            const carouselCenterY = (carouselInfoPoint.y / 100) * pageH;
            const carouselShiftX = carouselCenterX - defaultCarouselCenterX;
            const carouselShiftY = carouselCenterY - defaultCarouselCenterY;
            const infoX = margin + carouselShiftX;
            const infoY = margin + gridH + sy(20) + carouselShiftY;

            const frames = buildAdaptiveCarouselGridFrames({
              itemCount: pageImages.length,
              maxCols,
              maxRows,
              x: margin,
              y: gridY,
              width: contentW,
              height: gridH,
              gap: imgGap,
            });

            if (!frames.length) {
              doc.setFillColor(26, 29, 39);
              const emptySize = Math.min(contentW, gridH);
              const emptyX = margin + (contentW - emptySize) / 2;
              const emptyY = gridY + (gridH - emptySize) / 2;
              doc.roundedRect(emptyX, emptyY, emptySize, emptySize, cornerRadius, cornerRadius, "F");
            }

            for (const frame of frames) {
              doc.setFillColor(26, 29, 39);
              doc.roundedRect(frame.x, frame.y, frame.size, frame.size, cornerRadius, cornerRadius, "F");

              const imageUrl = pageImages[frame.index];
              if (!imageUrl) continue;

              const rawAsset = await getCachedImage(imageUrl);
              if (!rawAsset) continue;

              const fittedPng = await renderFittedImage(rawAsset.dataUrl, frame.size, frame.size, cornerRadius, {
                fitMode: "contain",
                backgroundMode: "solid",
              });

              if (fittedPng) {
                addPdfImage(doc, { dataUrl: fittedPng, format: "PNG" }, frame.x, frame.y, frame.size, frame.size);
              }
            }

            const cTitleFontSize = form.carousel_title_font_size ?? form.card_font_size ?? 14;
            const cCaptionFontSize = form.carousel_caption_font_size ?? form.card_caption_font_size ?? 11;
            const cDateFontSize = form.carousel_date_font_size ?? form.card_date_font_size ?? 12;

            const leftColW = contentW * 0.22;
            const centerColW = contentW * 0.48;
            const rightColW = contentW - leftColW - centerColW;

            const infoPaddingX = sx(8);
            const infoPaddingY = sy(8);
            const leftX = infoX + infoPaddingX;
            const centerX = infoX + leftColW + infoPaddingX;
            const rightX = infoX + leftColW + centerColW;
            const infoTop = infoY + infoPaddingY;
            const infoBottom = infoY + infoH - infoPaddingY;

            const postHeader = pages.length > 1
              ? `Post ${i + 1} • Página ${chunkIndex + 1}/${pages.length}`
              : `Post ${i + 1}`;

            setFont(doc, "bold");
            doc.setTextColor(titleR, titleG, titleB);
            doc.setFontSize(Math.max(10, sx(cTitleFontSize * 2.8)));
            doc.text(postHeader, leftX, infoTop + sy(34), { baseline: "middle" });

            setFont(doc, "bold");
            doc.setFontSize(sx(15));
            doc.setTextColor(accR, accG, accB);
            doc.text(postTypeLabel, leftX, infoTop + sy(68), { baseline: "middle" });

            const captionLabelY = infoTop + sy(2);
            const captionTextY = captionLabelY + sy(22);
            const captionText = toPdfText(post.caption, "Sem legenda");

            const formattedDate = formatPostingDate(post.posting_date);
            const dateText = `Data: ${formattedDate}`;
            const showTime = Boolean(form.show_time_on_card && post.posting_time);
            const timeText = showTime ? `Horário: ${toPdfText(post.posting_time, "—")}` : null;

            setFont(doc, "bold");
            doc.setFontSize(Math.max(10, sx(cDateFontSize * 1.8)));
            const badgeH = sy(48);
            const badgeGap = sy(10);
            const rightInnerW = Math.max(sx(120), rightColW - infoPaddingX);
            const dateBadgeW = Math.min(rightInnerW, Math.max(sx(150), doc.getTextWidth(dateText) + sx(32)));
            const timeBadgeW = showTime && timeText
              ? Math.min(rightInnerW, Math.max(sx(150), doc.getTextWidth(timeText) + sx(32)))
              : 0;
            const badgesTotalH = showTime ? badgeH * 2 + badgeGap : badgeH;
            const badgesTop = infoBottom - badgesTotalH;

            setFont(doc, "bold");
            doc.setTextColor(subR, subG, subB);
            doc.setFontSize(sx(16));
            doc.text("Legenda:", centerX, captionLabelY, { baseline: "top" });

            setFont(doc, "normal");
            doc.setTextColor(titleR, titleG, titleB);
            doc.setFontSize(Math.max(9, sx(cCaptionFontSize * 2)));
            const carouselCaptionW = Math.max(sx(120), centerColW - sx(22));
            const carouselCaptionH = Math.max(sy(30), badgesTop - captionTextY - sy(10));
            const carouselLines = fitTextLines(doc, captionText, carouselCaptionW, carouselCaptionH, 1.65);
            doc.setLineHeightFactor(1.65);
            doc.text(carouselLines, centerX, captionTextY, { baseline: "top", lineHeightFactor: 1.65 });
            doc.setLineHeightFactor(1.15);

            const dateBadgeX = rightX + rightInnerW - dateBadgeW;
            const dateBadgeY = badgesTop;
            const dateCenterX = dateBadgeX + dateBadgeW / 2;
            const dateCenterY = dateBadgeY + badgeH / 2;

            doc.setFillColor(accR, accG, accB);
            doc.roundedRect(dateBadgeX, dateBadgeY, dateBadgeW, badgeH, sy(10), sy(10), "F");
            doc.setTextColor(255, 255, 255);
            doc.text(dateText, dateCenterX, dateCenterY, { align: "center", baseline: "middle" });

            if (showTime && timeText) {
              const timeBadgeX = rightX + rightInnerW - timeBadgeW;
              const timeBadgeY = dateBadgeY + badgeH + badgeGap;
              const timeCenterX = timeBadgeX + timeBadgeW / 2;
              const timeCenterY = timeBadgeY + badgeH / 2;
              doc.setFillColor(accR, accG, accB);
              doc.roundedRect(timeBadgeX, timeBadgeY, timeBadgeW, badgeH, sy(10), sy(10), "F");
              doc.setTextColor(255, 255, 255);
              doc.text(timeText, timeCenterX, timeCenterY, { align: "center", baseline: "middle" });
            }
          }
        } else {
          ensurePage();
          drawBg(doc, pageW, pageH, form);

          const imageW = contentW * imgWidthPct;
          const infoW = contentW - imageW - gap;
          const imageX = margin;
          const imageY = margin;

          doc.setFillColor(26, 29, 39);
          doc.roundedRect(imageX, imageY, imageW, contentH, cornerRadius, cornerRadius, "F");

          const postImageUrl = getPostImage(post);
          let imageRendered = false;
          if (postImageUrl) {
            const rawAsset = await getCachedImage(postImageUrl);
            if (rawAsset) {
              const coverPng = await renderFittedImage(rawAsset.dataUrl, imageW, contentH, cornerRadius, {
                fitMode: "cover",
              });
              if (coverPng) {
                imageRendered = addPdfImage(doc, { dataUrl: coverPng, format: "PNG" }, imageX, imageY, imageW, contentH);
              }
            }
          }

          if (!imageRendered) {
            doc.setTextColor(110, 117, 138);
            setFont(doc, "bold");
            doc.setFontSize(sx(28));
            doc.text("Imagem do Post", imageX + imageW / 2, imageY + contentH / 2, { align: "center", baseline: "middle" });
          }

          // ── Use individual layout points for each element ──
          const cardsTitlePoint = getLayoutPoint(form.layout_overrides, "cards_title", DEFAULT_LAYOUT_POINTS.cards_title);
          const cardsCaptionPoint = getLayoutPoint(form.layout_overrides, "cards_caption", DEFAULT_LAYOUT_POINTS.cards_caption);
          const cardsDatePoint = getLayoutPoint(form.layout_overrides, "cards_date", DEFAULT_LAYOUT_POINTS.cards_date);
          const cardsTimePoint = getLayoutPoint(form.layout_overrides, "cards_time", DEFAULT_LAYOUT_POINTS.cards_time);

          const [bgR, bgG, bgB] = parseHex(form.background_color, [11, 13, 18]);
          const softAccR = Math.round(accR * 0.22 + bgR * 0.78);
          const softAccG = Math.round(accG * 0.22 + bgG * 0.78);
          const softAccB = Math.round(accB * 0.22 + bgB * 0.78);

          // Title at its own layout point
          const titlePxX = (cardsTitlePoint.x / 100) * pageW;
          const titlePxY = (cardsTitlePoint.y / 100) * pageH;

          const postTitle = `Post ${i + 1}`;
          const titleFontSize = Math.max(10, sx((form.card_font_size ?? 14) * 2.9));
          setFont(doc, "bold");
          doc.setTextColor(titleR, titleG, titleB);
          doc.setFontSize(titleFontSize);
          const postTitleW = doc.getTextWidth(postTitle);
          doc.text(postTitle, titlePxX, titlePxY, { baseline: "middle" });

          const typeFontSize = sx(18);
          setFont(doc, "bold");
          doc.setFontSize(typeFontSize);
          const typeTextW = doc.getTextWidth(postTypeLabel);
          const typePadX = sx(16);
          const typeBadgeW = typeTextW + typePadX * 2;
          const typeBadgeH = sy(38);
          const titleGap = sx(12);

          const typeBadgeX = titlePxX + postTitleW + titleGap;
          const typeBadgeY = titlePxY - typeBadgeH / 2;
          doc.setFillColor(softAccR, softAccG, softAccB);
          doc.roundedRect(typeBadgeX, typeBadgeY, typeBadgeW, typeBadgeH, sy(18), sy(18), "F");

          setFont(doc, "bold");
          doc.setTextColor(accR, accG, accB);
          doc.setFontSize(typeFontSize);
          doc.text(postTypeLabel, typeBadgeX + typeBadgeW / 2, titlePxY, { align: "center", baseline: "middle" });

          // Caption at its own layout point
          const captionPxX = (cardsCaptionPoint.x / 100) * pageW;
          const captionPxY = (cardsCaptionPoint.y / 100) * pageH;
          const captionText = toPdfText(post.caption, "Sem legenda");
          const captionMaxW = Math.max(sx(120), contentW * 0.45);

          setFont(doc, "bold");
          doc.setTextColor(subR, subG, subB);
          doc.setFontSize(sx(18));
          doc.text("Legenda:", captionPxX, captionPxY - sy(16), { baseline: "top" });

          setFont(doc, "normal");
          doc.setTextColor(titleR, titleG, titleB);
          doc.setFontSize(Math.max(9, sx((form.card_caption_font_size ?? 11) * 2)));

          // Calculate max caption height: from caption point to date point
          const datePxY = (cardsDatePoint.y / 100) * pageH;
          const captionMaxH = Math.max(sy(36), datePxY - captionPxY - sy(30));
          const wrappedCaption = fitTextLines(doc, captionText, captionMaxW, captionMaxH, 1.65);
          doc.setLineHeightFactor(1.65);
          doc.text(wrappedCaption, captionPxX, captionPxY + sy(10), { baseline: "top", lineHeightFactor: 1.65 });
          doc.setLineHeightFactor(1.15);

          // Date badge at its own layout point
          const formattedDate = formatPostingDate(post.posting_date);
          const dateText = `Data: ${formattedDate}`;
          const showTime = Boolean(form.show_time_on_card && post.posting_time);
          const timeText = showTime ? `Horário: ${toPdfText(post.posting_time, "—")}` : null;

          setFont(doc, "bold");
          doc.setFontSize(Math.max(10, sx((form.card_date_font_size ?? 12) * 1.8)));
          const badgeH = sy(48);
          const maxBadgeW = Math.max(sx(150), contentW * 0.35);
          const dateBadgeW = Math.min(maxBadgeW, Math.max(sx(150), doc.getTextWidth(dateText) + sx(34)));

          const dateBadgeCX = (cardsDatePoint.x / 100) * pageW;
          const dateBadgeCY = (cardsDatePoint.y / 100) * pageH;
          const dateBadgeX = dateBadgeCX - dateBadgeW / 2;
          const dateBadgeY = dateBadgeCY - badgeH / 2;

          doc.setFillColor(accR, accG, accB);
          doc.roundedRect(dateBadgeX, dateBadgeY, dateBadgeW, badgeH, sy(10), sy(10), "F");
          doc.setTextColor(255, 255, 255);
          doc.text(dateText, dateBadgeCX, dateBadgeCY, { align: "center", baseline: "middle" });

          // Time badge at its own layout point
          if (showTime && timeText) {
            const timeBadgeW = Math.min(maxBadgeW, Math.max(sx(150), doc.getTextWidth(timeText) + sx(34)));
            const timeBadgeCX = (cardsTimePoint.x / 100) * pageW;
            const timeBadgeCY = (cardsTimePoint.y / 100) * pageH;
            const timeBadgeX = timeBadgeCX - timeBadgeW / 2;
            const timeBadgeY = timeBadgeCY - badgeH / 2;
            doc.setFillColor(accR, accG, accB);
            doc.roundedRect(timeBadgeX, timeBadgeY, timeBadgeW, badgeH, sy(10), sy(10), "F");
            doc.setTextColor(255, 255, 255);
            doc.text(timeText, timeBadgeCX, timeBadgeCY, { align: "center", baseline: "middle" });
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

      const footerGroupPoint = getLayoutPoint(form.layout_overrides, "footer_group", DEFAULT_LAYOUT_POINTS.footer_group);
      const footerCenterX = (footerGroupPoint.x / 100) * pageW;
      const footerCenterY = (footerGroupPoint.y / 100) * pageH;
      const footerDx = footerCenterX - pageW / 2;
      const footerDy = footerCenterY - pageH / 2;

      const agencyLogo = await getCachedImage(form.agency_logo_url);
      if (agencyLogo) {
        const logoW = sx(210);
        const logoH = sy(110);
        addPdfImage(doc, agencyLogo, pageW / 2 - logoW / 2 + footerDx, pageH / 2 - sy(190) + footerDy, logoW, logoH);
      }

      setFont(doc, "bold");
      doc.setTextColor(titleR, titleG, titleB);
      doc.setFontSize(Math.max(12, sx((form.footer_title_font_size ?? 32) * 1.25)));
      doc.text(toPdfText(form.agency_name, "Nome da Agência"), pageW / 2 + footerDx, pageH / 2 - sy(20) + footerDy, { align: "center" });

      doc.setDrawColor(accR, accG, accB);
      doc.setLineWidth(2);
      doc.line(
        pageW / 2 - sx(160) + footerDx,
        pageH / 2 + sy(5) + footerDy,
        pageW / 2 + sx(160) + footerDx,
        pageH / 2 + sy(5) + footerDy,
      );

      doc.setTextColor(subR, subG, subB);
      setFont(doc, "normal");
      doc.setFontSize(Math.max(10, sx((form.footer_subtitle_font_size ?? 18) * 1.5)));
      doc.text(toPdfText(form.footer_text, "Cronograma de Conteúdo"), pageW / 2 + footerDx, pageH / 2 + sy(50) + footerDy, { align: "center" });

      doc.setTextColor(subR, subG, subB);
      doc.setFontSize(Math.max(9, sx((form.footer_contact_font_size ?? 11) * 1.6)));
      doc.text(toPdfText(form.footer_contact, "@agencia • contato@agencia.com"), pageW / 2 + footerDx, pageH / 2 + sy(95) + footerDy, { align: "center" });
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
