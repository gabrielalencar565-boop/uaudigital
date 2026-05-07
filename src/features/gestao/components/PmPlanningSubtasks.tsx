import { useState, useRef, useEffect, useCallback } from "react";
import { Clapperboard, Palette, ChevronDown, Plus, Check, ChevronRight, Trash2, RotateCcw, MessageSquare, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { cn } from "@/lib/utils";
import { PM_ACTIVE_STAGES, getStageCircleColor, tagColor, tagDisplay } from "../pm-constants";
import { useUpdatePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import { getFixedAssignee, getFixedWatchers, useDefaultFlowWithDates } from "./PmStageFlowConfig";
import type { PmTask } from "../pm-types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SubtaskTrashDialog } from "./SubtaskTrashDialog";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

type ReviewStatus = "aprovado" | "alteracao" | "pendente";
interface ReviewEntry { status: ReviewStatus; note: string; }
type RevisionNotes = Record<string, ReviewEntry>;

interface Props {
  parentTask: PmTask;
  childTasks: PmTask[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  members?: { id: string; name: string }[];
  onSelectSubtask?: (task: PmTask) => void;
  activeSubtaskId?: string | null;
  sectionTitle?: string;
  /** When set, shows review controls inline per subtask */
  reviewMode?: "revisao" | "alteracao" | null;
  readOnly?: boolean;
}

export function PmPlanningSubtasks({ parentTask, childTasks, membersMap, members, onSelectSubtask, activeSubtaskId, sectionTitle = "Planejamento", reviewMode, readOnly }: Props) {
  const [showTrash, setShowTrash] = useState(false);
  const updateTask = useUpdatePmTask();

  // Review state
  const existing = (parentTask as any).revision_notes as RevisionNotes | null;
  const [reviews, setReviews] = useState<RevisionNotes>(() => {
    const base: RevisionNotes = {};
    for (const child of childTasks) {
      base[child.id] = existing?.[child.id] ?? { status: "pendente", note: "" };
    }
    return base;
  });

  useEffect(() => {
    setReviews(prev => {
      const next: RevisionNotes = {};
      for (const child of childTasks) {
        next[child.id] = prev[child.id] ?? existing?.[child.id] ?? { status: "pendente", note: "" };
      }
      return next;
    });
  }, [childTasks.length]);

  const saveReviewToDb = useCallback((data: RevisionNotes, change?: { childTitle: string; newStatus: string }) => {
    updateTask.mutate({ id: parentTask.id, revision_notes: data, _revision_change: change ?? null } as any);
  }, [parentTask.id, updateTask]);

  const isReviewEditable = reviewMode === "revisao" && !readOnly;

  const videoTasks = childTasks.filter(c => c.post_type === "video");
  const designTasks = childTasks.filter(c => c.post_type === "design");

  // Always show both sections for planning-type parents (so user can add subtasks even when empty)
  const alwaysShowBothSections = ["planejamento", "pdf", "agendamento", "entrega"].includes(parentTask.stage_current);

  const videoDone = videoTasks.filter(t => t.stage_current === "entrega").length;
  const designDone = designTasks.filter(t => t.stage_current === "entrega").length;

  // Shared multi-selection state across both sections
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const total = childTasks.length;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedIds(new Set(childTasks.map(s => s.id))), [childTasks]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Drop ids that no longer exist (e.g., after stage advance / deletion)
  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      const valid = new Set(childTasks.map(s => s.id));
      let changed = false;
      const next = new Set<string>();
      prev.forEach(id => { if (valid.has(id)) next.add(id); else changed = true; });
      return changed ? next : prev;
    });
  }, [childTasks]);

  // Keyboard shortcuts: Esc clears, Delete/Backspace opens bulk confirm
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
      if (e.key === "Escape") {
        clearSelection();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setBulkConfirmOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const ids = Array.from(selectedIds);
    const deletedAt = new Date().toISOString();
    ids.forEach(id => {
      updateTask.mutate({ id, deleted_at: deletedAt, deleted_by: user?.id ?? null } as any);
    });
    toast(`${ids.length} subtarefa${ids.length !== 1 ? "s movidas" : " movida"} para lixeira`);
    clearSelection();
    setBulkConfirmOpen(false);
  }, [selectedIds, updateTask, clearSelection]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold">{sectionTitle}</h3>
        <span className="text-xs text-muted-foreground">
          {videoDone + designDone} de {childTasks.length} subtarefas
        </span>
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

      <SubtaskTrashDialog
        parentTaskId={parentTask.id}
        open={showTrash}
        onOpenChange={setShowTrash}
        membersMap={membersMap}
      />

      {/* Bulk selection bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 sticky top-0 z-10">
          <span className="text-xs font-medium">
            {selectedIds.size} selecionada{selectedIds.size !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] text-muted-foreground">
            (Del para excluir, Esc para limpar)
          </span>
          <div className="ml-auto flex items-center gap-1">
            {selectedIds.size < total && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>
                Selecionar todas
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSelection}>
              Limpar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-xs"
              onClick={() => setBulkConfirmOpen(true)}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Excluir
            </Button>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation (shared) */}
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
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={(e) => {
                e.stopPropagation();
                handleBulkDelete();
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {(videoTasks.length > 0 || alwaysShowBothSections) && (
        <PlanningSection
          type="video"
          icon={<Clapperboard className="h-4 w-4" />}
          label="Vídeo"
          headerBg="bg-blue-500"
          headerText="text-white"
          borderColor="border-blue-500/30"
          parentTask={parentTask}
          tasks={videoTasks}
          doneCount={videoDone}
          membersMap={membersMap}
          members={members}
          onSelectSubtask={onSelectSubtask}
          activeSubtaskId={activeSubtaskId}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          bulkConfirmOpen={bulkConfirmOpen}
          reviewMode={reviewMode}
          reviews={reviews}
          setReviews={setReviews}
          saveReviewToDb={saveReviewToDb}
          isReviewEditable={isReviewEditable}
        />
      )}

      {(designTasks.length > 0 || alwaysShowBothSections) && (
        <PlanningSection
          type="design"
          icon={<Palette className="h-4 w-4" />}
          label="Design"
          headerBg="bg-teal-500"
          headerText="text-white"
          borderColor="border-teal-500/30"
          parentTask={parentTask}
          tasks={designTasks}
          doneCount={designDone}
          membersMap={membersMap}
          members={members}
          onSelectSubtask={onSelectSubtask}
          activeSubtaskId={activeSubtaskId}
          selectedIds={selectedIds}
          toggleSelect={toggleSelect}
          bulkConfirmOpen={bulkConfirmOpen}
          reviewMode={reviewMode}
          reviews={reviews}
          setReviews={setReviews}
          saveReviewToDb={saveReviewToDb}
          isReviewEditable={isReviewEditable}
        />
      )}
    </div>
  );
}

function PlanningSection({
  type, icon, label, headerBg, headerText, borderColor,
  parentTask, tasks, doneCount,
  membersMap, members, onSelectSubtask, activeSubtaskId,
  selectedIds, toggleSelect, bulkConfirmOpen,
  reviewMode, reviews, setReviews, saveReviewToDb, isReviewEditable,
}: {
  type: "video" | "design";
  icon: React.ReactNode;
  label: string;
  headerBg: string;
  headerText: string;
  borderColor: string;
  parentTask: PmTask;
  tasks: PmTask[];
  doneCount: number;
  membersMap: Record<string, { name: string; avatar?: string }>;
  members?: { id: string; name: string }[];
  onSelectSubtask?: (task: PmTask) => void;
  activeSubtaskId?: string | null;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  bulkConfirmOpen: boolean;
  reviewMode?: "revisao" | "alteracao" | null;
  reviews: RevisionNotes;
  setReviews: React.Dispatch<React.SetStateAction<RevisionNotes>>;
  saveReviewToDb: (data: RevisionNotes) => void;
  isReviewEditable: boolean;
}) {
  const updateTask = useUpdatePmTask();
  const createTask = useCreatePmTask();
  const { stageAssignees } = useDefaultFlowWithDates();
  const [isOpen, setIsOpen] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const total = tasks.length;
  const hasSelection = selectedIds.size > 0;
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [explicitlyClosedIds, setExplicitlyClosedIds] = useState<Set<string>>(new Set());

  const toggleReviewStatus = (childId: string, targetStatus: ReviewStatus) => {
    if (!isReviewEditable) return;
    const current = reviews[childId]?.status;
    const newStatus = current === targetStatus ? "pendente" : targetStatus;
    const childTask = tasks.find(c => c.id === childId);
    const updated = {
      ...reviews,
      [childId]: { ...reviews[childId], status: newStatus, note: reviews[childId]?.note ?? "" },
    };
    setReviews(updated);
    saveReviewToDb(updated);
    if (newStatus === "alteracao") setExpandedNoteId(childId);
  };

  const setReviewNote = (childId: string, note: string) => {
    if (!isReviewEditable) return;
    setReviews(prev => ({ ...prev, [childId]: { ...prev[childId], note } }));
  };

  const saveNote = () => saveReviewToDb(reviews);

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  const handleSoftDelete = async (subId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    updateTask.mutate({ id: subId, deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null } as any);
    toast("Subtarefa movida para lixeira");
    setDeletingId(null);
  };

  const handleStartAdd = () => {
    setNewTitle("");
    setIsAdding(true);
  };

  const handleConfirmAdd = async () => {
    if (!newTitle.trim()) {
      setIsAdding(false);
      return;
    }
    await createTask.mutateAsync({
      client_id: parentTask.client_id,
      title: newTitle.trim(),
      parent_task_id: parentTask.id,
      stage_current: parentTask.stage_current,
      assignee_id: parentTask.assignee_id ?? undefined,
      watchers: parentTask.watchers ?? [],
      post_type: type,
    } as any);
    setNewTitle("");
    setIsAdding(false);
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
    const fixedAssignee = getFixedAssignee(stageAssignees, newStage, parentTask.client_id);
    const fixedWatchers = getFixedWatchers(stageAssignees, newStage, parentTask.client_id);
    const updates: any = { id: subId, stage_current: newStage as any };
    if (fixedAssignee !== undefined) {
      updates.assignee_id = fixedAssignee;
      updates.watchers = fixedWatchers;
    }
    updateTask.mutate(updates);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className={cn(
          "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg transition-all hover:opacity-90",
          headerBg, headerText
        )}>
          {icon}
          <span className="font-semibold text-sm">{label}</span>
          <span className="text-xs opacity-80">{total}</span>
          {/* Review summary badges */}
          {reviewMode && (() => {
            const sectionApproved = tasks.filter(t => reviews[t.id]?.status === "aprovado").length;
            const sectionAlteracao = tasks.filter(t => reviews[t.id]?.status === "alteracao").length;
            return (
              <div className="flex items-center gap-1 ml-1">
                {sectionApproved > 0 && (
                  <span className="inline-flex items-center gap-0.5 bg-white/20 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                    <Check className="h-2.5 w-2.5" /> {sectionApproved}
                  </span>
                )}
                {sectionAlteracao > 0 && (
                  <span className="inline-flex items-center gap-0.5 bg-amber-400/30 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                    <RotateCcw className="h-2.5 w-2.5" /> {sectionAlteracao}
                  </span>
                )}
              </div>
            );
          })()}
          <ChevronDown className={cn("h-3.5 w-3.5 ml-auto transition-transform", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className={cn("ml-2 border-l-2 pl-2 mt-1", borderColor)}>
          {tasks.map((sub) => {
            const isDone = sub.stage_current === "entrega";
            const isActive = activeSubtaskId === sub.id;
            const isSelected = selectedIds.has(sub.id);
            const subAssignees = allAssigneeIds(sub);
            const circleColor = getStageCircleColor(sub.stage_current);
            const review = reviews[sub.id];
            const hasReview = !!reviewMode;
            const hasAlteracao = review?.status === "alteracao";
            const isNoteExpanded = expandedNoteId === sub.id || (reviewMode === "alteracao" && !!review?.note && !explicitlyClosedIds.has(sub.id));

            return (
              <div key={sub.id}>
              <div
                className={cn(
                  "group flex items-center gap-2 px-2 py-2 transition border-b border-border/10 cursor-pointer rounded-lg my-0.5",
                  isActive ? "bg-primary/10 border-l-2 border-l-primary" : "",
                  isSelected && "bg-primary/5",
                  isDone && "opacity-60",
                  hasReview && review?.status === "aprovado" && "!bg-emerald-500 hover:!bg-emerald-500 text-white",
                  hasReview && hasAlteracao && "!bg-amber-500 hover:!bg-amber-500 text-white",
                  !hasReview && hasAlteracao && "border-l-2 border-l-amber-500 bg-amber-500/5",
                  !(hasReview && review?.status) && !isActive && !(!hasReview && hasAlteracao) && "hover:bg-card/40",
                )}
                onClick={(e) => {
                  if (deletingId || bulkConfirmOpen) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                  }
                  if (hasSelection) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSelect(sub.id);
                    return;
                  }
                  onSelectSubtask?.(sub);
                }}
              >
                {/* Review buttons (replace checkbox when in review mode) */}
                {hasReview ? (
                  <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      disabled={!isReviewEditable}
                      onClick={() => toggleReviewStatus(sub.id, "aprovado")}
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center transition-all border-2",
                        review?.status === "aprovado"
                          ? "bg-emerald-500 border-emerald-500 text-white scale-105"
                          : "border-emerald-500/30 hover:border-emerald-500/60 text-emerald-500/40 hover:text-emerald-500/70",
                        !isReviewEditable && "opacity-60 cursor-default"
                      )}
                      title="Aprovado"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      disabled={!isReviewEditable}
                      onClick={() => toggleReviewStatus(sub.id, "alteracao")}
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center transition-all border-2",
                        review?.status === "alteracao"
                          ? "bg-amber-500 border-amber-500 text-white scale-105"
                          : "border-amber-500/30 hover:border-amber-500/60 text-amber-500/40 hover:text-amber-500/70",
                        !isReviewEditable && "opacity-60 cursor-default"
                      )}
                      title="Precisa de alteração"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(sub.id)}
                      aria-label="Selecionar subtarefa"
                      className={cn(
                        "h-3.5 w-3.5 transition-opacity",
                        hasSelection ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      )}
                    />
                  </div>
                )}

                {/* Stage circle */}
                <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
                        circleColor.border,
                        isDone && `${circleColor.bg} border-emerald-500`
                      )}>
                        {isDone && <Check className="h-3 w-3 text-white" />}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="start">
                      {PM_ACTIVE_STAGES.map(s => {
                        const sColor = getStageCircleColor(s.key);
                        const isEntrega = s.key === "entrega";
                        const isStageSelected = sub.stage_current === s.key;
                        return (
                          <button
                            key={s.key}
                            className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition", isStageSelected && "bg-accent")}
                            onClick={() => changeStage(sub.id, s.key)}
                          >
                            <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", sColor.border, isEntrega && `${sColor.bg}`)}>
                              {isEntrega && <Check className="h-2.5 w-2.5 text-white" />}
                            </span>
                            {s.label}
                            {isStageSelected && <Check className="h-3 w-3 ml-auto text-primary" />}
                          </button>
                        );
                      })}
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
                  <span className={cn(
                    "truncate text-sm hover:text-primary transition-colors",
                    isDone && "line-through text-muted-foreground",
                    hasReview && review?.status === "aprovado" && "line-through text-muted-foreground"
                  )}>{sub.title}</span>
                </div>

                {/* Review note toggle — show whenever subtask has alteração status */}
                {hasAlteracao && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => {
                        if (isNoteExpanded) {
                          setExpandedNoteId(prev => prev === sub.id ? null : prev);
                          setExplicitlyClosedIds(prev => new Set(prev).add(sub.id));
                        } else {
                          setExpandedNoteId(sub.id);
                          setExplicitlyClosedIds(prev => { const n = new Set(prev); n.delete(sub.id); return n; });
                        }
                      }}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all",
                        hasReview && hasAlteracao
                          ? "bg-white/25 text-white hover:bg-white/40 border border-white/30"
                          : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30"
                      )}
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>ver alteração</span>
                      {isNoteExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                  </div>
                )}

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

                {/* Trash + chevron */}
                <div className="w-14 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded-md text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeletingId(sub.id);
                    }}
                    title="Mover para lixeira"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition" />
                </div>
              </div>

              {/* Expandable note area for alteração */}
              {isNoteExpanded && hasAlteracao && (
                <div className="px-3 pb-2 pt-0 bg-amber-500/5">
                  {isReviewEditable ? (
                    <Textarea
                      value={review.note}
                      onChange={(e) => setReviewNote(sub.id, e.target.value)}
                      onBlur={saveNote}
                      placeholder="Descreva o que precisa ser alterado..."
                      className="min-h-[50px] text-xs bg-background/50 border-border/30 resize-none"
                    />
                  ) : (
                    <div className="rounded-md bg-amber-500/5 border border-amber-500/15 px-3 py-2 text-xs text-foreground/80 whitespace-pre-wrap">
                      {review.note || <span className="text-muted-foreground italic">Sem detalhes adicionais</span>}
                    </div>
                  )}
                </div>
              )}
              </div>
            );
          })}
          {/* Delete confirmation (shared, outside rows) */}
          <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
            <AlertDialogContent className="z-[200]" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir subtarefa?</AlertDialogTitle>
                <AlertDialogDescription>
                  {(() => {
                    const t = tasks.find(s => s.id === deletingId);
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

          {/* Add subtask: input or button */}
          {isAdding ? (
            <div className="flex items-center gap-2 px-2 py-2">
              <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                ref={addInputRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={`Nome da subtarefa...`}
                className="h-7 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmAdd();
                  if (e.key === "Escape") { setIsAdding(false); setNewTitle(""); }
                }}
                onBlur={handleConfirmAdd}
              />
            </div>
          ) : (
            <button
              onClick={handleStartAdd}
              className="flex items-center gap-2 px-2 py-2 w-full text-muted-foreground/60 hover:text-primary hover:bg-card/40 transition rounded-b-md"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">Adicionar subtarefa</span>
            </button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
