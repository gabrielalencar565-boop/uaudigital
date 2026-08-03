import { Camera, Film, Image as ImageIcon, LayoutGrid, Smartphone, GripVertical, File } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarPublication } from "../calendar-types";

const CONTENT_TYPE_ICON: Record<CalendarPublication["content_type"], typeof Film> = {
  imagem: ImageIcon,
  carrossel: LayoutGrid,
  reel: Film,
  video: Camera,
  story: Smartphone,
  outro: File,
};

const STATUS_DOT: Record<CalendarPublication["status"], string> = {
  rascunho: "bg-muted-foreground/40",
  aguardando_aprovacao: "bg-amber-500",
  aprovada: "bg-success",
  alteracao_solicitada: "bg-destructive",
  atualizada: "bg-blue-500",
  cancelada: "bg-muted-foreground/20",
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

  return (
    <div
      className={cn(
        "group flex items-start gap-1.5 rounded-lg border border-border/30 bg-card px-1.5 py-1.5 text-left transition-colors hover:bg-muted/50",
        isDragging && "opacity-40",
      )}
    >
      <span
        ref={dragHandleProps?.setActivatorNodeRef}
        {...(dragHandleProps?.listeners ?? {})}
        {...(dragHandleProps?.attributes ?? {})}
        className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground/40 opacity-0 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3" />
      </span>
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[publication.status])} />
            <span className="truncate text-[11px] font-medium leading-4">{publication.title}</span>
          </span>
          <span className="block truncate text-[10px] text-muted-foreground leading-3">
            {publication.publish_time ? `${publication.publish_time.slice(0, 5)} · ` : ""}
            {publication.caption ? publication.caption.replace(/\s+/g, " ").trim() : "sem legenda"}
          </span>
        </span>
      </button>
    </div>
  );
}
