import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/features/data/queries";
import { AgendaWeekTaskItem } from "./AgendaWeekTaskItem";

interface TaskMember {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
}

interface DraggableTaskCardProps {
  task: TaskRow;
  stageLabel: string;
  done: boolean;
  assigneeName: string;
  assigneeAvatarUrl?: string;
  members?: TaskMember[];
  clientName: string;
  dueTime?: string;
  postType?: string | null;
  canInteract: boolean;
  canDelete: boolean;
  canDrag: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onClick: () => void;
}

export function DraggableTaskCard({
  task,
  stageLabel,
  done,
  assigneeName,
  assigneeAvatarUrl,
  members,
  clientName,
  dueTime,
  postType,
  canInteract,
  canDelete,
  canDrag,
  onToggle,
  onDelete,
  onClick,
}: DraggableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    disabled: !canDrag,
    data: { task },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative",
        isDragging && "opacity-50"
      )}
    >
      {canDrag && (
        <button
          type="button"
          {...listeners}
          {...attributes}
          className={cn(
            "absolute -left-1 top-1/2 -translate-y-1/2 z-10",
            "flex h-6 w-4 items-center justify-center rounded-sm",
            "text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent",
            "cursor-grab active:cursor-grabbing",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          )}
          aria-label="Arrastar tarefa"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      
      <AgendaWeekTaskItem
        stageLabel={stageLabel}
        stage={task.stage}
        done={done}
        assigneeName={assigneeName}
        assigneeAvatarUrl={assigneeAvatarUrl}
        members={members}
        clientName={clientName}
        dueTime={dueTime}
        isExtraDemand={task.is_extra_demand}
        canInteract={canInteract}
        canDelete={canDelete}
        onToggle={onToggle}
        onDelete={onDelete}
        onClick={onClick}
      />
    </div>
  );
}
