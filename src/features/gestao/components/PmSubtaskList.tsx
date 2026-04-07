import { useState } from "react";
import { Plus, ChevronRight, Check, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PM_ACTIVE_STAGES, getStageCircleColor, stageLabel, tagColor, tagDisplay } from "../pm-constants";
import { useUpdatePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import { getFixedAssignee, getFixedWatchers, useDefaultFlowWithDates } from "./PmStageFlowConfig";
import { SubtaskTrashDialog } from "./SubtaskTrashDialog";
import { toast } from "sonner";
import type { PmTask } from "../pm-types";
import { supabase } from "@/integrations/supabase/client";

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
  const { stageAssignees } = useDefaultFlowWithDates();
  const [newTitle, setNewTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  const handleSoftDelete = async (subId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    updateTask.mutate({ id: subId, deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null } as any, {
      onSuccess: () => deletedSubsQ.refetch(),
    });
    toast("Subtarefa movida para lixeira");
    setDeletingId(null);
  };

  const done = childTasks.filter(s => s.status_global === "concluido").length;
  const total = childTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await createTask.mutateAsync({
      client_id: parentTask.client_id,
      title: newTitle.trim(),
      parent_task_id: parentTask.id,
      stage_current: parentTask.stage_current,
      assignee_id: parentTask.assignee_id ?? undefined,
      watchers: parentTask.watchers ?? [],
    });
    setNewTitle("");
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

  const toggleDone = async (sub: PmTask) => {
    const isDone = sub.status_global === "concluido";
    if (isDone) {
      // Unmark: set back to backlog
      updateTask.mutate({ id: sub.id, status_global: "backlog" as any });
      toast("Subtarefa desmarcada");
    } else {
      // Mark as done (keep same stage, just change status — no scoring for subtasks)
      updateTask.mutate({ id: sub.id, status_global: "concluido" as any });
      toast.success("Subtarefa concluída!");
    }
  };

  const sendToAlteracoes = (sub: PmTask) => {
    const fixedAssignee = getFixedAssignee(stageAssignees, "alteracoes", parentTask.client_id);
    const fixedWatchers = getFixedWatchers(stageAssignees, "alteracoes", parentTask.client_id);
    const updates: any = { id: sub.id, stage_current: "alteracoes" as any, status_global: "backlog" as any };
    if (fixedAssignee !== undefined) {
      updates.assignee_id = fixedAssignee;
      updates.watchers = fixedWatchers;
    }
    updateTask.mutate(updates);
    toast("Subtarefa enviada para Alteração");
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
        <button
          onClick={() => setShowTrash(!showTrash)}
          className={cn(
            "h-auto px-2 py-0.5 flex items-center gap-1 rounded-md text-xs transition-all",
            showTrash
              ? "bg-destructive/10 text-destructive"
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
          )}
          title="Lixeira de subtarefas"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Lixeira
        </button>
      </div>

      {/* Trash panel */}
      {showTrash && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-semibold text-destructive">Subtarefas excluídas</span>
          </div>
          {deletedSubsQ.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (deletedSubsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma subtarefa na lixeira</p>
          ) : (
            <ScrollArea className={cn((deletedSubsQ.data ?? []).length > 4 && "h-[180px]")}>
              <div className="space-y-1">
                {(deletedSubsQ.data ?? []).map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 rounded-md border border-border/30 bg-card/50 px-2 py-1.5">
                    <span className="flex-1 truncate text-xs text-muted-foreground line-through">{sub.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      disabled={restoringId === sub.id}
                      onClick={() => handleRestore(sub.id)}
                    >
                      {restoringId === sub.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Restaurar
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Table header */}
      {total > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
          <div className="w-8 text-center">Etapa</div>
          <div className="flex-1">Nome</div>
          <div className="w-20 text-center">Responsável</div>
          <div className="w-12" />
        </div>
      )}

      {/* Rows */}
      <div className="space-y-0">
        {childTasks.map((sub) => {
          const isDone = sub.status_global === "concluido";
          const isAlt = sub.stage_current === "alteracoes";
          const isActive = activeSubtaskId === sub.id;
          const subAssignees = allAssigneeIds(sub);
          const circleColor = getStageCircleColor(sub.stage_current);

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
              {/* Done toggle + Alteração */}
              <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
                        isDone ? "bg-emerald-500 border-emerald-500" : circleColor.border,
                        isAlt && !isDone && "border-amber-500 bg-amber-500/20"
                      )}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleDone(sub);
                      }}
                    >
                      {isDone && <Check className="h-3 w-3 text-white" />}
                      {isAlt && !isDone && <RotateCcw className="h-3 w-3 text-amber-500" />}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="start">
                    <button
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition"
                      onClick={() => toggleDone(sub)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isDone ? "Desmarcar concluído" : "Marcar como concluído"}
                    </button>
                    <button
                      className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition", isAlt && "bg-accent")}
                      onClick={() => sendToAlteracoes(sub)}
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                      Enviar para Alteração
                    </button>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Tags + Title */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5">
                {(sub.tags ?? []).map(rawTag => {
                  const tc = tagColor(rawTag);
                  const name = tagDisplay(rawTag);
                  return <Badge key={rawTag} className={cn("text-[8px] h-4 px-1 gap-0.5 border-0 shrink-0", tc.bg, tc.text)}>{name}</Badge>;
                })}
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

              {/* Actions on the right of avatar */}
              <div className="w-14 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                <AlertDialog open={deletingId === sub.id} onOpenChange={(open) => !open && setDeletingId(null)}>
                  <AlertDialogTrigger asChild>
                    <button
                      className="h-6 w-6 flex items-center justify-center rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all"
                      onClick={(e) => { e.stopPropagation(); setDeletingId(sub.id); }}
                      aria-label={`Excluir subtarefa ${sub.title}`}
                      title="Mover para lixeira"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="z-[200]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir subtarefa?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A subtarefa <strong>"{sub.title}"</strong> será movida para a lixeira. Os pontos de performance não serão contabilizados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleSoftDelete(sub.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition" onClick={() => onSelectSubtask?.(sub)} />
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
