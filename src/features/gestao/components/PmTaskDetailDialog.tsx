import { useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar, UserCircle, Flag, X, ChevronRight, ArrowLeft, Trash2,
  Layers, Tag, MessageSquare, Plus, Check, CheckCircle2, RotateCcw, Paperclip, ListTodo, FileText, CalendarDays, Pencil, Lock
} from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteTask = useUpdatePmTask();

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
    <>
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
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive" title="Mover para lixeira" onClick={() => setShowDeleteConfirm(true)}><Trash2 className="h-4 w-4" /></Button>
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

    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent className="z-[200]">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p>Tem certeza que deseja excluir esta tarefa?</p>
              <p className="mt-2 text-destructive font-medium">⚠️ Os pontos de performance não serão contabilizados e a etapa será desmarcada no Magic Number.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser();
            deleteTask.mutate({ id: currentTask.id, deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null } as any);
            toast.success("Tarefa movida para a lixeira");
            handleClose();
          }}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
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
  const queryClient = useQueryClient();
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

  // Correction mode for completed snapshots
  const { user: sessionUser } = useSession();
  const { isAdmin: isRoleAdmin, isPlanner } = useRole(sessionUser?.id);
  const canCorrect = isRoleAdmin || isPlanner;
  const isCompletedSnapshot = task.status_global === "concluido" && task.stage_current !== "entrega" && !task.parent_task_id;
  const [correctionMode, setCorrectionMode] = useState(false);

  // Possible next stages from flow
  // Extra demands go straight to entrega after revisão
  const rawNextStages = getNextStages(flowConfig, task.stage_current);
  const nextStages = (task.is_extra_demand && task.stage_current === "revisao")
    ? ["entrega"]
    : rawNextStages;
  const isDone = task.parent_task_id
    ? task.status_global === "concluido"
    : task.stage_current === "entrega";

  const syncCompletedStage = async (completedStage: string) => {
    if (task.parent_task_id) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // DB function now automatically distributes points per subtask assignee
      syncStage.mutate({
        pmTaskId: task.id,
        completedStage,
        userId: user.id,
      });
    } catch (_) { /* ignore */ }
  };

  const doAdvance = async (completedStage: string, nextStage: string, newDueDate?: string, linkedTaskId?: string) => {
    const sb = supabase as any;
    const qc = (window as any).__pmQueryClient ?? null; // fallback, won't be used

    const cloneChildrenToNewTask = async (targetTaskId: string, targetStage: string) => {
      const fixedAssignee = getFixedAssignee(stageAssignees, targetStage, task.client_id);
      const fixedWatchers = getFixedWatchers(stageAssignees, targetStage, task.client_id);

      // Freeze originals via single batch call (avoids multiple mutations)
      const childIds = childTasks.map(c => c.id);
      if (childIds.length > 0) {
        await sb.from("pm_tasks").update({ status_global: "concluido" }).in("id", childIds);
      }

      // Clone children sequentially to avoid overwhelming React Query
      const { data: { user } } = await supabase.auth.getUser();
      for (const child of childTasks) {
        await sb.from("pm_tasks").insert({
          client_id: child.client_id,
          title: child.title,
          description: child.description ?? null,
          stage_current: targetStage,
          assignee_id: fixedAssignee !== undefined ? (fixedAssignee ?? null) : (child.assignee_id ?? null),
          watchers: fixedAssignee !== undefined ? fixedWatchers : (child.watchers ?? []),
          parent_task_id: targetTaskId,
          tags: child.tags ?? [],
          is_extra_demand: child.is_extra_demand,
          status_global: "backlog",
          post_type: child.post_type ?? null,
          created_by: user?.id,
        });
      }

      // Copy attachments
      const { data: existingAtts } = await sb.from("pm_attachments").select("*").eq("task_id", task.id);
      if (existingAtts?.length) {
        await Promise.all(existingAtts.map((att: any) => {
          const { id: _id, created_at: _ca, ...rest } = att;
          return sb.from("pm_attachments").insert({ ...rest, task_id: targetTaskId });
        }));
      }
    };

    // Skip scoring for alteracoes and revisao — they don't generate points
    if (completedStage !== "alteracoes" && completedStage !== "revisao") {
      syncCompletedStage(completedStage);
    }

    try {
      if (linkedTaskId) {
        // Snapshot: mark current task as completed at current stage
        const snapshotDueDate = task.due_date ?? format(new Date(), "yyyy-MM-dd");
        await sb.from("pm_tasks").update({
          stage_current: completedStage,
          status_global: "concluido",
          due_date: snapshotDueDate,
        }).eq("id", task.id);

        // Update linked task with correct assignee
        const fixedAssignee = getFixedAssignee(stageAssignees, nextStage, task.client_id);
        const fixedWatchers = getFixedWatchers(stageAssignees, nextStage, task.client_id);
        const linkedUpdates: any = { status_global: "backlog" };
        if (fixedAssignee !== undefined) {
          linkedUpdates.assignee_id = fixedAssignee;
          linkedUpdates.watchers = fixedWatchers;
        }
        await sb.from("pm_tasks").update(linkedUpdates).eq("id", linkedTaskId);
        await cloneChildrenToNewTask(linkedTaskId, nextStage);
      } else if (nextStage === "entrega") {
        // Final stage: mark parent + all children as delivered in a single batch
        const allIds = [task.id, ...childTasks.map(c => c.id)];
        await sb.from("pm_tasks")
          .update({ stage_current: "entrega", status_global: "concluido" })
          .in("id", allIds);
      } else {
        // Snapshot current task as completed (stays in agenda)
        const snapshotDueDate = task.due_date ?? format(new Date(), "yyyy-MM-dd");
        await sb.from("pm_tasks").update({
          stage_current: completedStage,
          status_global: "concluido",
          due_date: snapshotDueDate,
        }).eq("id", task.id);

        // Create new task for the next stage with correct assignee
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

        const originId = task.origin_task_id ?? task.id;
        const resolvedPostType = task.post_type
          ?? (completedStage === "edicao_videos" ? "video" : completedStage === "design" ? "design" : undefined);

        const { data: { user } } = await supabase.auth.getUser();
        const { data: newTask, error: createError } = await sb.from("pm_tasks").insert({
          client_id: task.client_id,
          title: newTitle,
          description: task.description ?? null,
          stage_current: nextStage,
          due_date: nextDueDate,
          assignee_id: fixedAssignee !== undefined ? (fixedAssignee ?? null) : (task.assignee_id ?? null),
          watchers: fixedAssignee !== undefined ? fixedWatchers : (task.watchers ?? []),
          priority: task.priority,
          project_id: task.project_id ?? null,
          tags: task.tags ?? [],
          is_extra_demand: task.is_extra_demand,
          status_global: "backlog",
          post_type: resolvedPostType ?? null,
          origin_task_id: originId,
          created_by: user?.id,
        }).select().single();

        if (createError) {
          console.error("Error creating next stage task:", createError);
          toast.error("Erro ao criar tarefa da próxima etapa");
          return;
        }

        if (newTask) {
          await cloneChildrenToNewTask(newTask.id, nextStage);
        }
      }

      // Invalidate queries to refresh UI after all DB operations complete
      queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
      queryClient.invalidateQueries({ queryKey: ["pm_activity_log"] });

      toast.success(nextStage === "entrega" ? "Tarefa marcada como Entregue!" : `Avançou para ${stageLabel(nextStage)}`);
    } catch (err) {
      console.error("Error advancing stage:", err);
      toast.error("Erro ao avançar etapa. Tente novamente.");
    }
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

    // When advancing to revisão, only link with the same post_type origin
    const inferredNextStagePostType = task.post_type
      ?? (task.stage_current === "edicao_videos" ? "video" : task.stage_current === "design" ? "design" : undefined);
    if (nextStage === "revisao" && inferredNextStagePostType) {
      query = query.eq("post_type", inferredNextStagePostType);
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
      // Clone children to linked task (originals stay frozen on snapshot)
      for (const child of children) {
        await createTask.mutateAsync({
          client_id: child.client_id, title: child.title,
          description: child.description ?? undefined, stage_current: stage,
          assignee_id: fixedAssignee !== undefined ? (fixedAssignee ?? undefined) : (child.assignee_id ?? undefined),
          watchers: fixedAssignee !== undefined ? fixedWatchers_ : (child.watchers ?? []),
          parent_task_id: linkedTaskId, tags: child.tags ?? [],
          is_extra_demand: child.is_extra_demand, status_global: "backlog",
          post_type: child.post_type ?? undefined,
        });
      }
    } else {
      // Create new task
      const title = monthLabel
        ? `${clientName} - ${stageLabel_} - ${monthLabel}`
        : `${clientName} - ${stageLabel_}`;
      const originId = task.origin_task_id ?? task.id;
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
        origin_task_id: originId,
      });
      // Clone children to new task (originals stay frozen on snapshot)
      for (const child of children) {
        await createTask.mutateAsync({
          client_id: child.client_id, title: child.title,
          description: child.description ?? undefined, stage_current: stage,
          assignee_id: fixedAssignee !== undefined ? (fixedAssignee ?? undefined) : (child.assignee_id ?? undefined),
          watchers: fixedAssignee !== undefined ? fixedWatchers_ : (child.watchers ?? []),
          parent_task_id: newTask.id, tags: child.tags ?? [],
          is_extra_demand: child.is_extra_demand, status_global: "backlog",
          post_type: child.post_type ?? undefined,
        });
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
      const sb = supabase as any;
      const allIds = [task.id, ...childTasks.map(c => c.id)];
      await sb.from("pm_tasks")
        .update({ stage_current: "captacao", status_global: "concluido" })
        .in("id", allIds);
      // Sync scoring for captação
      syncCompletedStage(completedStage);
      queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
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
        // Snapshot current task as completed + freeze all children via single batch
        const snapshotDueDate = task.due_date ?? format(new Date(), "yyyy-MM-dd");
        const sb = supabase as any;
        const allIds = [task.id, ...childTasks.map(c => c.id)];
        await sb.from("pm_tasks").update({ status_global: "concluido" }).in("id", allIds);
        await sb.from("pm_tasks").update({
          stage_current: completedStage,
          status_global: "concluido",
          due_date: snapshotDueDate,
        }).eq("id", task.id);

        // Sync scoring for planejamento
        syncCompletedStage(completedStage);

        queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
        queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
        queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });

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

    const originId = task.origin_task_id ?? task.id;
    let previousSnapshot: any = null;

    const taskTags = task.tags ?? [];
    const normalizedTitle = task.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const isVideoByPostType = task.post_type === "video";
    const isVideoByTag = taskTags.some((t) => {
      const parsed = parseTag(t);
      const tagName = parsed.name.toLowerCase();
      return tagName === "vídeo" || tagName === "video";
    });
    const isVideoByTitle = normalizedTitle.includes("video");
    const previousWorkStage = isVideoByPostType || isVideoByTag || isVideoByTitle
      ? "edicao_videos"
      : "design";
    const resolvedAlteracaoPostType = task.post_type ?? (previousWorkStage === "edicao_videos" ? "video" : "design");
    const previousStageAssignee = getFixedAssignee(stageAssignees, previousWorkStage, task.client_id);
    const previousStageWatchers = getFixedWatchers(stageAssignees, previousWorkStage, task.client_id);

    const { data: snapshots } = await sb
      .from("pm_tasks")
      .select("id, assignee_id, watchers, stage_current, post_type, tags")
      .or(`id.eq.${originId},origin_task_id.eq.${originId}`)
      .eq("stage_current", previousWorkStage)
      .eq("status_global", "concluido")
      .is("parent_task_id", null)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (snapshots?.length) {
      previousSnapshot = snapshots.find((snapshot: any) => snapshot.post_type === resolvedAlteracaoPostType)
        ?? snapshots[0];
    }

    if (previousSnapshot) {
      const resolvedPreviousAssignee = previousSnapshot.assignee_id ?? previousStageAssignee ?? null;
      const resolvedPreviousWatchers = previousSnapshot.watchers?.length
        ? previousSnapshot.watchers
        : previousStageWatchers;

      const prevUpdates: any = {
        id: previousSnapshot.id,
        stage_current: "alteracoes" as any,
        status_global: "em_andamento" as any,
        assignee_id: resolvedPreviousAssignee,
        watchers: resolvedPreviousWatchers,
        post_type: previousSnapshot.post_type ?? resolvedAlteracaoPostType,
      };
      updateTask.mutate(prevUpdates);

      const { data: prevChildren } = await sb
        .from("pm_tasks")
        .select("id")
        .eq("parent_task_id", previousSnapshot.id);
      if (prevChildren?.length) {
        for (const pc of prevChildren) {
          await sb.from("pm_tasks").update({ deleted_at: new Date().toISOString(), deleted_by: user.id }).eq("id", pc.id);
        }
      }

      for (const child of childTasks) {
        updateTask.mutate({
          id: child.id,
          parent_task_id: previousSnapshot.id,
          stage_current: "alteracoes" as any,
          status_global: "backlog" as any,
          assignee_id: resolvedPreviousAssignee,
          watchers: resolvedPreviousWatchers,
          post_type: child.post_type ?? previousSnapshot.post_type ?? resolvedAlteracaoPostType,
        } as any);
      }

      await sb
        .from("pm_subtasks")
        .update({ status: "nao_iniciado" })
        .eq("task_id", previousSnapshot.id);

      await sb
        .from("pm_attachments")
        .update({ task_id: previousSnapshot.id })
        .eq("task_id", task.id);

      updateTask.mutate({
        id: task.id,
        status_global: "pausado" as any,
      });

      toast.success("Tarefa retornou para alteração no responsável anterior");
    } else {
      const resolvedPreviousAssignee = previousStageAssignee ?? null;
      const resolvedPreviousWatchers = previousStageWatchers;

      const updates: any = {
        id: task.id,
        stage_current: "alteracoes" as any,
        assignee_id: resolvedPreviousAssignee,
        watchers: resolvedPreviousWatchers,
        post_type: resolvedAlteracaoPostType,
      };
      updateTask.mutate(updates);

      for (const child of childTasks) {
        updateTask.mutate({
          id: child.id,
          stage_current: "alteracoes" as any,
          assignee_id: resolvedPreviousAssignee,
          watchers: resolvedPreviousWatchers,
          post_type: child.post_type ?? resolvedAlteracaoPostType,
        } as any);
      }

      await sb
        .from("pm_subtasks")
        .update({ status: "nao_iniciado" })
        .eq("task_id", task.id);

      toast.success("Tarefa enviada para Alteração no responsável anterior");
    }
  };

  const handleReturnFromAlteracao = async () => {
    const sb = supabase as any;
    const originId = task.origin_task_id ?? task.id;

    // Detect original stage: check post_type first, then tags, then title as legacy fallback
    const isVideoByPostType = task.post_type === "video";
    const taskTags = task.tags ?? [];
    const isVideoByTag = taskTags.some(t => {
      const parsed = parseTag(t);
      return parsed.name.toLowerCase() === "vídeo" || parsed.name.toLowerCase() === "video";
    });
    const normalizedTitle = task.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const isVideoByTitle = normalizedTitle.includes("video");
    const isVideoTask = isVideoByPostType || isVideoByTag || isVideoByTitle;
    const originalStage = isVideoTask ? "edicao_videos" : "design";
    const resolvedReturnPostType = isVideoTask ? "video" : "design";

    // Find the paused revisão task in the same lineage to reactivate
    let revisaoQuery = sb
      .from("pm_tasks")
      .select("id, assignee_id, watchers, post_type")
      .or(`id.eq.${originId},origin_task_id.eq.${originId}`)
      .eq("stage_current", "revisao")
      .eq("status_global", "pausado")
      .is("parent_task_id", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    revisaoQuery = revisaoQuery.eq("post_type", task.post_type ?? resolvedReturnPostType);

    const { data: pausedRevisao } = await revisaoQuery;

    if (pausedRevisao && pausedRevisao.length > 0) {
      const revisaoTask = pausedRevisao[0];

      // Mark the current alteração task back as concluído at its original stage
      updateTask.mutate({
        id: task.id,
        stage_current: originalStage as any,
        status_global: "concluido" as any,
        post_type: task.post_type ?? revisaoTask.post_type ?? resolvedReturnPostType,
      });

      // Mark children as concluído too
      for (const child of childTasks) {
        updateTask.mutate({
          id: child.id,
          stage_current: originalStage as any,
          status_global: "concluido" as any,
          post_type: child.post_type ?? task.post_type ?? revisaoTask.post_type ?? resolvedReturnPostType,
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
        post_type: task.post_type ?? revisaoTask.post_type ?? resolvedReturnPostType,
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
          post_type: child.post_type ?? task.post_type ?? revisaoTask.post_type ?? resolvedReturnPostType,
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
        post_type: task.post_type ?? resolvedReturnPostType,
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

  const recalcTagPoints = async (taskId: string) => {
    try {
      await supabase.rpc("pm_recalc_tag_points", { _pm_task_id: taskId } as any);
    } catch (e) {
      console.error("Error recalculating tag points:", e);
    }
  };

  const removeTag = (tag: string) => {
    updateTask.mutate({ id: task.id, tags: (task.tags ?? []).filter(t => t !== tag) } as any, {
      onSuccess: () => { recalcTagPoints(task.id); },
    });
  };
  const toggleGlobalTag = (tag: string) => {
    const existing = task.tags ?? [];
    if (existing.includes(tag)) {
      removeTag(tag);
    } else {
      updateTask.mutate({ id: task.id, tags: [...existing, tag] } as any, {
        onSuccess: () => { recalcTagPoints(task.id); },
      });
    }
  };

  return (
    <div className="space-y-0">
      {task.cover_url && (
        <div className="relative w-full h-40 overflow-hidden bg-muted">
          <img src={task.cover_url} alt="Capa" className="w-full h-full object-cover" />
          {!isCompletedSnapshot && <Button size="sm" variant="secondary" className="absolute top-2 right-2 h-6 text-[10px] opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity" onClick={handleRemoveCover}>Remover capa</Button>}
        </div>
      )}

      <div className="px-4 sm:px-6 py-4 sm:py-5 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] sm:pb-5 space-y-5 sm:space-y-6">
        {/* Completed snapshot badge */}
        {isCompletedSnapshot && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex-1">
              <Lock className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Etapa concluída — {stageLabel(task.stage_current)}</span>
            </div>
            {canCorrect && (
              <Button size="sm" variant={correctionMode ? "default" : "outline"} className="gap-1.5 h-8 text-xs" onClick={() => setCorrectionMode(!correctionMode)}>
                <Pencil className="h-3.5 w-3.5" />
                {correctionMode ? "Sair do modo correção" : "Corrigir responsável / pontuação"}
              </Button>
            )}
          </div>
        )}

        {/* Title */}
        {isCompletedSnapshot ? (
          <h1 className="text-xl sm:text-2xl font-bold text-muted-foreground">{task.title}</h1>
        ) : editingTitle ? (
          <Input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && saveTitle()} className="text-xl sm:text-2xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0" />
        ) : (
          <h1 className="cursor-pointer text-xl sm:text-2xl font-bold hover:text-primary transition-colors" onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}>{task.title}</h1>
        )}

        {/* Properties grid */}
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2", isCompletedSnapshot && !correctionMode && "pointer-events-none opacity-60")}>
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
        {task.parent_task_id ? (
          /* ── Subtask-specific buttons: toggle done, send to Alteração ── */
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {isDone ? (
              <>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 gap-1">
                  <Check className="h-3 w-3" /> Concluído
                </Badge>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                  updateTask.mutate({ id: task.id, status_global: "backlog" });
                  toast.success("Subtarefa desmarcada");
                }}>
                  <RotateCcw className="h-3.5 w-3.5" /> Desmarcar concluído
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => {
                  updateTask.mutate({ id: task.id, stage_current: "alteracoes", status_global: "backlog" });
                  toast.success("Enviado para Alteração");
                }}>
                  <RotateCcw className="h-3.5 w-3.5" /> Enviar para Alteração
                </Button>
              </>
            ) : task.stage_current === "alteracoes" ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
                  <RotateCcw className="h-3.5 w-3.5" /> Em Alteração
                </div>
                <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/80" onClick={async () => {
                  updateTask.mutate({ id: task.id, status_global: "concluido" });
                  const { data: { user: u } } = await supabase.auth.getUser();
                   if (u) syncStage.mutate({ pmTaskId: task.id, completedStage: task.stage_current, userId: u.id });
                  toast.success("Subtarefa concluída ✓");
                }}>
                  <CheckCircle2 className="h-4 w-4" /> Concluído
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/80" onClick={async () => {
                  updateTask.mutate({ id: task.id, status_global: "concluido" });
                  const { data: { user: u } } = await supabase.auth.getUser();
                  if (u) syncStage.mutate({ pmTaskId: task.id, completedStage: task.stage_current, userId: u.id });
                  toast.success("Subtarefa concluída ✓");
                }}>
                  <CheckCircle2 className="h-4 w-4" /> Concluído
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => {
                  updateTask.mutate({ id: task.id, stage_current: "alteracoes", status_global: "backlog" });
                  toast.success("Enviado para Alteração");
                }}>
                  <RotateCcw className="h-3.5 w-3.5" /> Enviar para Alteração
                </Button>
              </>
            )}
          </div>
        ) : (
          /* ── Parent task buttons: full workflow ── */
          <>
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
          {!(isDone || isCompletedSnapshot) ? (
            <>
              <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/80" onClick={handleConcluido}>
                <CheckCircle2 className="h-4 w-4" />
                {task.stage_current === "revisao" ? "Aprovar e seguir fluxo" : "Concluir"}
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
            <Button
              size="sm"
              className="group/done gap-1.5 min-w-[130px] bg-success text-success-foreground hover:bg-destructive/90 transition-colors duration-200"
              onClick={async () => {
                const sb = supabase as any;
                const allIds = [task.id, ...childTasks.map(c => c.id)];

                if (isCompletedSnapshot) {
                  // Snapshot: keep stage, just reset status
                  await sb.from("pm_tasks")
                    .update({ status_global: "backlog" })
                    .in("id", allIds);
                } else {
                  // Normal entrega: revert to previous stage
                  const flowStages = Object.keys(flowConfig).length > 0
                    ? Object.entries(flowConfig)
                        .filter(([, v]: [string, any]) => v.enabled)
                        .sort(([, a]: [string, any], [, b]: [string, any]) => (a.order ?? 0) - (b.order ?? 0))
                        .map(([k]) => k)
                    : PM_ACTIVE_STAGES.map(s => s.key);
                  const entregaIdx = flowStages.indexOf("entrega");
                  const prevStage = entregaIdx > 0 ? flowStages[entregaIdx - 1] : "agendamento";
                  await sb.from("pm_tasks")
                    .update({ stage_current: prevStage, status_global: "backlog" })
                    .in("id", allIds);
                }
                queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
                queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
                queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
                toast.success("Tarefa desconcluída");
              }}
            >
              <span className="contents group-hover/done:hidden">
                <CheckCircle2 className="h-4 w-4" />
                Concluído
              </span>
              <span className="hidden group-hover/done:contents">
                <RotateCcw className="h-4 w-4" />
                Desmarcar
              </span>
            </Button>
          )}

          {/* Enviar para Alteração — only from Revisão */}
          {task.stage_current === "revisao" && (
            <Button size="sm" variant="outline" className="gap-1.5 text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={handleAlteracao}>
              <RotateCcw className="h-3.5 w-3.5" /> Enviar para Alteração
            </Button>
          )}

        </div>
        )}
          </>
        )}
        {/* Description / Caption editor */}
        <div className={cn("border-t border-border/20 pt-4", isCompletedSnapshot && !correctionMode && "pointer-events-none opacity-60")}>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Descrição</h3>
          </div>
          <SmartCaptionEditor
            value={task.description ?? ""}
            onChange={(val) => updateTask.mutate({ id: task.id, description: val })}
            placeholder="Adicione uma descrição..."
            minHeight="100px"
          />
        </div>


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
            <PmSubtaskList parentTask={task} childTasks={childTasks} membersMap={membersMap} members={members} onSelectSubtask={onSelectSubtask} activeSubtaskId={activeSubtaskId} readOnly={isCompletedSnapshot && !correctionMode} correctionMode={correctionMode && isCompletedSnapshot} />
          )}
        </div>

        {/* Attachments — hidden for planning parent tasks */}
        {!(task.stage_current === "planejamento" && !task.parent_task_id) && (
          <div className={cn("border-t border-border/20 pt-4", isCompletedSnapshot && !correctionMode && "pointer-events-none opacity-60")}>
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
