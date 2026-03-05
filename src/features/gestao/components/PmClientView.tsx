import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Folder, CheckCircle2, Circle, AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, stageLabel } from "../pm-constants";
import type { PmTask } from "../pm-types";

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

function childStatusIcon(status: string) {
  switch (status) {
    case "concluido": return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    case "cancelado": return <AlertOctagon className="h-3.5 w-3.5 text-destructive" />;
    case "em_andamento": return <Circle className="h-3.5 w-3.5 text-primary fill-primary/20" />;
    case "em_aprovacao": return <Circle className="h-3.5 w-3.5 text-warning fill-warning/20" />;
    default: return <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />;
  }
}

interface Props {
  tasks: PmTask[];
  childTasksMap: Record<string, PmTask[]>;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (task: PmTask) => void;
}

export function PmClientView({ tasks, childTasksMap, clientsMap, membersMap, onTaskClick }: Props) {
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const grouped = useMemo(() => {
    const map: Record<string, PmTask[]> = {};
    tasks.forEach((t) => {
      if (!map[t.client_id]) map[t.client_id] = [];
      map[t.client_id].push(t);
    });
    return Object.entries(map)
      .map(([clientId, clientTasks]) => ({
        clientId,
        clientName: clientsMap[clientId] ?? "Sem cliente",
        tasks: clientTasks,
      }))
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [tasks, clientsMap]);

  const toggleClient = (id: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleTask = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {grouped.map((group) => {
        const isClientOpen = expandedClients.has(group.clientId);
        const totalDone = group.tasks.filter((t) => t.status_global === "concluido").length;

        return (
          <div key={group.clientId}>
            <button
              type="button"
              onClick={() => toggleClient(group.clientId)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-card/30 rounded-md"
            >
              {isClientOpen ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <Folder className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 text-sm font-semibold">{group.clientName}</span>
              <span className="text-[11px] text-muted-foreground">{totalDone}/{group.tasks.length}</span>
            </button>

            {isClientOpen && (
              <div className="ml-5 border-l border-border/30 space-y-0.5">
                {group.tasks.map((task) => {
                  const isTaskOpen = expandedTasks.has(task.id);
                  const children = childTasksMap[task.id] ?? [];
                  const childDone = children.filter(s => s.status_global === "concluido").length;

                  return (
                    <div key={task.id}>
                      <div className="flex items-center gap-2 pl-3 pr-3 py-1.5 hover:bg-card/30 rounded-md transition group">
                        {children.length > 0 ? (
                          <button type="button" onClick={() => toggleTask(task.id)} className="shrink-0">
                            {isTaskOpen ? (
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          <div className="w-3" />
                        )}
                        <div className={cn("h-3 w-3 shrink-0 rounded-full border-2", statusDot(task.status_global))} />
                        <button
                          type="button"
                          onClick={() => onTaskClick(task)}
                          className="flex-1 text-left truncate text-sm font-medium hover:text-primary transition-colors"
                        >
                          {task.title}
                        </button>
                        {children.length > 0 && (
                          <span className="text-[10px] text-muted-foreground shrink-0">{childDone}/{children.length}</span>
                        )}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/50 text-accent-foreground shrink-0">
                          {stageLabel(task.stage_current)}
                        </span>
                      </div>

                      {isTaskOpen && children.length > 0 && (
                        <div className="ml-8 border-l border-border/20 space-y-0.5 py-0.5">
                          {children.map(child => (
                            <div
                              key={child.id}
                              className={cn(
                                "flex items-center gap-2 pl-3 pr-3 py-1 rounded-md hover:bg-card/30 transition cursor-pointer",
                                child.status_global === "concluido" && "opacity-50"
                              )}
                              onClick={() => onTaskClick(child)}
                            >
                              {childStatusIcon(child.status_global)}
                              <span className={cn("flex-1 truncate text-[13px]", child.status_global === "concluido" && "line-through text-muted-foreground")}>
                                {child.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {stageLabel(child.stage_current)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
