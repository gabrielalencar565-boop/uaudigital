import { useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { CalendarDays, User, Flag, Plus, MoreHorizontal, Archive, Trash2, Pencil, Link2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { priorityMeta, tagColor, tagDisplay } from "../pm-constants";
import { useUpdatePmTask, useDeletePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
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
  const total = childTasks.length;
  const updateTask = useUpdatePmTask();
  const deleteTask = useDeletePmTask();
  const createTask = useCreatePmTask();
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState("");

  const handleAddSubtask = async () => {
    if (!newSubTitle.trim()) { setAddingSubtask(false); return; }
    await createTask.mutateAsync({ client_id: task.client_id, title: newSubTitle.trim(), parent_task_id: task.id, stage_current: "planejamento" });
    setNewSubTitle(""); setAddingSubtask(false);
    toast.success("Subtarefa criada");
  };

  const handleArchive = (e: React.MouseEvent) => { e.stopPropagation(); updateTask.mutate({ id: task.id, status_global: "cancelado" as any }); toast.success("Tarefa arquivada"); };
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Excluir esta tarefa e todas as subtarefas?")) return;
    try { await deleteTask.mutateAsync(task.id); toast.success("Tarefa excluída"); } catch (err: any) { toast.error(err?.message ?? "Erro ao excluir"); }
  };

  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const handleRename = () => { if (renameDraft.trim() && renameDraft.trim() !== task.title) updateTask.mutate({ id: task.id, title: renameDraft.trim() }); setRenaming(false); };

  const dueDateOverdue = task.due_date && isPast(new Date(task.due_date + "T23:59:59")) && !isToday(new Date(task.due_date + "T12:00:00"));

  return (
    <div className="group w-full rounded-lg border border-border/30 bg-card text-left transition hover:border-border/60 overflow-hidden shadow-sm">
      {task.cover_url && (
        <div className="w-full h-20 overflow-hidden">
          <img src={task.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <button type="button" onClick={onClick} className="w-full p-3 text-left space-y-2.5">
        {/* Title */}
        {renaming ? (
          <Input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
            onClick={(e) => e.stopPropagation()} className="text-sm font-semibold h-6 border-0 bg-transparent p-0 focus-visible:ring-0" />
        ) : (
          <p className="text-sm font-semibold leading-snug">{task.title}</p>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((rawTag) => {
              const tc = tagColor(rawTag);
              const name = tagDisplay(rawTag);
              return <span key={rawTag} className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium", tc.bg, tc.text)}>{name}</span>;
            })}
          </div>
        )}

        {/* Bottom row: avatar, date, priority flag, subtask count */}
        <div className="flex items-center gap-2 pt-0.5">
          {/* Assignee avatar */}
          {assigneeName ? (
            <Avatar className="h-6 w-6 border border-border/30">
              <AvatarImage src={assigneeAvatar} />
              <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials(assigneeName)}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-6 w-6 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center">
              <User className="h-3 w-3 text-muted-foreground/30" />
            </div>
          )}

          {/* Due date badge */}
          {task.due_date && (
            <span className={cn(
              "flex items-center gap-1 text-[10px] font-medium rounded px-1.5 py-0.5",
              dueDateOverdue ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"
            )}>
              <CalendarDays className="h-3 w-3" />
              {format(new Date(task.due_date + "T12:00:00"), "MMM d").toLowerCase()}
            </span>
          )}

          {/* Priority flag */}
          {task.priority === "urgente" && (
            <span className="flex items-center text-destructive">
              <Flag className="h-3 w-3" />
            </span>
          )}
          {task.priority === "alta" && (
            <span className="flex items-center text-warning">
              <Flag className="h-3 w-3" />
            </span>
          )}

          <div className="flex-1" />

          {/* Subtask count */}
          {total > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Link2 className="h-3 w-3" />
              {total} subtarefas
            </span>
          )}
        </div>
      </button>

      {/* Hover action bar */}
      <div className="flex items-center justify-end gap-0.5 px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {addingSubtask ? (
          <Input autoFocus value={newSubTitle} onChange={(e) => setNewSubTitle(e.target.value)} placeholder="Subtarefa..."
            className="h-6 w-28 text-[10px]" onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); if (e.key === "Escape") setAddingSubtask(false); }}
            onBlur={handleAddSubtask} />
        ) : (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setAddingSubtask(true); }} title="Adicionar subtarefa">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => { setRenameDraft(task.title); setRenaming(true); }} className="text-xs gap-2"><Pencil className="h-3.5 w-3.5" /> Renomear</DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive} className="text-xs gap-2"><Archive className="h-3.5 w-3.5" /> Arquivar</DropdownMenuItem>
            {isAdmin && <DropdownMenuItem onClick={handleDelete} className="text-xs gap-2 text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
