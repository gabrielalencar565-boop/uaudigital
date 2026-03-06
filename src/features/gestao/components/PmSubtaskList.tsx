import { useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PM_STAGES, stageColorClass, stageLabel } from "../pm-constants";
import { useUpdatePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import type { PmTask } from "../pm-types";

function initials(n: string) { return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join(""); }

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

  const done = childTasks.filter(s => s.stage_current === "entrega").length;
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
    if (result && onSelectSubtask) {
      onSelectSubtask(result as PmTask);
    }
  };

  const toggleAssignee = (subId: string, sub: PmTask, memberId: string) => {
    const currentWatchers = sub.watchers ?? [];
    if (sub.assignee_id === memberId) {
      const remaining = currentWatchers.filter(w => w !== memberId);
      updateTask.mutate({ id: subId, assignee_id: remaining[0] ?? null, watchers: remaining.slice(1) } as any);
    } else if (currentWatchers.includes(memberId)) {
      updateTask.mutate({ id: subId, watchers: currentWatchers.filter(w => w !== memberId) } as any);
    } else if (!sub.assignee_id) {
      updateTask.mutate({ id: subId, assignee_id: memberId } as any);
    } else {
      updateTask.mutate({ id: subId, watchers: [...currentWatchers, memberId] } as any);
    }
  };

  const allAssigneeIds = (sub: PmTask) => [
    ...(sub.assignee_id ? [sub.assignee_id] : []),
    ...(sub.watchers ?? []).filter(w => w !== sub.assignee_id),
  ];

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
          <div className="w-20">Etapa</div>
          <div className="flex-1">Nome</div>
          <div className="w-20 text-center">Responsável</div>
          <div className="w-6" />
        </div>
      )}

      {/* Rows */}
      <div className="space-y-0">
        {childTasks.map((sub) => {
          const isDone = sub.stage_current === "entrega";
          const isActive = activeSubtaskId === sub.id;
          const subAssignees = allAssigneeIds(sub);

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
              {/* Stage badge */}
              <div className="w-20 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Select value={sub.stage_current} onValueChange={(v) => updateTask.mutate({ id: sub.id, stage_current: v as any })}>
                  <SelectTrigger className="h-6 w-auto border-0 bg-transparent shadow-none p-0">
                    <Badge className={cn("text-[9px] font-bold px-1.5 py-0 rounded", stageColorClass(sub.stage_current))}>
                      {stageLabel(sub.stage_current)}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {PM_STAGES.filter(s => !["roteiro", "edicao"].includes(s.key)).map(s => (
                      <SelectItem key={s.key} value={s.key} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", stageColorClass(s.key).split(" ")[0])} />
                          {s.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="flex-1 min-w-0">
                <span className={cn("truncate text-sm hover:text-primary transition-colors", isDone && "line-through text-muted-foreground")}>{sub.title}</span>
              </div>

              {/* Assignee */}
              <div className="w-20 flex justify-center" onClick={(e) => e.stopPropagation()}>
                {members && members.length > 0 ? (
                  <PmAssigneeSelector
                    selectedIds={subAssignees}
                    membersMap={membersMap}
                    members={members}
                    onToggle={(mId) => toggleAssignee(sub.id, sub, mId)}
                  >
                    <button className="flex items-center -space-x-1">
                      {subAssignees.length > 0 ? subAssignees.slice(0, 2).map(id => {
                        const m = membersMap[id];
                        if (!m) return null;
                        return (
                          <Avatar key={id} className="h-5 w-5 border border-background">
                            <AvatarImage src={m.avatar} />
                            <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{initials(m.name)}</AvatarFallback>
                          </Avatar>
                        );
                      }) : (
                        <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30" />
                      )}
                    </button>
                  </PmAssigneeSelector>
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
