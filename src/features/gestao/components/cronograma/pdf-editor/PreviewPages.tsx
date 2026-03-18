import { useState, useEffect } from "react";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PdfSettings, LayoutPoint, BlockId } from "./types";
import { PDF_W, PDF_H, getLayoutPoint, DEFAULT_LAYOUT_POINTS, startDrag, clamp } from "./types";
import { buildAdaptiveCarouselGridFrames } from "../carousel-grid";

interface PreviewProps {
  form: Partial<PdfSettings>;
  editable: boolean;
  onMoveNode: (key: string, point: LayoutPoint) => void;
}

/* ─── Preview: Cover ─── */
export function PreviewCover({ form, editable, onMoveNode }: PreviewProps) {
  const accent = form.accent_color ?? "#7C5CFF";
  const bg = form.background_color ?? "#0B0D12";
  const margin = form.margin_size ?? 60;
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const titlePoint = getLayoutPoint(form.layout_overrides, "cover_title", DEFAULT_LAYOUT_POINTS.cover_title);
  const subtitlePoint = getLayoutPoint(form.layout_overrides, "cover_subtitle", DEFAULT_LAYOUT_POINTS.cover_subtitle);
  const dragCls = "cursor-move ring-1 ring-primary/50 bg-background/20";

  return (
    <div ref={setContainerEl} className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg, backgroundImage: form.background_image_url ? `url(${form.background_image_url})` : undefined, backgroundSize: "cover", backgroundPosition: "center" }}>
      {form.background_image_url && <div className="absolute inset-0 bg-black/40" />}
      {form.cover_logo_url && (
        <img src={form.cover_logo_url} alt="Logo" className="absolute z-10 object-contain" style={{ height: 120, left: "50%", top: margin + 30, transform: "translateX(-50%)" }} />
      )}
      <div
        style={{ position: "absolute", left: `${titlePoint.x}%`, top: `${titlePoint.y}%`, transform: "translate(-50%, -50%)", fontSize: (form.title_font_size ?? 32) * 2.5, color: form.title_color ?? "#FFFFFF" }}
        className={cn("z-10 font-bold leading-tight text-center px-4 rounded-xl", editable && dragCls)}
        onPointerDown={(e) => editable && startDrag(e, containerEl, (p) => onMoveNode("cover_title", p))}
      >
        Nome do Cliente
      </div>
      <div
        style={{ position: "absolute", left: `${subtitlePoint.x}%`, top: `${subtitlePoint.y}%`, transform: "translate(-50%, -50%)", fontSize: (form.subtitle_font_size ?? 18) * 2, color: form.subtitle_color ?? "#AAAAAA" }}
        className={cn("z-10 text-center px-4 rounded-xl", editable && "cursor-move ring-1 ring-primary/40 bg-background/15")}
        onPointerDown={(e) => editable && startDrag(e, containerEl, (p) => onMoveNode("cover_subtitle", p))}
      >
        Cronograma de Conteúdo — Março 2026
      </div>
      <div className="absolute z-10 h-2 w-48 rounded-full" style={{ backgroundColor: accent, left: "50%", top: `${subtitlePoint.y + 4.3}%`, transform: "translateX(-50%)" }} />
      {(form.agency_name || form.agency_logo_url) && (
        <div className="absolute bottom-12 left-1/2 z-10 -translate-x-1/2 flex items-center gap-4">
          {form.agency_logo_url && <img src={form.agency_logo_url} alt="Agency" className="h-[48px] object-contain" />}
          {form.agency_name && <div style={{ fontSize: 24, color: form.subtitle_color ?? "#AAA" }}>{form.agency_name}</div>}
        </div>
      )}
    </div>
  );
}

/* ─── Preview: Post Page ─── */
export function PreviewPostPage({ form, editable, onMoveNode, index = 0, onResizeImage }: PreviewProps & { index?: number; onResizeImage?: (delta: number) => void }) {
  const bg = form.background_color ?? "#0B0D12";
  const accent = form.accent_color ?? "#7C5CFF";
  const titleColor = form.title_color ?? "#FFFFFF";
  const subtitleColor = form.subtitle_color ?? "#AAAAAA";
  const margin = form.margin_size ?? 60;
  const imgPct = form.card_image_width_pct ?? 45;
  const postTypes = ["Feed", "Reels", "Story", "Carrossel"];
  const postType = postTypes[index % postTypes.length];
  const day = 3 + index * 3;
  const caption = "Essa é a legenda completa da postagem. O texto ocupa uma área própria, respeita largura e quebra de linha sem invadir data e horário.";

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [imageSelected, setImageSelected] = useState(false);

  const contentW = PDF_W - margin * 2;
  const contentH = PDF_H - margin * 2;
  const imageW = (contentW * imgPct) / 100;
  const gap = 40;
  const infoW = contentW - imageW - gap;

  const cardsInfoPoint = getLayoutPoint(form.layout_overrides, "cards_info", DEFAULT_LAYOUT_POINTS.cards_info);
  const defaultCardsCenterX = (DEFAULT_LAYOUT_POINTS.cards_info.x / 100) * PDF_W;
  const cardsCenterX = (cardsInfoPoint.x / 100) * PDF_W;
  const infoShiftX = clamp(cardsCenterX - defaultCardsCenterX, -56, 56);
  const infoX = margin + imageW + gap + infoShiftX;
  const infoY = margin;
  const infoInnerW = infoW - 8;

  const showTime = form.show_time_on_card ?? true;
  const badgeHeight = 50;
  const badgeGap = 10;
  const badgesTotalHeight = showTime ? badgeHeight * 2 + badgeGap : badgeHeight;
  const badgesTop = infoY + contentH - 18 - badgesTotalHeight;
  const captionLabelY = infoY + 90;
  const captionTextY = captionLabelY + 28;
  const captionHeight = Math.max(40, badgesTop - captionTextY - 12);

  const dragClass = "cursor-move ring-1 ring-primary/40 bg-background/15 rounded-xl";

  return (
    <div ref={setContainerEl} className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg }}>
      <div className="absolute" style={{ left: margin, top: margin, width: contentW, height: contentH }}>
        {/* Image area */}
        <div
          className={cn("absolute rounded-3xl overflow-hidden shrink-0 flex items-center justify-center", editable && "cursor-pointer ring-2 ring-transparent hover:ring-primary/60", imageSelected && "ring-primary")}
          style={{ width: imageW, height: contentH, background: "linear-gradient(140deg, #131828 0%, #283149 48%, #11141f 100%)", boxShadow: "0 20px 60px -15px rgba(0,0,0,0.4)" }}
          onClick={() => editable && setImageSelected(true)}
        >
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative flex flex-col items-center gap-4 text-center" style={{ color: "#d9deef" }}>
            <LayoutGrid className="h-20 w-20" />
            <span style={{ fontSize: 20 }}>Imagem do Post</span>
            <span className="text-sm opacity-70">Sem cortes • formato original</span>
          </div>
          {editable && imageSelected && onResizeImage && (
            <div className="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-xl border border-primary/40 bg-background/80 p-1.5">
              <button type="button" className="h-7 w-7 rounded-lg bg-muted text-foreground flex items-center justify-center text-sm font-bold" onClick={(e) => { e.stopPropagation(); onResizeImage(-2); }}>−</button>
              <span className="text-[10px] font-medium px-1">{imgPct}%</span>
              <button type="button" className="h-7 w-7 rounded-lg bg-muted text-foreground flex items-center justify-center text-sm font-bold" onClick={(e) => { e.stopPropagation(); onResizeImage(2); }}>+</button>
            </div>
          )}
        </div>
      </div>

      {/* Info block */}
      <div
        className={cn("absolute z-10", editable && dragClass)}
        style={{ left: infoX + infoW / 2, top: infoY + contentH / 2, transform: "translate(-50%, -50%)", width: infoW, height: contentH, padding: editable ? "6px" : 0 }}
        onPointerDown={(e) => editable && startDrag(e, containerEl, (p) => onMoveNode("cards_info", p))}
      >
        <div className="relative h-full w-full">
          <div className="flex items-center gap-3 flex-wrap" style={{ minHeight: 56 }}>
            <div style={{ fontSize: (form.card_font_size ?? 14) * 2.9, color: titleColor }} className="font-bold leading-tight">Post {index + 1}</div>
            <div className="rounded-full px-4 py-1.5 font-semibold shrink-0" style={{ fontSize: 18, backgroundColor: `${accent}22`, color: accent }}>{postType}</div>
          </div>
          <div style={{ marginTop: 24, maxWidth: infoInnerW }}>
            <div style={{ fontSize: 18, color: subtitleColor }} className="uppercase tracking-widest font-semibold mb-3">Legenda:</div>
            <div style={{ fontSize: (form.card_caption_font_size ?? 11) * 2, color: titleColor, lineHeight: 1.65, wordBreak: "break-word", overflowWrap: "break-word", maxHeight: captionHeight, overflow: "hidden" }}>
              {caption}
            </div>
          </div>
          <div className="absolute right-1 flex flex-col items-end gap-2.5" style={{ top: badgesTop - infoY }}>
            <div className="rounded-xl px-6 py-3 font-bold text-white whitespace-nowrap" style={{ backgroundColor: accent, fontSize: (form.card_date_font_size ?? 12) * 1.8 }}>
              Data: {String(day).padStart(2, "0")}/03/2026
            </div>
            {showTime && (
              <div className="rounded-xl px-6 py-3 font-bold text-white whitespace-nowrap" style={{ backgroundColor: accent, fontSize: (form.card_date_font_size ?? 12) * 1.8 }}>
                Horário: 18:00
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Preview: Carousel Page ─── */
export function PreviewCarouselPage({ form, editable, onMoveNode }: PreviewProps) {
  const bg = form.background_color ?? "#0B0D12";
  const accent = form.accent_color ?? "#7C5CFF";
  const titleColor = form.title_color ?? "#FFFFFF";
  const subtitleColor = form.subtitle_color ?? "#AAAAAA";
  const margin = form.margin_size ?? 60;
  const maxCols = form.carousel_cols ?? 4;
  const maxRows = form.carousel_rows ?? 2;
  const imgGap = 12;
  const contentW = PDF_W - margin * 2;
  const contentH = PDF_H - margin * 2;
  const imgHeightPct = (form.carousel_image_height_pct ?? 65) / 100;
  const gridH = contentH * imgHeightPct;
  const infoH = contentH - gridH - 20;

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const fallbackInfoPoint: LayoutPoint = { x: 50, y: ((margin + gridH + 20 + infoH / 2) / PDF_H) * 100 };
  const infoPoint = getLayoutPoint(form.layout_overrides, "carousel_info", fallbackInfoPoint);

  const mockImageCount = Math.min(maxCols * maxRows, 5);
  const frames = buildAdaptiveCarouselGridFrames({ itemCount: mockImageCount, maxCols, maxRows, x: margin, y: margin, width: contentW, height: gridH, gap: imgGap });

  const mockBackgrounds = [
    "linear-gradient(140deg, #2a3148 0%, #556fa7 60%, #1b2135 100%)",
    "linear-gradient(140deg, #322515 0%, #aa6d2e 58%, #251b10 100%)",
    "linear-gradient(140deg, #183235 0%, #2f9c8b 56%, #132427 100%)",
    "linear-gradient(140deg, #352039 0%, #9652a2 55%, #281a2b 100%)",
    "linear-gradient(140deg, #2f2f2f 0%, #6f6f6f 58%, #1d1d1d 100%)",
  ];

  return (
    <div ref={setContainerEl} className="relative overflow-hidden" style={{ width: PDF_W, height: PDF_H, backgroundColor: bg }}>
      {frames.map((frame) => (
        <div key={frame.index} className="absolute rounded-3xl overflow-hidden" style={{ left: frame.x, top: frame.y, width: frame.size, height: frame.size, backgroundColor: "#1a1d27" }}>
          <div className="absolute inset-0" style={{ backgroundImage: mockBackgrounds[frame.index % mockBackgrounds.length], backgroundSize: "contain", backgroundPosition: "center", backgroundRepeat: "no-repeat" }} />
          <div className="absolute inset-0 flex items-end justify-center pb-4 text-white/90 text-sm font-semibold">Página {frame.index + 1}</div>
        </div>
      ))}

      <div
        className={cn("absolute", editable && "cursor-move")}
        style={{ left: `${infoPoint.x}%`, top: `${infoPoint.y}%`, transform: "translate(-50%, -50%)", width: contentW, minHeight: infoH }}
        onPointerDown={(e) => editable && startDrag(e, containerEl, (point) => onMoveNode("carousel_info", point))}
      >
        <div className={cn("relative rounded-2xl px-3 py-2", editable && "ring-1 ring-primary/40 bg-background/15")} style={{ minHeight: infoH }}>
          <div className="absolute left-3 top-4" style={{ width: "22%" }}>
            <div style={{ fontSize: (form.carousel_title_font_size ?? 14) * 2.8, color: titleColor }} className="font-bold leading-tight">Post 1</div>
            <div style={{ fontSize: 16, color: accent }} className="mt-1 font-semibold">Carrossel</div>
          </div>
          <div className="absolute top-4" style={{ left: "24%", width: "46%" }}>
            <div style={{ fontSize: 15, color: subtitleColor }} className="uppercase tracking-wider font-semibold mb-2">Legenda:</div>
            <div style={{ fontSize: (form.carousel_caption_font_size ?? 11) * 1.9, color: titleColor, lineHeight: 1.65, maxHeight: infoH - 30, overflow: "hidden" }}>
              Essa é a legenda completa da postagem do carrossel com quebra automática, sem invadir a área de data e horário.
            </div>
          </div>
          <div className="absolute right-3 bottom-3 flex flex-col gap-2.5 items-end" style={{ width: "26%" }}>
            <div className="rounded-xl px-6 py-3 font-bold text-white" style={{ backgroundColor: accent, fontSize: (form.carousel_date_font_size ?? 12) * 1.8 }}>Data: 05/03/2026</div>
            {(form.show_time_on_card ?? true) && (
              <div className="rounded-xl px-6 py-3 font-bold text-white" style={{ backgroundColor: accent, fontSize: (form.carousel_date_font_size ?? 12) * 1.8 }}>Horário: 12h00</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Preview: Footer ─── */
export function PreviewFooter({ form, editable, onMoveNode }: PreviewProps) {
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
            <div style={{ fontSize: (form.footer_title_font_size ?? 32) * 1.3, color: form.title_color ?? "#FFF" }} className="font-bold">{form.agency_name || "Nome da Agência"}</div>
            <div style={{ fontSize: (form.footer_subtitle_font_size ?? 18) * 1.5, color: form.subtitle_color ?? "#AAA" }} className="mt-2">{form.footer_text || "Cronograma de Conteúdo"}</div>
            <div style={{ fontSize: (form.footer_contact_font_size ?? 11) * 1.6, color: form.subtitle_color ?? "#AAA" }} className="mt-2">{form.footer_contact || "@agencia • contato@agencia.com"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Scaled preview wrapper ─── */
const CANVAS_PAD = 24;
// Max canvas height per page card — ensures the full page is visible without scrolling within the card
const MAX_CANVAS_H = 420;

export function ScaledPreview({ children, label, pageNum, isSelected, onClick }: {
  children: React.ReactNode; label: string; pageNum: number; isSelected: boolean; onClick: () => void;
}) {
  const [scale, setScale] = useState(0.25);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerEl) return;

    const update = () => {
      const availW = containerEl.clientWidth - CANVAS_PAD * 2;
      if (availW <= 0) return;
      const maxInnerH = MAX_CANVAS_H - CANVAS_PAD * 2;
      // Fit to the smaller of width or height constraint
      const fitW = availW / PDF_W;
      const fitH = maxInnerH / PDF_H;
      setScale(Math.max(0.08, Math.min(1, Math.min(fitW, fitH))));
    };

    const ro = new ResizeObserver(update);
    ro.observe(containerEl);
    update();
    return () => ro.disconnect();
  }, [containerEl]);

  const canvasH = PDF_H * scale + CANVAS_PAD * 2;

  return (
    <div
      className={cn(
        "rounded-2xl border overflow-hidden transition-all cursor-pointer group",
        isSelected
          ? "border-primary/40 shadow-lg shadow-primary/8 ring-1 ring-primary/15"
          : "border-border/15 hover:border-border/30 hover:shadow-md"
      )}
      onClick={onClick}
    >
      {/* Page header strip */}
      <div className={cn(
        "flex items-center justify-between px-4 py-2 border-b transition-colors",
        isSelected ? "bg-primary/5 border-primary/15" : "bg-muted/10 border-border/10"
      )}>
        <div className="flex items-center gap-2.5">
          <span className={cn(
            "inline-flex items-center justify-center h-5 w-5 rounded-md text-[10px] font-bold",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground"
          )}>
            {pageNum}
          </span>
          <span className="text-[11px] font-medium text-foreground/80">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(scale * 100)}%</span>
          {isSelected && (
            <span className="text-[10px] font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
              Editando
            </span>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={setContainerEl}
        className="flex items-center justify-center"
        style={{
          height: canvasH,
          background: isSelected
            ? "radial-gradient(circle at 50% 40%, hsl(var(--primary) / 0.04), hsl(var(--muted) / 0.08))"
            : "hsl(var(--muted) / 0.05)",
        }}
      >
        <div
          className="rounded-lg overflow-hidden shrink-0"
          style={{
            width: PDF_W,
            height: PDF_H,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
            fontFamily: '"Bricolage Grotesque", "Segoe UI", sans-serif',
            boxShadow: "0 8px 32px -8px rgba(0,0,0,0.25), 0 2px 8px -2px rgba(0,0,0,0.15)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
