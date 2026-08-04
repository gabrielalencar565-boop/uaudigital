import { Camera, Film, Image as ImageIcon, LayoutGrid, Smartphone, GripVertical, File, Clock } from "lucide-react";
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
        "group flex items-start gap-2.5 rounded-lg border border-border/60 bg-card/20 p-2 shadow-sm transition-colors hover:border-primary/50 hover:bg-card/40",
        isDragging && "opacity-40",
      )}
    >
      <button type="button" onClick={onClick} className="shrink-0">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-14 w-14 rounded-md object-cover" />
        ) : (
          <span className="flex h-14 w-14 items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className={cn("inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-snug", statusPill.className)}>
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

        <button type="button" onClick={onClick} className="mt-1 block w-full text-left">
          <span className="block truncate text-[13px] font-medium leading-4">{publication.title}</span>
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Icon className="h-3 w-3 shrink-0" />
            {CONTENT_TYPE_LABELS[publication.content_type]}
          </span>
          {publication.publish_time && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {publication.publish_time.slice(0, 5)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
