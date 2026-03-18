import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { LayoutPoint } from "./types";
import { startDrag, clamp } from "./types";
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
  absolute?: boolean;
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
  const [dragging, setDragging] = useState(false);
  const [livePoint, setLivePoint] = useState<LayoutPoint | null>(null);

  const activePoint = livePoint ?? point;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!editable || !containerEl) return;
      e.stopPropagation();
      e.preventDefault();

      setDragging(true);
      setLivePoint({ ...point });

      const updateFromClient = (clientX: number, clientY: number) => {
        const rect = containerEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = clamp(((clientX - rect.left) / rect.width) * 100, 4, 96);
        const y = clamp(((clientY - rect.top) / rect.height) * 100, 4, 96);
        const snapped = { x: snapToGuide(x), y: snapToGuide(y) };
        setLivePoint(snapped);
        onMoveNode(layoutKey, snapped);
      };

      updateFromClient(e.clientX, e.clientY);

      const handleMove = (ev: PointerEvent) => updateFromClient(ev.clientX, ev.clientY);
      const cleanup = () => {
        setDragging(false);
        setLivePoint(null);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", cleanup);
        window.removeEventListener("pointercancel", cleanup);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", cleanup);
      window.addEventListener("pointercancel", cleanup);
    },
    [editable, containerEl, point, layoutKey, onMoveNode]
  );

  return (
    <div
      className={cn(
        "group/node transition-shadow",
        editable && "cursor-move select-none rounded-xl",
        editable && !dragging && "hover:ring-2 hover:ring-primary/50 hover:bg-primary/5",
        dragging && "ring-2 ring-primary/70 bg-primary/10 z-50",
        className
      )}
      style={{
        ...(absolute
          ? {
              position: "absolute",
              left: `${activePoint.x}%`,
              top: `${activePoint.y}%`,
              transform: "translate(-50%, -50%)",
            }
          : {}),
        ...style,
      }}
      onPointerDown={handlePointerDown}
    >
      {/* Label tooltip */}
      {editable && (
        <div className={cn(
          "absolute -top-6 left-1/2 -translate-x-1/2 transition-opacity pointer-events-none z-30 flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-primary-foreground text-[9px] font-semibold whitespace-nowrap shadow-lg",
          dragging ? "opacity-100" : "opacity-0 group-hover/node:opacity-100"
        )}>
          <Move className="h-2.5 w-2.5" />
          {label ?? layoutKey}
          {dragging && (
            <span className="ml-1 font-mono text-[8px] opacity-80">
              {Math.round(activePoint.x)}, {Math.round(activePoint.y)}
            </span>
          )}
        </div>
      )}

      {/* Ruler crosshair lines during drag */}
      {dragging && (
        <>
          {/* Vertical ruler */}
          <div
            className="pointer-events-none fixed z-40"
            style={{
              left: `${activePoint.x}%`,
              top: 0,
              bottom: 0,
              width: 1,
              position: "absolute",
              background: "hsl(var(--primary) / 0.35)",
              transform: "translateX(-50%)",
              // Extend beyond the node to cover the full container
              height: "200vh",
              marginTop: "-100vh",
            }}
          />
          {/* Horizontal ruler */}
          <div
            className="pointer-events-none fixed z-40"
            style={{
              left: 0,
              right: 0,
              top: `${activePoint.y}%`,
              height: 1,
              position: "absolute",
              background: "hsl(var(--primary) / 0.35)",
              transform: "translateY(-50%)",
              width: "200vw",
              marginLeft: "-100vw",
            }}
          />
        </>
      )}

      {children}
    </div>
  );
}

/** Snap to 25%, 33%, 50%, 66%, 75% guides with 1.5% threshold */
function snapToGuide(value: number): number {
  const guides = [10, 25, 33.33, 50, 66.66, 75, 90];
  for (const g of guides) {
    if (Math.abs(value - g) < 1.5) return g;
  }
  return value;
}
