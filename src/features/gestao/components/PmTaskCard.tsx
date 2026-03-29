import { useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { Calendar, UserCircle, Flag, Plus, MoreHorizontal, Archive, Trash2, Pencil, Link2, AlertTriangle, Clapperboard, Palette } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  assignees?: { id: string; name: string; avatar?: string }[];
  childTasks?: PmTask[];
  onClick: () => void;
  isAdmin?: boolean;
}

export function PmTaskCard({ task, clientName, assignees = [], childTasks = [], onClick, isAdmin }: Props) {
  const prio = priorityMeta(task.priority);
  const total = childTasks.length;
  const updateTask = useUpdatePmTask();
  const deleteTask = useDeletePmTask();
  const createTask = useCreatePmTask();
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const handleAddSubtask = async () => {
    if (!newSubTitle.trim()) { setAddingSubtask(false); return; }
    await createTask.mutateAsync({ client_id: task.client_id, title: newSubTitle.trim(), parent_task_id: task.id, stage_current: "planejamento" });
    setNewSubTitle(""); setAddingSubtask(false);
    toast.success("Subtarefa criada");
  };

  const handleArchive = (e: React.MouseEvent) => { e.stopPropagation(); updateTask.mutate({ id: task.id, status_global: "cancelado" as any }); toast.success("Tarefa arquivada"); };
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmOpen(true);
  };
  const confirmDelete = async () => {
    try { await deleteTask.mutateAsync(task.id); toast.success("Tarefa excluída"); } catch (err: any) { toast.error(err?.message ?? "Erro ao excluir"); }
    setDeleteConfirmOpen(false);
  };

  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const handleRename = () => { if (renameDraft.trim() && renameDraft.trim() !== task.title) updateTask.mutate({ id: task.id, title: renameDraft.trim() }); setRenaming(false); };

  const dueDateOverdue = task.due_date && isPast(new Date(task.due_date + "T23:59:59")) && !isToday(new Date(task.due_date + "T12:00:00"));
  const visibleAssignees = assignees.slice(0, 2);
  const extraAssignees = Math.max(assignees.length - visibleAssignees.length, 0);

  return (
    <div className={cn(
      "calendar-card-hover group w-full rounded-xl border shadow-sm transition-all duration-300 ease-out overflow-hidden",
      task.stage_current === "alteracoes" && task.post_type
        ? "bg-[#E5C94E] border-[#E5C94E]/60"
        : "border-border/20 bg-card"
    )}>
      {task.cover_url && (
        <div className="w-full h-20 overflow-hidden">
          <img src={task.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <button type="button" onClick={onClick} className="w-full p-3.5 text-left space-y-2.5">
        {/* Client name pill */}
        <span className="inline-flex items-center rounded-md bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary/70 tracking-wide">
          {clientName}
        </span>

        {/* Title */}
        {renaming ? (
          <Input autoFocus value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false); }}
            onClick={(e) => e.stopPropagation()} className="text-sm font-semibold h-6 border-0 bg-transparent p-0 focus-visible:ring-0" />
        ) : (
          <p className="text-[13px] font-semibold leading-snug text-foreground/90">{task.title}</p>
        )}

        {/* Post type badge — show origin in revisão */}
        {task.post_type && (task.stage_current === "revisao" || task.stage_current === "alteracoes") && (
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold text-white tracking-wide",
            task.post_type === "video"
              ? "bg-gradient-to-r from-pink-500 to-blue-500"
              : "bg-gradient-to-r from-pink-500 to-teal-500"
          )}>
            {task.stage_current === "alteracoes"
              ? (task.post_type === "video" ? <><Clapperboard className="h-3 w-3" /> ALT/VDO</> : <><Palette className="h-3 w-3" /> ALT/DSG</>)
              : (task.post_type === "video" ? <><Clapperboard className="h-3 w-3" /> REV/Vídeo</> : <><Palette className="h-3 w-3" /> REV/DSG</>)
            }
          </span>
        )}
        {task.post_type && ["planejamento", "design", "edicao_videos"].includes(task.stage_current) && (
          <span className={cn(
            "inline-flex items-center justify-center rounded-md h-5 w-5",
            task.post_type === "video"
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400"
              : "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400"
          )}>
            {task.post_type === "video" ? <Clapperboard className="h-2.5 w-2.5" /> : <Palette className="h-2.5 w-2.5" />}
          </span>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((rawTag) => {
              const tc = tagColor(rawTag);
              const name = tagDisplay(rawTag);
              return <span key={rawTag} className={cn("inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-semibold", tc.bg, tc.text)}>{name}</span>;
            })}
          </div>
        )}

        {/* Bottom row */}
        <div className="flex items-center gap-2 pt-1">
          {/* Assignees avatars */}
          {visibleAssignees.length > 0 ? (
            <div className="flex items-center">
              {visibleAssignees.map((assignee, index) => (
                <Avatar key={assignee.id} className={cn("h-6 w-6 ring-2 ring-background", index > 0 && "-ml-2")}> 
                  <AvatarImage src={assignee.avatar} />
                  <AvatarFallback className="text-[8px] bg-primary/10 text-primary font-bold">{initials(assignee.name)}</AvatarFallback>
                </Avatar>
              ))}
              {extraAssignees > 0 && (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-semibold text-muted-foreground">
                  +{extraAssignees}
                </span>
              )}
            </div>
          ) : (
            <div className="h-6 w-6 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
              <UserCircle className="h-3.5 w-3.5 text-muted-foreground/25" />
            </div>
          )}

          {/* Due date badge */}
          {task.due_date && (
            <span className={cn(
              "flex items-center gap-1 text-[10px] font-semibold rounded-md px-2 py-0.5",
              dueDateOverdue ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"
            )}>
              <Calendar className="h-3 w-3" />
              {format(new Date(task.due_date + "T12:00:00"), "MMM d").toLowerCase()}
            </span>
          )}

          {/* Priority flag */}
          {task.priority === "urgente" && (
            <span className="flex items-center gap-0.5 text-destructive bg-destructive/10 rounded-md px-1.5 py-0.5">
              <Flag className="h-3 w-3" fill="currentColor" />
            </span>
          )}
          {task.priority === "alta" && (
            <span className="flex items-center gap-0.5 text-warning bg-warning/10 rounded-md px-1.5 py-0.5">
              <Flag className="h-3 w-3" fill="currentColor" />
            </span>
          )}

          <div className="flex-1" />

          {/* Subtask count */}
          {total > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground/60 bg-muted/60 rounded-md px-1.5 py-0.5">
              <Link2 className="h-3 w-3" />
              {total}
            </span>
          )}
        </div>
      </button>

      {/* Hover action bar */}
      <div className="flex items-center justify-end gap-0.5 px-3 pb-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {addingSubtask ? (
          <Input autoFocus value={newSubTitle} onChange={(e) => setNewSubTitle(e.target.value)} placeholder="Subtarefa..."
            className="h-7 w-32 text-[10px] rounded-lg" onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddSubtask(); if (e.key === "Escape") setAddingSubtask(false); }}
            onBlur={handleAddSubtask} />
        ) : (
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={(e) => { e.stopPropagation(); setAddingSubtask(true); }} title="Adicionar subtarefa">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl z-[200]" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => { setRenameDraft(task.title); setRenaming(true); }} className="text-xs gap-2 rounded-lg"><Pencil className="h-3.5 w-3.5" /> Renomear</DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive} className="text-xs gap-2 rounded-lg"><Archive className="h-3.5 w-3.5" /> Arquivar</DropdownMenuItem>
            {isAdmin && <DropdownMenuItem onClick={handleDelete} className="text-xs gap-2 text-destructive focus:text-destructive rounded-lg"><Trash2 className="h-3.5 w-3.5" /> Excluir</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir tarefa?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Tem certeza que deseja excluir <strong>"{task.title}"</strong>?</span>
              <span className="block text-destructive font-medium">
                ⚠️ Os pontos de performance não serão contabilizados e a etapa será desmarcada no Magic Number.
              </span>
              {total > 0 && (
                <span className="block text-muted-foreground">
                  {total} subtarefa{total > 1 ? "s" : ""} também será{total > 1 ? "ão" : ""} excluída{total > 1 ? "s" : ""}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
