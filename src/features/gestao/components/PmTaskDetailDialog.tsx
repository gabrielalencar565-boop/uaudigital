import { useState, useMemo } from "react";
import {
  Calendar, UserCircle, Flag, X, ChevronRight, ArrowLeft,
  Layers, Tag, MessageSquare, Plus, Check, CheckCircle2, RotateCcw, Paperclip, ListTodo, FileText, CalendarDays
} from "lucide-react";
import { addDays, format } from "date-fns";
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
  TAG_COLORS, parseTag, tagColor, tagDisplay
} from "../pm-constants";
import {
  useUpdatePmTask, useCreatePmTask, usePmTasks, usePmChildTasks,
  usePmComments, usePmAttachments, usePmSyncStageCompletion,
} from "../hooks/use-pm-data";
import { usePmTags, useCreatePmTag, useDeletePmTag } from "../hooks/use-pm-tags";
import { useDefaultFlowWithDates, getNextStages, getFixedAssignee } from "./PmStageFlowConfig";
import { PmSubtaskList } from "./PmSubtaskList";
import { PmCommentsSection } from "./PmCommentsSection";
import { PmAttachmentsSection } from "./PmAttachmentsSection";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import { PmCronogramaTab } from "./PmCronogramaTab";
import { PmPostingFields } from "./PmPostingFields";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";
import { SmartCaptionEditor } from "./SmartCaptionEditor";

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
      <DialogContent hideClose className="max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border-border/30 shadow-2xl">

        {/* Breadcrumb bar */}
        <div className="flex items-center gap-1.5 border-b border-border/20 px-5 py-2.5 bg-card/60 backdrop-blur-sm shrink-0">
          <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0 rounded-lg", sidebarOpen && "bg-primary/10 text-primary")} onClick={() => setSidebarOpen(!sidebarOpen)} title="Sidebar de subtarefas">
            <Layers className="h-4 w-4" />
          </Button>
          {isSubtaskView && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleBackToParent}><ArrowLeft className="h-3.5 w-3.5" /></Button>
          )}
          <span className="text-xs text-muted-foreground truncate">{clientsMap[resolvedRootTask.client_id] ?? "—"}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
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
          {/* LEFT: Subtask Sidebar */}
          {sidebarOpen && (
            <div className="w-64 shrink-0 flex flex-col bg-card/30 border-r border-border/30 animate-in slide-in-from-left-5 duration-200">
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
            <TaskContentView task={currentTask} childTasks={childTasks} attachments={attachments} membersMap={membersMap} members={members} isAdmin={isAdmin} onSelectSubtask={handleSelectSubtask} activeSubtaskId={null} onClose={handleClose} clientsMap={clientsMap} allTags={allTags} parentStageCurrent={isSubtaskView ? resolvedRootTask.stage_current : undefined} globalTags={globalTagsQ.data ?? []} />
          </div>

          {/* RIGHT: Comments sidebar */}
          <div className="w-80 shrink-0 flex-col bg-card/10 border-l border-border/30 hidden sm:flex">
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

function TaskContentView({ task, childTasks, attachments, membersMap, members, isAdmin, onSelectSubtask, activeSubtaskId, onClose, clientsMap, allTags, parentStageCurrent, globalTags }: {
  task: PmTask; childTasks: PmTask[]; attachments: any[];
  membersMap: Record<string, { name: string; avatar?: string }>; members: { id: string; name: string }[];
  isAdmin: boolean; onSelectSubtask: (sub: PmTask) => void; activeSubtaskId: string | null;
  onClose: () => void; clientsMap: Record<string, string>; allTags: string[];
  parentStageCurrent?: string;
  globalTags: { id: string; name: string; color_key: string; created_by: string; created_at: string }[];
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
  const [newTagColor, setNewTagColor] = useState("blue");
  const [stageChoiceOpen, setStageChoiceOpen] = useState(false);
  const [stageChoiceOptions, setStageChoiceOptions] = useState<string[]>([]);
  const [alteracaoChoiceOpen, setAlteracaoChoiceOpen] = useState(false);

  // Date on completion state
  const [completionDateOpen, setCompletionDateOpen] = useState(false);
  const [completionDate, setCompletionDate] = useState("");
  const [pendingCompletedStage, setPendingCompletedStage] = useState("");
  const [pendingDueDate, setPendingDueDate] = useState<string | undefined>();

  // Possible next stages from flow
  const nextStages = getNextStages(flowConfig, task.stage_current);
  const isDone = task.stage_current === "entrega";

  const alteracaoTargets = ["design", "edicao_videos"].filter(s => s !== task.stage_current);

  const syncCompletedStage = async (completedStage: string) => {
    if (task.parent_task_id) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      syncStage.mutate({ pmTaskId: task.id, completedStage, userId: user.id });
    } catch (_) { /* ignore */ }
  };

  const advanceStage = async (completedStage: string, nextStage: string, newDueDate?: string) => {
    // Save a "completed snapshot" so the agenda keeps showing the old stage as done
    const snapshotDueDate = task.due_date ?? format(new Date(), "yyyy-MM-dd");
    createTask.mutate({
      client_id: task.client_id,
      title: task.title,
      description: task.description ?? undefined,
      priority: task.priority,
      stage_current: completedStage,
      due_date: snapshotDueDate,
      assignee_id: task.assignee_id ?? undefined,
      project_id: task.project_id ?? undefined,
      tags: task.tags ?? [],
      parent_task_id: task.parent_task_id ?? undefined,
      is_extra_demand: task.is_extra_demand,
      status_global: "concluido",
    });

    // Advance the actual task to the next stage
    const updates: any = { id: task.id, stage_current: nextStage as any };
    if (newDueDate) updates.due_date = newDueDate;

    const fixedAssignee = getFixedAssignee(stageAssignees, nextStage, task.client_id);
    if (fixedAssignee !== undefined) {
      updates.assignee_id = fixedAssignee;
      updates.watchers = [];
    }

    updateTask.mutate(updates);
    syncCompletedStage(completedStage);
    toast.success(nextStage === "entrega" ? "Tarefa marcada como Entregue!" : `Avançou para ${stageLabel(nextStage)}`);
  };

  // Revert: go back to previous stage (undo concluído advance)
  const handleRevert = () => {
    if (!task.stage_current || task.stage_current === "captacao") return;
    // Find the stage that points to the current stage
    const prevStage = Object.entries(flowConfig).find(([_, targets]) => 
      (targets as string[]).includes(task.stage_current)
    )?.[0];
    if (!prevStage) {
      toast.error("Não foi possível reverter");
      return;
    }
    updateTask.mutate({ id: task.id, stage_current: prevStage as any });
    toast.success(`Revertido para ${stageLabel(prevStage)}`);
  };

  const handleConcluido = () => {
    if (isDone) return;
    const completedStage = task.stage_current;
    const dateConfig = transitionDates[task.stage_current];

    // Calculate new due date
    let newDueDate: string | undefined;

    if (typeof dateConfig === "number") {
      // Auto-apply +N days silently
      const baseDate = task.due_date ? new Date(task.due_date + "T12:00:00") : new Date();
      newDueDate = format(addDays(baseDate, dateConfig), "yyyy-MM-dd");
    }

    if (dateConfig === "pick") {
      // Show date picker dialog
      setPendingCompletedStage(completedStage);
      setCompletionDate(task.due_date ?? format(new Date(), "yyyy-MM-dd"));
      setCompletionDateOpen(true);
      return;
    }

    // No "pick" — advance directly (with auto-calculated date if any)
    if (nextStages.length === 0) {
      advanceStage(completedStage, "entrega", newDueDate);
    } else if (nextStages.length === 1) {
      advanceStage(completedStage, nextStages[0], newDueDate);
    } else {
      setPendingCompletedStage(completedStage);
      setPendingDueDate(newDueDate);
      setStageChoiceOptions(nextStages);
      setStageChoiceOpen(true);
    }
  };

  const handleConfirmCompletionDate = () => {
    const completedStage = pendingCompletedStage;
    const newDueDate = completionDate || undefined;

    if (nextStages.length === 0) {
      advanceStage(completedStage, "entrega", newDueDate);
    } else if (nextStages.length === 1) {
      advanceStage(completedStage, nextStages[0], newDueDate);
    } else {
      setPendingDueDate(newDueDate);
      setStageChoiceOptions(nextStages);
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

  const handleAlteracao = () => {
    if (alteracaoTargets.length === 1) {
      updateTask.mutate({ id: task.id, stage_current: alteracaoTargets[0] as any });
      toast.success(`Retornou para ${stageLabel(alteracaoTargets[0])}`);
    } else {
      setAlteracaoChoiceOpen(true);
    }
  };

  const handleChooseAlteracao = (stageKey: string) => {
    updateTask.mutate({ id: task.id, stage_current: stageKey as any });
    toast.success(`Retornou para ${stageLabel(stageKey)}`);
    setAlteracaoChoiceOpen(false);
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

  const createGlobalTag = useCreatePmTag();
  const deleteGlobalTag = useDeletePmTag();

  const addTag = async () => {
    if (!newTagName.trim()) return;
    const tagValue = `${newTagName.trim()}:${newTagColor}`;
    const existing = task.tags ?? [];
    if (!existing.some(t => parseTag(t).name === newTagName.trim())) {
      // Create global tag if it doesn't exist
      const alreadyGlobal = globalTags.some(gt => gt.name.toLowerCase() === newTagName.trim().toLowerCase());
      if (!alreadyGlobal) {
        await createGlobalTag.mutateAsync({ name: newTagName.trim(), color_key: newTagColor });
      }
      updateTask.mutate({ id: task.id, tags: [...existing, tagValue] } as any);
    }
    setNewTagName("");
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
  const handleDeleteGlobalTag = (globalTag: { id: string; name: string; color_key: string }) => {
    const tagValue = `${globalTag.name}:${globalTag.color_key}`;
    deleteGlobalTag.mutate({ tagId: globalTag.id, tagValue });
  };

  return (
    <div className="space-y-0">
      {task.cover_url && (
        <div className="relative w-full h-40 overflow-hidden bg-muted">
          <img src={task.cover_url} alt="Capa" className="w-full h-full object-cover" />
          <Button size="sm" variant="secondary" className="absolute top-2 right-2 h-6 text-[10px] opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity" onClick={handleRemoveCover}>Remover capa</Button>
        </div>
      )}

      <div className="px-6 py-5 space-y-6">
        {/* Title */}
        {editingTitle ? (
          <Input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === "Enter" && saveTitle()} className="text-2xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0" />
        ) : (
          <h1 className="cursor-pointer text-2xl font-bold hover:text-primary transition-colors" onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}>{task.title}</h1>
        )}

        {/* Properties grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
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
              <PopoverContent className="w-56 p-1 max-h-64 overflow-y-auto" align="start">
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
              <PopoverContent className="w-56 p-1" align="start">
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
              <PopoverContent className="w-64 p-0" align="start">
                <div className="p-3 border-b border-border/30">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="Pesquise ou adicione tags..."
                    className="h-8 text-xs"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  />
                  {newTagName.trim() && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {TAG_COLORS.map(c => (
                        <button key={c.key} className={cn("h-5 w-5 rounded-full transition-all", c.dot, newTagColor === c.key ? "ring-2 ring-offset-2 ring-offset-background ring-white/50 scale-110" : "opacity-60 hover:opacity-100")} onClick={() => setNewTagColor(c.key)} />
                      ))}
                    </div>
                  )}
                  {newTagName.trim() && !globalTags.some(gt => gt.name.toLowerCase() === newTagName.trim().toLowerCase()) && (
                    <Button size="sm" className="mt-2 h-7 text-xs w-full" onClick={addTag}>
                      <Plus className="h-3 w-3 mr-1" /> Criar "{newTagName.trim()}"
                    </Button>
                  )}
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
                          <button
                            className="h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleDeleteGlobalTag(gt); }}
                            title="Apagar etiqueta de todas as tarefas"
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </PropertyRow>
        </div>

        {/* ── Concluído / Alteração action buttons ── */}
        <div className="flex items-center gap-2 pt-2">
          {!isDone ? (
            <>
              <Popover open={stageChoiceOpen} onOpenChange={setStageChoiceOpen}>
                <PopoverTrigger asChild>
              <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/80" onClick={handleConcluido}>
                    <CheckCircle2 className="h-4 w-4" /> Concluído <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </PopoverTrigger>
                {stageChoiceOptions.length > 1 && (
                  <PopoverContent className="w-52 p-1" align="start">
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
                )}
              </Popover>

              {/* Completion date dialog */}
              <Dialog open={completionDateOpen} onOpenChange={setCompletionDateOpen}>
                <DialogContent className="max-w-xs">
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
            <Badge className="bg-emerald-500/20 text-emerald-400 border-0 gap-1">
              <Check className="h-3 w-3" /> Entregue
            </Badge>
          )}

          <Popover open={alteracaoChoiceOpen} onOpenChange={setAlteracaoChoiceOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10" onClick={handleAlteracao}>
                <RotateCcw className="h-3.5 w-3.5" /> Alteração
              </Button>
            </PopoverTrigger>
            {alteracaoTargets.length > 1 && (
              <PopoverContent className="w-52 p-1" align="start">
                <p className="text-xs text-muted-foreground px-3 py-2 font-medium">Retornar para qual etapa?</p>
                {alteracaoTargets.map(sk => {
                  const sc = getStageCircleColor(sk);
                  return (
                    <button key={sk} className="flex items-center gap-2 w-full px-3 py-2 rounded text-sm hover:bg-accent transition" onClick={() => handleChooseAlteracao(sk)}>
                      <span className={cn("h-4 w-4 rounded-full border-2 shrink-0", sc.border)} />
                      <span className="font-medium">{stageLabel(sk)}</span>
                    </button>
                  );
                })}
              </PopoverContent>
            )}
          </Popover>

          {/* Revert button — go back to previous stage */}
          {!isDone && task.stage_current !== "captacao" && (
            <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground border-border/40 hover:bg-muted/60" onClick={handleRevert}>
              <RotateCcw className="h-3.5 w-3.5" /> Reverter
            </Button>
          )}
        </div>

        {/* Description */}
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

        {/* Posting Fields (for subtasks - all stages) */}
        {task.parent_task_id && (
          <div className="border-t border-border/20 pt-4">
            <PmPostingFields task={task} />
          </div>
        )}

        {/* Subtasks */}
        <div className="border-t border-border/20 pt-4">
          <PmSubtaskList parentTask={task} childTasks={childTasks} membersMap={membersMap} members={members} onSelectSubtask={onSelectSubtask} activeSubtaskId={activeSubtaskId} />
        </div>

        {/* Attachments */}
        <div className="border-t border-border/20 pt-4">
          <PmAttachmentsSection taskId={task.id} attachments={attachments} membersMap={membersMap} onSetCover={handleSetCover} currentCoverUrl={task.cover_url} />
        </div>

        {/* Cronograma tab (only for parent tasks with children) */}
        {!task.parent_task_id && childTasks.length > 0 && (
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
              onEditTask={(taskId) => setTaskStack(prev => [...prev, taskId])}
            />
          </div>
        )}
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
