import { useState, useMemo, useCallback } from "react";
import {
  Calendar, UserCircle, Flag, X, ChevronRight, ArrowLeft,
  Layers, Tag, MessageSquare, Plus, Check, CheckCircle2, RotateCcw, Paperclip, ListTodo, FileText, CalendarDays
} from "lucide-react";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker, DatePickerInline } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PM_ACTIVE_STAGES, stageLabel, getStageCircleColor,
  parseTag, tagColor, tagDisplay
} from "../pm-constants";
import {
  useUpdatePmTask, useCreatePmTask, usePmTasks, usePmChildTasks,
  usePmComments, usePmAttachments, usePmSyncStageCompletion,
} from "../hooks/use-pm-data";
import { usePmTags } from "../hooks/use-pm-tags";
import { useDefaultFlowWithDates, getNextStages, getFixedAssignee, getFixedWatchers } from "./PmStageFlowConfig";
import { PmSubtaskList } from "./PmSubtaskList";
import { PmPlanningSubtasks } from "./PmPlanningSubtasks";
import { PmCommentsSection } from "./PmCommentsSection";
import { PmAttachmentsSection } from "./PmAttachmentsSection";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import { PmCronogramaTab } from "./PmCronogramaTab";
import { PmPostingFields } from "./PmPostingFields";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";
import { SmartCaptionEditor } from "./SmartCaptionEditor";
import { LinkOrDateDialog } from "./LinkOrDateDialog";
import { supabase } from "@/integrations/supabase/client";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

interface Props {
  task: PmTask | null;
  open: boolean;
  onClose: () => void;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  members: { id: string; name: string }[];
  isAdmin: boolean;
}

export function PmTaskDetailDialog({ task, open, onClose, clientsMap, membersMap, members, isAdmin }: Props) {
  const [taskStack, setTaskStack] = useState<string[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const tasksQ = usePmTasks();
  const resolvedRootTask = useMemo(() => {
    if (!task) return null;
    return tasksQ.data?.find(t => t.id === task.id) ?? task;
  }, [task, tasksQ.data]);

  const currentTaskId = taskStack.length > 0 ? taskStack[taskStack.length - 1] : resolvedRootTask?.id ?? null;

  const childTasksQ = usePmChildTasks(currentTaskId);
  const rootChildTasksQ = usePmChildTasks(resolvedRootTask?.id ?? null);
  const commentsQ = usePmComments(currentTaskId);
  const attachmentsQ = usePmAttachments(currentTaskId);

  const currentTask = useMemo(() => {
    if (!resolvedRootTask) return null;
    if (taskStack.length === 0) return resolvedRootTask;
    const lastId = taskStack[taskStack.length - 1];
    const allChildren = rootChildTasksQ.data ?? [];
    const found = allChildren.find(t => t.id === lastId);
    if (found) return found;
    return childTasksQ.data?.find(t => t.id === lastId) ?? null;
  }, [resolvedRootTask, taskStack, rootChildTasksQ.data, childTasksQ.data]);

  const globalTagsQ = usePmTags();

  const allTags = useMemo(() => {
    // Global tags are the source of truth
    return (globalTagsQ.data ?? []).map(t => `${t.name}:${t.color_key}`);
  }, [globalTagsQ.data]);

  if (!task || !currentTask || !resolvedRootTask) return null;

  const childTasks = childTasksQ.data ?? [];
  const comments = commentsQ.data ?? [];
  const attachments = attachmentsQ.data ?? [];

  const isSubtaskView = taskStack.length > 0;

  const stackTasks = taskStack.map(id => {
    const found = (rootChildTasksQ.data ?? []).find(t => t.id === id);
    return found ?? { id, title: "..." } as PmTask;
  });

  const handleClose = () => { setTaskStack([]); setSidebarOpen(false); onClose(); };
  const handleSelectSubtask = (sub: PmTask) => { setTaskStack(prev => [...prev, sub.id]); };
  const handleBackToParent = () => { setTaskStack(prev => prev.slice(0, -1)); };
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) setTaskStack([]);
    else setTaskStack(prev => prev.slice(0, index + 1));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent hideClose className="z-[120] max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] max-sm:max-w-full max-sm:w-full max-sm:max-h-full max-sm:h-full max-sm:rounded-none p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border-border/30 shadow-2xl">

        {/* Breadcrumb bar */}
        <div className="flex items-center gap-1.5 border-b border-border/20 px-3 sm:px-5 py-2.5 bg-card/60 backdrop-blur-sm shrink-0">
          <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0 rounded-lg hidden sm:inline-flex", sidebarOpen && "bg-primary/10 text-primary")} onClick={() => setSidebarOpen(!sidebarOpen)} title="Sidebar de subtarefas">
            <Layers className="h-4 w-4" />
          </Button>
          {isSubtaskView && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleBackToParent}><ArrowLeft className="h-3.5 w-3.5" /></Button>
          )}
          <span className="text-xs text-muted-foreground truncate max-sm:hidden">{clientsMap[resolvedRootTask.client_id] ?? "—"}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0 max-sm:hidden" />
          <span className={cn("text-xs truncate", isSubtaskView ? "text-muted-foreground cursor-pointer hover:text-foreground transition" : "font-medium")} onClick={isSubtaskView ? () => handleBreadcrumbClick(-1) : undefined}>{resolvedRootTask.title}</span>
          {stackTasks.map((stackTask, i) => (
            <span key={stackTask.id} className="contents">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span className={cn("text-xs truncate", i < stackTasks.length - 1 ? "text-muted-foreground cursor-pointer hover:text-foreground transition" : "font-medium")} onClick={i < stackTasks.length - 1 ? () => handleBreadcrumbClick(i) : undefined}>{stackTask.title}</span>
            </span>
          ))}
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={handleClose}><X className="h-4 w-4" /></Button>
        </div>

        {/* Main content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* LEFT: Subtask Sidebar (hidden on mobile) */}
          {sidebarOpen && (
            <div className="hidden sm:flex w-64 shrink-0 flex-col bg-card/30 border-r border-border/30 animate-in slide-in-from-left-5 duration-200">
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className={cn("flex items-center gap-2 px-4 py-3 cursor-pointer transition border-b border-border/20", taskStack.length === 0 ? "bg-primary/10 text-primary" : "hover:bg-card/40")} onClick={() => setTaskStack([])}>
                  <StageCircle stageKey={resolvedRootTask.stage_current} size="sm" />
                  <span className="truncate flex-1 font-semibold text-sm">{resolvedRootTask.title}</span>
                </div>
                <div className="py-0.5">
                  {(rootChildTasksQ.data ?? []).map(sub => {
                    const isActive = taskStack.length > 0 && taskStack[taskStack.length - 1] === sub.id;
                    const isDone = sub.stage_current === "entrega";
                    return (
                      <div key={sub.id} className={cn("flex items-center gap-2 pl-6 pr-4 py-2.5 cursor-pointer transition text-sm", isActive ? "bg-primary/10 text-primary" : "hover:bg-card/40", isDone && !isActive && "opacity-50")} onClick={() => handleSelectSubtask(sub)}>
                        <StageCircle stageKey={sub.stage_current} size="xs" />
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          {(sub.tags ?? []).map(rawTag => {
                            const tc = tagColor(rawTag);
                            const name = tagDisplay(rawTag);
                            return <Badge key={rawTag} className={cn("text-[7px] h-3.5 px-1 gap-0 border-0 shrink-0", tc.bg, tc.text)}>{name}</Badge>;
                          })}
                          <span className={cn("truncate", isDone && "line-through")}>{sub.title}</span>
                        </div>
                      </div>
                    );
                  })}
                  {(rootChildTasksQ.data ?? []).length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Nenhuma subtarefa</p>}
                </div>
              </div>
            </div>
          )}

          {/* CENTER: Task detail */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <TaskContentView task={currentTask} childTasks={childTasks} attachments={attachments} membersMap={membersMap} members={members} isAdmin={isAdmin} onSelectSubtask={handleSelectSubtask} activeSubtaskId={null} onClose={handleClose} clientsMap={clientsMap} allTags={allTags} parentStageCurrent={isSubtaskView ? resolvedRootTask.stage_current : undefined} globalTags={globalTagsQ.data ?? []} onEditTask={(taskId) => setTaskStack(prev => [...prev, taskId])} />
          </div>

          {/* RIGHT: Comments sidebar (hidden on mobile) */}
          <div className="w-80 shrink-0 flex-col bg-card/10 border-l border-border/30 hidden md:flex">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 shrink-0">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Atividade</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
              <PmCommentsSection taskId={currentTask.id} comments={comments} membersMap={membersMap} members={members} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stage Circle Component ───
function StageCircle({ stageKey, size = "md" }: { stageKey: string; size?: "xs" | "sm" | "md" }) {
  const color = getStageCircleColor(stageKey);
  const isDone = stageKey === "entrega";
  const sizeClass = size === "xs" ? "h-2 w-2" : size === "sm" ? "h-2.5 w-2.5" : "h-4 w-4";
  return (
    <span className={cn("rounded-full shrink-0 flex items-center justify-center", sizeClass, isDone ? `${color.bg}` : `border-2 ${color.border}`)}>
      {isDone && size !== "xs" && <Check className="h-2 w-2 text-white" />}
    </span>
  );
}

// ─── Task Content View ───

function TaskContentView({ task, childTasks, attachments, membersMap, members, isAdmin, onSelectSubtask, activeSubtaskId, onClose, clientsMap, allTags, parentStageCurrent, globalTags, onEditTask }: {
  task: PmTask; childTasks: PmTask[]; attachments: any[];
  membersMap: Record<string, { name: string; avatar?: string }>; members: { id: string; name: string }[];
  isAdmin: boolean; onSelectSubtask: (sub: PmTask) => void; activeSubtaskId: string | null;
  onClose: () => void; clientsMap: Record<string, string>; allTags: string[];
  parentStageCurrent?: string;
  globalTags: { id: string; name: string; color_key: string; created_by: string; created_at: string }[];
  onEditTask?: (taskId: string) => void;
}) {
  const updateTask = useUpdatePmTask();
  const createTask = useCreatePmTask();
  const syncStage = usePmSyncStageCompletion();
  const { flowConfig, transitionDates, stageAssignees } = useDefaultFlowWithDates();

  const allAssigneeIds = [
    ...(task.assignee_id ? [task.assignee_id] : []),
    ...(task.watchers ?? []).filter(w => w !== task.assignee_id),
  ];

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [stageChoiceOpen, setStageChoiceOpen] = useState(false);
  const [stageChoiceOptions, setStageChoiceOptions] = useState<string[]>([]);

  // Date on completion state
  const [completionDateOpen, setCompletionDateOpen] = useState(false);
  const [completionDate, setCompletionDate] = useState("");
  const [pendingCompletedStage, setPendingCompletedStage] = useState("");
  const [pendingDueDate, setPendingDueDate] = useState<string | undefined>();

  // Link existing task state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkExistingTask, setLinkExistingTask] = useState<{ id: string; due_date: string; title: string } | null>(null);
  const [pendingAdvance, setPendingAdvance] = useState<{ completedStage: string; nextStage: string } | null>(null);

  // Pending split state (for planejamento → design/video linking)
  const [pendingSplit, setPendingSplit] = useState<{
    stage: string;
    stageLabel: string;
    children: PmTask[];
    postType: string;
    snapshotDueDate: string;
    nextDueDate: string;
    clientName: string;
    monthLabel: string | null;
    remainingSplits: { stage: string; stageLabel: string; children: PmTask[]; postType: string }[];
  } | null>(null);

  // Possible next stages from flow
  // Extra demands go straight to entrega after revisão
  const rawNextStages = getNextStages(flowConfig, task.stage_current);
  const nextStages = (task.is_extra_demand && task.stage_current === "revisao")
    ? ["entrega"]
    : rawNextStages;
  const isDone = task.stage_current === "entrega";

  const syncCompletedStage = async (completedStage: string) => {
    if (task.parent_task_id) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Pass explicit user IDs: assignee + watchers (BEFORE stage change updates them)
      const scoringUserIds = [
        task.assignee_id,
        ...(task.watchers ?? []),
      ].filter(Boolean) as string[];
      // Also include child task assignees
      for (const child of childTasks) {
        if (child.assignee_id && !scoringUserIds.includes(child.assignee_id)) {
          scoringUserIds.push(child.assignee_id);
        }
      }
      syncStage.mutate({
        pmTaskId: task.id,
        completedStage,
        userId: user.id,
        scoringUserIds: scoringUserIds.length > 0 ? scoringUserIds : undefined,
      });
    } catch (_) { /* ignore */ }
  };

  const doAdvance = (completedStage: string, nextStage: string, newDueDate?: string, linkedTaskId?: string) => {
    const transferChildren = async (targetTaskId: string, targetStage: string) => {
      const fixedAssignee = getFixedAssignee(stageAssignees, targetStage, task.client_id);
      const fixedWatchers = getFixedWatchers(stageAssignees, targetStage, task.client_id);
      for (const child of childTasks) {
        const childUpdates: any = {
          id: child.id,
          parent_task_id: targetTaskId,
          stage_current: targetStage as any,
          status_global: "backlog" as any,
        };
        if (fixedAssignee !== undefined) {
          childUpdates.assignee_id = fixedAssignee;
          childUpdates.watchers = fixedWatchers;
        }
        updateTask.mutate(childUpdates as any);
      }
      // Transfer attachments from old task to the new task
      const sb = supabase as any;
      await sb
        .from("pm_attachments")
        .update({ task_id: targetTaskId })
        .eq("task_id", task.id);
    };

    if (linkedTaskId) {
      // Snapshot: mark current task as completed at current stage
      const snapshotDueDate = task.due_date ?? format(new Date(), "yyyy-MM-dd");
      updateTask.mutate({
        id: task.id,
        stage_current: completedStage as any,
        status_global: "concluido" as any,
        due_date: snapshotDueDate,
      });

      // Update linked task and transfer children
      const linkedUpdates: any = { id: linkedTaskId, status_global: "backlog" as any };
      const fixedAssignee = getFixedAssignee(stageAssignees, nextStage, task.client_id);
      const fixedWatchers = getFixedWatchers(stageAssignees, nextStage, task.client_id);
      if (fixedAssignee !== undefined) {
        linkedUpdates.assignee_id = fixedAssignee;
        linkedUpdates.watchers = fixedWatchers;
      }
      updateTask.mutate(linkedUpdates);
      transferChildren(linkedTaskId, nextStage);
    } else if (nextStage === "entrega") {
      // Final stage: mark as delivered
      updateTask.mutate({
        id: task.id,
        stage_current: "entrega" as any,
        status_global: "concluido" as any,
      });
      for (const child of childTasks) {
        updateTask.mutate({
          id: child.id,
          stage_current: "entrega" as any,
          status_global: "concluido" as any,
        });
      }
    } else {
      // Snapshot current task as completed (stays in agenda)
      const snapshotDueDate = task.due_date ?? format(new Date(), "yyyy-MM-dd");
      updateTask.mutate({
        id: task.id,
        stage_current: completedStage as any,
        status_global: "concluido" as any,
        due_date: snapshotDueDate,
      });

      // Create new task for the next stage and transfer all children
      const fixedAssignee = getFixedAssignee(stageAssignees, nextStage, task.client_id);
      const fixedWatchers = getFixedWatchers(stageAssignees, nextStage, task.client_id);
      const nextDueDate = newDueDate ?? format(addDays(new Date(snapshotDueDate + "T12:00:00"), 1), "yyyy-MM-dd");

      // Build new title replacing the stage portion
      const nextStageLabel = stageLabel(nextStage);
      const currentStageLabel = stageLabel(completedStage);
      let newTitle = task.title;
      if (task.title.includes(` - ${currentStageLabel} - `)) {
        newTitle = task.title.replace(` - ${currentStageLabel} - `, ` - ${nextStageLabel} - `);
      } else if (task.title.includes(` - ${currentStageLabel}`)) {
        newTitle = task.title.replace(` - ${currentStageLabel}`, ` - ${nextStageLabel}`);
      }

      createTask.mutateAsync({
        client_id: task.client_id,
        title: newTitle,
        description: task.description ?? undefined,
        stage_current: nextStage,
        due_date: nextDueDate,
        assignee_id: fixedAssignee !== undefined ? (fixedAssignee ?? undefined) : (task.assignee_id ?? undefined),
        watchers: fixedAssignee !== undefined ? fixedWatchers : (task.watchers ?? []),
        priority: task.priority,
        project_id: task.project_id ?? undefined,
        tags: task.tags ?? [],
        is_extra_demand: task.is_extra_demand,
        status_global: "backlog",
        post_type: task.post_type ?? undefined,
      }).then((newTask) => {
        transferChildren(newTask.id, nextStage);
      });
    }

    // Skip scoring for alteracoes and revisao — they don't generate points
    if (completedStage !== "alteracoes" && completedStage !== "revisao") {
      syncCompletedStage(completedStage);
    }
    toast.success(nextStage === "entrega" ? "Tarefa marcada como Entregue!" : `Avançou para ${stageLabel(nextStage)}`);
  };

  const findExistingAgendaTaskForStage = async (nextStage: string, referenceDueDate?: string) => {
    if (nextStage === "entrega") return null;

    const sb = supabase as any;
    const referenceDate = referenceDueDate ?? task.due_date ?? format(new Date(), "yyyy-MM-dd");
    const base = new Date(`${referenceDate}T12:00:00`);
    const monthStart = format(new Date(base.getFullYear(), base.getMonth(), 1), "yyyy-MM-dd");
    const monthEnd = format(new Date(base.getFullYear(), base.getMonth() + 1, 0), "yyyy-MM-dd");

    let query = sb
      .from("pm_tasks")
      .select("id, due_date, title")
      .eq("client_id", task.client_id)
      .eq("stage_current", nextStage)
      .neq("status_global", "concluido")
      .is("parent_task_id", null)
      .not("due_date", "is", null)
      .gte("due_date", monthStart)
      .lte("due_date", monthEnd)
      .neq("id", task.id)
      .order("due_date", { ascending: true })
      .limit(1);

    // When advancing to revisão, only link with same post_type origin
    if (nextStage === "revisao" && task.post_type) {
      query = query.eq("post_type", task.post_type);
    }

    const { data: existing } = await query;


    return existing && existing.length > 0 ? existing[0] : null;
  };

  const advanceStage = async (completedStage: string, nextStage: string, newDueDate?: string) => {
    // Always check for existing agenda task regardless of date config
    const existing = await findExistingAgendaTaskForStage(nextStage, newDueDate);
    if (existing) {
      setLinkExistingTask(existing);
      setPendingAdvance({ completedStage, nextStage });
      setLinkDialogOpen(true);
      return;
    }

    doAdvance(completedStage, nextStage, newDueDate);
  };

  // Revert: go back to previous stage (undo concluído advance)
  const handleRevert = async () => {
    if (!task.stage_current || task.stage_current === "captacao") return;
    // Find the stage that points to the current stage
    const prevStage = Object.entries(flowConfig).find(([_, targets]) => 
      (targets as string[]).includes(task.stage_current)
    )?.[0];
    if (!prevStage) {
      toast.error("Não foi possível reverter");
      return;
    }

    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { user } } = await supabase.auth.getUser();
    const sb = supabase as any;

    // 1) Delete the snapshot pm_task created for the previous stage (concluído copy)
    //    Snapshots have status_global = "concluido" and stage_current = prevStage
    await sb
      .from("pm_tasks")
      .delete()
      .eq("client_id", task.client_id)
      .eq("stage_current", prevStage)
      .eq("status_global", "concluido")
      .eq("title", task.title)
      .not("id", "eq", task.id);

    // 2) Soft-delete performance snapshot tasks for this pm_task + prevStage
    //    This triggers task_soft_delete_uncheck_magic to uncheck magic number & recalc scores
    await sb
      .from("tasks")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .like("description", `pm:${task.id}:${prevStage}%`)
      .is("deleted_at", null);

    // 3) Restore assignee from the previous stage
    const fixedAssignee = getFixedAssignee(stageAssignees, prevStage, task.client_id);
    const fixedWatchers = getFixedWatchers(stageAssignees, prevStage, task.client_id);
    const updates: any = { id: task.id, stage_current: prevStage as any };
    if (fixedAssignee !== undefined) {
      updates.assignee_id = fixedAssignee;
      updates.watchers = fixedWatchers;
    }
    updateTask.mutate(updates);

    // Revert child tasks too
    for (const child of childTasks) {
      const childUpdates: any = { id: child.id, stage_current: prevStage as any };
      if (fixedAssignee !== undefined) {
        childUpdates.assignee_id = fixedAssignee;
        childUpdates.watchers = fixedWatchers;
      }
      updateTask.mutate(childUpdates);
    }

    toast.success(`Revertido para ${stageLabel(prevStage)}`);
  };

  // ── Split task helper (creates or links to existing agenda task) ──
  const executeSplitTask = async (
    stage: string, stageLabel_: string, children: PmTask[], postType: string,
    dueDate: string, clientName: string, monthLabel: string | null, linkedTaskId?: string
  ) => {
    const fixedAssignee = getFixedAssignee(stageAssignees, stage, task.client_id);
    const fixedWatchers_ = getFixedWatchers(stageAssignees, stage, task.client_id);

    if (linkedTaskId) {
      // Link to existing task: update it and transfer children
      const linkedUpdates: any = { id: linkedTaskId, status_global: "backlog" as any };
      if (fixedAssignee !== undefined) {
        linkedUpdates.assignee_id = fixedAssignee;
        linkedUpdates.watchers = fixedWatchers_;
      }
      updateTask.mutate(linkedUpdates);
      for (const child of children) {
        const childUpdates: any = {
          id: child.id,
          parent_task_id: linkedTaskId,
          stage_current: stage as any,
          status_global: "backlog" as any,
        };
        if (fixedAssignee !== undefined) {
          childUpdates.assignee_id = fixedAssignee;
          childUpdates.watchers = fixedWatchers_;
        }
        updateTask.mutate(childUpdates as any);
      }
    } else {
      // Create new task
      const title = monthLabel
        ? `${clientName} - ${stageLabel_} - ${monthLabel}`
        : `${clientName} - ${stageLabel_}`;
      const newTask = await createTask.mutateAsync({
        client_id: task.client_id,
        title,
        description: task.description ?? undefined,
        stage_current: stage,
        due_date: dueDate,
        assignee_id: fixedAssignee !== undefined ? (fixedAssignee ?? undefined) : (task.assignee_id ?? undefined),
        watchers: fixedAssignee !== undefined ? fixedWatchers_ : (task.watchers ?? []),
        priority: task.priority,
        project_id: task.project_id ?? undefined,
        tags: task.tags ?? [],
        is_extra_demand: task.is_extra_demand,
        status_global: "backlog",
        post_type: postType,
      });
      for (const child of children) {
        const childUpdates: any = {
          id: child.id,
          parent_task_id: newTask.id,
          stage_current: stage as any,
          status_global: "backlog" as any,
        };
        if (fixedAssignee !== undefined) {
          childUpdates.assignee_id = fixedAssignee;
          childUpdates.watchers = fixedWatchers_;
        }
        updateTask.mutate(childUpdates as any);
      }
    }
  };

  const processSplitQueue = async (
    splits: { stage: string; stageLabel: string; children: PmTask[]; postType: string }[],
    snapshotDueDate: string, nextDueDate: string, clientName: string, monthLabel: string | null
  ) => {
    if (splits.length === 0) {
      toast.success("Planejamento concluído! Tarefas criadas.");
      return;
    }

    const [current, ...remaining] = splits;

    // Check for existing agenda task for this stage
    const existing = await findExistingAgendaTaskForStage(current.stage, snapshotDueDate);
    if (existing) {
      // Store pending split info and show link dialog
      setPendingSplit({
        stage: current.stage,
        stageLabel: current.stageLabel,
        children: current.children,
        postType: current.postType,
        snapshotDueDate,
        nextDueDate,
        clientName,
        monthLabel,
        remainingSplits: remaining,
      });
      setLinkExistingTask(existing);
      setLinkDialogOpen(true);
      return;
    }

    // No existing task — create directly
    await executeSplitTask(current.stage, current.stageLabel, current.children, current.postType, nextDueDate, clientName, monthLabel);

    // Process remaining splits
    await processSplitQueue(remaining, snapshotDueDate, nextDueDate, clientName, monthLabel);
  };

  const handleConcluido = async () => {
    if (isDone) return;
    const completedStage = task.stage_current;

    // ═══ CAPTAÇÃO: just mark as done, no stage advancement ═══
    if (completedStage === "captacao") {
      updateTask.mutate({
        id: task.id,
        stage_current: "captacao" as any,
        status_global: "concluido" as any,
      });
      for (const child of childTasks) {
        updateTask.mutate({
          id: child.id,
          stage_current: "captacao" as any,
          status_global: "concluido" as any,
        });
      }
      // Sync scoring for captação
      syncCompletedStage(completedStage);
      toast.success("Captação concluída!");
      return;
    }

    const dateConfig = transitionDates[task.stage_current];

    // Calculate new due date
    let newDueDate: string | undefined;

    if (typeof dateConfig === "number") {
      const baseDate = task.due_date ? new Date(task.due_date + "T12:00:00") : new Date();
      newDueDate = format(addDays(baseDate, dateConfig), "yyyy-MM-dd");
    }

    // If planejamento → split into video + design tasks
    if (completedStage === "planejamento" && !task.parent_task_id) {
      const videoChildren = childTasks.filter(c => c.post_type === "video");
      const designChildren = childTasks.filter(c => c.post_type === "design");
      const hasVideo = videoChildren.length > 0;
      const hasDesign = designChildren.length > 0;

      if (hasVideo || hasDesign) {
        // Snapshot current task as completed
        const snapshotDueDate = task.due_date ?? format(new Date(), "yyyy-MM-dd");
        updateTask.mutate({
          id: task.id,
          stage_current: completedStage as any,
          status_global: "concluido" as any,
          due_date: snapshotDueDate,
        });

        // Sync scoring for planejamento
        syncCompletedStage(completedStage);

        const clientName = clientsMap[task.client_id] || task.title.split(" - ")[0];
        let monthLabel: string | null = null;
        if (task.due_date) {
          const raw = format(parseISO(task.due_date), "MMMM", { locale: ptBR });
          monthLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
        }
        const nextDueDate = newDueDate ?? format(addDays(new Date(snapshotDueDate + "T12:00:00"), 1), "yyyy-MM-dd");

        // Build split list
        const splits: { stage: string; stageLabel: string; children: PmTask[]; postType: string }[] = [];
        if (hasVideo) splits.push({ stage: "edicao_videos", stageLabel: "Vídeo", children: videoChildren, postType: "video" });
        if (hasDesign) splits.push({ stage: "design", stageLabel: "Design", children: designChildren, postType: "design" });

        // Process splits sequentially, checking for existing tasks
        await processSplitQueue(splits, snapshotDueDate, nextDueDate, clientName, monthLabel);
        return;
      }
    }

    // Default flow for other stages
    let resolvedNextStages = nextStages;

    // Multiple next stages → show stage choice first
    if (resolvedNextStages.length > 1) {
      setPendingCompletedStage(completedStage);
      setPendingDueDate(newDueDate);
      setStageChoiceOptions(resolvedNextStages);
      setStageChoiceOpen(true);
      return;
    }

    // Single next stage → check for existing agenda task
    if (resolvedNextStages.length === 1) {
      const existing = await findExistingAgendaTaskForStage(resolvedNextStages[0], newDueDate ?? task.due_date ?? format(new Date(), "yyyy-MM-dd"));
      if (existing) {
        setLinkExistingTask(existing);
        setPendingAdvance({ completedStage, nextStage: resolvedNextStages[0] });
        setLinkDialogOpen(true);
        return;
      }
    }

    // No existing task found — if dateConfig is "pick", show date picker
    if (dateConfig === "pick") {
      setPendingCompletedStage(completedStage);
      setCompletionDate(task.due_date ?? format(new Date(), "yyyy-MM-dd"));
      setCompletionDateOpen(true);
      return;
    }

    // No "pick" — advance directly
    if (resolvedNextStages.length === 0) {
      advanceStage(completedStage, "entrega", newDueDate);
    } else if (resolvedNextStages.length === 1) {
      advanceStage(completedStage, resolvedNextStages[0], newDueDate);
    }
  };

  const handleConfirmCompletionDate = () => {
    const completedStage = pendingCompletedStage;
    const newDueDate = completionDate || undefined;

    // Resolve next stages
    let resolvedNext = nextStages;

    if (resolvedNext.length === 0) {
      advanceStage(completedStage, "entrega", newDueDate);
    } else if (resolvedNext.length === 1) {
      advanceStage(completedStage, resolvedNext[0], newDueDate);
    } else {
      setPendingDueDate(newDueDate);
      setStageChoiceOptions(resolvedNext);
      setStageChoiceOpen(true);
    }
    setCompletionDateOpen(false);
  };

  const handleChooseNextStage = (stageKey: string) => {
    const completedStage = pendingCompletedStage || task.stage_current;
    advanceStage(completedStage, stageKey, pendingDueDate);
    setStageChoiceOpen(false);
    setPendingDueDate(undefined);
  };

  const handleAlteracao = async () => {
    const sb = supabase as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Find the previous completed design/video snapshot task for the same client
    let previousSnapshot: any = null;
    let previousStage: string | null = null;

    for (const stage of ["design", "edicao_videos"]) {
      const { data: snapshot } = await sb
        .from("pm_tasks")
        .select("id, assignee_id, watchers, stage_current, post_type")
        .eq("client_id", task.client_id)
        .eq("stage_current", stage)
        .eq("status_global", "concluido")
        .is("parent_task_id", null)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (snapshot && snapshot.length > 0) {
        previousSnapshot = snapshot[0];
        previousStage = stage;
        break;
      }
    }

    if (previousSnapshot) {
      // Reactivate the previous snapshot: set stage to alteracoes, status back to em_andamento
      // The task keeps its completed_at but becomes active again for alteração work
      const prevUpdates: any = {
        id: previousSnapshot.id,
        stage_current: "alteracoes" as any,
        status_global: "em_andamento" as any,
      };
      // Keep the original assignee from the snapshot (the person who did the work)
      updateTask.mutate(prevUpdates);

      // Reactivate children of the previous snapshot too
      const { data: prevChildren } = await sb
        .from("pm_tasks")
        .select("id")
        .eq("parent_task_id", previousSnapshot.id);
      if (prevChildren) {
        for (const pc of prevChildren) {
          updateTask.mutate({
            id: pc.id,
            stage_current: "alteracoes" as any,
            status_global: "em_andamento" as any,
          } as any);
        }
      }

      // Transfer current task's children to the reactivated task
      for (const child of childTasks) {
        updateTask.mutate({
          id: child.id,
          parent_task_id: previousSnapshot.id,
          stage_current: "alteracoes" as any,
          status_global: "backlog" as any,
        } as any);
      }

      // Transfer attachments
      await sb
        .from("pm_attachments")
        .update({ task_id: previousSnapshot.id })
        .eq("task_id", task.id);

      // Mark the current revisão task as paused (waiting for alteração to finish)
      updateTask.mutate({
        id: task.id,
        status_global: "pausado" as any,
      });

      toast.success("Tarefa retornou para alteração no responsável anterior");
    } else {
      // Fallback: no previous snapshot found — change current task's stage (old behavior)
      let alteracaoAssignee: string | null = null;
      let alteracaoWatchers: string[] = [];
      const altAssignee = getFixedAssignee(stageAssignees, "alteracoes", task.client_id);
      const designAssignee = getFixedAssignee(stageAssignees, "design", task.client_id);
      const videoAssignee = getFixedAssignee(stageAssignees, "edicao_videos", task.client_id);
      alteracaoAssignee = (altAssignee !== undefined ? altAssignee : (designAssignee !== undefined ? designAssignee : (videoAssignee ?? null))) as string | null;
      alteracaoWatchers = altAssignee !== undefined
        ? getFixedWatchers(stageAssignees, "alteracoes", task.client_id)
        : (designAssignee !== undefined
          ? getFixedWatchers(stageAssignees, "design", task.client_id)
          : getFixedWatchers(stageAssignees, "edicao_videos", task.client_id));

      const updates: any = { id: task.id, stage_current: "alteracoes" as any };
      if (alteracaoAssignee) {
        updates.assignee_id = alteracaoAssignee;
        updates.watchers = alteracaoWatchers;
      }
      updateTask.mutate(updates);

      for (const child of childTasks) {
        const childUpdates: any = { id: child.id, stage_current: "alteracoes" as any };
        if (alteracaoAssignee) {
          childUpdates.assignee_id = alteracaoAssignee;
          childUpdates.watchers = alteracaoWatchers;
        }
        updateTask.mutate(childUpdates);
      }

      toast.success("Tarefa enviada para Alteração");
    }
  };

  const handleReturnFromAlteracao = async () => {
    const sb = supabase as any;

    // Find the paused revisão task for the same client to reactivate
    const { data: pausedRevisao } = await sb
      .from("pm_tasks")
      .select("id, assignee_id, watchers")
      .eq("client_id", task.client_id)
      .eq("stage_current", "revisao")
      .eq("status_global", "pausado")
      .is("parent_task_id", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (pausedRevisao && pausedRevisao.length > 0) {
      const revisaoTask = pausedRevisao[0];

      // Mark the current alteração task back as concluído at its original stage (design/edicao_videos)
      // Determine original stage from post_type
      const originalStage = task.post_type === "video" ? "edicao_videos" : "design";
      updateTask.mutate({
        id: task.id,
        stage_current: originalStage as any,
        status_global: "concluido" as any,
      });

      // Mark children as concluído too
      for (const child of childTasks) {
        updateTask.mutate({
          id: child.id,
          stage_current: originalStage as any,
          status_global: "concluido" as any,
        } as any);
      }

      // Transfer attachments back to revisão
      await sb
        .from("pm_attachments")
        .update({ task_id: revisaoTask.id })
        .eq("task_id", task.id);

      // Reactivate the revisão task
      const fixedAssignee = getFixedAssignee(stageAssignees, "revisao", task.client_id);
      const fixedWatchers = getFixedWatchers(stageAssignees, "revisao", task.client_id);
      const revisaoUpdates: any = {
        id: revisaoTask.id,
        status_global: "backlog" as any,
      };
      if (fixedAssignee !== undefined) {
        revisaoUpdates.assignee_id = fixedAssignee;
        revisaoUpdates.watchers = fixedWatchers;
      }
      updateTask.mutate(revisaoUpdates);

      // Transfer children from this task to revisão
      for (const child of childTasks) {
        updateTask.mutate({
          id: child.id,
          parent_task_id: revisaoTask.id,
          stage_current: "revisao" as any,
          status_global: "backlog" as any,
        } as any);
      }

      toast.success("Ajuste concluído — retornou para Revisão");
    } else {
      // Fallback: no paused revisão found, just change stage on current task
      const fixedAssignee = getFixedAssignee(stageAssignees, "revisao", task.client_id);
      const fixedWatchers = getFixedWatchers(stageAssignees, "revisao", task.client_id);

      const updates: any = {
        id: task.id,
        stage_current: "revisao" as any,
      };
      if (fixedAssignee !== undefined) {
        updates.assignee_id = fixedAssignee;
        updates.watchers = fixedWatchers;
      }
      updateTask.mutate(updates);

      for (const child of childTasks) {
        const childUpdates: any = {
          id: child.id,
          stage_current: "revisao" as any,
        };
        if (fixedAssignee !== undefined) {
          childUpdates.assignee_id = fixedAssignee;
          childUpdates.watchers = fixedWatchers;
        }
        updateTask.mutate(childUpdates);
      }

      toast.success("Ajuste concluído — retornou para Revisão");
    }
  };

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== task.title) updateTask.mutate({ id: task.id, title: titleDraft.trim() });
    setEditingTitle(false);
  };
  

  const handleSetCover = (url: string) => { updateTask.mutate({ id: task.id, cover_url: url } as any); toast.success("Capa definida!"); };
  const handleRemoveCover = () => { updateTask.mutate({ id: task.id, cover_url: null } as any); toast.success("Capa removida!"); };

  const toggleAssignee = (memberId: string) => {
    const currentWatchers = task.watchers ?? [];
    if (task.assignee_id === memberId) {
      const remaining = currentWatchers.filter(w => w !== memberId);
      updateTask.mutate({ id: task.id, assignee_id: remaining[0] ?? null, watchers: remaining.slice(1) } as any);
    } else if (currentWatchers.includes(memberId)) {
      updateTask.mutate({ id: task.id, watchers: currentWatchers.filter(w => w !== memberId) } as any);
    } else if (!task.assignee_id) {
      updateTask.mutate({ id: task.id, assignee_id: memberId } as any);
    } else {
      updateTask.mutate({ id: task.id, watchers: [...currentWatchers, memberId] } as any);
    }
  };

  const removeTag = (tag: string) => { updateTask.mutate({ id: task.id, tags: (task.tags ?? []).filter(t => t !== tag) } as any); };
  const toggleGlobalTag = (tag: string) => {
    const existing = task.tags ?? [];
    if (existing.includes(tag)) {
      removeTag(tag);
    } else {
      updateTask.mutate({ id: task.id, tags: [...existing, tag] } as any);
    }
  };

  return (
    <div className="space-y-0">
      {task.cover_url && (
        <div className="relative w-full h-40 overflow-hidden bg-muted">
          <img src={task.cover_url} alt="Capa" className="w-full h-full object-cover" />
          <Button size="sm" variant="secondary" className="absolute top-2 right-2 h-6 text-[10px] opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity" onClick={handleRemoveCover}>Remover capa</Button>
        </div>
      )}

      <div className="px-4 sm:px-6 py-4 sm:py-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] sm:pb-5 space-y-5 sm:space-y-6">
        {/* Title */}
        {editingTitle ? (
          <Input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && saveTitle()} className="text-xl sm:text-2xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0" />
        ) : (
          <h1 className="cursor-pointer text-xl sm:text-2xl font-bold hover:text-primary transition-colors" onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}>{task.title}</h1>
        )}

        {/* Properties grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {/* Assignee */}
          <PropertyRow icon={<UserCircle className="h-3.5 w-3.5" />} label="Responsável">
            <PmAssigneeSelector
              selectedIds={allAssigneeIds}
              membersMap={membersMap}
              members={members}
              onToggle={toggleAssignee}
            >
              <button className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition min-h-[28px] flex-wrap">
                {allAssigneeIds.length > 0 ? allAssigneeIds.map(id => {
                  const m = membersMap[id];
                  if (!m) return null;
                  return (
                    <span key={id} className="flex items-center gap-1.5 bg-primary/10 rounded-full pl-0.5 pr-2.5 py-0.5">
                      <Avatar className="h-5 w-5 border border-background">
                        <AvatarImage src={m.avatar} />
                        <AvatarFallback className="text-[7px] bg-primary/20 text-primary">{initials(m.name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">{m.name.split(" ")[0]}</span>
                    </span>
                  );
                }) : (
                  <span className="text-xs text-muted-foreground">Selecionar...</span>
                )}
              </button>
            </PmAssigneeSelector>
          </PropertyRow>

          {/* Client */}
          <PropertyRow icon={<UserCircle className="h-3.5 w-3.5" />} label="Cliente">
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-xs min-h-[28px] hover:opacity-80 transition">
                  {clientsMap[task.client_id] ?? "—"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1 max-h-64 overflow-y-auto z-[150]" align="start">
                {Object.entries(clientsMap).map(([cid, cname]) => (
                  <button key={cid} className={cn("flex items-center gap-2 w-full px-3 py-2 rounded text-sm hover:bg-accent transition text-left", task.client_id === cid && "bg-accent")} onClick={() => {
                    const oldClientName = clientsMap[task.client_id];
                    const newTitle = oldClientName && task.title.startsWith(`[${oldClientName}]`)
                      ? `[${cname}]${task.title.slice(oldClientName.length + 2)}`
                      : task.title;
                    updateTask.mutate({ id: task.id, client_id: cid, title: newTitle });
                  }}>
                    {cname}
                    {task.client_id === cid && <Check className="h-3 w-3 ml-auto text-primary" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </PropertyRow>

          <PropertyRow icon={<Calendar className="h-3.5 w-3.5" />} label="Entrega">
            <DatePickerInline value={task.due_date ?? ""} onChange={(v) => updateTask.mutate({ id: task.id, due_date: v || null })} />
          </PropertyRow>

          <PropertyRow icon={<Flag className="h-3.5 w-3.5" />} label="Demanda Extra">
            <label className="flex items-center gap-2 cursor-pointer min-h-[28px]">
              <input
                type="checkbox"
                checked={task.is_extra_demand ?? false}
                onChange={(e) => updateTask.mutate({ id: task.id, is_extra_demand: e.target.checked } as any)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
            </label>
          </PropertyRow>

          {/* Stage selector */}
          <PropertyRow icon={<Layers className="h-3.5 w-3.5" />} label="Etapa">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 min-h-[28px] hover:opacity-80 transition">
                  <StageCircleInline stageKey={task.stage_current} />
                  <span className="text-xs font-medium">{stageLabel(task.stage_current)}</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1 z-[150]" align="start">
                {PM_ACTIVE_STAGES.map(s => {
                  const color = getStageCircleColor(s.key);
                  const isDoneS = s.key === "entrega";
                  const isSelected = task.stage_current === s.key;
                  return (
                    <button
                      key={s.key}
                      className={cn("flex items-center gap-3 w-full px-3 py-2 rounded text-sm hover:bg-accent transition", isSelected && "bg-accent")}
                      onClick={() => updateTask.mutate({ id: task.id, stage_current: s.key as any })}
                    >
                      <span className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0", color.border, isDoneS && `${color.bg}`)}>
                        {isDoneS && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span className="font-medium">{s.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </PropertyRow>

          {/* Planning type selector removed — now uses dual sections */}

          <PropertyRow icon={<Tag className="h-3.5 w-3.5" />} label="Etiquetas">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex flex-wrap items-center gap-1 cursor-pointer min-h-[28px]">
                  {(task.tags ?? []).length > 0 ? (task.tags ?? []).map((rawTag) => {
                    const tc = tagColor(rawTag);
                    const name = tagDisplay(rawTag);
                    return (<Badge key={rawTag} className={cn("text-[10px] h-5 px-1.5 gap-1 border-0", tc.bg, tc.text)}>{name}</Badge>);
                  }) : (<span className="text-xs text-muted-foreground">Adicionar...</span>)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0 z-[150]" align="start">
                <div className="p-3 border-b border-border/30">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Pesquisar etiquetas..."
                    className="h-8 text-xs"
                  />
                </div>
                {globalTags.length > 0 && (
                  <div className="p-2 space-y-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-2 py-1">Etiquetas disponíveis</p>
                    {globalTags
                      .filter(gt => !newTagName.trim() || gt.name.toLowerCase().includes(newTagName.trim().toLowerCase()))
                      .map(gt => {
                      const rawTag = `${gt.name}:${gt.color_key}`;
                      const tc = tagColor(rawTag);
                      const isActive = (task.tags ?? []).includes(rawTag);
                      return (
                        <div key={gt.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50 transition group", isActive && "bg-accent/30")}>
                          <button className="flex items-center gap-2 flex-1 text-left" onClick={() => toggleGlobalTag(rawTag)}>
                            <span className={cn("h-3 w-3 rounded shrink-0", tc.dot)} />
                            <span className="text-xs flex-1">{gt.name}</span>
                            {isActive && <Check className="h-3 w-3 text-primary shrink-0" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                {globalTags.length === 0 && (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Nenhuma etiqueta criada. Crie em Configurações → Pontuação.
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </PropertyRow>
        </div>

        {/* ── Concluído / Alteração action buttons ── */}
        {task.stage_current === "alteracoes" && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
              <RotateCcw className="h-3.5 w-3.5" /> Em Alteração
            </div>
            <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/80" onClick={handleReturnFromAlteracao}>
              <CheckCircle2 className="h-4 w-4" /> Ajuste Concluído
            </Button>
            {/* Revert button */}
            <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground border-border/40 hover:bg-muted/60" onClick={handleRevert}>
              <RotateCcw className="h-3.5 w-3.5" /> Reverter
            </Button>
          </div>
        )}

        {task.stage_current !== "alteracoes" && (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {!isDone ? (
            <>
              <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/80" onClick={handleConcluido}>
                <CheckCircle2 className="h-4 w-4" />
                {task.stage_current === "revisao" ? "Aprovar e seguir fluxo" : "Concluído"}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>

              {/* Stage choice popover (for multiple next stages) */}
              <Popover open={stageChoiceOpen} onOpenChange={setStageChoiceOpen}>
                <PopoverTrigger asChild>
                  <span />
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1 z-[130]" align="start">
                  <p className="text-xs text-muted-foreground px-3 py-2 font-medium">Avançar para qual etapa?</p>
                  {stageChoiceOptions.map(sk => {
                    const sc = getStageCircleColor(sk);
                    return (
                      <button key={sk} className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm hover:bg-accent transition" onClick={() => handleChooseNextStage(sk)}>
                        <span className={cn("h-4 w-4 rounded-full border-2 shrink-0", sc.border, sk === "entrega" && sc.bg)}>
                          {sk === "entrega" && <Check className="h-2.5 w-2.5 text-white" />}
                        </span>
                        <span className="font-medium">{stageLabel(sk)}</span>
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>

              {/* Completion date dialog */}
              <Dialog open={completionDateOpen} onOpenChange={setCompletionDateOpen}>
                <DialogContent className="max-w-xs z-[130]">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">Data de entrega da próxima etapa</h3>
                    <p className="text-xs text-muted-foreground">
                      Defina a data de entrega para a próxima etapa.
                    </p>
                    <DatePicker value={completionDate} onChange={(v) => setCompletionDate(v)} className="w-full h-9" />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setCompletionDateOpen(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleConfirmCompletionDate} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Check className="h-3.5 w-3.5" /> Confirmar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Link or Date dialog for existing agenda tasks */}
              <LinkOrDateDialog
                open={linkDialogOpen}
                onClose={() => { setLinkDialogOpen(false); setLinkExistingTask(null); setPendingAdvance(null); setPendingSplit(null); }}
                existingTask={linkExistingTask}
                onLink={async (dueDate) => {
                  if (pendingSplit) {
                    // Handle split linking
                    const s = pendingSplit;
                    await executeSplitTask(s.stage, s.stageLabel, s.children, s.postType, dueDate, s.clientName, s.monthLabel, linkExistingTask?.id);
                    setLinkDialogOpen(false); setLinkExistingTask(null); setPendingSplit(null);
                    // Process remaining splits
                    await processSplitQueue(s.remainingSplits, s.snapshotDueDate, s.nextDueDate, s.clientName, s.monthLabel);
                  } else if (pendingAdvance) {
                    doAdvance(pendingAdvance.completedStage, pendingAdvance.nextStage, dueDate, linkExistingTask?.id);
                    setLinkDialogOpen(false); setLinkExistingTask(null); setPendingAdvance(null);
                  }
                }}
                onSelectDate={async (dueDate) => {
                  if (pendingSplit) {
                    const s = pendingSplit;
                    await executeSplitTask(s.stage, s.stageLabel, s.children, s.postType, dueDate, s.clientName, s.monthLabel);
                    setLinkDialogOpen(false); setLinkExistingTask(null); setPendingSplit(null);
                    await processSplitQueue(s.remainingSplits, s.snapshotDueDate, s.nextDueDate, s.clientName, s.monthLabel);
                  } else if (pendingAdvance) {
                    doAdvance(pendingAdvance.completedStage, pendingAdvance.nextStage, dueDate);
                    setLinkDialogOpen(false); setLinkExistingTask(null); setPendingAdvance(null);
                  }
                }}
              />
            </>
          ) : (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-0 gap-1">
              <Check className="h-3 w-3" /> Entregue
            </Badge>
          )}

          {/* Enviar para Alteração — only from Revisão */}
          {task.stage_current === "revisao" && (
            <Button size="sm" variant="outline" className="gap-1.5 text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={handleAlteracao}>
              <RotateCcw className="h-3.5 w-3.5" /> Enviar para Alteração
            </Button>
          )}

          {/* Revert button — go back to previous stage */}
          {!isDone && task.stage_current !== "captacao" && (
            <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground border-border/40 hover:bg-muted/60" onClick={handleRevert}>
              <RotateCcw className="h-3.5 w-3.5" /> Reverter
            </Button>
          )}
        </div>
        )}

        {/* Description — hidden for planning parent tasks */}
        {!(task.stage_current === "planejamento" && !task.parent_task_id) && (
          <div className="border-t border-border/20 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold">Descrição</h3>
            </div>
            <SmartCaptionEditor
              value={task.description ?? ""}
              onChange={(val) => updateTask.mutate({ id: task.id, description: val })}
              placeholder="Adicione uma descrição..."
              minHeight="80px"
            />
          </div>
        )}

        {/* Posting Fields (for subtasks in PDF stage only) */}
        {task.parent_task_id && task.stage_current === "pdf" && (
          <div className="border-t border-border/20 pt-4">
            <PmPostingFields task={task} />
          </div>
        )}

        {/* Subtasks — use planning layout for planejamento parent tasks */}
        <div className="border-t border-border/20 pt-4">
          {task.stage_current === "planejamento" && !task.parent_task_id ? (
            <PmPlanningSubtasks parentTask={task} childTasks={childTasks} membersMap={membersMap} members={members} onSelectSubtask={onSelectSubtask} activeSubtaskId={activeSubtaskId} />
          ) : (
            <PmSubtaskList parentTask={task} childTasks={childTasks} membersMap={membersMap} members={members} onSelectSubtask={onSelectSubtask} activeSubtaskId={activeSubtaskId} />
          )}
        </div>

        {/* Attachments — hidden for planning parent tasks */}
        {!(task.stage_current === "planejamento" && !task.parent_task_id) && (
          <div className="border-t border-border/20 pt-4">
            <PmAttachmentsSection taskId={task.id} attachments={attachments} membersMap={membersMap} onSetCover={handleSetCover} currentCoverUrl={task.cover_url} />
          </div>
        )}

        {/* Cronograma tab (only for parent tasks in PDF stage with children) */}
        {!task.parent_task_id && task.stage_current === "pdf" && childTasks.length > 0 && (
          <div className="border-t border-border/20 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold">Cronograma</h3>
            </div>
            <PmCronogramaTab
              parentTask={task}
              childTasks={childTasks}
              clientName={clientsMap[task.client_id] ?? ""}
              membersMap={membersMap}
              onEditTask={onEditTask}
            />
          </div>
        )}

        {/* Mobile-only comments section (since sidebar is hidden) */}
        <div className="border-t border-border/20 pt-4 md:hidden">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Atividade</h3>
          </div>
          <MobileCommentsInline taskId={task.id} membersMap={membersMap} members={members} />
        </div>
      </div>
    </div>
  );
}

// ─── Inline Stage Circle ───
function StageCircleInline({ stageKey }: { stageKey: string }) {
  const color = getStageCircleColor(stageKey);
  const isDone = stageKey === "entrega";
  return (
    <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", color.border, isDone && `${color.bg}`)}>
      {isDone && <Check className="h-2.5 w-2.5 text-white" />}
    </span>
  );
}

// ─── Helpers ───

function PropertyRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-2 min-h-[40px] rounded-lg hover:bg-muted/30 transition px-2 -mx-2">
      <div className="flex items-center gap-2 w-28 shrink-0 text-muted-foreground/70">{icon}<span className="text-xs font-medium">{label}</span></div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/* Small wrapper so the mobile inline comments fetch their own data */
function MobileCommentsInline({ taskId, membersMap, members }: {
  taskId: string;
  membersMap: Record<string, { name: string; avatar?: string }>;
  members: { id: string; name: string }[];
}) {
  const commentsQ = usePmComments(taskId);
  return <PmCommentsSection taskId={taskId} comments={commentsQ.data ?? []} membersMap={membersMap} members={members} />;
}
