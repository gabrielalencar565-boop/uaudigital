import { useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { PM_KANBAN_COLUMNS, statusLabel, statusColor } from "../pm-constants";
import type { PmTask, PmSubtask } from "../pm-types";
import { PmTaskCard } from "./PmTaskCard";
import { useUpdatePmTask } from "../hooks/use-pm-data";

interface Props {
  tasks: PmTask[];
  subtasksMap: Record<string, PmSubtask[]>;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (task: PmTask) => void;
  onCreateClick: (status?: string) => void;
  filters: { clientId?: string; assigneeId?: string; search?: string };
}

export function PmKanbanBoard({ tasks, subtasksMap, clientsMap, membersMap, onTaskClick, onCreateClick, filters }: Props) {
  const updateTask = useUpdatePmTask();

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
    return PM_KANBAN_COLUMNS.map((status) => ({
      status,
      tasks: filtered.filter((t) => t.status_global === status),
    }));
  }, [filtered]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => (
        <div key={col.status} className="flex w-72 min-w-[280px] flex-col rounded-lg border border-border/40 bg-card/10">
          {/* Column header */}
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold", statusColor(col.status))}>
                {statusLabel(col.status)}
              </span>
              <span className="text-xs text-muted-foreground">{col.tasks.length}</span>
            </div>
            <button
              type="button"
              onClick={() => onCreateClick(col.status)}
              className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-2 p-2" style={{ minHeight: 100 }}>
            {col.tasks.map((task) => {
              const member = task.assignee_id ? membersMap[task.assignee_id] : undefined;
              return (
                <PmTaskCard
                  key={task.id}
                  task={task}
                  clientName={clientsMap[task.client_id] ?? "—"}
                  assigneeName={member?.name}
                  assigneeAvatar={member?.avatar}
                  subtasks={subtasksMap[task.id] ?? []}
                  onClick={() => onTaskClick(task)}
                />
              );
            })}
            {col.tasks.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma tarefa</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
