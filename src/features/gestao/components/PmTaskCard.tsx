import { format } from "date-fns";
import { CalendarDays, AlertTriangle, User, Flag } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { priorityMeta, stageLabel } from "../pm-constants";
import type { PmTask } from "../pm-types";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function statusDot(key: string) {
  switch (key) {
    case "backlog": return "border-muted-foreground bg-transparent";
    case "em_andamento": return "border-primary bg-primary/30";
    case "em_aprovacao": return "border-warning bg-warning/30";
    case "concluido": return "border-success bg-success";
    case "pausado": return "border-muted-foreground/50 bg-transparent";
    case "cancelado": return "border-destructive bg-destructive/30";
    default: return "border-muted-foreground bg-transparent";
  }
}

interface Props {
  task: PmTask;
  clientName: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  childTasks?: PmTask[];
  onClick: () => void;
}

export function PmTaskCard({ task, clientName, assigneeName, assigneeAvatar, childTasks = [], onClick }: Props) {
  const prio = priorityMeta(task.priority);
  const done = childTasks.filter((s) => s.status_global === "concluido").length;
  const total = childTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-md border border-border/50 bg-card/40 p-3 text-left transition hover:bg-card/70 hover:border-border"
    >
      <div className="flex items-start gap-2.5">
        <div className={cn("mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2", statusDot(task.status_global))} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{task.title}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="truncate">{clientName}</span>
            <span className="text-border">•</span>
            <span className="px-1.5 py-0.5 rounded bg-accent/50 text-[10px] font-medium text-accent-foreground">
              {stageLabel(task.stage_current)}
            </span>
          </div>
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {total > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-success" : "bg-primary/70")}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0">{done}/{total}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold", prio.color)}>
                <Flag className="h-2.5 w-2.5" /> {prio.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {task.due_date && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <CalendarDays className="h-2.5 w-2.5" />
                  {format(new Date(task.due_date + "T12:00:00"), "dd/MM")}
                </span>
              )}
              {assigneeName ? (
                <Avatar className="h-5 w-5">
                  <AvatarImage src={assigneeAvatar} />
                  <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{initials(assigneeName)}</AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center">
                  <User className="h-2.5 w-2.5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
