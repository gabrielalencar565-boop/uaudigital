import { Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getStageCircleColor, PM_PRIORITIES } from "@/features/gestao/pm-constants";
import { dueDateLabel } from "./MyPmTasksWidget";
import type { PmTask } from "@/features/gestao/pm-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tasks: PmTask[];
  clientsMap: Record<string, string>;
  todayKey: string;
  onOpenTask: (taskId: string) => void;
}

export function MetricTaskListSheet({ open, onOpenChange, title, tasks, clientsMap, todayKey, onOpenTask }: Props) {
  const sorted = [...tasks].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-1">
          {sorted.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa aqui.</p>
          )}
          {sorted.map((t) => {
            const isDone = t.status_global === "concluido";
            const due = dueDateLabel(t.due_date, todayKey, isDone);
            const stageColor = getStageCircleColor(t.stage_current);
            const priority = PM_PRIORITIES.find((p) => p.key === t.priority) ?? PM_PRIORITIES[1];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenTask(t.id)}
                className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-accent/40"
              >
                <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full border-2", stageColor.border, isDone && stageColor.bg)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <Flag className={cn("h-3 w-3 shrink-0", priority.color)} />
                    <span className={cn("shrink-0 text-xs font-medium", due.color)}>{due.text}</span>
                    {clientsMap[t.client_id] && (
                      <span className="truncate text-xs text-muted-foreground">· {clientsMap[t.client_id]}</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
