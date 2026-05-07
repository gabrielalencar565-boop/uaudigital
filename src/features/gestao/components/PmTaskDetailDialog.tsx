import { useState, useMemo, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calendar, UserCircle, Flag, X, ChevronRight, ArrowLeft, Trash2,
  Layers, Tag, MessageSquare, Plus, Check, CheckCircle2, RotateCcw, Paperclip, ListTodo, FileText, Pencil, Lock
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
  parseTag, tagColor, tagDisplay, isHexColor, TAG_COLORS
} from "../pm-constants";
import { usePeriodicStages } from "../hooks/use-periodic-stages";
import {
  useUpdatePmTask, useCreatePmTask, usePmTasks, usePmChildTasks,
  usePmComments, usePmAttachments, usePmSyncStageCompletion,
} from "../hooks/use-pm-data";
import { usePmTags } from "../hooks/use-pm-tags";
import { useDefaultFlowWithDates, getNextStages, getFixedAssignee, getFixedWatchers, resolveAssigneeStageKey } from "./PmStageFlowConfig";
import { PmSubtaskList } from "./PmSubtaskList";
import { PmPlanningSubtasks } from "./PmPlanningSubtasks";
import { PmCommentsSection } from "./PmCommentsSection";
import { PmAttachmentsSection } from "./PmAttachmentsSection";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import { AlteracaoReviewPanel } from "./AlteracaoReviewPanel";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";
import { SmartCaptionEditor } from "./SmartCaptionEditor";
import { LinkOrDateDialog } from "./LinkOrDateDialog";
import { SpellCheckText } from "./SpellCheckText";
import { EditableTitleWithSpellCheck } from "./EditableTitleWithSpellCheck";
import { supabase } from "@/integrations/supabase/client";
import { inferPmPostType, type PmPostType } from "../utils/infer-pm-post-type";

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
  const queryClientPrefetch = useQueryClient();

  const tasksQ = usePmTasks();
  const resolvedRootTask = useMemo(() => {
    if (!task) return null;
    return tasksQ.data?.find(t => t.id === task.id) ?? task;
  }, [task, tasksQ.data]);

  const currentTaskId = taskStack.length > 0 ? taskStack[taskStack.length - 1] : resolvedRootTask?.id ?? null;

  // Pré-popular cache de child_tasks a partir de pm_child_tasks_all (versão leve, em memória)
  // Evita o "delay" visual ao abrir o detalhe; o usePmChildTasks faz refetch em background
  // com SELECT * e substitui pelos dados completos (description, etc).
  useEffect(() => {
    if (!open || !currentTaskId) return;
    const allChildren = queryClientPrefetch.getQueryData<PmTask[]>(["pm_child_tasks_all"]);
    if (!allChildren) return;
    const existing = queryClientPrefetch.getQueryData<PmTask[]>(["pm_child_tasks", currentTaskId]);
    if (existing && existing.length > 0) return;
    const filtered = allChildren.filter(c => c.parent_task_id === currentTaskId);
    if (filtered.length > 0) {
      // Seed com dados leves para render imediato; marca como stale para refetch completo.
      queryClientPrefetch.setQueryData(["pm_child_tasks", currentTaskId], filtered);
      queryClientPrefetch.invalidateQueries({ queryKey: ["pm_child_tasks", currentTaskId] });
    }
  }, [open, currentTaskId, queryClientPrefetch]);

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
  const visibleAssigneeIds = allAssigneeIds.filter(id => membersMap[id]);

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
    deferredCompletion?: { allIds: string[]; completedStage: string; snapshotDueDate: string };
  } | null>(null);

  // Correction mode for completed snapshots
  const { user: sessionUser } = useSession();
  const { isAdmin: isRoleAdmin, isPlanner } = useRole(sessionUser?.id);
  const canCorrect = isRoleAdmin || isPlanner;
  const isCompletedSnapshot = task.status_global === "concluido" && task.stage_current !== "entrega" && !task.parent_task_id && !task.is_extra_demand;
  const [correctionMode, setCorrectionMode] = useState(false);
  const periodicStagesQ = usePeriodicStages();
  const periodicStages = periodicStagesQ.data ?? [];
  const currentPeriodic = task.periodic_stage_key ? periodicStages.find(p => p.key === task.periodic_stage_key) : null;
  const resolvedTaskPostType = inferPmPostType(task) ?? task.post_type;

  const isPlanejamentoReview = task.stage_current === "revisao" && !task.parent_task_id && (
    task.post_type === "planejamento" || (
      task.post_type == null &&
      childTasks.length > 0 &&
      childTasks.some(c => c.post_type === "video") &&
      childTasks.some(c => c.post_type === "design") &&
      !childTasks.some(c => c.stage_current === "design" || c.stage_current === "edicao_videos")
    )
  );

  // Possible next stages from flow
  // Planejamento sempre vai completo para Revisão (Planejamento), mesmo se o fluxo salvo estiver legado.
  // Extra demands go straight to entrega after revisão
  const rawNextStages = getNextStages(flowConfig, task.stage_current);
  const nextStages = task.is_extra_demand
    ? []
    : task.stage_current === "planejamento"
    ? ["revisao"]
    : rawNextStages;
  const isDone = task.parent_task_id
    ? task.status_global === "concluido"
    : task.is_extra_demand
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

  const invalidatePmTaskQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
    queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
    queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
    queryClient.invalidateQueries({ queryKey: ["pm_activity_log"] });
  }, [queryClient]);

  const doAdvance = async (completedStage: string, nextStage: string, newDueDate?: string, linkedTaskId?: string) => {
    const sb = supabase as any;
    const qc = (window as any).__pmQueryClient ?? null; // fallback, won't be used

    const cloneChildrenToNewTask = async (targetTaskId: string, targetStage: string) => {
      const assigneeKey = resolveAssigneeStageKey(completedStage, targetStage);
      const fixedAssignee = getFixedAssignee(stageAssignees, assigneeKey, task.client_id);
      const fixedWatchers = getFixedWatchers(stageAssignees, assigneeKey, task.client_id);
      const fallbackPostType = inferPmPostType(
        task,
        completedStage === "edicao_videos" ? "video" : completedStage === "design" ? "design" : null
      );

      // Freeze originals via single batch call (avoids multiple mutations)
      const childIds = childTasks.map(c => c.id);
      if (childIds.length > 0) {
        await sb.from("pm_tasks").update({ status_global: "concluido" }).in("id", childIds);
      }

      // Clone children sequentially to avoid overwhelming React Query
      const { data: { user } } = await supabase.auth.getUser();
      const childIdMap: Record<string, string> = {}; // old id → new id
      for (const child of childTasks) {
        const { data: newChild } = await sb.from("pm_tasks").insert({
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
          post_type: inferPmPostType(child, fallbackPostType) ?? null,
          created_by: user?.id,
        }).select("id").single();
        if (newChild) childIdMap[child.id] = newChild.id;
      }

      // Copy attachments AND comments in background (fire-and-forget to avoid blocking UI)
      const copyAttachmentsAndComments = async () => {
        // --- Attachments ---
        const { data: existingAtts } = await sb.from("pm_attachments").select("*").eq("task_id", task.id);
        if (existingAtts?.length) {
          await Promise.all(existingAtts.map((att: any) => {
            const { id: _id, created_at: _ca, ...rest } = att;
            return sb.from("pm_attachments").insert({ ...rest, task_id: targetTaskId });
          }));
        }
        const oldChildIds = Object.keys(childIdMap);
        if (oldChildIds.length > 0) {
          const { data: childAtts } = await sb.from("pm_attachments").select("*").in("task_id", oldChildIds);
          if (childAtts?.length) {
            await Promise.all(childAtts.map((att: any) => {
              const { id: _id, created_at: _ca, task_id: oldTaskId, ...rest } = att;
              const newTaskId = childIdMap[oldTaskId];
              if (!newTaskId) return Promise.resolve();
              return sb.from("pm_attachments").insert({ ...rest, task_id: newTaskId });
            }));
          }
        }
        // --- Comments ---
        const allOldCommentIds = [task.id, ...oldChildIds];
        const { data: existingComments } = await sb.from("pm_comments").select("*").in("task_id", allOldCommentIds);
        if (existingComments?.length) {
          await Promise.all(existingComments.map((c: any) => {
            const { id: _id, created_at: _ca, task_id: oldTid, ...rest } = c;
            const newTid = oldTid === task.id ? targetTaskId : childIdMap[oldTid];
            if (!newTid) return Promise.resolve();
            return sb.from("pm_comments").insert({ ...rest, task_id: newTid });
          }));
        }
      };
      copyAttachmentsAndComments(); // non-blocking
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
        const linkedAssigneeKey = resolveAssigneeStageKey(completedStage, nextStage);
        const fixedAssignee = getFixedAssignee(stageAssignees, linkedAssigneeKey, task.client_id);
        const fixedWatchers = getFixedWatchers(stageAssignees, linkedAssigneeKey, task.client_id);
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

        // Optimistic cache update — instant UI feedback
        await queryClient.cancelQueries({ queryKey: ["pm_tasks"] });
        await queryClient.cancelQueries({ queryKey: ["pm_child_tasks"] });
        await queryClient.cancelQueries({ queryKey: ["pm_child_tasks_all"] });
        const markDone = (old: PmTask[] | undefined) =>
          old?.map(t => allIds.includes(t.id) ? { ...t, stage_current: "entrega" as any, status_global: "concluido" as any } : t);
        queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_tasks"] }, markDone);
        queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks"] }, markDone);
        queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks_all"] }, markDone);
        toast.success("Tarefa marcada como Entregue!");

        // Fire DB in background then resync
        sb.from("pm_tasks")
          .update({ stage_current: "entrega", status_global: "concluido" })
          .in("id", allIds)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
            queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
            queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
            queryClient.invalidateQueries({ queryKey: ["pm_activity_log"] });
          });
        return; // skip the generic toast/invalidation below
      } else {
        // Snapshot current task as completed (stays in agenda)
        const snapshotDueDate = task.due_date ?? format(new Date(), "yyyy-MM-dd");

        // Optimistic: mark current task as completed in cache immediately
        await queryClient.cancelQueries({ queryKey: ["pm_tasks"] });
        const markSnapshot = (old: PmTask[] | undefined) =>
          old?.map(t => t.id === task.id ? { ...t, stage_current: completedStage as any, status_global: "concluido" as any, due_date: snapshotDueDate } : t);
        queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_tasks"] }, markSnapshot);
        toast.success(`Avançou para ${stageLabel(nextStage)}`);

        // Fire DB operations — snapshot + create next stage task
        sb.from("pm_tasks").update({
          stage_current: completedStage,
          status_global: "concluido",
          due_date: snapshotDueDate,
        }).eq("id", task.id).then(async () => {
          const newAssigneeKey = resolveAssigneeStageKey(completedStage, nextStage);
          const fixedAssignee = getFixedAssignee(stageAssignees, newAssigneeKey, task.client_id);
          const fixedWatchers_ = getFixedWatchers(stageAssignees, newAssigneeKey, task.client_id);
          const nextDueDate = newDueDate ?? format(addDays(new Date(snapshotDueDate + "T12:00:00"), 1), "yyyy-MM-dd");

          const nextStageLabel = stageLabel(nextStage);
          const currentStageLabel = stageLabel(completedStage);
          let newTitle = task.title;
          if (task.title.includes(` - ${currentStageLabel} - `)) {
            newTitle = task.title.replace(` - ${currentStageLabel} - `, ` - ${nextStageLabel} - `);
          } else if (task.title.includes(` - ${currentStageLabel}`)) {
            newTitle = task.title.replace(` - ${currentStageLabel}`, ` - ${nextStageLabel}`);
          }

          const originId = task.origin_task_id ?? task.id;
          // PDF and Agendamento are unified (no post_type); other stages inherit from origin
          // Revisão (Planejamento): when planejamento → revisão, mark with sentinel "planejamento"
          // so the agenda/cards render REV/PLAN instead of REV/DSG or REV/VDO
          // Determine post_type for the next task:
          // - PDF/Agendamento: null (unified)
          // - Planejamento → Revisão: "planejamento" sentinel
          // - Design/Vídeo stages: always use stage-based type (not task.post_type which may be stale)
          // - Other stages: inherit task.post_type
          const resolvedPostType = (nextStage === "pdf" || nextStage === "agendamento")
            ? null
            : (completedStage === "planejamento" && nextStage === "revisao")
              ? "planejamento"
              : completedStage === "edicao_videos"
                ? "video"
                : completedStage === "design"
                  ? "design"
                  : (task.post_type ?? undefined);

          const { data: { user } } = await supabase.auth.getUser();
          const { data: newTask } = await sb.from("pm_tasks").insert({
            client_id: task.client_id,
            title: newTitle,
            description: task.description ?? null,
            stage_current: nextStage,
            due_date: nextDueDate,
            assignee_id: fixedAssignee !== undefined ? (fixedAssignee ?? null) : (task.assignee_id ?? null),
            watchers: fixedAssignee !== undefined ? fixedWatchers_ : (task.watchers ?? []),
            priority: task.priority,
            project_id: task.project_id ?? null,
            tags: task.tags ?? [],
            is_extra_demand: task.is_extra_demand,
            status_global: "backlog",
            post_type: resolvedPostType ?? null,
            origin_task_id: originId,
            created_by: user?.id,
          }).select().single();

          if (newTask) {
            cloneChildrenToNewTask(newTask.id, nextStage);
            // Copy parent-level comments to new task (background)
            void (async () => {
              const { data: parentComments } = await sb.from("pm_comments").select("*").eq("task_id", task.id);
              if (parentComments?.length) {
                await Promise.all(parentComments.map((c: any) => {
                  const { id: _id, created_at: _ca, ...rest } = c;
                  return sb.from("pm_comments").insert({ ...rest, task_id: newTask.id });
                }));
              }
            })().catch((err: any) => console.error("Error copying parent comments:", err));
          }

          queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
          queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
          queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
          queryClient.invalidateQueries({ queryKey: ["pm_activity_log"] });
        });
        return;
      }
    } catch (err) {
      console.error("Error advancing stage:", err);
      toast.error("Erro ao avançar etapa. Tente novamente.");
    }
  };

  const findExistingAgendaTaskForStage = async (nextStage: string, referenceDueDate?: string) => {
    if (nextStage === "entrega") return null;

    // Revisão (Planejamento) é sempre uma etapa isolada por pauta — nunca reaproveita
    // uma Revisão existente (que pode ser de materiais Design/Vídeo).
    if (nextStage === "revisao" && task.stage_current === "planejamento") return null;

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
      .neq("status_global", "pausado")
      .eq("is_extra_demand", false)
      .is("deleted_at", null)
      .is("parent_task_id", null)
      .not("due_date", "is", null)
      .gte("due_date", monthStart)
      .lte("due_date", monthEnd)
      .neq("id", task.id)
      .order("due_date", { ascending: true })
      .limit(1);

    // When advancing to revisão (materiais), only link with the same post_type origin (video|design).
    // Nunca casa com Revisão (Planejamento) que tem post_type='planejamento'.
    // Also filter by post_type for any stage when the task has a specific post_type,
    // to avoid cross-matching (e.g. design task finding a video revisão).
    const inferredNextStagePostType = task.stage_current === "edicao_videos"
      ? "video"
      : task.stage_current === "design"
        ? "design"
        : task.post_type ?? undefined;
    if (nextStage === "revisao" && inferredNextStagePostType && inferredNextStagePostType !== "planejamento") {
      query = query.eq("post_type", inferredNextStagePostType);
    } else if (inferredNextStagePostType && inferredNextStagePostType !== "planejamento") {
      // For non-revisão stages, still filter by post_type to avoid cross-linking
      query = query.eq("post_type", inferredNextStagePostType);
    }

    const { data: existing } = await query;


    return existing && existing.length > 0 ? existing[0] : null;
  };

  const advanceStage = async (completedStage: string, nextStage: string, newDueDate?: string) => {
    // Always check for existing agenda task regardless of date config
    const existing = await findExistingAgendaTaskForStage(nextStage, newDueDate);

    // PDF and Agendamento: auto-merge silently with notification (no dialog)
    if (existing && (nextStage === "pdf" || nextStage === "agendamento")) {
      toast.success(nextStage === "pdf" ? `Vinculado ao PDF do mês` : `Vinculado ao Agendamento do mês`);
      doAdvance(completedStage, nextStage, existing.due_date ?? newDueDate, existing.id);
      return;
    }

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
    const sbx = supabase as any;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const fixedAssignee = getFixedAssignee(stageAssignees, stage, task.client_id);
    const fixedWatchers_ = getFixedWatchers(stageAssignees, stage, task.client_id);

    const insertChildren = async (targetTaskId: string) => {
      // Preserve original creation order so the new stage shows subtasks in
      // the same sequence as Planejamento. Child tasks are queried elsewhere
      // ordered by created_at ascending — so we must:
      //  1) sort the source list by created_at, and
      //  2) insert SEQUENTIALLY (not via Promise.all) so created_at stays monotonic.
      const orderedChildren = [...children].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      });

      const inserted: Array<readonly [string, string]> = [];
      for (const child of orderedChildren) {
        const resolvedPostType = inferPmPostType(child, postType as PmPostType);
        const { data, error } = await sbx.from("pm_tasks").insert({
          client_id: child.client_id,
          title: child.title,
          description: child.description ?? null,
          stage_current: stage,
          assignee_id: fixedAssignee !== undefined ? (fixedAssignee ?? null) : (child.assignee_id ?? null),
          watchers: fixedAssignee !== undefined ? fixedWatchers_ : (child.watchers ?? []),
          parent_task_id: targetTaskId,
          tags: child.tags ?? [],
          is_extra_demand: child.is_extra_demand,
          status_global: "backlog",
          post_type: resolvedPostType ?? null,
          created_by: user.id,
        }).select("id").single();

        if (error || !data) throw error ?? new Error("Falha ao criar subtarefa");
        inserted.push([child.id, data.id] as const);
      }

      return Object.fromEntries(inserted) as Record<string, string>;
    };

    const copyAttachmentsAndCommentsInBackground = (targetTaskId: string, childIdMap: Record<string, string>) => {
      const allOldIds = [task.id, ...Object.keys(childIdMap)];
      void (async () => {
        // --- Attachments ---
        const { data: existingAtts } = await sbx.from("pm_attachments").select("*").in("task_id", allOldIds);
        if (existingAtts?.length) {
          await Promise.all(existingAtts.map((att: any) => {
            const { id: _id, created_at: _ca, task_id: oldTid, ...rest } = att;
            const newTid = oldTid === task.id ? targetTaskId : childIdMap[oldTid];
            if (!newTid) return Promise.resolve();
            return sbx.from("pm_attachments").insert({ ...rest, task_id: newTid });
          }));
        }
        // --- Comments ---
        const { data: existingComments } = await sbx.from("pm_comments").select("*").in("task_id", allOldIds);
        if (existingComments?.length) {
          await Promise.all(existingComments.map((c: any) => {
            const { id: _id, created_at: _ca, task_id: oldTid, ...rest } = c;
            const newTid = oldTid === task.id ? targetTaskId : childIdMap[oldTid];
            if (!newTid) return Promise.resolve();
            return sbx.from("pm_comments").insert({ ...rest, task_id: newTid });
          }));
        }
      })()
        .catch((err) => console.error("Error copying split attachments/comments:", err))
        .finally(() => invalidatePmTaskQueries());
    };

    if (linkedTaskId) {
      const linkedUpdates: any = { id: linkedTaskId, status_global: "backlog" as any };
      if (fixedAssignee !== undefined) {
        linkedUpdates.assignee_id = fixedAssignee;
        linkedUpdates.watchers = fixedWatchers_;
      }
      updateTask.mutate(linkedUpdates);

      const linkedChildMap = await insertChildren(linkedTaskId);
      copyAttachmentsAndCommentsInBackground(linkedTaskId, linkedChildMap);
      invalidatePmTaskQueries();
      return;
    }

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

    const newChildMap = await insertChildren(newTask.id);
    copyAttachmentsAndCommentsInBackground(newTask.id, newChildMap);
    invalidatePmTaskQueries();
  };

  const finalizePlanejamentoCompletion = async (deferred: { allIds: string[]; completedStage: string; snapshotDueDate: string }) => {
    const sb = supabase as any;

    // Optimistic cache update — mark as completed NOW (after all splits are done)
    const optimisticUpdater = (old: PmTask[] | undefined) => old?.map((item) => {
      if (item.id === task.id) {
        return { ...item, stage_current: deferred.completedStage as any, status_global: "concluido" as any, due_date: deferred.snapshotDueDate };
      }
      if (deferred.allIds.includes(item.id)) {
        return { ...item, status_global: "concluido" as any };
      }
      return item;
    });
    queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_tasks"] }, optimisticUpdater);
    queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks"] }, optimisticUpdater);
    queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks_all"] }, optimisticUpdater);

    // DB writes — mark parent + children as concluído
    void Promise.all([
      sb.from("pm_tasks").update({ stage_current: deferred.completedStage, status_global: "concluido", due_date: deferred.snapshotDueDate }).eq("id", task.id),
      ...(deferred.allIds.length > 1
        ? [sb.from("pm_tasks").update({ status_global: "concluido" }).in("id", deferred.allIds.filter((id: string) => id !== task.id))]
        : []),
    ]).catch((e: any) => console.error("Error marking planejamento as done:", e));

    // Sync scoring
    syncCompletedStage(deferred.completedStage);
    invalidatePmTaskQueries();
    toast.success("Planejamento concluído!");
  };

  const processSplitQueue = async (
    splits: { stage: string; stageLabel: string; children: PmTask[]; postType: string }[],
    snapshotDueDate: string, nextDueDate: string, clientName: string, monthLabel: string | null,
    deferredCompletion?: { allIds: string[]; completedStage: string; snapshotDueDate: string }
  ) => {
    if (splits.length === 0) {
      if (deferredCompletion) {
        await finalizePlanejamentoCompletion(deferredCompletion);
      }
      setLinkDialogOpen(false);
      setLinkExistingTask(null);
      setPendingSplit(null);
      toast.success("Próximas tarefas prontas.");
      return;
    }

    const [current, ...remaining] = splits;
    const existing = await findExistingAgendaTaskForStage(current.stage, nextDueDate);

    if (existing) {
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
        deferredCompletion,
      });
      setLinkExistingTask(existing);
      setLinkDialogOpen(true);
      return;
    }

    try {
      await executeSplitTask(current.stage, current.stageLabel, current.children, current.postType, nextDueDate, clientName, monthLabel);
    } catch (err) {
      console.error("bg split error:", err);
    }
    await processSplitQueue(remaining, snapshotDueDate, nextDueDate, clientName, monthLabel, deferredCompletion);
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

    // ═══ PERIODIC / CUSTOM STAGES (e.g. Reunião): standalone — just mark as done, no flow ═══
    if (task.periodic_stage_key) {
      const sb = supabase as any;
      const allIds = [task.id, ...childTasks.map(c => c.id)];
      await sb.from("pm_tasks")
        .update({ status_global: "concluido" })
        .in("id", allIds);
      queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
      toast.success("Tarefa concluída!");
      return;
    }

    // ═══ EXTRA DEMAND: standalone — just mark as done, no next stage ═══
    if (task.is_extra_demand) {
      const sb = supabase as any;
      const allIds = [task.id, ...childTasks.map(c => c.id)];
      await sb.from("pm_tasks")
        .update({ status_global: "concluido" })
        .in("id", allIds);
      syncCompletedStage(completedStage);
      queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
      toast.success("Demanda extra concluída!");
      return;
    }

    // ═══ MANUAL DESIGN/VÍDEO TASKS: standalone — only workflow-generated items advance to Revisão ═══
    const isStandaloneProductionTask = !task.parent_task_id
      && !task.origin_task_id
      && (completedStage === "design" || completedStage === "edicao_videos");
    if (isStandaloneProductionTask) {
      const sb = supabase as any;
      const allIds = [task.id, ...childTasks.map(c => c.id)];
      await sb.from("pm_tasks")
        .update({ status_global: "concluido" })
        .in("id", allIds);
      syncCompletedStage(completedStage);
      queryClient.invalidateQueries({ queryKey: ["pm_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
      toast.success("Tarefa concluída!");
      return;
    }

    const dateConfig = transitionDates[task.stage_current];

    // Calculate new due date
    let newDueDate: string | undefined;

    if (typeof dateConfig === "number") {
      const baseDate = task.due_date ? new Date(task.due_date + "T12:00:00") : new Date();
      newDueDate = format(addDays(baseDate, dateConfig), "yyyy-MM-dd");
    }

    // Revisão (Planejamento) aprovada → só agora distribui em Vídeo + Design.
    // Revisões de materiais (post_type design/video) seguem o fluxo normal para PDF.
    if (completedStage === "revisao" && isPlanejamentoReview) {
      const alreadySplit = childTasks.some(
        (c) => c.stage_current === "design" || c.stage_current === "edicao_videos"
      );
      if (!alreadySplit) {
        // Use inferPmPostType to catch children without explicit post_type
        const { inferPmPostType } = await import("../utils/infer-pm-post-type");
        const videoChildren: PmTask[] = [];
        const designChildren: PmTask[] = [];
        for (const c of childTasks) {
          const inferred = inferPmPostType(c);
          if (inferred === "video") videoChildren.push(c);
          else if (inferred === "design") designChildren.push(c);
        }
        const hasVideo = videoChildren.length > 0;
        const hasDesign = designChildren.length > 0;

        console.log("[handleConcluido] revisao→split check:", {
          childCount: childTasks.length,
          videoCount: videoChildren.length,
          designCount: designChildren.length,
        });

        if (hasVideo || hasDesign) {
          const snapshotDueDate = task.due_date ?? format(new Date(), "yyyy-MM-dd");
          const allIds = [task.id, ...childTasks.map(c => c.id)];

          const clientName = clientsMap[task.client_id] || task.title.split(" - ")[0];
          let monthLabel: string | null = null;
          if (task.due_date) {
            const raw = format(parseISO(task.due_date), "MMMM", { locale: ptBR });
            monthLabel = raw.charAt(0).toUpperCase() + raw.slice(1);
          }
          const nextDueDate = newDueDate ?? format(addDays(new Date(snapshotDueDate + "T12:00:00"), 1), "yyyy-MM-dd");

          const splits: { stage: string; stageLabel: string; children: PmTask[]; postType: string }[] = [];
          if (hasVideo) splits.push({ stage: "edicao_videos", stageLabel: "Vídeo", children: videoChildren, postType: "video" });
          if (hasDesign) splits.push({ stage: "design", stageLabel: "Design", children: designChildren, postType: "design" });

          const deferredCompletion = { allIds, completedStage, snapshotDueDate };

          try {
            await processSplitQueue(splits, snapshotDueDate, nextDueDate, clientName, monthLabel, deferredCompletion);
          } catch (err) {
            console.error("Error processing revisao splits:", err);
            invalidatePmTaskQueries();
            toast.error("Erro ao criar próximas tarefas. Tente novamente.");
          }
          return;
        }
      }
      // Se já houve split (segunda revisão), cai no fluxo normal: revisao → pdf
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

    // Detect if children have mixed post_types (both video and design)
    const childPostTypes = new Set(
      childTasks.map((c) => c.post_type).filter(Boolean) as string[],
    );
    const hasMixedChildren = childPostTypes.has("video") && childPostTypes.has("design");

    // Use children as the DEFINITIVE signal for post_type when available
    // (the parent task.post_type may be corrupted from legacy bugs)
    const childDerivedPostType: string | null = hasMixedChildren
      ? null
      : childPostTypes.has("design")
        ? "design"
        : childPostTypes.has("video")
          ? "video"
          : null;

    const taskTags = task.tags ?? [];
    const normalizedTitle = task.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const isPautaReview = task.post_type === "planejamento" || (
      task.post_type == null && task.stage_current === "revisao" && !childTasks.some(c => c.post_type === "video" || c.post_type === "design")
    );
    // Prefer child-derived type over inferPmPostType (which may use corrupted task.post_type)
    const effectivePostType = childDerivedPostType ?? inferPmPostType(task);
    const isVideoByPostType = effectivePostType === "video";
    const isVideoByTag = taskTags.some((t) => {
      const parsed = parseTag(t);
      const tagName = parsed.name.toLowerCase();
      return tagName === "vídeo" || tagName === "video";
    });
    const isVideoByTitle = normalizedTitle.includes("video");
    const previousWorkStage = isPautaReview
      ? "planejamento"
      : isVideoByPostType || isVideoByTag || isVideoByTitle
        ? "edicao_videos"
        : "design";
    const resolvedAlteracaoPostType = hasMixedChildren
      ? null
      : isPautaReview
        ? "planejamento"
        : (childDerivedPostType ?? effectivePostType ?? (previousWorkStage === "edicao_videos" ? "video" : "design"));

    // Helper to get assignee/watchers per post_type
    const getAssigneeForPostType = (pt: string | null) => {
      const stage = pt === "video" ? "edicao_videos" : "design";
      return getFixedAssignee(stageAssignees, stage, task.client_id);
    };
    const getWatchersForPostType = (pt: string | null) => {
      const stage = pt === "video" ? "edicao_videos" : "design";
      return getFixedWatchers(stageAssignees, stage, task.client_id);
    };

    const previousStageAssignee = getFixedAssignee(stageAssignees, previousWorkStage, task.client_id);
    const previousStageWatchers = getFixedWatchers(stageAssignees, previousWorkStage, task.client_id);

    // For mixed children, skip snapshot-based routing — just move to alteração with per-child assignees
    if (hasMixedChildren) {
      const updates: any = {
        id: task.id,
        stage_current: "alteracoes" as any,
        assignee_id: previousStageAssignee ?? null,
        watchers: previousStageWatchers,
        // Planejamento has mixed Design/Vídeo children, but the parent must stay PLAN
        // so returning from Alteração reopens REV/PLAN instead of falling back to REV/DSG.
        post_type: isPautaReview ? "planejamento" : null,
      };
      updateTask.mutate(updates);

      for (const child of childTasks) {
        const childPt = child.post_type ?? "design";
        updateTask.mutate({
          id: child.id,
          stage_current: "alteracoes" as any,
          assignee_id: getAssigneeForPostType(childPt) ?? previousStageAssignee ?? null,
          watchers: getWatchersForPostType(childPt) ?? previousStageWatchers,
          post_type: childPt,
        } as any);
      }

      await sb
        .from("pm_subtasks")
        .update({ status: "nao_iniciado" })
        .eq("task_id", task.id);

      toast.success("Tarefa enviada para Alteração (Design + Vídeo)");
      return;
    }

    let previousSnapshot: any = null;

    // Filter snapshots strictly by post_type to avoid cross-contamination between
    // design and video branches that share the same origin_task_id.
    let snapshotQuery = sb
      .from("pm_tasks")
      .select("id, assignee_id, watchers, stage_current, post_type, tags")
      .or(`id.eq.${originId},origin_task_id.eq.${originId}`)
      .eq("stage_current", previousWorkStage)
      .eq("status_global", "concluido")
      .is("parent_task_id", null)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(5);

    // Add strict post_type filter so we never pick a snapshot from the other branch
    if (resolvedAlteracaoPostType && resolvedAlteracaoPostType !== "planejamento") {
      snapshotQuery = snapshotQuery.eq("post_type", resolvedAlteracaoPostType);
    }

    const { data: snapshots } = await snapshotQuery;

    if (snapshots?.length) {
      previousSnapshot = snapshots[0];
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

    // Detect original stage: use children post_type as definitive signal, then tags/title as fallback
    const childPostTypes = new Set(childTasks.map((c) => c.post_type).filter(Boolean) as string[]);
    const hasMixedPlanningChildren = childPostTypes.has("video") && childPostTypes.has("design");
    const isPautaReview = task.post_type === "planejamento" || (task.stage_current === "alteracoes" && hasMixedPlanningChildren);
    // Prefer child-derived type (most reliable for corrupted parent post_type)
    const childDerivedPt = hasMixedPlanningChildren
      ? null
      : childPostTypes.has("design") ? "design"
      : childPostTypes.has("video") ? "video"
      : null;
    const effectivePt = childDerivedPt ?? inferPmPostType(task);
    const isVideoByPostType = effectivePt === "video";
    const taskTags = task.tags ?? [];
    const isVideoByTag = taskTags.some(t => {
      const parsed = parseTag(t);
      return parsed.name.toLowerCase() === "vídeo" || parsed.name.toLowerCase() === "video";
    });
    const normalizedTitle = task.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const isVideoByTitle = normalizedTitle.includes("video");
    const isVideoTask = childDerivedPt === "video" || (!childDerivedPt && (isVideoByPostType || isVideoByTag || isVideoByTitle));
    const originalStage = isPautaReview ? "planejamento" : isVideoTask ? "edicao_videos" : "design";
    const resolvedReturnPostType = isPautaReview ? "planejamento" : isVideoTask ? "video" : "design";

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

    revisaoQuery = revisaoQuery.eq("post_type", resolvedReturnPostType);

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

      // Reactivate the revisão task — use revisao_pauta key for planejamento returns
      const revisaoAssigneeKey = isPautaReview ? "revisao_pauta" : "revisao";
      const fixedAssignee = getFixedAssignee(stageAssignees, revisaoAssigneeKey, task.client_id);
      const fixedWatchers = getFixedWatchers(stageAssignees, revisaoAssigneeKey, task.client_id);
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
      const fallbackAssigneeKey = isPautaReview ? "revisao_pauta" : "revisao";
      const fixedAssignee = getFixedAssignee(stageAssignees, fallbackAssigneeKey, task.client_id);
      const fixedWatchers = getFixedWatchers(stageAssignees, fallbackAssigneeKey, task.client_id);

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

  // Propagate assignee change to subtasks dialog state
  const [pendingPropagateAssignee, setPendingPropagateAssignee] = useState<{
    newAssigneeId: string | null;
    differingSubtaskIds: string[];
  } | null>(null);

  const propagateAssigneeToSubtasks = async (newAssigneeId: string | null, subtaskIds: string[]) => {
    if (subtaskIds.length === 0) return;
    const sb = supabase as any;
    await sb.from("pm_tasks").update({ assignee_id: newAssigneeId, updated_at: new Date().toISOString() }).in("id", subtaskIds);
    queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] });
    queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
  };

  const maybeAskPropagation = (newAssigneeId: string | null) => {
    if (task.parent_task_id) return; // Only for parent tasks
    const subs = (childTasks ?? []).filter(c => !(c as any).deleted_at);
    if (subs.length === 0) return;
    // Find subtasks whose assignee differs from the NEW parent assignee
    const differing = subs.filter(s => (s.assignee_id ?? null) !== newAssigneeId);
    if (differing.length === 0) return;
    setPendingPropagateAssignee({ newAssigneeId, differingSubtaskIds: differing.map(s => s.id) });
  };

  const toggleAssignee = (memberId: string) => {
    const currentWatchers = task.watchers ?? [];
    const hasHiddenPrimaryAssignee = !!task.assignee_id && !membersMap[task.assignee_id];
    let newAssigneeId: string | null | undefined;
    if (hasHiddenPrimaryAssignee) {
      newAssigneeId = memberId;
      updateTask.mutate({ id: task.id, assignee_id: memberId, watchers: currentWatchers.filter(w => w !== memberId) } as any);
    } else if (task.assignee_id === memberId) {
      const remaining = currentWatchers.filter(w => w !== memberId);
      newAssigneeId = remaining[0] ?? null;
      updateTask.mutate({ id: task.id, assignee_id: newAssigneeId, watchers: remaining.slice(1) } as any);
    } else if (currentWatchers.includes(memberId)) {
      updateTask.mutate({ id: task.id, watchers: currentWatchers.filter(w => w !== memberId) } as any);
      return; // watcher toggle, no main assignee change
    } else if (!task.assignee_id) {
      newAssigneeId = memberId;
      updateTask.mutate({ id: task.id, assignee_id: memberId } as any);
    } else {
      updateTask.mutate({ id: task.id, watchers: [...currentWatchers, memberId] } as any);
      return; // watcher add, no main assignee change
    }
    if (newAssigneeId !== undefined) {
      maybeAskPropagation(newAssigneeId);
    }
  };

  const recalcTagPoints = async (taskId: string) => {
    try {
      await supabase.rpc("pm_recalc_tag_points", { _pm_task_id: taskId } as any);
    } catch (e) {
      console.error("Error recalculating tag points:", e);
    }
  };

  const handleTagCorrectionResync = async (oldTags: string[], newTags: string[]) => {
    if (!correctionMode || !isCompletedSnapshot) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // Log the correction
    await (supabase as any).from("pm_activity_log").insert({
      entity_type: "task",
      entity_id: task.id,
      action: "correction_tags",
      metadata: { old_tags: oldTags, new_tags: newTags, changed_by: user.id },
      created_by: user.id,
    });
    // Resync scoring for the current stage
    try {
      await supabase.rpc("pm_resync_correction" as any, {
        _pm_task_id: task.id,
        _completed_stage: task.stage_current,
      });
      toast.success("Pontuação recalculada após correção de etiquetas");
    } catch (e) {
      console.error("Error resyncing after tag correction:", e);
    }
  };

  const removeTag = (tag: string) => {
    const oldTags = task.tags ?? [];
    const newTags = oldTags.filter(t => t !== tag);
    updateTask.mutate({ id: task.id, tags: newTags } as any, {
      onSuccess: async () => {
        await recalcTagPoints(task.id);
        await handleTagCorrectionResync(oldTags, newTags);
      },
    });
  };
  const toggleGlobalTag = (tag: string) => {
    const existing = task.tags ?? [];
    if (existing.includes(tag)) {
      removeTag(tag);
    } else {
      const newTags = [...existing, tag];
      updateTask.mutate({ id: task.id, tags: newTags } as any, {
        onSuccess: async () => {
          await recalcTagPoints(task.id);
          await handleTagCorrectionResync(existing, newTags);
        },
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
        ) : (
          <EditableTitleWithSpellCheck
            value={task.title}
            onSave={(newTitle) => updateTask.mutate({ id: task.id, title: newTitle })}
            className="text-xl sm:text-2xl font-bold text-foreground cursor-text"
          />
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
              <button type="button" className="flex min-w-24 items-center gap-1.5 cursor-pointer hover:opacity-80 transition min-h-[28px] flex-wrap">
                {visibleAssigneeIds.length > 0 ? visibleAssigneeIds.map(id => {
                  const m = membersMap[id];
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
                  {task.periodic_stage_key
                    ? (task.title.replace(/\s*\b\d{1,2}:\d{2}\b\s*$/, "").trim() || clientsMap[task.client_id] || "—")
                    : (clientsMap[task.client_id] ?? "—")}
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
                  {currentPeriodic ? (
                    (() => {
                      const c = currentPeriodic.color_key;
                      const swatch = c && !isHexColor(c) ? TAG_COLORS.find(t => t.key === c) : null;
                      return (
                        <span
                          className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", swatch ? `${swatch.bg} ${swatch.text}` : "bg-primary/10 text-primary")}
                          style={c && isHexColor(c) ? { backgroundColor: `${c}26`, color: c } : undefined}
                        >
                          {currentPeriodic.label}
                        </span>
                      );
                    })()
                  ) : (
                    <>
                      <StageCircleInline stageKey={task.stage_current} />
                      <span className="text-xs font-medium">{stageLabel(task.stage_current)}</span>
                    </>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1 z-[150] max-h-72 overflow-y-auto" align="start">
                {PM_ACTIVE_STAGES.map(s => {
                  const color = getStageCircleColor(s.key);
                  const isDoneS = s.key === "entrega";
                  const isSelected = !task.periodic_stage_key && task.stage_current === s.key;
                  return (
                    <button
                      key={s.key}
                      className={cn("flex items-center gap-3 w-full px-3 py-2 rounded text-sm hover:bg-accent transition", isSelected && "bg-accent")}
                      onClick={() => {
                        updateTask.mutate({ id: task.id, stage_current: s.key as any, periodic_stage_key: null as any });
                        // Propagate stage change to children
                        for (const child of childTasks) {
                          updateTask.mutate({ id: child.id, stage_current: s.key as any });
                        }
                      }}
                    >
                      <span className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0", color.border, isDoneS && `${color.bg}`)}>
                        {isDoneS && <Check className="h-3 w-3 text-white" />}
                      </span>
                      <span className="font-medium">{s.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                    </button>
                  );
                })}
                {periodicStages.length > 0 && (
                  <>
                    <div className="my-1 border-t border-border" />
                    <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">Periódicas</div>
                    {periodicStages.map(p => {
                      const isSelected = task.periodic_stage_key === p.key;
                      const c = p.color_key;
                      const swatch = c && !isHexColor(c) ? TAG_COLORS.find(t => t.key === c) : null;
                      return (
                        <button
                          key={p.key}
                          className={cn("flex items-center gap-3 w-full px-3 py-2 rounded text-sm hover:bg-accent transition", isSelected && "bg-accent")}
                          onClick={() => updateTask.mutate({ id: task.id, periodic_stage_key: p.key as any, stage_current: "entrega" as any, status_global: "concluido" as any })}
                        >
                          <span
                            className={cn("h-5 w-5 rounded-full flex items-center justify-center shrink-0", swatch ? swatch.bg : "bg-primary/20")}
                            style={c && isHexColor(c) ? { backgroundColor: `${c}40` } : undefined}
                          />
                          <span className="font-medium">{p.label}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
                        </button>
                      );
                    })}
                  </>
                )}
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
                  const pt = inferPmPostType(task) ?? task.post_type;
                  const altStage = pt === "video" ? "edicao_videos" : pt === "design" ? "design" : "planejamento";
                  const altAssignee = getFixedAssignee(stageAssignees, altStage, task.client_id);
                  const altWatchers = getFixedWatchers(stageAssignees, altStage, task.client_id);
                  updateTask.mutate({
                    id: task.id,
                    stage_current: "alteracoes",
                    status_global: "backlog",
                    post_type: pt ?? task.post_type,
                    ...(altAssignee ? { assignee_id: altAssignee } : {}),
                    ...(altWatchers?.length ? { watchers: altWatchers } : {}),
                  } as any);
                  toast.success(`Enviado para ${pt === "video" ? "ALT/VDO" : pt === "design" ? "ALT/DSG" : pt === "planejamento" ? "ALT/PLAN" : "Alteração"}`);
                }}>
                  <RotateCcw className="h-3.5 w-3.5" /> Enviar para Alteração
                </Button>
              </>
            ) : task.stage_current === "alteracoes" ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold">
                  <RotateCcw className="h-3.5 w-3.5" /> {resolvedTaskPostType === "video" ? "ALT/VDO" : resolvedTaskPostType === "design" ? "ALT/DSG" : resolvedTaskPostType === "planejamento" ? "ALT/PLAN" : "Em Alteração"}
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
                  const pt = inferPmPostType(task) ?? task.post_type;
                  const altStage = pt === "video" ? "edicao_videos" : pt === "design" ? "design" : "planejamento";
                  const altAssignee = getFixedAssignee(stageAssignees, altStage, task.client_id);
                  const altWatchers = getFixedWatchers(stageAssignees, altStage, task.client_id);
                  updateTask.mutate({
                    id: task.id,
                    stage_current: "alteracoes",
                    status_global: "backlog",
                    post_type: pt ?? task.post_type,
                    ...(altAssignee ? { assignee_id: altAssignee } : {}),
                    ...(altWatchers?.length ? { watchers: altWatchers } : {}),
                  } as any);
                  toast.success(`Enviado para ${pt === "video" ? "ALT/VDO" : pt === "design" ? "ALT/DSG" : pt === "planejamento" ? "ALT/PLAN" : "Alteração"}`);
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
              <RotateCcw className="h-3.5 w-3.5" /> {resolvedTaskPostType === "video" ? "ALT/VDO" : resolvedTaskPostType === "design" ? "ALT/DSG" : resolvedTaskPostType === "planejamento" ? "ALT/PLAN" : "Em Alteração"}
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

              
            </>
          ) : (
            <Button
              size="sm"
              className="group/done gap-1.5 min-w-[130px] bg-success text-success-foreground hover:bg-destructive/90 transition-colors duration-200"
              onClick={async () => {
                const sbx = supabase as any;
                const allIds = [task.id, ...childTasks.map(c => c.id)];

                // Cancel in-flight queries to prevent stale overwrites
                await queryClient.cancelQueries({ queryKey: ["pm_tasks"] });
                await queryClient.cancelQueries({ queryKey: ["pm_child_tasks"] });
                await queryClient.cancelQueries({ queryKey: ["pm_child_tasks_all"] });

                if (isCompletedSnapshot) {
                  // Optimistic: instantly mark as backlog in cache
                  const markBacklog = (old: PmTask[] | undefined) =>
                    old?.map(t => allIds.includes(t.id) ? { ...t, status_global: "backlog" as any } : t);
                  queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_tasks"] }, markBacklog);
                  queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks"] }, markBacklog);
                  queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks_all"] }, markBacklog);
                  toast.success("Tarefa desconcluída");
                  // DB in background
                  sbx.from("pm_tasks").update({ status_global: "backlog" }).in("id", allIds)
                    .then(() => { queryClient.invalidateQueries({ queryKey: ["pm_tasks"] }); queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] }); queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] }); });
                } else {
                  const flowStages = Object.keys(flowConfig).length > 0
                    ? Object.entries(flowConfig)
                        .filter(([, v]: [string, any]) => v.enabled)
                        .sort(([, a]: [string, any], [, b]: [string, any]) => (a.order ?? 0) - (b.order ?? 0))
                        .map(([k]) => k)
                    : PM_ACTIVE_STAGES.map(s => s.key);
                  const entregaIdx = flowStages.indexOf("entrega");
                  const prevStage = entregaIdx > 0 ? flowStages[entregaIdx - 1] : "agendamento";
                  // Optimistic: instantly revert in cache
                  const revert = (old: PmTask[] | undefined) =>
                    old?.map(t => allIds.includes(t.id) ? { ...t, stage_current: prevStage as any, status_global: "backlog" as any } : t);
                  queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_tasks"] }, revert);
                  queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks"] }, revert);
                  queryClient.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks_all"] }, revert);
                  toast.success("Tarefa desconcluída");
                  // DB in background
                  sbx.from("pm_tasks").update({ stage_current: prevStage, status_global: "backlog" }).in("id", allIds)
                    .then(() => { queryClient.invalidateQueries({ queryKey: ["pm_tasks"] }); queryClient.invalidateQueries({ queryKey: ["pm_child_tasks"] }); queryClient.invalidateQueries({ queryKey: ["pm_child_tasks_all"] }); });
                }
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

        {/* Link or Date dialog for existing agenda tasks — rendered outside conditional to survive task status changes */}
        <LinkOrDateDialog
          open={linkDialogOpen}
          onClose={() => { setLinkDialogOpen(false); setLinkExistingTask(null); setPendingAdvance(null); setPendingSplit(null); }}
          existingTask={linkExistingTask}
          onLink={async (dueDate) => {
            if (pendingSplit) {
              const s = pendingSplit;
              void executeSplitTask(s.stage, s.stageLabel, s.children, s.postType, dueDate, s.clientName, s.monthLabel, linkExistingTask?.id)
                .catch((err) => console.error("bg split error:", err));
              await processSplitQueue(s.remainingSplits, s.snapshotDueDate, s.nextDueDate, s.clientName, s.monthLabel, s.deferredCompletion);
            } else if (pendingAdvance) {
              doAdvance(pendingAdvance.completedStage, pendingAdvance.nextStage, dueDate, linkExistingTask?.id);
              setLinkDialogOpen(false); setLinkExistingTask(null); setPendingAdvance(null);
            }
          }}
          onSelectDate={async (dueDate) => {
            if (pendingSplit) {
              const s = pendingSplit;
              void executeSplitTask(s.stage, s.stageLabel, s.children, s.postType, dueDate, s.clientName, s.monthLabel)
                .catch((err) => console.error("bg split error:", err));
              await processSplitQueue(s.remainingSplits, s.snapshotDueDate, s.nextDueDate, s.clientName, s.monthLabel, s.deferredCompletion);
            } else if (pendingAdvance) {
              doAdvance(pendingAdvance.completedStage, pendingAdvance.nextStage, dueDate);
              setLinkDialogOpen(false); setLinkExistingTask(null); setPendingAdvance(null);
            }
          }}
        />
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


        {/* Subtasks — use planning layout for parent tasks at planejamento, pdf, agendamento, entrega,
            revisao, or alteracoes (including single post_type like REV/DSG, REV/VDO, ALT/DSG, ALT/VDO).
            Periodic tasks (custom_*) are simple standalone tasks → always use the regular subtask list. */}
        <div className="border-t border-border/20 pt-4">
          {(() => {
            // ALT/DSG, ALT/VDO, REV/DSG, REV/VDO — single post_type, filter subtasks
            const isSinglePostType = (task.post_type === "video" || task.post_type === "design") &&
              (task.stage_current === "alteracoes" || task.stage_current === "revisao");
            const filteredChildren = isSinglePostType
              ? childTasks.filter(c => c.post_type === task.post_type)
              : childTasks;
            const usePlanningLayout = !task.parent_task_id && !task.periodic_stage_key && (
              ["planejamento", "pdf", "agendamento", "entrega", "revisao", "alteracoes"].includes(task.stage_current) ||
              isPlanejamentoReview
            );
            if (usePlanningLayout) {
              const sectionTitle = isSinglePostType
                ? (task.stage_current === "revisao"
                  ? (task.post_type === "video" ? "Revisão (Vídeo)" : "Revisão (Design)")
                  : (task.post_type === "video" ? "Alterações (Vídeo)" : "Alterações (Design)"))
                : isPlanejamentoReview ? "Revisão (Planejamento)" : stageLabel(task.stage_current);
              return (
                <PmPlanningSubtasks
                  parentTask={task}
                  childTasks={filteredChildren}
                  membersMap={membersMap}
                  members={members}
                  onSelectSubtask={onSelectSubtask}
                  activeSubtaskId={activeSubtaskId}
                  sectionTitle={sectionTitle}
                  reviewMode={
                    (task.stage_current === "revisao") ? "revisao" :
                    (task.stage_current === "alteracoes") ? "alteracao" :
                    null
                  }
                  readOnly={isCompletedSnapshot && !correctionMode}
                />
              );
            }
            return (
              <PmSubtaskList parentTask={task} childTasks={filteredChildren} membersMap={membersMap} members={members} onSelectSubtask={onSelectSubtask} activeSubtaskId={activeSubtaskId} readOnly={isCompletedSnapshot && !correctionMode} correctionMode={correctionMode && isCompletedSnapshot} />
            );
          })()}
        </div>

        {/* Attachments — hidden for planning parent tasks */}
        {!(!task.periodic_stage_key && (task.stage_current === "planejamento" || task.stage_current === "revisao") && !task.parent_task_id && !childTasks.some(c => c.stage_current === "design" || c.stage_current === "edicao_videos")) && (
          <div className={cn("border-t border-border/20 pt-4", isCompletedSnapshot && !correctionMode && "pointer-events-none opacity-60")}>
            <PmAttachmentsSection taskId={task.id} attachments={attachments} membersMap={membersMap} onSetCover={handleSetCover} currentCoverUrl={task.cover_url} />
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

      {/* Propagate parent assignee change to subtasks */}
      <AlertDialog open={!!pendingPropagateAssignee} onOpenChange={(open) => !open && setPendingPropagateAssignee(null)}>
        <AlertDialogContent className="z-[200]">
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar responsável às subtarefas?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingPropagateAssignee && (
                <>
                  Existem <strong>{pendingPropagateAssignee.differingSubtaskIds.length}</strong> subtarefa(s) com um responsável diferente.
                  Deseja aplicar o novo responsável da tarefa principal a todas elas?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingPropagateAssignee(null)}>Manter diferentes</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingPropagateAssignee) return;
                await propagateAssigneeToSubtasks(pendingPropagateAssignee.newAssigneeId, pendingPropagateAssignee.differingSubtaskIds);
                setPendingPropagateAssignee(null);
                toast.success("Responsável aplicado às subtarefas");
              }}
            >
              Sim, aplicar a todas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
