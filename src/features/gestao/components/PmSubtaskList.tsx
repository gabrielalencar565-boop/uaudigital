import { useState, useEffect } from "react";
import { Plus, ChevronRight, Check, RotateCcw, Trash2, Pencil, X, Tag as TagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PM_ACTIVE_STAGES, getStageCircleColor, stageLabel, tagColor, tagDisplay } from "../pm-constants";
import { useUpdatePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import { usePmTags } from "../hooks/use-pm-tags";
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
  readOnly?: boolean;
  correctionMode?: boolean;
}

export function PmSubtaskList({ parentTask, childTasks, membersMap, members, onSelectSubtask, activeSubtaskId, readOnly, correctionMode }: Props) {
  const updateTask = useUpdatePmTask();
  const createTask = useCreatePmTask();
  const { stageAssignees } = useDefaultFlowWithDates();
  const [newTitle, setNewTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(childTasks.map(s => s.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const handleSoftDelete = async (subId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    updateTask.mutate({ id: subId, deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null } as any);
    toast("Subtarefa movida para lixeira");
    setDeletingId(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const ids = Array.from(selectedIds);
    const nowIso = new Date().toISOString();
    ids.forEach(id => {
      updateTask.mutate({ id, deleted_at: nowIso, deleted_by: user?.id ?? null } as any);
    });
    toast.success(`${ids.length} subtarefa${ids.length !== 1 ? "s" : ""} movida${ids.length !== 1 ? "s" : ""} para lixeira`);
    clearSelection();
    setBulkConfirmOpen(false);
  };

  // Keyboard shortcuts: Delete/Backspace -> bulk delete, ESC -> clear selection
  useEffect(() => {
    if (selectedIds.size === 0 || readOnly) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;
      if (isEditable) return;
      if (e.key === "Escape") {
        e.preventDefault();
        clearSelection();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setBulkConfirmOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, readOnly]);

  const done = childTasks.filter(s => s.status_global === "concluido").length;
  const total = childTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleAdd = async () => {
    if (!newTitle.trim() || readOnly) return;
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

  const toggleAssignee = async (subId: string, sub: PmTask, memberId: string) => {
    const currentWatchers = sub.watchers ?? [];
    const oldAssignee = sub.assignee_id;

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

    // Log and resync if in correction mode
    if (correctionMode) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Log the change
        const sb = supabase as any;
        await sb.from("pm_activity_log").insert({
          entity_type: "task",
          entity_id: parentTask.id,
          action: "correction_assignee",
          metadata: {
            subtask_id: subId,
            subtask_title: sub.title,
            old_assignee: oldAssignee,
            new_assignee: memberId,
            changed_by: user.id,
          },
          created_by: user.id,
        });

        // Resync scoring
        try {
          await supabase.rpc("pm_resync_correction" as any, {
            _pm_task_id: parentTask.id,
            _completed_stage: parentTask.stage_current,
          });
          toast.success("Pontuação recalculada");
        } catch (e) {
          console.error("Error resyncing:", e);
        }
      }
    }
  };

  const allAssigneeIds = (sub: PmTask) => [
    ...(sub.assignee_id ? [sub.assignee_id] : []),
    ...(sub.watchers ?? []).filter(w => w !== sub.assignee_id),
  ];

  const toggleDone = async (sub: PmTask) => {
    if (readOnly) return;
    const isDone = sub.status_global === "concluido";
    if (isDone) {
      updateTask.mutate({ id: sub.id, status_global: "backlog" as any });
      toast("Subtarefa desmarcada");
    } else {
      updateTask.mutate({ id: sub.id, status_global: "concluido" as any });
      toast.success("Subtarefa concluída!");
    }
  };

  const sendToAlteracoes = (sub: PmTask) => {
    if (readOnly) return;
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
        {correctionMode && (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 text-[10px]">
            <Pencil className="h-3 w-3" /> Modo correção
          </Badge>
        )}
        {!readOnly && (
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
        )}
      </div>

      {!readOnly && (
        <SubtaskTrashDialog
          parentTaskId={parentTask.id}
          open={showTrash}
          onOpenChange={setShowTrash}
          membersMap={membersMap}
        />
      )}

      {/* Bulk selection bar */}
      {!readOnly && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium text-primary">
              {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground hidden sm:inline">
              · <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Delete</kbd> para excluir · <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> para cancelar
            </span>
          </div>
          <div className="flex items-center gap-1">
            {selectedIds.size < total && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>
                Selecionar todas
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setBulkConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={clearSelection} title="Cancelar seleção">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent className="z-[200]" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} subtarefa{selectedIds.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedIds.size === 1 ? "A subtarefa selecionada será movida" : `As ${selectedIds.size} subtarefas selecionadas serão movidas`} para a lixeira. Os pontos de performance não serão contabilizados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={(e) => { e.stopPropagation(); handleBulkDelete(); }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single delete confirmation (shared, outside rows) */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="z-[200]" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir subtarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const t = childTasks.find(s => s.id === deletingId);
                return <>A subtarefa <strong>"{t?.title ?? ""}"</strong> será movida para a lixeira. Os pontos de performance não serão contabilizados.</>;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.stopPropagation();
                if (deletingId) handleSoftDelete(deletingId);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Table header */}
      {total > 0 && (
        <div className="flex items-center gap-2 px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20">
          {!readOnly && (
            <div className="w-5 flex justify-center" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedIds.size > 0 && selectedIds.size === total}
                onCheckedChange={(c) => c ? selectAll() : clearSelection()}
                aria-label="Selecionar todas"
                className="h-3.5 w-3.5"
              />
            </div>
          )}
          <div className="w-8 text-center">Etapa</div>
          <div className="flex-1">Nome</div>
          <div className="w-20 text-center">Responsável</div>
          {!readOnly && <div className="w-12" />}
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

          const isSelected = selectedIds.has(sub.id);

          return (
            <div
              key={sub.id}
              className={cn(
                "group flex items-center gap-2 px-2 py-2 transition border-b border-border/10 cursor-pointer",
                isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-card/40",
                isSelected && "bg-primary/5 ring-1 ring-primary/30 ring-inset",
                isDone && !correctionMode && "opacity-60"
              )}
              onClick={(e) => {
                if (deletingId || bulkConfirmOpen) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                onSelectSubtask?.(sub);
              }}
            >
              {/* Selection checkbox */}
              {!readOnly && (
                <div className="w-5 flex justify-center" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(sub.id)}
                    aria-label={`Selecionar ${sub.title}`}
                    className={cn("h-3.5 w-3.5 transition-opacity", selectedIds.size > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                  />
                </div>
              )}
              {/* Done toggle + Alteração */}
              <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                {readOnly && !correctionMode ? (
                  <span
                    className={cn(
                      "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                      isDone ? "bg-emerald-500 border-emerald-500" : circleColor.border,
                      isAlt && !isDone && "border-amber-500 bg-amber-500/20"
                    )}
                  >
                    {isDone && <Check className="h-3 w-3 text-white" />}
                    {isAlt && !isDone && <RotateCcw className="h-3 w-3 text-amber-500" />}
                  </span>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={cn(
                          "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
                          isDone ? "bg-emerald-500 border-emerald-500" : circleColor.border,
                          isAlt && !isDone && "border-amber-500 bg-amber-500/20"
                        )}
                        onClick={(e) => {
                          if (readOnly) return;
                          e.preventDefault();
                          e.stopPropagation();
                          toggleDone(sub);
                        }}
                      >
                        {isDone && <Check className="h-3 w-3 text-white" />}
                        {isAlt && !isDone && <RotateCcw className="h-3 w-3 text-amber-500" />}
                      </button>
                    </PopoverTrigger>
                    {!readOnly && (
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
                    )}
                  </Popover>
                )}
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

              {/* Assignee - always visible, clickable in correction mode or normal mode */}
              <div className="w-20 flex justify-center" onClick={(e) => e.stopPropagation()}>
                {members && members.length > 0 && (!readOnly || correctionMode) ? (
                  <PmAssigneeSelector
                    selectedIds={subAssignees}
                    membersMap={membersMap}
                    members={members}
                    onToggle={(mId) => toggleAssignee(sub.id, sub, mId)}
                  >
                    <button className={cn("flex items-center -space-x-1", correctionMode && "ring-2 ring-amber-500/30 rounded-full p-0.5")}>
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
                  <div className="flex items-center -space-x-1">
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
                  </div>
                )}
              </div>

              {/* Actions - hidden in readOnly */}
              {!readOnly && (
                <div className="w-14 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded-md text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeletingId(sub.id);
                    }}
                    aria-label={`Excluir subtarefa ${sub.title}`}
                    title="Mover para lixeira"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition" />
                </div>
              )}

              {/* Correction mode: show chevron for navigation */}
              {readOnly && (
                <div className="w-6 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add subtask - hidden in readOnly */}
      {!readOnly && (
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
      )}
    </div>
  );
}
