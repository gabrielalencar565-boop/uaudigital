import { useState } from "react";
import {
  CalendarDays, User, Flag, X, Trash2, ChevronRight, ArrowLeft,
  Circle, Layers, Tag, MessageSquare, Paperclip, FileText,
  CheckCircle2, Plus, Pencil, MoreHorizontal, Archive
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { PM_STATUSES, PM_STAGES, PM_PRIORITIES, stageLabel } from "../pm-constants";
import {
  useUpdatePmTask, useDeletePmTask, usePmChildTasks,
  usePmComments, usePmAttachments,
} from "../hooks/use-pm-data";
import { PmSubtaskList } from "./PmSubtaskList";
import { PmCommentsSection } from "./PmCommentsSection";
import { PmAttachmentsSection } from "./PmAttachmentsSection";
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
  // Navigation stack: array of task ids for breadcrumb
  const [taskStack, setTaskStack] = useState<PmTask[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // The currently displayed task is either the last in stack or the root task
  const currentTask = taskStack.length > 0 ? taskStack[taskStack.length - 1] : task;

  // Data for current task
  const childTasksQ = usePmChildTasks(currentTask?.id ?? null);
  const commentsQ = usePmComments(currentTask?.id ?? null);
  const attachmentsQ = usePmAttachments(currentTask?.id ?? null);

  if (!task || !currentTask) return null;

  const childTasks = childTasksQ.data ?? [];
  const comments = commentsQ.data ?? [];
  const attachments = attachmentsQ.data ?? [];

  const isSubtaskView = taskStack.length > 0;

  const handleClose = () => {
    setTaskStack([]);
    setSidebarOpen(false);
    onClose();
  };

  const handleSelectSubtask = (sub: PmTask) => {
    setTaskStack(prev => [...prev, sub]);
  };

  const handleBackToParent = () => {
    setTaskStack(prev => prev.slice(0, -1));
  };

  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Go to root
      setTaskStack([]);
    } else {
      setTaskStack(prev => prev.slice(0, index + 1));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-xl border-border/50 shadow-2xl">

        {/* ─── Breadcrumb bar ─── */}
        <div className="flex items-center gap-1.5 border-b border-border/40 px-5 py-2 bg-card/50 shrink-0">
          {isSubtaskView && (
            <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" onClick={handleBackToParent}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <span className="text-xs text-muted-foreground truncate">
            {clientsMap[task.client_id] ?? "—"}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <span
            className={cn("text-xs truncate", isSubtaskView ? "text-muted-foreground cursor-pointer hover:text-foreground transition" : "font-medium")}
            onClick={isSubtaskView ? () => handleBreadcrumbClick(-1) : undefined}
          >
            {task.title}
          </span>
          {taskStack.map((stackTask, i) => (
            <span key={stackTask.id} className="contents">
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span
                className={cn(
                  "text-xs truncate",
                  i < taskStack.length - 1 ? "text-muted-foreground cursor-pointer hover:text-foreground transition" : "font-medium"
                )}
                onClick={i < taskStack.length - 1 ? () => handleBreadcrumbClick(i) : undefined}
              >
                {stackTask.title}
              </span>
            </span>
          ))}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", sidebarOpen && "bg-primary/10 text-primary")}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Sidebar de subtarefas"
          >
            <Layers className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ─── Main content ─── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ─── LEFT: Subtask Sidebar (toggle) ─── */}
          {sidebarOpen && (
            <div className="w-64 shrink-0 flex flex-col bg-card/30 border-r border-border/30 animate-in slide-in-from-left-5 duration-200">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 shrink-0">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Subtarefas</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{childTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="py-1">
                  {childTasks.map(sub => {
                    const isActive = taskStack.length > 0 && taskStack[taskStack.length - 1].id === sub.id;
                    const isDone = sub.status_global === "concluido";
                    return (
                      <div
                        key={sub.id}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 cursor-pointer transition text-sm",
                          isActive ? "bg-primary/10 text-primary border-r-2 border-r-primary" : "hover:bg-card/40",
                          isDone && !isActive && "opacity-50"
                        )}
                        onClick={() => handleSelectSubtask(sub)}
                      >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", statusDotColor(sub.status_global))} />
                        <span className={cn("truncate flex-1", isDone && "line-through")}>{sub.title}</span>
                      </div>
                    );
                  })}
                  {childTasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhuma subtarefa</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── CENTER: Task detail (scrollable) ─── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <TaskContentView
              task={currentTask}
              childTasks={childTasks}
              attachments={attachments}
              membersMap={membersMap}
              members={members}
              isAdmin={isAdmin}
              onSelectSubtask={handleSelectSubtask}
              activeSubtaskId={null}
              onClose={handleClose}
              clientsMap={clientsMap}
            />
          </div>

          {/* ─── RIGHT: Comments sidebar ─── */}
          <div className="w-80 shrink-0 flex-col bg-card/10 border-l border-border/30 hidden sm:flex">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 shrink-0">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Atividade</span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
              <PmCommentsSection taskId={currentTask.id} comments={comments} membersMap={membersMap} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task Content View (reused for both parent and child) ───

function TaskContentView({
  task, childTasks, attachments, membersMap, members, isAdmin,
  onSelectSubtask, activeSubtaskId, onClose, clientsMap,
}: {
  task: PmTask;
  childTasks: PmTask[];
  attachments: any[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  members: { id: string; name: string }[];
  isAdmin: boolean;
  onSelectSubtask: (sub: PmTask) => void;
  activeSubtaskId: string | null;
  onClose: () => void;
  clientsMap: Record<string, string>;
}) {
  const updateTask = useUpdatePmTask();
  const deleteTask = useDeletePmTask();
  const assignee = task.assignee_id ? membersMap[task.assignee_id] : undefined;

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== task.title) {
      updateTask.mutate({ id: task.id, title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const saveDesc = () => {
    updateTask.mutate({ id: task.id, description: descDraft });
    setEditingDesc(false);
  };

  const handleDelete = async () => {
    if (!confirm("Excluir esta tarefa e todas as subtarefas?")) return;
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success("Tarefa excluída");
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao excluir");
    }
  };

  return (
    <div className="px-6 py-5 space-y-6">
      {/* Title */}
      {editingTitle ? (
        <Input
          autoFocus value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && saveTitle()}
          className="text-2xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      ) : (
        <h1
          className="cursor-pointer text-2xl font-bold hover:text-primary transition-colors"
          onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
        >{task.title}</h1>
      )}

      {/* Properties grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        <PropertyRow icon={<Circle className="h-3.5 w-3.5" />} label="Status">
          <Select value={task.status_global} onValueChange={(v) => updateTask.mutate({ id: task.id, status_global: v as any })}>
            <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1.5">
              <Badge className={cn("text-[10px] uppercase font-bold tracking-wide px-2.5 py-0.5 rounded", statusBadgeColor(task.status_global))}>
                <SelectValue />
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {PM_STATUSES.map(s => (
                <SelectItem key={s.key} value={s.key} className="text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", statusDotColor(s.key))} />
                    {s.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        <PropertyRow icon={<User className="h-3.5 w-3.5" />} label="Responsável">
          <Select value={task.assignee_id ?? "__none__"} onValueChange={(v) => updateTask.mutate({ id: task.id, assignee_id: v === "__none__" ? null : v })}>
            <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1.5">
              {assignee ? (
                <div className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={assignee.avatar} />
                    <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{initials(assignee.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs">{assignee.name}</span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">Vazio</span>
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">Ninguém</SelectItem>
              {members.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        <PropertyRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Entrega">
          <Input type="date" value={task.due_date ?? ""} onChange={(e) => updateTask.mutate({ id: task.id, due_date: e.target.value || null })} className="h-7 w-36 text-xs border-0 bg-transparent shadow-none p-0" />
        </PropertyRow>

        <PropertyRow icon={<Flag className="h-3.5 w-3.5" />} label="Prioridade">
          <Select value={task.priority} onValueChange={(v) => updateTask.mutate({ id: task.id, priority: v as any })}>
            <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PM_PRIORITIES.map(p => (
                <SelectItem key={p.key} value={p.key} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        <PropertyRow icon={<Layers className="h-3.5 w-3.5" />} label="Etapa">
          <Select value={task.stage_current} onValueChange={(v) => updateTask.mutate({ id: task.id, stage_current: v as any })}>
            <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PM_STAGES.map(s => (
                <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PropertyRow>

        <PropertyRow icon={<Tag className="h-3.5 w-3.5" />} label="Etiquetas">
          <div className="flex flex-wrap items-center gap-1">
            {task.tags.length > 0 ? task.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5">{tag}</Badge>
            )) : (
              <span className="text-xs text-muted-foreground">Vazio</span>
            )}
          </div>
        </PropertyRow>
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
          <div
            className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition min-h-[40px] py-2"
            onClick={() => { setDescDraft(task.description ?? ""); setEditingDesc(true); }}
          >
            {task.description || "Adicione uma descrição..."}
          </div>
        )}
      </div>

      {/* Subtasks */}
      <div className="border-t border-border/20 pt-4">
        <PmSubtaskList
          parentTask={task}
          childTasks={childTasks}
          membersMap={membersMap}
          members={members}
          onSelectSubtask={onSelectSubtask}
          activeSubtaskId={activeSubtaskId}
        />
      </div>

      {/* Attachments */}
      <div className="border-t border-border/20 pt-4">
        <PmAttachmentsSection taskId={task.id} attachments={attachments} membersMap={membersMap} />
      </div>

      {/* Delete */}
      {isAdmin && (
        <div className="border-t border-border/20 pt-4 flex justify-end">
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir tarefa
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ───

function PropertyRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1.5 min-h-[36px]">
      <div className="flex items-center gap-1.5 w-28 shrink-0 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function statusBadgeColor(key: string) {
  switch (key) {
    case "backlog": return "bg-muted-foreground text-muted";
    case "em_andamento": return "bg-primary text-primary-foreground";
    case "em_aprovacao": return "bg-warning text-warning-foreground";
    case "concluido": return "bg-success text-success-foreground";
    case "pausado": return "bg-muted-foreground/50 text-muted";
    case "cancelado": return "bg-destructive text-destructive-foreground";
    default: return "bg-muted-foreground text-muted";
  }
}

function statusDotColor(key: string) {
  switch (key) {
    case "backlog": return "bg-muted-foreground";
    case "em_andamento": return "bg-primary";
    case "em_aprovacao": return "bg-warning";
    case "concluido": return "bg-success";
    case "pausado": return "bg-muted-foreground/50";
    case "cancelado": return "bg-destructive";
    default: return "bg-muted-foreground";
  }
}
