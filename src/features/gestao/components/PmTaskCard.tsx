import { format } from "date-fns";
import { CalendarDays, AlertTriangle, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { priorityMeta, stageLabel, statusColor } from "../pm-constants";
import type { PmTask, PmSubtask } from "../pm-types";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

interface Props {
  task: PmTask;
  clientName: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  subtasks?: PmSubtask[];
  onClick: () => void;
}

export function PmTaskCard({ task, clientName, assigneeName, assigneeAvatar, subtasks = [], onClick }: Props) {
  const prio = priorityMeta(task.priority);
  const done = subtasks.filter((s) => s.status === "concluido").length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const hasBlocked = subtasks.some((s) => s.status === "bloqueado");

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-border/60 bg-card/30 p-3 text-left transition hover:bg-card/60 hover:shadow-sm"
    >
      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="inline-block rounded bg-accent/50 px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <p className="truncate text-sm font-semibold">{task.title}</p>

      {/* Client + Stage */}
      <div className="mt-1 flex items-center gap-2">
        <span className="truncate text-xs text-muted-foreground">{clientName}</span>
        <Badge variant="outline" className="text-[10px] h-5">{stageLabel(task.stage_current)}</Badge>
      </div>

      {/* Priority + Blocked */}
      <div className="mt-2 flex items-center gap-2">
        <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", prio.bg, prio.color)}>
          {prio.label}
        </span>
        {hasBlocked && (
          <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
            <AlertTriangle className="h-3 w-3" /> Bloqueio
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{done}/{total} subtarefas</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-success" : "bg-primary")}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: assignee + due */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {assigneeName ? (
            <>
              <Avatar className="h-5 w-5">
                <AvatarImage src={assigneeAvatar} />
                <AvatarFallback className="text-[8px]">{initials(assigneeName)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-[11px] text-muted-foreground">{assigneeName}</span>
            </>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <User className="h-3 w-3" /> Sem responsável
            </span>
          )}
        </div>
        {task.due_date && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            {format(new Date(task.due_date + "T12:00:00"), "dd/MM")}
          </span>
        )}
      </div>
    </button>
  );
}
