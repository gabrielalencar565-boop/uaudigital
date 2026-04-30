import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, FolderOpen, CheckCircle2, Circle, AlertOctagon, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, stageLabel, taskStageLabel } from "../pm-constants";
import { usePeriodicStages } from "../hooks/use-periodic-stages";
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
    default: return <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />;
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
  const { data: periodicStages = [] } = usePeriodicStages();

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
    <div className="space-y-1.5">
      {grouped.map((group) => {
        const isClientOpen = expandedClients.has(group.clientId);
        const totalDone = group.tasks.filter((t) => t.status_global === "concluido").length;

        return (
          <div key={group.clientId} className="rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleClient(group.clientId)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left transition-all rounded-xl",
                isClientOpen ? "bg-primary/8" : "hover:bg-muted/60"
              )}
            >
              <div className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center transition-colors",
                isClientOpen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
              )}>
                <FolderOpen className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold block truncate">{group.clientName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full bg-foreground/5 px-2.5 text-[11px] font-semibold text-muted-foreground">
                  {totalDone}/{group.tasks.length}
                </span>
                {isClientOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground/60 transition-transform" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform" />
                )}
              </div>
            </button>

            {isClientOpen && (
              <div className="ml-6 border-l-2 border-border/30 space-y-0.5 py-1">
                {group.tasks.map((task) => {
                  const isTaskOpen = expandedTasks.has(task.id);
                  const children = childTasksMap[task.id] ?? [];
                  const childDone = children.filter(s => s.status_global === "concluido").length;

                  return (
                    <div key={task.id}>
                      <div className="flex items-center gap-2.5 pl-4 pr-3 py-2 hover:bg-muted/40 rounded-lg transition group">
                        {children.length > 0 ? (
                          <button type="button" onClick={() => toggleTask(task.id)} className="shrink-0 h-5 w-5 flex items-center justify-center rounded-md hover:bg-foreground/5 transition">
                            {isTaskOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        ) : (
                          <div className="w-5 flex items-center justify-center">
                            <Hash className="h-3 w-3 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className={cn("h-3 w-3 shrink-0 rounded-full border-2", statusDot(task.status_global))} />
                        <button
                          type="button"
                          onClick={() => onTaskClick(task)}
                          className="flex-1 text-left truncate text-[13px] font-medium hover:text-primary transition-colors"
                        >
                          {task.title}
                        </button>
                        {children.length > 0 && (
                          <span className="text-[10px] font-semibold text-muted-foreground/60 bg-foreground/5 rounded-full px-2 py-0.5">{childDone}/{children.length}</span>
                        )}
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-accent/60 text-accent-foreground font-medium shrink-0">
                          {taskStageLabel(task, periodicStages)}
                        </span>
                      </div>

                      {isTaskOpen && children.length > 0 && (
                        <div className="ml-10 border-l-2 border-border/15 space-y-0.5 py-1">
                          {children.map(child => (
                            <div
                              key={child.id}
                              className={cn(
                                "flex items-center gap-2.5 pl-4 pr-3 py-1.5 rounded-lg hover:bg-muted/30 transition cursor-pointer",
                                child.status_global === "concluido" && "opacity-50"
                              )}
                              onClick={() => onTaskClick(child)}
                            >
                              {childStatusIcon(child.status_global)}
                              <span className={cn("flex-1 truncate text-[12px]", child.status_global === "concluido" && "line-through text-muted-foreground")}>
                                {child.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground/60 font-medium">
                                {taskStageLabel(child, periodicStages)}
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
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center">
            <FolderOpen className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground/60 font-medium">Nenhuma tarefa criada ainda.</p>
        </div>
      )}
    </div>
  );
}
