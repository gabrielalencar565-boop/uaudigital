import { useState } from "react";
import { CheckCircle2, Circle, AlertOctagon, Plus, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PM_SUBTASK_STATUSES, subtaskStatusMeta, stageLabel } from "../pm-constants";
import { useUpdatePmSubtask, useCreatePmSubtask } from "../hooks/use-pm-data";
import type { PmSubtask } from "../pm-types";

function initials(n: string) { return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join(""); }

function statusIcon(status: string) {
  switch (status) {
    case "concluido": return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "bloqueado": return <AlertOctagon className="h-4 w-4 text-destructive" />;
    case "em_producao": return <Circle className="h-4 w-4 text-primary fill-primary/20" />;
    case "em_revisao": return <Circle className="h-4 w-4 text-warning fill-warning/20" />;
    case "aprovado": return <CheckCircle2 className="h-4 w-4 text-success/60" />;
    case "aguardando": return <Circle className="h-4 w-4 text-warning" />;
    default: return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusDot(status: string) {
  switch (status) {
    case "concluido": return "bg-success";
    case "bloqueado": return "bg-destructive";
    case "em_producao": return "bg-primary";
    case "em_revisao": return "bg-warning";
    case "aprovado": return "bg-success/60";
    case "aguardando": return "bg-warning/60";
    default: return "bg-muted-foreground/40";
  }
}

interface Props {
  taskId: string;
  subtasks: PmSubtask[];
  membersMap: Record<string, { name: string; avatar?: string }>;
}

export function PmSubtaskList({ taskId, subtasks, membersMap }: Props) {
  const updateSub = useUpdatePmSubtask();
  const createSub = useCreatePmSubtask();
  const [newTitle, setNewTitle] = useState("");

  const done = subtasks.filter(s => s.status === "concluido").length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await createSub.mutateAsync({
      task_id: taskId,
      title: newTitle.trim(),
      description: null,
      stage: "planejamento",
      status: "nao_iniciado",
      assignee_id: null,
      due_date: null,
      order_index: subtasks.length,
      is_required: false,
    });
    setNewTitle("");
  };

  const toggleDone = (sub: PmSubtask) => {
    const newStatus = sub.status === "concluido" ? "nao_iniciado" : "concluido";
    updateSub.mutate({ id: sub.id, status: newStatus, task_id: sub.task_id });
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold">Subtarefas</h3>
        <span className="text-xs text-muted-foreground">{done}/{total}</span>
        {total > 0 && (
          <div className="flex-1 max-w-40">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-success" : "bg-primary")} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {total > 0 && <span className="text-xs text-muted-foreground">{progress}%</span>}
      </div>

      {/* List */}
      <div className="space-y-0.5">
        {subtasks.map((sub) => {
          const member = sub.assignee_id ? membersMap[sub.assignee_id] : undefined;
          const isDone = sub.status === "concluido";

          return (
            <div
              key={sub.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-2 transition hover:bg-card/40",
                isDone && "opacity-50"
              )}
            >
              {/* Status toggle */}
              <button type="button" onClick={() => toggleDone(sub)} className="shrink-0 hover:scale-110 transition-transform">
                {statusIcon(sub.status)}
              </button>

              {/* Title */}
              <span className={cn("flex-1 truncate text-sm", isDone && "line-through text-muted-foreground")}>{sub.title}</span>

              {/* Stage badge */}
              <span className="hidden sm:inline text-[10px] rounded px-1.5 py-0.5 bg-accent/50 text-accent-foreground shrink-0">
                {stageLabel(sub.stage)}
              </span>

              {/* Status select */}
              <Select
                value={sub.status}
                onValueChange={(v) => updateSub.mutate({ id: sub.id, status: v, task_id: sub.task_id })}
              >
                <SelectTrigger className="h-6 w-28 text-[10px] border-0 bg-transparent shadow-none shrink-0">
                  <div className="flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", statusDot(sub.status))} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {PM_SUBTASK_STATUSES.map((s) => (
                    <SelectItem key={s.key} value={s.key} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(s.key))} />
                        {s.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Assignee */}
              {member ? (
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={member.avatar} />
                  <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{initials(member.name)}</AvatarFallback>
                </Avatar>
              ) : (
                <div className="h-5 w-5 shrink-0 rounded-full border border-dashed border-muted-foreground/30" />
              )}
            </div>
          );
        })}
      </div>

      {/* Add subtask - ClickUp style */}
      <div className="flex items-center gap-2 pl-2">
        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Adicionar Subtask"
          className="h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/60"
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
