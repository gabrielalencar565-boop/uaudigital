import { useState, useMemo } from "react";
import {
  CalendarDays, User, Flag, X, ChevronRight, ArrowLeft,
  Layers, Tag, MessageSquare, Plus, Check, CheckCircle2, RotateCcw
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  PM_ACTIVE_STAGES, PM_PRIORITIES, stageLabel, getStageCircleColor,
  TAG_COLORS, parseTag, tagColor, tagDisplay
} from "../pm-constants";
import {
  useUpdatePmTask, usePmTasks, usePmChildTasks,
  usePmComments, usePmAttachments, usePmSyncStageCompletion,
} from "../hooks/use-pm-data";
import { useDefaultFlow, getNextStages } from "./PmStageFlowConfig";
import { PmSubtaskList } from "./PmSubtaskList";
import { PmCommentsSection } from "./PmCommentsSection";
import { PmAttachmentsSection } from "./PmAttachmentsSection";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";

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
  const [taskStack, setTaskStack] = useState<string[]>([]); // store IDs instead of full objects
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Resolve tasks from query cache for reactivity ──
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

  // Resolve current task from child tasks query data for reactivity
  const currentTask = useMemo(() => {
    if (!resolvedRootTask) return null;
    if (taskStack.length === 0) return resolvedRootTask;
    const lastId = taskStack[taskStack.length - 1];
    // Look in all child task queries
    const allChildren = rootChildTasksQ.data ?? [];
    const found = allChildren.find(t => t.id === lastId);
    if (found) return found;
    // Fallback: look in current childTasks
    return childTasksQ.data?.find(t => t.id === lastId) ?? null;
  }, [resolvedRootTask, taskStack, rootChildTasksQ.data, childTasksQ.data]);

  // Collect all unique tags from all tasks
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    (tasksQ.data ?? []).forEach(t => (t.tags ?? []).forEach((tag: string) => tagSet.add(tag)));
    (rootChildTasksQ.data ?? []).forEach(t => (t.tags ?? []).forEach((tag: string) => tagSet.add(tag)));
    return Array.from(tagSet);
  }, [tasksQ.data, rootChildTasksQ.data]);

  if (!task || !currentTask || !resolvedRootTask) return null;

  const childTasks = childTasksQ.data ?? [];
  const comments = commentsQ.data ?? [];
  const attachments = attachmentsQ.data ?? [];

  const isSubtaskView = taskStack.length > 0;

  // Build breadcrumb labels from child tasks
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
      <DialogContent hideClose className="max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-xl border-border/50 shadow-2xl">

        {/* Breadcrumb bar */}
        <div className="flex items-center gap-1.5 border-b border-border/40 px-5 py-2 bg-card/50 shrink-0">
          <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0", sidebarOpen && "bg-primary/10 text-primary")} onClick={() => setSidebarOpen(!sidebarOpen)} title="Sidebar de subtarefas">
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
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}><X className="h-4 w-4" /></Button>
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
                        <span className={cn("truncate flex-1", isDone && "line-through")}>{sub.title}</span>
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
            <TaskContentView task={currentTask} childTasks={childTasks} attachments={attachments} membersMap={membersMap} members={members} isAdmin={isAdmin} onSelectSubtask={handleSelectSubtask} activeSubtaskId={null} onClose={handleClose} clientsMap={clientsMap} allTags={allTags} />
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

function TaskContentView({ task, childTasks, attachments, membersMap, members, isAdmin, onSelectSubtask, activeSubtaskId, onClose, clientsMap, allTags }: {
  task: PmTask; childTasks: PmTask[]; attachments: any[];
  membersMap: Record<string, { name: string; avatar?: string }>; members: { id: string; name: string }[];
  isAdmin: boolean; onSelectSubtask: (sub: PmTask) => void; activeSubtaskId: string | null;
  onClose: () => void; clientsMap: Record<string, string>; allTags: string[];
}) {
  const updateTask = useUpdatePmTask();
  const syncStage = usePmSyncStageCompletion();
  const flowConfig = useDefaultFlow();

  const allAssigneeIds = [
    ...(task.assignee_id ? [task.assignee_id] : []),
    ...(task.watchers ?? []).filter(w => w !== task.assignee_id),
  ];

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("blue");
  const [stageChoiceOpen, setStageChoiceOpen] = useState(false);
  const [stageChoiceOptions, setStageChoiceOptions] = useState<string[]>([]);
  const [alteracaoChoiceOpen, setAlteracaoChoiceOpen] = useState(false);

  // Possible next stages from flow
  const nextStages = getNextStages(flowConfig, task.stage_current);
  const isDone = task.stage_current === "entrega";

  // Alteração: go back to design or video (common return points)
  const alteracaoTargets = ["design", "edicao_videos"].filter(s => s !== task.stage_current);

  // Helper: sync completed stage with Magic Number + Performance
  const syncCompletedStage = async (completedStage: string) => {
    if (task.parent_task_id) return;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      syncStage.mutate({ pmTaskId: task.id, completedStage, userId: user.id });
    } catch (_) { /* ignore */ }
  };

  const handleConcluido = () => {
    if (isDone) return;
    const completedStage = task.stage_current;
    if (nextStages.length === 0) {
      updateTask.mutate({ id: task.id, stage_current: "entrega" as any });
      syncCompletedStage(completedStage);
      toast.success("Tarefa marcada como Entregue!");
    } else if (nextStages.length === 1) {
      updateTask.mutate({ id: task.id, stage_current: nextStages[0] as any });
      syncCompletedStage(completedStage);
      toast.success(`Avançou para ${stageLabel(nextStages[0])}`);
    } else {
      setStageChoiceOptions(nextStages);
      setStageChoiceOpen(true);
    }
  };

  const handleChooseNextStage = (stageKey: string) => {
    const completedStage = task.stage_current;
    updateTask.mutate({ id: task.id, stage_current: stageKey as any });
    syncCompletedStage(completedStage);
    toast.success(`Avançou para ${stageLabel(stageKey)}`);
    setStageChoiceOpen(false);
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
  const saveDesc = () => { updateTask.mutate({ id: task.id, description: descDraft }); setEditingDesc(false); };

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

  const addTag = () => {
    if (!newTagName.trim()) return;
    const tagValue = `${newTagName.trim()}:${newTagColor}`;
    const existing = task.tags ?? [];
    if (!existing.some(t => parseTag(t).name === newTagName.trim())) {
      updateTask.mutate({ id: task.id, tags: [...existing, tagValue] } as any);
    }
    setNewTagName("");
  };
  const removeTag = (tag: string) => { updateTask.mutate({ id: task.id, tags: (task.tags ?? []).filter(t => t !== tag) } as any); };

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
          <PropertyRow icon={<User className="h-3.5 w-3.5" />} label="Responsável">
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
          <PropertyRow icon={<User className="h-3.5 w-3.5" />} label="Cliente">
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-xs min-h-[28px] hover:opacity-80 transition">
                  {clientsMap[task.client_id] ?? "—"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-1 max-h-64 overflow-y-auto" align="start">
                {Object.entries(clientsMap).map(([cid, cname]) => (
                  <button key={cid} className={cn("flex items-center gap-2 w-full px-3 py-2 rounded text-sm hover:bg-accent transition text-left", task.client_id === cid && "bg-accent")} onClick={() => {
                    // Update client and auto-update title prefix
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

          <PropertyRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Entrega">
            <Input type="date" value={task.due_date ?? ""} onChange={(e) => updateTask.mutate({ id: task.id, due_date: e.target.value || null })} className="h-7 w-36 text-xs border-0 bg-transparent shadow-none p-0" />
          </PropertyRow>

          <PropertyRow icon={<Flag className="h-3.5 w-3.5" />} label="Prioridade">
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs min-h-[28px] hover:opacity-80 transition">
                  {PM_PRIORITIES.find(p => p.key === task.priority)?.label ?? task.priority}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="start">
                {PM_PRIORITIES.map(p => (
                  <button key={p.key} className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition", task.priority === p.key && "bg-accent")} onClick={() => updateTask.mutate({ id: task.id, priority: p.key as any })}>
                    {p.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </PropertyRow>

          {/* Stage selector with colored circles (ClickUp style) */}
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
                  const isDone = s.key === "entrega";
                  const isSelected = task.stage_current === s.key;
                  return (
                    <button
                      key={s.key}
                      className={cn("flex items-center gap-3 w-full px-3 py-2 rounded text-sm hover:bg-accent transition", isSelected && "bg-accent")}
                      onClick={() => updateTask.mutate({ id: task.id, stage_current: s.key as any })}
                    >
                      <span className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0", color.border, isDone && `${color.bg}`)}>
                        {isDone && <Check className="h-3 w-3 text-white" />}
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
                  {newTagName.trim() && (
                    <Button size="sm" className="mt-2 h-7 text-xs w-full" onClick={addTag}>
                      <Plus className="h-3 w-3 mr-1" /> Criar "{newTagName.trim()}"
                    </Button>
                  )}
                </div>
                {(task.tags ?? []).length > 0 && (
                  <div className="p-2 space-y-0.5">
                    {(task.tags ?? []).map(rawTag => {
                      const tc = tagColor(rawTag);
                      const name = tagDisplay(rawTag);
                      return (
                        <div key={rawTag} className="flex items-center justify-between group px-2 py-1.5 rounded hover:bg-accent/50 transition">
                          <div className="flex items-center gap-2">
                            <span className={cn("h-3 w-3 rounded", tc.dot)} />
                            <span className="text-xs">{name}</span>
                          </div>
                          <button onClick={() => removeTag(rawTag)} className="opacity-0 group-hover:opacity-100 transition"><X className="h-3 w-3 text-muted-foreground hover:text-destructive" /></button>
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
            <Popover open={stageChoiceOpen} onOpenChange={setStageChoiceOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleConcluido}>
                  <CheckCircle2 className="h-4 w-4" /> Concluído
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
        </div>

        {/* Description */}
        <div className="border-t border-border/20 pt-4">
          {editingDesc ? (
            <div className="space-y-2">
              <Textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} className="min-h-[120px]" />
              <div className="flex gap-2">
                <Button size="sm" onClick={saveDesc}>Salvar</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition min-h-[40px] py-2" onClick={() => { setDescDraft(task.description ?? ""); setEditingDesc(true); }}>
              {task.description || "Adicione uma descrição..."}
            </div>
          )}
        </div>

        {/* Subtasks */}
        <div className="border-t border-border/20 pt-4">
          <PmSubtaskList parentTask={task} childTasks={childTasks} membersMap={membersMap} members={members} onSelectSubtask={onSelectSubtask} activeSubtaskId={activeSubtaskId} />
        </div>

        {/* Attachments */}
        <div className="border-t border-border/20 pt-4">
          <PmAttachmentsSection taskId={task.id} attachments={attachments} membersMap={membersMap} onSetCover={handleSetCover} currentCoverUrl={task.cover_url} />
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
    <div className="flex items-center gap-2 py-1.5 min-h-[36px]">
      <div className="flex items-center gap-1.5 w-28 shrink-0 text-muted-foreground">{icon}<span className="text-xs">{label}</span></div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
