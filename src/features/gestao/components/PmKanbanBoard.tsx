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
{ key: "entrega", label: "Concluído" }] as
const;

interface Props {
  tasks: PmTask[];
  childTasksMap: Record<string, PmTask[]>;
  clientsMap: Record<string, string>;
  membersMap: Record<string, {name: string;avatar?: string;}>;
  onTaskClick: (task: PmTask) => void;
  onCreateClick: (status?: string) => void;
  filters: {clientId?: string;assigneeId?: string;search?: string;fixedAssigneeClientIds?: Set<string>;};
  isAdmin?: boolean;
}

export function PmKanbanBoard({ tasks, childTasksMap, clientsMap, membersMap, onTaskClick, onCreateClick, filters, isAdmin }: Props) {
  const filtered = useMemo(() => {
    // Exclude completed snapshots (they only show in the agenda view)
    let list = tasks.filter((t) => t.status_global !== "concluido");
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
      tasks: filtered.filter((t) => t.stage_current === col.key)
    }));
  }, [filtered]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {columns.map((col) => {
        const circleColor = getStageCircleColor(col.key);
        return (
          <div key={col.key} className="flex w-[272px] min-w-[272px] flex-col rounded-2xl bg-muted/40 backdrop-blur-sm border border-[#6932c8]">
            {/* Column header */}
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className={cn("h-2.5 w-2.5 rounded-full ring-2 ring-offset-1 ring-offset-muted/40", circleColor.bg, circleColor.border.replace("border-", "ring-"))} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">{col.label}</span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/8 text-[10px] font-semibold text-foreground/50 px-1.5">
                  {col.tasks.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onCreateClick(col.key)}
                className="rounded-lg p-1.5 text-muted-foreground/60 transition-all hover:bg-primary/10 hover:text-primary active:scale-95">
                
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            {/* Cards */}
            <div className="flex flex-col gap-2 px-2 pb-3" style={{ minHeight: 60 }}>
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
                    isAdmin={isAdmin} />);


              })}
              {col.tasks.length === 0 &&
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="h-8 w-8 rounded-xl bg-foreground/5 flex items-center justify-center">
                    <Plus className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                  <p className="text-[11px] text-muted-foreground/40 font-medium">Nenhuma tarefa</p>
                </div>
              }
            </div>
          </div>);

      })}
    </div>);

}