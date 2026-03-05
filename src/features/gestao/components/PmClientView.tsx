import { useMemo, useState } from "react";
import { ChevronRight, Folder } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusColor, statusLabel } from "../pm-constants";
import type { PmTask, PmSubtask } from "../pm-types";
import { PmTaskCard } from "./PmTaskCard";

interface Props {
  tasks: PmTask[];
  subtasksMap: Record<string, PmSubtask[]>;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (task: PmTask) => void;
}

export function PmClientView({ tasks, subtasksMap, clientsMap, membersMap, onTaskClick }: Props) {
  const [expandedClient, setExpandedClient] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, PmTask[]> = {};
    tasks.forEach((t) => {
      if (!map[t.client_id]) map[t.client_id] = [];
      map[t.client_id].push(t);
    });
    return Object.entries(map)
      .map(([clientId, tasks]) => ({
        clientId,
        clientName: clientsMap[clientId] ?? "Sem cliente",
        tasks,
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [tasks, clientsMap]);

  return (
    <div className="space-y-2">
      {grouped.map((group) => {
        const isOpen = expandedClient === group.clientId;
        const totalDone = group.tasks.filter((t) => t.status_global === "concluido").length;

        return (
          <div key={group.clientId} className="rounded-lg border border-border/40 bg-card/10">
            <button
              type="button"
              onClick={() => setExpandedClient(isOpen ? null : group.clientId)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-card/30"
            >
              <ChevronRight className={cn("h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-90")} />
              <Folder className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm font-semibold">{group.clientName}</span>
              <span className="text-xs text-muted-foreground">{totalDone}/{group.tasks.length} concluídas</span>
            </button>

            {isOpen && (
              <div className="grid gap-2 border-t border-border/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.tasks.map((task) => {
                  const member = task.assignee_id ? membersMap[task.assignee_id] : undefined;
                  return (
                    <PmTaskCard
                      key={task.id}
                      task={task}
                      clientName={group.clientName}
                      assigneeName={member?.name}
                      assigneeAvatar={member?.avatar}
                      subtasks={subtasksMap[task.id] ?? []}
                      onClick={() => onTaskClick(task)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {grouped.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa criada ainda.</p>
      )}
    </div>
  );
}
