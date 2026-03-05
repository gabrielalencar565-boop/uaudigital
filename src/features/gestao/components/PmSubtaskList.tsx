import { useState } from "react";
import { CheckCircle2, Circle, AlertOctagon, Plus } from "lucide-react";
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
      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Subtarefas</span>
        <span className="text-xs text-muted-foreground">{done}/{total}</span>
        {total > 0 && (
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-success" : "bg-primary")} style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-1">
        {subtasks.map((sub) => {
          const meta = subtaskStatusMeta(sub.status);
          const member = sub.assignee_id ? membersMap[sub.assignee_id] : undefined;
          const isDone = sub.status === "concluido";
          const isBlocked = sub.status === "bloqueado";

          return (
            <div key={sub.id} className={cn("flex items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-card/40", isDone && "opacity-60")}>
              <button type="button" onClick={() => toggleDone(sub)} className="shrink-0">
                {isDone ? <CheckCircle2 className="h-4 w-4 text-success" /> : isBlocked ? <AlertOctagon className="h-4 w-4 text-destructive" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              </button>

              <span className={cn("flex-1 truncate text-sm", isDone && "line-through")}>{sub.title}</span>

              <Badge variant="outline" className="text-[10px] h-5 shrink-0">{stageLabel(sub.stage)}</Badge>

              <Select
                value={sub.status}
                onValueChange={(v) => updateSub.mutate({ id: sub.id, status: v, task_id: sub.task_id })}
              >
                <SelectTrigger className="h-6 w-24 text-[10px] border-0 bg-transparent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PM_SUBTASK_STATUSES.map((s) => (
                    <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {member && (
                <Avatar className="h-5 w-5 shrink-0">
                  <AvatarImage src={member.avatar} />
                  <AvatarFallback className="text-[8px]">{initials(member.name)}</AvatarFallback>
                </Avatar>
              )}
            </div>
          );
        })}
      </div>

      {/* Add subtask */}
      <div className="flex items-center gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nova subtarefa..."
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <Button size="sm" variant="ghost" onClick={handleAdd} disabled={!newTitle.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
