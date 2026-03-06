import { useState } from "react";
import { Plus, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PM_STAGES, stageColorClass, stageLabel } from "../pm-constants";
import { useUpdatePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import type { PmTask } from "../pm-types";

function initials(n: string) { return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join(""); }

const ACTIVE_STAGES = PM_STAGES.filter(s => !["roteiro", "edicao"].includes(s.key));

// Circle color per stage (solid)
const CIRCLE_COLOR: Record<string, string> = {
  planejamento: "border-muted-foreground text-muted-foreground",
  captacao: "border-emerald-500 text-emerald-500",
  edicao_videos: "border-primary text-primary",
  design: "border-emerald-500 text-emerald-500",
  revisao: "border-amber-500 text-amber-500",
  pdf: "border-orange-500 text-orange-500",
  entrega: "border-emerald-500 text-emerald-500 bg-emerald-500",
  alteracoes: "border-amber-500 text-amber-500",
  agendamento: "border-violet-500 text-violet-500",
};

const CIRCLE_BG: Record<string, string> = {
  entrega: "bg-emerald-500",
};

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
    if (result && onSelectSubtask) onSelectSubtask(result as PmTask);
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

  const changeStage = (subId: string, newStage: string) => {
    updateTask.mutate({ id: subId, stage_current: newStage as any });
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
              <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Table header */}
      {total > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
          <div className="w-8 text-center">Etapa</div>
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
          const circleColor = CIRCLE_COLOR[sub.stage_current] ?? "border-muted-foreground text-muted-foreground";

          return (
            <div
              key={sub.id}
              className={cn(
                "group flex items-center gap-2 px-2 py-2 transition border-b border-border/10 cursor-pointer",
                isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-card/40",
                isDone && "opacity-60"
              )}
              onClick={() => onSelectSubtask?.(sub)}
            >
              {/* Stage circle */}
              <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
                      circleColor,
                      isDone && "bg-emerald-500 border-emerald-500"
                    )}>
                      {isDone && <Check className="h-3 w-3 text-white" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="start">
                    {ACTIVE_STAGES.map(s => {
                      const sColor = CIRCLE_COLOR[s.key] ?? "border-muted-foreground";
                      const isEntrega = s.key === "entrega";
                      return (
                        <button
                          key={s.key}
                          className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition", sub.stage_current === s.key && "bg-accent")}
                          onClick={() => changeStage(sub.id, s.key)}
                        >
                          <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", sColor, isEntrega && "bg-emerald-500 border-emerald-500")}>
                            {isEntrega && <Check className="h-2.5 w-2.5 text-white" />}
                          </span>
                          {s.label}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
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
