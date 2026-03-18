import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Palette,
  Save,
  Upload,
  GripVertical,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  FileText,
  Image,
  CreditCard,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sb = supabase as any;

interface LayoutPoint {
  x: number;
  y: number;
}

interface PdfSettings {
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

type BlockId = "cover" | "cards" | "carousel" | "footer";

const BLOCK_META: Record<BlockId, { label: string; icon: React.ReactNode; description: string }> = {
  cover: { label: "Capa", icon: <Image className="h-4 w-4" />, description: "Logo, título, mês e imagem de fundo" },
  cards: { label: "Páginas de Posts", icon: <CreditCard className="h-4 w-4" />, description: "Cada postagem em página individual" },
  carousel: { label: "Carrossel", icon: <Layers className="h-4 w-4" />, description: "Layout de grade para posts carrossel" },
  footer: { label: "Rodapé", icon: <FileText className="h-4 w-4" />, description: "Logo da agência, contato e redes" },
};

const DEFAULT_LAYOUT_POINTS: Record<string, LayoutPoint> = {
  cover_title: { x: 50, y: 45 },
  cover_subtitle: { x: 50, y: 53 },
  cards_info: { x: 73, y: 50 },
  carousel_info: { x: 50, y: 83 },
  footer_group: { x: 50, y: 50 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function startDrag(
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

function usePdfSettings() {
  return useQuery<PdfSettings>({
    queryKey: ["pm_pdf_settings"],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_pdf_settings").select("*").limit(1).single();
      if (error) throw error;
      return {
        ...data,
        blocks_order: data.blocks_order ?? ["cover", "cards", "carousel", "footer"],
        blocks_enabled: data.blocks_enabled ?? { cover: true, cards: true, carousel: true, footer: true },
        layout_overrides: data.layout_overrides ?? {},
        footer_title_font_size: data.footer_title_font_size ?? 32,
        footer_subtitle_font_size: data.footer_subtitle_font_size ?? 18,
        footer_contact_font_size: data.footer_contact_font_size ?? 11,
        card_image_width_pct: data.card_image_width_pct ?? 45,
        carousel_cols: data.carousel_cols ?? 4,
        carousel_rows: data.carousel_rows ?? 2,
        carousel_title_font_size: data.carousel_title_font_size ?? 14,
        carousel_caption_font_size: data.carousel_caption_font_size ?? 11,
        carousel_date_font_size: data.carousel_date_font_size ?? 12,
        carousel_image_height_pct: data.carousel_image_height_pct ?? 65,
      };
    },
  });
}

function useUpdatePdfSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<PdfSettings> & { id: string }) => {
      const { id, ...updates } = settings;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await sb
        .from("pm_pdf_settings")
        .update({ ...updates, updated_by: user?.id, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_pdf_settings"] });
      toast.success("Layout salvo!");
    },
  });
}

/* A4 Landscape dimensions (ratio 1.414:1) */
const PDF_W = 1684;
const PDF_H = 1190;

/* ─── Preview: Cover ─── */
function PreviewCover({
  form,
  editable,
  onMoveNode,
}: {
  form: Partial<PdfSettings>;
  editable: boolean;
  onMoveNode: (key: string, point: LayoutPoint) => void;
}) {
  const accent = form.accent_color ?? "#7C5CFF";
  const bg = form.background_color ?? "#0B0D12";
  const margin = form.margin_size ?? 60;
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const titlePoint = getLayoutPoint(form.layout_overrides, "cover_title", DEFAULT_LAYOUT_POINTS.cover_title);
  const subtitlePoint = getLayoutPoint(form.layout_overrides, "cover_subtitle", DEFAULT_LAYOUT_POINTS.cover_subtitle);

  return (
    <div
      ref={setContainerEl}
      className="relative overflow-hidden"
      style={{
        width: PDF_W,
        height: PDF_H,
        backgroundColor: bg,
        backgroundImage: form.background_image_url ? `url(${form.background_image_url})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {form.background_image_url && <div className="absolute inset-0 bg-black/40" />}

      {form.cover_logo_url && (
        <img
          src={form.cover_logo_url}
          alt="Logo"
          className="absolute z-10 object-contain"
          style={{ height: 120, left: "50%", top: margin + 30, transform: "translateX(-50%)" }}
        />
      )}

      <div
        style={{
          position: "absolute",
          left: `${titlePoint.x}%`,
          top: `${titlePoint.y}%`,
          transform: "translate(-50%, -50%)",
          fontSize: (form.title_font_size ?? 32) * 2.5,
          color: form.title_color ?? "#FFFFFF",
        }}
        className={cn(
          "z-10 font-bold leading-tight text-center px-4 rounded-xl",
          editable && "cursor-move ring-1 ring-primary/50 bg-background/20"
        )}
        onPointerDown={(e) => editable && startDrag(e, containerEl, (point) => onMoveNode("cover_title", point))}
      >
        Nome do Cliente
      </div>

      <div
        style={{
          position: "absolute",
          left: `${subtitlePoint.x}%`,
          top: `${subtitlePoint.y}%`,
          transform: "translate(-50%, -50%)",
          fontSize: (form.subtitle_font_size ?? 18) * 2,
          color: form.subtitle_color ?? "#AAAAAA",
        }}
        className={cn(
          "z-10 text-center px-4 rounded-xl",
          editable && "cursor-move ring-1 ring-primary/40 bg-background/15"
        )}
        onPointerDown={(e) => editable && startDrag(e, containerEl, (point) => onMoveNode("cover_subtitle", point))}
      >
        Cronograma de Conteúdo — Março 2026
      </div>

      <div
        className="absolute z-10 h-2 w-48 rounded-full"
        style={{ backgroundColor: accent, left: "50%", top: `${subtitlePoint.y + 4.3}%`, transform: "translateX(-50%)" }}
      />

      {(form.agency_name || form.agency_logo_url) && (
        <div className="absolute bottom-12 left-1/2 z-10 -translate-x-1/2 flex items-center gap-4">
          {form.agency_logo_url && <img src={form.agency_logo_url} alt="Agency" className="h-[48px] object-contain" />}
          {form.agency_name && <div style={{ fontSize: 24, color: form.subtitle_color ?? "#AAA" }}>{form.agency_name}</div>}
        </div>
      )}
    </div>
  );
}

/* ─── Preview: Post Page (standard) ─── */
function PreviewPostPage({
  form,
  index,
  editable,
  onMoveNode,
  onResizeImage,
}: {
  form: Partial<PdfSettings>;
  index: number;
  editable: boolean;
  onMoveNode: (key: string, point: LayoutPoint) => void;
  onResizeImage: (delta: number) => void;
}) {
  const bg = form.background_color ?? "#0B0D12";
  const accent = form.accent_color ?? "#7C5CFF";
  const titleColor = form.title_color ?? "#FFFFFF";
  const subtitleColor = form.subtitle_color ?? "#AAAAAA";
  const margin = form.margin_size ?? 60;
  const imgPct = form.card_image_width_pct ?? 45;

  const postTypes = ["Feed", "Reels", "Story", "Carrossel"];
  const postType = postTypes[index % postTypes.length];
  const day = 3 + index * 3;
  const caption =
    "Essa é a legenda completa da postagem. O texto será exibido com quebra automática de linha para preencher o espaço disponível no lado direito da página.";

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [imageSelected, setImageSelected] = useState(false);

  const contentW = PDF_W - margin * 2;
  const contentH = PDF_H - margin * 2;
  const imageW = (contentW * imgPct) / 100;
  const infoW = contentW - imageW - 40;

  const fallbackInfoPoint: LayoutPoint = {
    x: ((margin + imageW + 40 + infoW / 2) / PDF_W) * 100,
    y: 50,
  };
  const infoPoint = getLayoutPoint(form.layout_overrides, "cards_info", fallbackInfoPoint);

  return (
    <div ref={setContainerEl} className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg }}>
      <div className="absolute" style={{ left: margin, top: margin, width: contentW, height: contentH }}>
        {/* Left: Image mockup */}
        <div
          className={cn(
            "absolute rounded-3xl overflow-hidden shrink-0 flex items-center justify-center",
            editable && "cursor-pointer ring-2 ring-transparent hover:ring-primary/60",
            imageSelected && "ring-primary"
          )}
          style={{
            width: imageW,
            height: contentH,
            background: "linear-gradient(140deg, #131828 0%, #283149 48%, #11141f 100%)",
            boxShadow: "0 20px 60px -15px rgba(0,0,0,0.4)",
          }}
          onClick={() => editable && setImageSelected(true)}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative flex flex-col items-center gap-4 text-center" style={{ color: "#d9deef" }}>
            <LayoutGrid className="h-20 w-20" />
            <span style={{ fontSize: 20 }}>Imagem do Post</span>
            <span className="text-sm opacity-70">Sem cortes • formato original</span>
          </div>

          {editable && imageSelected && (
            <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-primary/40 bg-background/80 p-1.5">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onResizeImage(-2);
                }}
              >
                −
              </Button>
              <span className="text-[10px] font-medium px-1">{imgPct}%</span>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onResizeImage(2);
                }}
              >
                +
              </Button>
            </div>
          )}
        </div>

        {/* Right: Info */}
        <div
          className={cn("absolute flex flex-col justify-between overflow-hidden", editable && "cursor-move")}
          style={{
            left: `${infoPoint.x}%`,
            top: `${infoPoint.y}%`,
            transform: "translate(-50%, -50%)",
            width: infoW,
            height: contentH,
          }}
          onPointerDown={(e) => editable && startDrag(e, containerEl, (point) => onMoveNode("cards_info", point))}
        >
          <div
            className={cn(
              "h-full rounded-2xl px-3 py-2",
              editable && "ring-1 ring-primary/40 bg-background/15"
            )}
            style={{ overflow: "hidden" }}
          >
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <div style={{ fontSize: (form.card_font_size ?? 14) * 3, color: titleColor }} className="font-bold leading-tight">
                Post {index + 1}
              </div>
              <div
                className="rounded-full px-5 py-2 font-semibold shrink-0"
                style={{ fontSize: 20, backgroundColor: accent + "22", color: accent }}
              >
                {postType}
              </div>
            </div>
            <div className="mb-6">
              <div style={{ fontSize: 20, color: subtitleColor }} className="uppercase tracking-widest font-semibold mb-3">
                Legenda:
              </div>
              <div
                style={{
                  fontSize: (form.card_caption_font_size ?? 11) * 2,
                  color: titleColor,
                  lineHeight: 1.7,
                  wordBreak: "break-word",
                  overflowWrap: "break-word",
                }}
              >
                {caption}
              </div>
            </div>

            <div className="flex items-center gap-6 pt-4" style={{ borderTop: `2px solid ${accent}33` }}>
              <div>
                <div style={{ fontSize: 16, color: subtitleColor }} className="uppercase tracking-widest font-semibold mb-1">
                  Data
                </div>
                <div style={{ fontSize: (form.card_date_font_size ?? 12) * 2.4, color: titleColor }} className="font-bold">
                  {String(day).padStart(2, "0")}/03/2026
                </div>
              </div>
              {(form.show_time_on_card ?? true) && (
                <div>
                  <div style={{ fontSize: 16, color: subtitleColor }} className="uppercase tracking-widest font-semibold mb-1">
                    Horário
                  </div>
                  <div style={{ fontSize: (form.card_date_font_size ?? 12) * 2.4, color: titleColor }} className="font-bold">
                    18:00
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Preview: Carousel Page (grid top, info bottom) ─── */
function PreviewCarouselPage({
  form,
  editable,
  onMoveNode,
}: {
  form: Partial<PdfSettings>;
  editable: boolean;
  onMoveNode: (key: string, point: LayoutPoint) => void;
}) {
  const bg = form.background_color ?? "#0B0D12";
  const accent = form.accent_color ?? "#7C5CFF";
  const titleColor = form.title_color ?? "#FFFFFF";
  const margin = form.margin_size ?? 60;
  const COLS = form.carousel_cols ?? 4;
  const ROWS = form.carousel_rows ?? 2;
  const imgGap = 12;
  const contentW = PDF_W - margin * 2;
  const contentH = PDF_H - margin * 2;
  const imgHeightPct = (form.carousel_image_height_pct ?? 65) / 100;
  const gridH = contentH * imgHeightPct;
  const infoH = contentH - gridH - 20;

  const gridRowH = (gridH - imgGap * (ROWS - 1)) / ROWS;
  const totalCells = COLS * ROWS;

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const fallbackInfoPoint: LayoutPoint = {
    x: 50,
    y: ((margin + gridH + 20 + infoH / 2) / PDF_H) * 100,
  };
  const infoPoint = getLayoutPoint(form.layout_overrides, "carousel_info", fallbackInfoPoint);

  const mockBackgrounds = [
    "linear-gradient(140deg, #2a3148 0%, #556fa7 60%, #1b2135 100%)",
    "linear-gradient(140deg, #322515 0%, #aa6d2e 58%, #251b10 100%)",
    "linear-gradient(140deg, #183235 0%, #2f9c8b 56%, #132427 100%)",
    "linear-gradient(140deg, #352039 0%, #9652a2 55%, #281a2b 100%)",
  ];

  return (
    <div ref={setContainerEl} className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg }}>
      <div style={{ padding: margin, height: PDF_H }}>
        {/* Top: Image grid */}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: imgGap, height: gridH }}>
          {Array.from({ length: totalCells }, (_, n) => (
            <div
              key={n}
              className="relative rounded-3xl overflow-hidden"
              style={{
                backgroundImage: mockBackgrounds[n % mockBackgrounds.length],
                backgroundSize: "cover",
                backgroundPosition: "center",
                height: gridRowH,
              }}
            >
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute inset-0 flex items-end justify-center pb-4 text-white/90 text-sm font-semibold">
                Página {n + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom: Info bar */}
        <div
          className={cn("absolute", editable && "cursor-move")}
          style={{
            left: `${infoPoint.x}%`,
            top: `${infoPoint.y}%`,
            transform: "translate(-50%, -50%)",
            width: contentW,
            maxWidth: contentW,
            minHeight: infoH,
          }}
          onPointerDown={(e) => editable && startDrag(e, containerEl, (point) => onMoveNode("carousel_info", point))}
        >
          <div
            className={cn(
              "flex items-start rounded-2xl px-3 py-2",
              editable && "ring-1 ring-primary/40 bg-background/15"
            )}
            style={{ minHeight: infoH }}
          >
            <div style={{ width: "20%" }}>
              <div style={{ fontSize: (form.carousel_title_font_size ?? 14) * 3, color: titleColor }} className="font-bold leading-tight">
                Post 1
              </div>
              <div style={{ fontSize: 18, color: accent }} className="mt-1">
                Carrossel
              </div>
            </div>

            <div style={{ width: "50%", fontSize: (form.carousel_caption_font_size ?? 11) * 2, color: titleColor, lineHeight: 1.7 }}>
              Essa é a legenda completa da postagem do carrossel com quebra automática.
            </div>

            <div style={{ width: "30%", display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              <div className="rounded-xl px-6 py-3 font-bold text-white" style={{ backgroundColor: accent, fontSize: (form.carousel_date_font_size ?? 12) * 1.8 }}>
                Data: 05/03/2026
              </div>
              {(form.show_time_on_card ?? true) && (
                <div className="rounded-xl px-6 py-3 font-bold text-white" style={{ backgroundColor: accent, fontSize: (form.carousel_date_font_size ?? 12) * 1.8 }}>
                  Horário: 12h00
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Preview: Footer page ─── */
function PreviewFooter({
  form,
  editable,
  onMoveNode,
}: {
  form: Partial<PdfSettings>;
  editable: boolean;
  onMoveNode: (key: string, point: LayoutPoint) => void;
}) {
  const bg = form.background_color ?? "#0B0D12";
  const accent = form.accent_color ?? "#7C5CFF";
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const groupPoint = getLayoutPoint(form.layout_overrides, "footer_group", DEFAULT_LAYOUT_POINTS.footer_group);

  return (
    <div ref={setContainerEl} className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg }}>
      <div
        className={cn("absolute flex items-center justify-center gap-12", editable && "cursor-move")}
        style={{ left: `${groupPoint.x}%`, top: `${groupPoint.y}%`, transform: "translate(-50%, -50%)" }}
        onPointerDown={(e) => editable && startDrag(e, containerEl, (point) => onMoveNode("footer_group", point))}
      >
        <div className={cn("flex items-center gap-12 rounded-2xl px-4 py-3", editable && "ring-1 ring-primary/40 bg-background/15")}>
          {form.agency_logo_url && <img src={form.agency_logo_url} alt="Logo" className="h-[110px] object-contain" />}
          <div className="h-20 w-[2px] rounded-full" style={{ backgroundColor: accent + "66" }} />
          <div>
            <div style={{ fontSize: (form.footer_title_font_size ?? 32) * 1.3, color: form.title_color ?? "#FFF" }} className="font-bold">
              {form.agency_name || "Nome da Agência"}
            </div>
            <div style={{ fontSize: (form.footer_subtitle_font_size ?? 18) * 1.5, color: form.subtitle_color ?? "#AAA" }} className="mt-2">
              {form.footer_text || "Cronograma de Conteúdo"}
            </div>
            <div style={{ fontSize: (form.footer_contact_font_size ?? 11) * 1.6, color: form.subtitle_color ?? "#AAA" }} className="mt-2">
              {form.footer_contact || "@agencia • contato@agencia.com"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Block Reorder Item ─── */
function BlockItem({
  blockId,
  enabled,
  onToggle,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  isSelected,
  onClick,
}: {
  blockId: BlockId;
  enabled: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const meta = BLOCK_META[blockId];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-all",
        isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/30 hover:border-border/60",
        !enabled && "opacity-50"
      )}
      onClick={onClick}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="shrink-0 text-primary">{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{meta.label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{meta.description}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst}>
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast}>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {enabled ? <Eye className="h-3.5 w-3.5 text-success" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
        </Button>
      </div>
    </div>
  );
}

/* ─── Settings Panels ─── */

function CoverSettings({ form, setForm, uploading, handleUploadBg, handleUploadLogo }: any) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-[10px] text-muted-foreground">Margem (px)</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.margin_size ?? 60]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, margin_size: v }))} min={20} max={120} step={5} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.margin_size ?? 60}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Título da capa — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.title_font_size ?? 32]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, title_font_size: v }))} min={18} max={54} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.title_font_size ?? 32}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Subtítulo da capa — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.subtitle_font_size ?? 18]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, subtitle_font_size: v }))} min={10} max={34} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.subtitle_font_size ?? 18}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] text-muted-foreground">Cor de fundo</Label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={form.background_color ?? "#0B0D12"} onChange={e => setForm((p: any) => ({ ...p, background_color: e.target.value }))} className="h-8 w-8 rounded-lg border border-border/30 cursor-pointer" />
            <Input value={form.background_color ?? ""} onChange={e => setForm((p: any) => ({ ...p, background_color: e.target.value }))} className="h-8 text-xs flex-1" />
          </div>
        </div>
        <div>
          <Label className="text-[10px] text-muted-foreground">Cor de destaque</Label>
          <div className="flex items-center gap-2 mt-1">
            <input type="color" value={form.accent_color ?? "#7C5CFF"} onChange={e => setForm((p: any) => ({ ...p, accent_color: e.target.value }))} className="h-8 w-8 rounded-lg border border-border/30 cursor-pointer" />
            <Input value={form.accent_color ?? ""} onChange={e => setForm((p: any) => ({ ...p, accent_color: e.target.value }))} className="h-8 text-xs flex-1" />
          </div>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Imagem de fundo</Label>
        <div className="flex items-center gap-2 mt-1">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition">
            <Upload className="h-3.5 w-3.5" />{uploading ? "Enviando..." : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadBg} disabled={uploading} />
          </label>
          {form.background_image_url && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setForm((p: any) => ({ ...p, background_image_url: null }))}>Remover</Button>}
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Logo da capa</Label>
        <div className="flex items-center gap-2 mt-1">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition">
            <Upload className="h-3.5 w-3.5" />{uploading ? "Enviando..." : "Upload logo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadLogo} disabled={uploading} />
          </label>
          {form.cover_logo_url && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setForm((p: any) => ({ ...p, cover_logo_url: null }))}>Remover</Button>}
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Cor do título</Label>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" value={form.title_color ?? "#FFFFFF"} onChange={e => setForm((p: any) => ({ ...p, title_color: e.target.value }))} className="h-7 w-7 rounded border border-border/30 cursor-pointer" />
          <Input value={form.title_color ?? ""} onChange={e => setForm((p: any) => ({ ...p, title_color: e.target.value }))} className="h-7 text-xs flex-1" />
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Cor do subtítulo</Label>
        <div className="flex items-center gap-2 mt-1">
          <input type="color" value={form.subtitle_color ?? "#AAAAAA"} onChange={e => setForm((p: any) => ({ ...p, subtitle_color: e.target.value }))} className="h-7 w-7 rounded border border-border/30 cursor-pointer" />
          <Input value={form.subtitle_color ?? ""} onChange={e => setForm((p: any) => ({ ...p, subtitle_color: e.target.value }))} className="h-7 text-xs flex-1" />
        </div>
      </div>
    </div>
  );
}

function CardsSettings({ form, setForm }: any) {
  return (
    <div className="space-y-3">
      <div className="px-2 py-1.5 rounded-lg bg-muted/30 border border-border/20">
        <span className="text-[10px] text-muted-foreground">Fonte: <strong className="text-foreground">Bricolage Grotesque</strong> (Regular + Bold)</span>
      </div>
      <div className="px-2 py-1.5 rounded-lg bg-muted/30 border border-border/20">
        <span className="text-[10px] text-muted-foreground">Dica: clique na imagem da prévia para aumentar ou diminuir o tamanho.</span>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Largura da imagem (%)</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.card_image_width_pct ?? 45]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, card_image_width_pct: v }))} min={25} max={65} step={1} className="flex-1" />
          <span className="text-xs font-mono w-10 text-right">{form.card_image_width_pct ?? 45}%</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Título — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.card_font_size ?? 14]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, card_font_size: v }))} min={10} max={24} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.card_font_size ?? 14}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Data — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.card_date_font_size ?? 12]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, card_date_font_size: v }))} min={8} max={20} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.card_date_font_size ?? 12}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Legenda — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.card_caption_font_size ?? 11]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, card_caption_font_size: v }))} min={8} max={18} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.card_caption_font_size ?? 11}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={form.show_time_on_card ?? true} onCheckedChange={v => setForm((p: any) => ({ ...p, show_time_on_card: v }))} />
        <Label className="text-xs">Mostrar horário</Label>
      </div>
    </div>
  );
}

function CarouselSettings({ form, setForm }: any) {
  return (
    <div className="space-y-3">
      <div className="px-2 py-1.5 rounded-lg bg-muted/30 border border-border/20">
        <span className="text-[10px] text-muted-foreground">Layout: grade de imagens em cima, informações embaixo.</span>
      </div>
      <div className="px-2 py-1.5 rounded-lg bg-muted/30 border border-border/20">
        <span className="text-[10px] text-muted-foreground">As imagens são exportadas sem corte com preenchimento visual no fundo.</span>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Colunas</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.carousel_cols ?? 4]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, carousel_cols: v }))} min={2} max={6} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.carousel_cols ?? 4}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Linhas</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.carousel_rows ?? 2]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, carousel_rows: v }))} min={1} max={4} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.carousel_rows ?? 2}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Altura das imagens (%)</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.carousel_image_height_pct ?? 65]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, carousel_image_height_pct: v }))} min={40} max={85} step={1} className="flex-1" />
          <span className="text-xs font-mono w-10 text-right">{form.carousel_image_height_pct ?? 65}%</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Título — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.carousel_title_font_size ?? 14]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, carousel_title_font_size: v }))} min={10} max={24} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.carousel_title_font_size ?? 14}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Legenda — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.carousel_caption_font_size ?? 11]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, carousel_caption_font_size: v }))} min={8} max={18} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.carousel_caption_font_size ?? 11}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Data — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.carousel_date_font_size ?? 12]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, carousel_date_font_size: v }))} min={8} max={20} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.carousel_date_font_size ?? 12}</span>
        </div>
      </div>
    </div>
  );
}

function FooterSettings({ form, setForm, uploading, handleUploadAgencyLogo }: any) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] text-muted-foreground">Logo da agência</Label>
        <div className="flex items-center gap-2 mt-1">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border/30 bg-muted/30 text-xs cursor-pointer hover:bg-muted/50 transition">
            <Upload className="h-3.5 w-3.5" />{uploading ? "Enviando..." : "Upload"}
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadAgencyLogo} disabled={uploading} />
          </label>
          {form.agency_logo_url && <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setForm((p: any) => ({ ...p, agency_logo_url: null }))}>Remover</Button>}
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Nome da agência</Label>
        <Input value={form.agency_name ?? ""} onChange={e => setForm((p: any) => ({ ...p, agency_name: e.target.value }))} className="h-8 text-xs mt-1" placeholder="Ex: Uau Digital" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Texto padrão</Label>
        <Input value={form.footer_text ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_text: e.target.value }))} className="h-8 text-xs mt-1" placeholder="Cronograma de Conteúdo" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Contato / Redes</Label>
        <Input value={form.footer_contact ?? ""} onChange={e => setForm((p: any) => ({ ...p, footer_contact: e.target.value }))} className="h-8 text-xs mt-1" placeholder="@agencia • contato@agencia.com" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Nome da agência — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.footer_title_font_size ?? 32]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, footer_title_font_size: v }))} min={18} max={54} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.footer_title_font_size ?? 32}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Texto padrão — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.footer_subtitle_font_size ?? 18]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, footer_subtitle_font_size: v }))} min={10} max={34} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.footer_subtitle_font_size ?? 18}</span>
        </div>
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Contato — tamanho</Label>
        <div className="flex items-center gap-2 mt-1">
          <Slider value={[form.footer_contact_font_size ?? 11]} onValueChange={([v]: number[]) => setForm((p: any) => ({ ...p, footer_contact_font_size: v }))} min={8} max={20} step={1} className="flex-1" />
          <span className="text-xs font-mono w-8 text-right">{form.footer_contact_font_size ?? 11}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Scaled Preview Wrapper ─── */
const PREVIEW_SCALE_FACTOR = 0.82;
const PREVIEW_MIN_SCALE = 0.24;
const PREVIEW_SIDE_PADDING = 12;

function ScaledPreview({ children, label, isSelected, onClick }: { children: React.ReactNode; label: string; isSelected: boolean; onClick: () => void }) {
  const [scale, setScale] = useState(1);
  const [contentH, setContentH] = useState(0);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerEl) return;
    const inner = containerEl.querySelector("[data-pdf-inner]") as HTMLElement | null;
    if (!inner) return;

    const update = () => {
      const child = inner.firstElementChild as HTMLElement | null;
      const availableW = Math.max(containerEl.clientWidth - PREVIEW_SIDE_PADDING * 2, 0);
      const fitScale = availableW / PDF_W;
      const nextScale = Math.min(1, Math.max(PREVIEW_MIN_SCALE, fitScale * PREVIEW_SCALE_FACTOR));
      setScale(nextScale);
      if (child) setContentH(child.offsetHeight * nextScale);
    };

    const ro = new ResizeObserver(update);
    ro.observe(containerEl);
    update();

    return () => ro.disconnect();
  }, [containerEl]);

  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all cursor-pointer",
        isSelected ? "border-primary shadow-lg shadow-primary/10" : "border-border/30"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/20">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div
        className="bg-muted/20 overflow-hidden px-3 py-3"
        ref={setContainerEl}
        style={{ height: contentH ? contentH + PREVIEW_SIDE_PADDING * 2 : "auto" }}
      >
        <div
          data-pdf-inner
          className="origin-top-left"
          style={{ width: PDF_W, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Editor ─── */

const LAYOUT_KEYS_BY_BLOCK: Record<BlockId, string[]> = {
  cover: ["cover_title", "cover_subtitle"],
  cards: ["cards_info"],
  carousel: ["carousel_info"],
  footer: ["footer_group"],
};

export function PdfLayoutEditor() {
  const settingsQ = usePdfSettings();
  const updateSettings = useUpdatePdfSettings();
  const [form, setForm] = useState<Partial<PdfSettings>>({});
  const [uploading, setUploading] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<BlockId>("cover");

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data);
  }, [settingsQ.data]);

  const ALL_BLOCKS: BlockId[] = ["cover", "cards", "carousel", "footer"];
  const blocksOrder = (form.blocks_order ?? ["cover", "cards", "carousel", "footer"]).filter(
    (b): b is BlockId => ALL_BLOCKS.includes(b as BlockId)
  );
  if (!blocksOrder.includes("carousel")) blocksOrder.splice(Math.max(blocksOrder.indexOf("cards") + 1, 1), 0, "carousel");
  const blocksEnabled = (form.blocks_enabled ?? { cover: true, cards: true, carousel: true, footer: true }) as Record<BlockId, boolean>;

  const handleSave = () => {
    if (!form.id) return;
    updateSettings.mutate(form as PdfSettings);
  };

  const moveBlock = useCallback((blockId: BlockId, dir: -1 | 1) => {
    setForm(prev => {
      const order = [...(prev.blocks_order ?? ["cover", "cards", "carousel", "footer"])].filter(
        (b): b is BlockId => ALL_BLOCKS.includes(b as BlockId)
      );
      const idx = order.indexOf(blockId);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= order.length) return prev;
      [order[idx], order[newIdx]] = [order[newIdx], order[idx]];
      return { ...prev, blocks_order: order };
    });
  }, []);

  const toggleBlock = useCallback((blockId: BlockId) => {
    setForm(prev => {
      const enabled = { ...(prev.blocks_enabled ?? { cover: true, cards: true, carousel: true, footer: true }) } as Record<BlockId, boolean>;
      enabled[blockId] = !enabled[blockId];
      return { ...prev, blocks_enabled: enabled };
    });
  }, []);

  const moveLayoutNode = useCallback((key: string, point: LayoutPoint) => {
    setForm(prev => ({
      ...prev,
      layout_overrides: {
        ...((prev.layout_overrides as Record<string, LayoutPoint> | undefined) ?? {}),
        [key]: point,
      },
    }));
  }, []);

  const nudgeCardImageWidth = useCallback((delta: number) => {
    setForm(prev => ({
      ...prev,
      card_image_width_pct: clamp((prev.card_image_width_pct ?? 45) + delta, 25, 65),
    }));
  }, []);

  const resetSelectedBlockLayout = useCallback(() => {
    setForm(prev => {
      const current = { ...((prev.layout_overrides as Record<string, LayoutPoint> | undefined) ?? {}) };
      for (const key of LAYOUT_KEYS_BY_BLOCK[selectedBlock]) {
        delete current[key];
      }
      return { ...prev, layout_overrides: current };
    });
    toast.success("Posição da aba resetada.");
  }, [selectedBlock]);

  const uploadFile = async (file: File, prefix: string) => {
    setUploading(true);
    try {
      const path = `pdf-layouts/${prefix}-${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("app-assets").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("app-assets").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      toast.error("Erro ao carregar imagem");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleUploadBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "bg");
    if (url) { setForm(p => ({ ...p, background_image_url: url })); toast.success("Imagem carregada!"); }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "logo");
    if (url) { setForm(p => ({ ...p, cover_logo_url: url })); toast.success("Logo carregado!"); }
  };

  const handleUploadAgencyLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, "agency-logo");
    if (url) { setForm(p => ({ ...p, agency_logo_url: url })); toast.success("Logo carregado!"); }
  };

  if (settingsQ.isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>;

  const renderBlockSettings = () => {
    switch (selectedBlock) {
      case "cover": return <CoverSettings form={form} setForm={setForm} uploading={uploading} handleUploadBg={handleUploadBg} handleUploadLogo={handleUploadLogo} />;
      case "cards": return <CardsSettings form={form} setForm={setForm} />;
      case "carousel": return <CarouselSettings form={form} setForm={setForm} />;
      case "footer": return <FooterSettings form={form} setForm={setForm} uploading={uploading} handleUploadAgencyLogo={handleUploadAgencyLogo} />;
    }
  };

  const renderPreview = (blockId: BlockId) => {
    const editable = selectedBlock === blockId;

    switch (blockId) {
      case "cover":
        return (
          <ScaledPreview key="cover" label="Capa" isSelected={editable} onClick={() => setSelectedBlock("cover")}>
            <PreviewCover form={form} editable={editable} onMoveNode={moveLayoutNode} />
          </ScaledPreview>
        );
      case "cards":
        return (
          <ScaledPreview key="cards" label="Post padrão" isSelected={editable} onClick={() => setSelectedBlock("cards")}>
            <PreviewPostPage
              form={form}
              index={0}
              editable={editable}
              onMoveNode={moveLayoutNode}
              onResizeImage={nudgeCardImageWidth}
            />
          </ScaledPreview>
        );
      case "carousel":
        return (
          <ScaledPreview key="carousel" label={`Carrossel (${form.carousel_cols ?? 4} colunas)`} isSelected={editable} onClick={() => setSelectedBlock("carousel")}>
            <PreviewCarouselPage form={form} editable={editable} onMoveNode={moveLayoutNode} />
          </ScaledPreview>
        );
      case "footer":
        return (
          <ScaledPreview key="footer" label="Rodapé" isSelected={editable} onClick={() => setSelectedBlock("footer")}>
            <PreviewFooter form={form} editable={editable} onMoveNode={moveLayoutNode} />
          </ScaledPreview>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-bold">Editor de Layout do PDF</h3>
          <p className="text-xs text-muted-foreground">Landscape A4 — arraste elementos na prévia e clique na imagem para redimensionar.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={resetSelectedBlockLayout}>
            Resetar posição da aba
          </Button>
          <Button size="sm" className="gap-1.5 rounded-xl" onClick={handleSave} disabled={updateSettings.isPending}>
            <Save className="h-3.5 w-3.5" /> Salvar Layout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Left: Block organizer + settings */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Palette className="h-4 w-4" /> Blocos do PDF</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {blocksOrder.map((blockId, i) => (
                <BlockItem
                  key={blockId}
                  blockId={blockId}
                  enabled={blocksEnabled[blockId] ?? true}
                  onToggle={() => toggleBlock(blockId)}
                  onMoveUp={() => moveBlock(blockId, -1)}
                  onMoveDown={() => moveBlock(blockId, 1)}
                  isFirst={i === 0}
                  isLast={i === blocksOrder.length - 1}
                  isSelected={selectedBlock === blockId}
                  onClick={() => setSelectedBlock(blockId)}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {BLOCK_META[selectedBlock].icon}
                {BLOCK_META[selectedBlock].label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderBlockSettings()}
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3 w-full lg:max-w-[760px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold">Pré-visualização interativa</h4>
            <span className="text-[10px] text-muted-foreground">Clique em uma aba e arraste os elementos para reposicionar.</span>
          </div>

          <div className="space-y-4">
            {blocksOrder.filter(b => blocksEnabled[b]).map(blockId => renderPreview(blockId))}
          </div>
        </div>
      </div>
    </div>
  );
}
