import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, User, Flag, CheckCircle2, Plus, MoreHorizontal, Archive, Trash2, Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { priorityMeta, stageLabel, stageColorClass, tagColor } from "../pm-constants";
import { useUpdatePmTask, useDeletePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

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

interface Props {
  task: PmTask;
  clientName: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  childTasks?: PmTask[];
  onClick: () => void;
  isAdmin?: boolean;
}

export function PmTaskCard({ task, clientName, assigneeName, assigneeAvatar, childTasks = [], onClick, isAdmin }: Props) {
  const prio = priorityMeta(task.priority);
  const done = childTasks.filter((s) => s.status_global === "concluido").length;
  const total = childTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const updateTask = useUpdatePmTask();
  const deleteTask = useDeletePmTask();
  const createTask = useCreatePmTask();
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState("");

  const toggleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status_global === "concluido" ? "em_andamento" : "concluido";
    updateTask.mutate({ id: task.id, status_global: newStatus as any });
  };

  const handleAddSubtask = async () => {
    if (!newSubTitle.trim()) { setAddingSubtask(false); return; }
    await createTask.mutateAsync({
      client_id: task.client_id,
      title: newSubTitle.trim(),
      parent_task_id: task.id,
      stage_current: "planejamento",
    });
    setNewSubTitle("");
    setAddingSubtask(false);
    toast.success("Subtarefa criada");
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask.mutate({ id: task.id, status_global: "cancelado" as any });
    toast.success("Tarefa arquivada");
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir esta tarefa e todas as subtarefas?")) return;
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success("Tarefa excluída");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir");
    }
  };

  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");

  const handleRename = () => {
    if (renameDraft.trim() && renameDraft.trim() !== task.title) {
      updateTask.mutate({ id: task.id, title: renameDraft.trim() });
    }
    setRenaming(false);
  };

  return (
    <div className="group w-full rounded-md border border-border/50 bg-card/40 text-left transition hover:bg-card/70 hover:border-border overflow-hidden">
      {/* Cover image */}
      {task.cover_url && (
        <div className="w-full h-24 overflow-hidden">
          <img src={task.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <button type="button" onClick={onClick} className="w-full p-3 text-left">
        <div className="flex items-start gap-2.5">
          <div className={cn("mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2", statusDot(task.status_global))} />
          <div className="min-w-0 flex-1 space-y-1.5">
            {renaming ? (
              <Input
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium h-6 border-0 bg-transparent p-0 focus-visible:ring-0"
              />
            ) : (
              <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{task.title}</p>
            )}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="truncate">{clientName}</span>
               <span className="text-border">•</span>
               <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", stageColorClass(task.stage_current))}>
                 {stageLabel(task.stage_current)}
               </span>
            </div>
            {task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {task.tags.slice(0, 3).map((tag) => {
                  const tc = tagColor(tag);
                  return (
                    <span key={tag} className={cn("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium", tc.bg, tc.text)}>
                      <span className={cn("h-1 w-1 rounded-full", tc.dot)} />
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}
            {total > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-success" : "bg-primary/70")}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{done}/{total}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex items-center gap-0.5 text-[10px] font-semibold", prio.color)}>
                  <Flag className="h-2.5 w-2.5" /> {prio.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {task.due_date && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <CalendarDays className="h-2.5 w-2.5" />
                    {format(new Date(task.due_date + "T12:00:00"), "dd/MM")}
                  </span>
                )}
                {assigneeName ? (
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={assigneeAvatar} />
                    <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{initials(assigneeName)}</AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center">
                    <User className="h-2.5 w-2.5 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </button>

      {/* Action bar at bottom of card */}
      <div className="flex items-center justify-end gap-0.5 px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Check complete */}
        <Button
          variant="ghost" size="icon"
          className={cn("h-6 w-6", task.status_global === "concluido" && "text-success")}
          onClick={toggleComplete}
          title="Concluir"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </Button>

        {/* Add subtask */}
        {addingSubtask ? (
          <Input
            autoFocus value={newSubTitle}
            onChange={(e) => setNewSubTitle(e.target.value)}
            placeholder="Subtarefa..."
            className="h-6 w-28 text-[10px]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); if (e.key === "Escape") setAddingSubtask(false); }}
            onBlur={handleAddSubtask}
          />
        ) : (
          <Button
            variant="ghost" size="icon" className="h-6 w-6"
            onClick={(e) => { e.stopPropagation(); setAddingSubtask(true); }}
            title="Adicionar subtarefa"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => { setRenameDraft(task.title); setRenaming(true); }} className="text-xs gap-2">
              <Pencil className="h-3.5 w-3.5" /> Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive} className="text-xs gap-2">
              <Archive className="h-3.5 w-3.5" /> Arquivar
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={handleDelete} className="text-xs gap-2 text-destructive focus:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
