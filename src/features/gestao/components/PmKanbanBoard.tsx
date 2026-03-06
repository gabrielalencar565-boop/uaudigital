import { useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PM_STAGES, stageLabel, stageColorClass } from "../pm-constants";
import type { PmTask } from "../pm-types";
import { PmTaskCard } from "./PmTaskCard";

// Use stages as kanban columns (excluding legacy)
const KANBAN_STAGES = PM_STAGES.filter(s => !["roteiro", "edicao"].includes(s.key));

interface Props {
  tasks: PmTask[];
  childTasksMap: Record<string, PmTask[]>;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (task: PmTask) => void;
  onCreateClick: (status?: string) => void;
  filters: { clientId?: string; assigneeId?: string; search?: string };
  isAdmin?: boolean;
}

export function PmKanbanBoard({ tasks, childTasksMap, clientsMap, membersMap, onTaskClick, onCreateClick, filters, isAdmin }: Props) {
  const filtered = useMemo(() => {
    let list = tasks;
    if (filters.clientId) list = list.filter((t) => t.client_id === filters.clientId);
    if (filters.assigneeId) list = list.filter((t) => t.assignee_id === filters.assigneeId);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [tasks, filters]);

  const columns = useMemo(() => {
    return KANBAN_STAGES.map((stage) => ({
      stage: stage.key,
      label: stage.label,
      tasks: filtered.filter((t) => t.stage_current === stage.key),
    }));
  }, [filtered]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div key={col.stage} className="flex w-72 min-w-[280px] flex-col rounded-lg border border-border/40 bg-card/5">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
            <div className="flex items-center gap-2">
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold", stageColorClass(col.stage))}>{col.label}</span>
              <span className="text-[10px] text-muted-foreground ml-1 bg-muted/50 rounded-full px-1.5 py-0.5">
                {col.tasks.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onCreateClick(col.stage)}
              className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5 p-2" style={{ minHeight: 80 }}>
            {col.tasks.map((task) => {
              const member = task.assignee_id ? membersMap[task.assignee_id] : undefined;
              return (
                <PmTaskCard
                  key={task.id}
                  task={task}
                  clientName={clientsMap[task.client_id] ?? "—"}
                  assigneeName={member?.name}
                  assigneeAvatar={member?.avatar}
                  childTasks={childTasksMap[task.id] ?? []}
                  onClick={() => onTaskClick(task)}
                  isAdmin={isAdmin}
                />
              );
            })}
            {col.tasks.length === 0 && (
              <p className="py-6 text-center text-[11px] text-muted-foreground/60">Nenhuma tarefa</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
