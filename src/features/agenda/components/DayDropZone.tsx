import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { PropsWithChildren } from "react";

interface DayDropZoneProps {
  dayKey: string; // formato yyyy-MM-dd
  isToday?: boolean;
  disabled?: boolean;
}

export function DayDropZone({
  dayKey,
  isToday,
  disabled,
  children,
}: PropsWithChildren<DayDropZoneProps>) {
  const { isOver, setNodeRef } = useDroppable({
    id: dayKey,
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[80px] rounded-lg border-2 border-transparent transition-colors",
        isOver && !disabled && "border-primary/50 bg-primary/5",
        isToday && !isOver && "bg-primary/5"
      )}
    >
      {children}
    </div>
  );
}
