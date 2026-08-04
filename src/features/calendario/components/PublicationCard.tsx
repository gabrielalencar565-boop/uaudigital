import { Camera, Film, Image as ImageIcon, LayoutGrid, Smartphone, GripVertical, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { TAG_COLORS } from "@/features/gestao/pm-constants";
import { CONTENT_TYPE_LABELS, type CalendarPublication } from "../calendar-types";

const CONTENT_TYPE_ICON: Record<CalendarPublication["content_type"], typeof Film> = {
  imagem: ImageIcon,
  carrossel: LayoutGrid,
  reel: Film,
  video: Camera,
  story: Smartphone,
  outro: File,
};

// Mirrors the color of the tag that generates each content type
// (Post/Capa → green, Carrossel → blue, Vídeo curto → yellow, Vídeo → purple,
// Stories → red), so the card reads consistently with the task's own tag.
const CONTENT_TYPE_COLOR_KEY: Record<CalendarPublication["content_type"], string> = {
  imagem: "green",
  carrossel: "blue",
  reel: "yellow",
  video: "purple",
  story: "red",
  outro: "slate",
};

function getContentTypeColor(contentType: CalendarPublication["content_type"]) {
  const key = CONTENT_TYPE_COLOR_KEY[contentType];
  const found = TAG_COLORS.find((c) => c.key === key);
  return found ? { bg: found.bg, text: found.text } : { bg: "bg-muted", text: "text-muted-foreground" };
}

const STATUS_PILL: Record<CalendarPublication["status"], { label: string; className: string }> = {
  rascunho: { label: "RASCUNHO", className: "bg-muted text-muted-foreground" },
  aguardando_aprovacao: { label: "AGUARDANDO", className: "bg-amber-500/15 text-amber-600" },
  aprovada: { label: "APROVADA", className: "bg-success/15 text-success" },
  alteracao_solicitada: { label: "ALTERAÇÃO", className: "bg-destructive/15 text-destructive" },
  atualizada: { label: "ATUALIZADA", className: "bg-blue-500/15 text-blue-600" },
  cancelada: { label: "CANCELADA", className: "bg-muted-foreground/10 text-muted-foreground/60" },
};

interface Props {
  publication: CalendarPublication;
  thumbnailUrl?: string | null;
  onClick: () => void;
  dragHandleProps?: { listeners?: any; attributes?: any; setActivatorNodeRef?: (el: HTMLElement | null) => void };
  isDragging?: boolean;
}

export function PublicationCard({ publication, thumbnailUrl, onClick, dragHandleProps, isDragging }: Props) {
  const Icon = CONTENT_TYPE_ICON[publication.content_type];
  const statusPill = STATUS_PILL[publication.status];
  const contentTypeColor = getContentTypeColor(publication.content_type);

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
          <span className="truncate">{CONTENT_TYPE_LABELS[publication.content_type]}</span>
        </span>
        {publication.publish_time && (
          <span className="shrink-0 text-[9px] text-muted-foreground">{publication.publish_time.slice(0, 5)}</span>
        )}
      </div>

      <button type="button" onClick={onClick} className="mt-1 block w-full">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="aspect-square w-full object-cover" />
        ) : (
          <span className="flex aspect-square w-full items-center justify-center bg-muted">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </span>
        )}
      </button>

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
