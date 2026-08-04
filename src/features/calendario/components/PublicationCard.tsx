import { Camera, Film, Image as ImageIcon, LayoutGrid, Smartphone, GripVertical, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTENT_TYPE_LABELS, type CalendarPublication } from "../calendar-types";

const CONTENT_TYPE_ICON: Record<CalendarPublication["content_type"], typeof Film> = {
  imagem: ImageIcon,
  carrossel: LayoutGrid,
  reel: Film,
  video: Camera,
  story: Smartphone,
  outro: File,
};

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

  return (
    <div
      className={cn(
        "group w-full max-w-full overflow-hidden rounded-lg border border-border/60 bg-card/20 shadow-sm transition-colors hover:border-primary/50 hover:bg-card/40",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-1 px-1.5 pt-1.5">
        <span className="flex min-w-0 items-center gap-1 truncate text-muted-foreground">
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate text-[10px]">{CONTENT_TYPE_LABELS[publication.content_type]}</span>
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
