import { useState } from "react";
import { CheckCircle2, Circle, AlertOctagon, Plus, Flag, Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PM_SUBTASK_STATUSES, stageLabel } from "../pm-constants";
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
  members?: { id: string; name: string }[];
  parentTitle?: string;
  onSelectSubtask?: (subtask: PmSubtask) => void;
  activeSubtaskId?: string | null;
}

export function PmSubtaskList({ taskId, subtasks, membersMap, members, onSelectSubtask, activeSubtaskId }: Props) {
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

  const toggleStatus = (sub: PmSubtask) => {
    const newStatus = sub.status === "concluido" ? "nao_iniciado" : "concluido";
    updateSub.mutate({ id: sub.id, status: newStatus, task_id: sub.task_id });
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
          <div className="w-24 text-center hidden sm:block">Status</div>
          <div className="w-20 text-center">Responsável</div>
          <div className="w-8 text-center"><Clock className="h-3 w-3 mx-auto" /></div>
          <div className="w-6" />
        </div>
      )}

      {/* Rows */}
      <div className="space-y-0">
        {subtasks.map((sub) => {
          const member = sub.assignee_id ? membersMap[sub.assignee_id] : undefined;
          const isDone = sub.status === "concluido";
          const isActive = activeSubtaskId === sub.id;

          return (
            <div
              key={sub.id}
              className={cn(
                "group flex items-center gap-2 px-2 py-2 transition border-b border-border/10 cursor-pointer",
                isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-card/40",
                isDone && "opacity-50"
              )}
            >
              {/* Status icon - click toggles completion */}
              <div
                className="shrink-0 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); toggleStatus(sub); }}
              >
                {statusIcon(sub.status)}
              </div>

              {/* Title + stage - click opens detail */}
              <div
                className="flex-1 flex items-center gap-2 min-w-0"
                onClick={() => onSelectSubtask?.(sub)}
              >
                <span className={cn("truncate text-sm hover:text-primary transition-colors", isDone && "line-through text-muted-foreground")}>{sub.title}</span>
                <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0 hidden sm:inline-flex">
                  {stageLabel(sub.stage)}
                </Badge>
              </div>

              {/* Status select */}
              <div className="w-24 hidden sm:block" onClick={(e) => e.stopPropagation()}>
                <Select
                  value={sub.status}
                  onValueChange={(v) => updateSub.mutate({ id: sub.id, status: v, task_id: sub.task_id })}
                >
                  <SelectTrigger className="h-6 text-[10px] border-0 bg-transparent shadow-none px-1">
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
              </div>

              {/* Assignee */}
              <div className="w-20 flex justify-center" onClick={(e) => e.stopPropagation()}>
                {members && members.length > 0 ? (
                  <Select
                    value={sub.assignee_id ?? "__none__"}
                    onValueChange={(v) => updateSub.mutate({ id: sub.id, assignee_id: v === "__none__" ? null : v, task_id: sub.task_id })}
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

              {/* Due date indicator */}
              <div className="w-8 flex justify-center">
                {sub.due_date ? (
                  <span className="text-[9px] text-muted-foreground">{sub.due_date.slice(5)}</span>
                ) : (
                  <Flag className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition" />
                )}
              </div>

              {/* Open indicator */}
              <div className="w-6 flex justify-center" onClick={() => onSelectSubtask?.(sub)}>
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
