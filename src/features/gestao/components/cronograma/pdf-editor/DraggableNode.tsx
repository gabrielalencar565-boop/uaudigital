import { cn } from "@/lib/utils";
import type { LayoutPoint } from "./types";
import { startDrag } from "./types";
import { Move } from "lucide-react";

interface DraggableNodeProps {
  layoutKey: string;
  point: LayoutPoint;
  editable: boolean;
  containerEl: HTMLElement | null;
  onMoveNode: (key: string, point: LayoutPoint) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** If true, position is absolute using point.x/y as % */
  absolute?: boolean;
  /** Label shown on hover when editable */
  label?: string;
}

export function DraggableNode({
  layoutKey,
  point,
  editable,
  containerEl,
  onMoveNode,
  children,
  className,
  style,
  absolute = true,
  label,
}: DraggableNodeProps) {
  return (
    <div
      className={cn(
        "group/node transition-all",
        editable && "cursor-move select-none",
        editable && "hover:ring-2 hover:ring-primary/50 hover:bg-primary/5 rounded-xl",
        className
      )}
      style={{
        ...(absolute
          ? {
              position: "absolute",
              left: `${point.x}%`,
              top: `${point.y}%`,
              transform: "translate(-50%, -50%)",
            }
          : {}),
        ...style,
      }}
      onPointerDown={(e) => {
        if (!editable) return;
        e.stopPropagation();
        startDrag(e, containerEl, (p) => onMoveNode(layoutKey, p));
      }}
    >
      {editable && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none z-30 flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-semibold whitespace-nowrap shadow-lg">
          <Move className="h-2.5 w-2.5" />
          {label ?? layoutKey}
        </div>
      )}
      {children}
    </div>
  );
}
