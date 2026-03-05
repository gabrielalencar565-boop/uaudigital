import { useState } from "react";
import { Circle, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PM_STATUSES } from "../pm-constants";
import { useUpdatePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import type { PmTask } from "../pm-types";

function initials(n: string) { return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join(""); }

function statusColor(key: string) {
  switch (key) {
    case "backlog": return "border-muted-foreground/50 text-muted-foreground";
    case "em_andamento": return "border-primary text-primary";
    case "em_aprovacao": return "border-warning text-warning";
    case "concluido": return "border-success text-success";
    case "pausado": return "border-muted-foreground/40 text-muted-foreground";
    case "cancelado": return "border-destructive text-destructive";
    default: return "border-muted-foreground/50 text-muted-foreground";
  }
}

function statusFill(key: string) {
  switch (key) {
    case "concluido": return "bg-success";
    case "em_andamento": return "bg-primary/20";
    case "em_aprovacao": return "bg-warning/20";
    case "cancelado": return "bg-destructive/20";
    default: return "";
  }
}

function statusLabel(key: string) {
  return PM_STATUSES.find(s => s.key === key)?.label ?? key;
}

interface Props {
  parentTask: PmTask;
  childTasks: PmTask[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  members?: { id: string; name: string }[];
  onSelectSubtask?: (task: PmTask) => void;
  activeSubtaskId?: string | null;
}

export function PmSubtaskList({ parentTask, childTasks, membersMap, members, onSelectSubtask, activeSubtaskId }: Props) {
  const updateTask = useUpdatePmTask();
  const createTask = useCreatePmTask();
  const [newTitle, setNewTitle] = useState("");

  const done = childTasks.filter(s => s.status_global === "concluido").length;
  const total = childTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    const result = await createTask.mutateAsync({
      client_id: parentTask.client_id,
      title: newTitle.trim(),
      parent_task_id: parentTask.id,
      stage_current: "planejamento",
    });
    setNewTitle("");
    // Auto-open the newly created subtask
    if (result && onSelectSubtask) {
      onSelectSubtask(result as PmTask);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold">Subtarefas</h3>
        <span className="text-xs text-muted-foreground">{done} de {total}</span>
        {total > 0 && (
          <div className="w-20">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-success" : "bg-primary")} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Table header */}
      {total > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
          <div className="w-5" />
          <div className="flex-1">Nome</div>
          <div className="w-20 text-center">Responsável</div>
          <div className="w-6" />
        </div>
      )}

      {/* Rows */}
      <div className="space-y-0">
        {childTasks.map((sub) => {
          const member = sub.assignee_id ? membersMap[sub.assignee_id] : undefined;
          const isDone = sub.status_global === "concluido";
          const isActive = activeSubtaskId === sub.id;

          return (
            <div
              key={sub.id}
              className={cn(
                "group flex items-center gap-2 px-2 py-2 transition border-b border-border/10 cursor-pointer",
                isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-card/40",
                isDone && "opacity-50"
              )}
              onClick={() => onSelectSubtask?.(sub)}
            >
              {/* Status circle - click opens status picker */}
              <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center justify-center h-5 w-5 rounded-full cursor-pointer hover:scale-110 transition">
                      <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center", statusColor(sub.status_global), statusFill(sub.status_global))}>
                        {isDone && (
                          <svg className="h-2.5 w-2.5 text-success-foreground" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    <div className="space-y-0.5">
                      {PM_STATUSES.map((s) => (
                        <button
                          key={s.key}
                          className={cn(
                            "flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-xs hover:bg-accent transition text-left",
                            sub.status_global === s.key && "bg-accent font-medium"
                          )}
                          onClick={() => updateTask.mutate({ id: sub.id, status_global: s.key as any })}
                        >
                          <span className={cn("h-3 w-3 rounded-full border-2 shrink-0", statusColor(s.key), statusFill(s.key))} />
                          <span className="uppercase text-[10px] font-semibold tracking-wide">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Title only (no stage badge) */}
              <div className="flex-1 min-w-0">
                <span className={cn("truncate text-sm hover:text-primary transition-colors", isDone && "line-through text-muted-foreground")}>{sub.title}</span>
              </div>

              {/* Assignee */}
              <div className="w-20 flex justify-center" onClick={(e) => e.stopPropagation()}>
                {members && members.length > 0 ? (
                  <Select
                    value={sub.assignee_id ?? "__none__"}
                    onValueChange={(v) => updateTask.mutate({ id: sub.id, assignee_id: v === "__none__" ? null : v })}
                  >
                    <SelectTrigger className="h-6 w-auto border-0 bg-transparent shadow-none p-0">
                      {member ? (
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{initials(member.name)}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30" />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__" className="text-xs">Ninguém</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : member ? (
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{initials(member.name)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30" />
                )}
              </div>

              {/* Open indicator */}
              <div className="w-6 flex justify-center">
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Add subtask */}
      <div className="flex items-center gap-2 px-2 py-1.5">
        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Adicionar subtarefa..."
          className="h-7 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        {newTitle.trim() && (
          <Button size="sm" variant="ghost" onClick={handleAdd} className="h-6 text-xs px-2">
            Adicionar
          </Button>
        )}
      </div>
    </div>
  );
}
