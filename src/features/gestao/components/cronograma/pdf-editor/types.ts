export interface LayoutPoint {
  x: number;
  y: number;
}

export interface PdfSettings {
  id: string;
  background_color: string;
  background_image_url: string | null;
  cover_logo_url: string | null;
  title_font_size: number;
  title_color: string;
  subtitle_font_size: number;
  subtitle_color: string;
  card_proportion: string;
  card_font_size: number;
  card_date_font_size: number;
  card_caption_font_size: number;
  show_caption_on_card: boolean;
  show_time_on_card: boolean;
  accent_color: string;
  blocks_order: string[];
  blocks_enabled: Record<string, boolean>;
  layout_overrides: Record<string, LayoutPoint>;
  agenda_layout: string;
  agency_logo_url: string | null;
  agency_name: string;
  footer_text: string;
  footer_contact: string;
  margin_size: number;
  footer_title_font_size: number;
  footer_subtitle_font_size: number;
  footer_contact_font_size: number;
  card_image_width_pct: number;
  carousel_cols: number;
  carousel_rows: number;
  carousel_title_font_size: number;
  carousel_caption_font_size: number;
  carousel_date_font_size: number;
  carousel_image_height_pct: number;
}

export type BlockId = "cover" | "cards" | "carousel" | "footer";

export const ALL_BLOCKS: BlockId[] = ["cover", "cards", "carousel", "footer"];

export const BLOCK_META: Record<BlockId, { label: string; description: string; icon: string }> = {
  cover: { label: "Capa", icon: "image", description: "Logo, título, mês e imagem de fundo" },
  cards: { label: "Posts", icon: "credit-card", description: "Cada postagem em página individual" },
  carousel: { label: "Carrossel", icon: "layers", description: "Grade de imagens para carrosséis" },
  footer: { label: "Rodapé", icon: "file-text", description: "Logo da agência, contato e redes" },
};

export const DEFAULT_LAYOUT_POINTS: Record<string, LayoutPoint> = {
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

export const PDF_W = 1684;
export const PDF_H = 1190;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getLayoutPoint(layout: unknown, key: string, fallback: LayoutPoint): LayoutPoint {
  if (!layout || typeof layout !== "object") return fallback;
  const raw = (layout as Record<string, unknown>)[key];
  if (!raw || typeof raw !== "object") return fallback;
  const x = Number((raw as any).x);
  const y = Number((raw as any).y);
  if (Number.isNaN(x) || Number.isNaN(y)) return fallback;
  return { x, y };
}

export function startDrag(
  e: React.PointerEvent<HTMLElement>,
  container: HTMLElement | null,
  onPointChange: (point: LayoutPoint) => void,
) {
  if (!container) return;
  e.preventDefault();
  e.stopPropagation();

  const updateFromClient = (clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 4, 96);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 4, 96);
    onPointChange({ x, y });
  };

  updateFromClient(e.clientX, e.clientY);

  const handleMove = (event: PointerEvent) => updateFromClient(event.clientX, event.clientY);
  const cleanup = () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", cleanup);
    window.removeEventListener("pointercancel", cleanup);
  };

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", cleanup);
  window.addEventListener("pointercancel", cleanup);
}

export const LAYOUT_KEYS_BY_BLOCK: Record<BlockId, string[]> = {
  cover: ["cover_title", "cover_subtitle"],
  cards: ["cards_info", "cards_title", "cards_caption", "cards_date", "cards_time"],
  carousel: ["carousel_info", "carousel_title", "carousel_caption", "carousel_date", "carousel_time"],
  footer: ["footer_group"],
};
