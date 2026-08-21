import { useEffect, useState } from "react";
import { Video, Film, Images, Aperture, LayoutGrid, Smartphone, GripVertical, File, ChevronLeft, ChevronRight, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { TAG_COLORS } from "@/features/gestao/pm-constants";
import { CONTENT_TYPE_LABELS, type CalendarPublication } from "../calendar-types";

export const CONTENT_TYPE_ICON: Record<CalendarPublication["content_type"], typeof Film> = {
  carrossel: LayoutGrid,
  reel: Film,
  video: Video,
  story: Smartphone,
  outro: File,
  post: Images,
  foto: Aperture,
};

// Mirrors the color of the tag that generates each content type
// (Post → green, Foto/Capa → teal, Carrossel → blue, Vídeo curto/Vídeo → yellow,
// Stories → red), so the card reads consistently with the task's own tag.
// "video" is a legacy content_type — every video format resolves to "reel" (Reels)
// now, so this entry only exists to satisfy the Record over the DB enum; nothing
// assigns "video" anymore (see pm_resolve_content_type).
const CONTENT_TYPE_COLOR_KEY: Record<CalendarPublication["content_type"], string> = {
  carrossel: "blue",
  reel: "yellow",
  video: "purple",
  story: "red",
  outro: "slate",
  post: "green",
  foto: "teal",
};

export function getContentTypeColor(contentType: CalendarPublication["content_type"]) {
  const key = CONTENT_TYPE_COLOR_KEY[contentType];
  const found = TAG_COLORS.find((c) => c.key === key);
  return found ? { bg: found.dot, text: "text-white" } : { bg: "bg-muted-foreground", text: "text-white" };
}

const STATUS_PILL: Record<CalendarPublication["status"], { label: string; className: string }> = {
  em_montagem: { label: "EM MONTAGEM", className: "bg-muted text-muted-foreground" },
  aguardando_aprovacao: { label: "AGUARDANDO", className: "bg-amber-500/15 text-amber-600" },
  aprovada: { label: "APROVADA", className: "bg-success/15 text-success" },
  alteracao_solicitada: { label: "ALTERAÇÃO", className: "bg-destructive/15 text-destructive" },
};

interface Props {
  publication: CalendarPublication;
  images?: string[];
  onClick: () => void;
  dragHandleProps?: { listeners?: any; attributes?: any; setActivatorNodeRef?: (el: HTMLElement | null) => void };
  isDragging?: boolean;
  // Tasks tagged "Capa" (candidate cover-art holders for the PDF stage) default to
  // content_type 'outro' like any other misc task — this badges them distinctly instead
  // of showing the generic "Outro" label, so they read as what they actually are.
  isCapa?: boolean;
}

export function PublicationCard({ publication, images, onClick, dragHandleProps, isDragging, isCapa }: Props) {
  const Icon = isCapa ? Bookmark : CONTENT_TYPE_ICON[publication.content_type];
  const label = isCapa ? "Capa" : CONTENT_TYPE_LABELS[publication.content_type];
  const statusPill = STATUS_PILL[publication.status];
  const contentTypeColor = isCapa
    ? { bg: TAG_COLORS.find((c) => c.key === "indigo")!.dot, text: "text-white" }
    : getContentTypeColor(publication.content_type);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const imgList = images ?? [];
  const hasMultiple = imgList.length > 1;

  useEffect(() => {
    if (!hasMultiple || paused) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % imgList.length), 3000);
    return () => clearInterval(id);
  }, [hasMultiple, paused, imgList.length]);

  return (
    <div
      className={cn(
        "group w-full max-w-full overflow-hidden rounded-lg border border-border/60 bg-card/20 shadow-sm transition-colors hover:border-primary/50 hover:bg-card/40",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-1 px-1.5 pt-1.5">
        <span className={cn("inline-flex min-w-0 items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[9px] font-semibold", contentTypeColor.bg, contentTypeColor.text)}>
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        {publication.publish_time && (
          <span className="shrink-0 text-[9px] text-muted-foreground">{publication.publish_time.slice(0, 5)}</span>
        )}
      </div>

      <div
        className="relative mt-1"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <button type="button" onClick={onClick} className="block aspect-square w-full overflow-hidden rounded-md bg-background/40">
          {imgList.length > 0 ? (
            <div
              className="flex h-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${slide * 100}%)` }}
            >
              {imgList.map((url, i) => (
                <img key={i} src={url} alt="" className={cn("h-full w-full shrink-0", hasMultiple ? "object-contain" : "object-cover")} />
              ))}
            </div>
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-muted">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </span>
          )}
        </button>
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSlide((s) => (s - 1 + imgList.length) % imgList.length); }}
              className="absolute left-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition-opacity opacity-0 group-hover:opacity-100"
              aria-label="Anterior"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSlide((s) => (s + 1) % imgList.length); }}
              className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition-opacity opacity-0 group-hover:opacity-100"
              aria-label="Próxima"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
            <span className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[8px] font-semibold text-foreground backdrop-blur">
              {slide + 1}/{imgList.length}
            </span>
          </>
        )}
      </div>

      <div className="flex min-w-0 items-center justify-between gap-1 p-1.5">
        <span className={cn("min-w-0 truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-snug", statusPill.className)}>
          {statusPill.label}
        </span>
        <span
          ref={dragHandleProps?.setActivatorNodeRef}
          {...(dragHandleProps?.listeners ?? {})}
          {...(dragHandleProps?.attributes ?? {})}
          className="shrink-0 cursor-grab touch-none text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      </div>
    </div>
  );
}
