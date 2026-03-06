import { useMemo } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStageCircleColor } from "../pm-constants";
import type { PmTask } from "../pm-types";
import { PmTaskCard } from "./PmTaskCard";

// Fixed column order per user request
const KANBAN_COLUMNS = [
  { key: "captacao", label: "Captação" },
  { key: "planejamento", label: "Planejamento" },
  { key: "design", label: "Design" },
  { key: "edicao_videos", label: "Vídeo" },
  { key: "revisao", label: "Revisão" },
  { key: "pdf", label: "PDF" },
  { key: "agendamento", label: "Agendamento" },
  { key: "entrega", label: "Concluído" },
] as const;

interface Props {
  tasks: PmTask[];
  childTasksMap: Record<string, PmTask[]>;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (task: PmTask) => void;
  onCreateClick: (status?: string) => void;
  filters: { clientId?: string; assigneeId?: string; search?: string; fixedAssigneeClientIds?: Set<string> };
  isAdmin?: boolean;
}

export function PmKanbanBoard({ tasks, childTasksMap, clientsMap, membersMap, onTaskClick, onCreateClick, filters, isAdmin }: Props) {
  const filtered = useMemo(() => {
    let list = tasks;
    if (filters.clientId) list = list.filter((t) => t.client_id === filters.clientId);
    if (filters.assigneeId) {
      const fixedClients = filters.fixedAssigneeClientIds ?? new Set<string>();
      list = list.filter((t) => t.assignee_id === filters.assigneeId || fixedClients.has(t.client_id));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [tasks, filters]);

  const columns = useMemo(() => {
    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      tasks: filtered.filter((t) => t.stage_current === col.key),
    }));
  }, [filtered]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-4">
      {columns.map((col) => {
        const circleColor = getStageCircleColor(col.key);
        return (
          <div key={col.key} className="flex w-[260px] min-w-[260px] flex-col rounded-lg bg-card/5">
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-full", circleColor.bg)} />
                <span className="text-xs font-semibold uppercase tracking-wide text-foreground/80">{col.label}</span>
                <span className="text-[10px] text-muted-foreground bg-muted/50 rounded-full px-1.5 py-0.5 font-medium">
                  {col.tasks.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onCreateClick(col.key)}
                className="rounded p-1 text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Cards */}
            <div className="flex flex-col gap-1.5 px-1.5 pb-2" style={{ minHeight: 60 }}>
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
                <p className="py-6 text-center text-[11px] text-muted-foreground/40">Nenhuma tarefa</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
