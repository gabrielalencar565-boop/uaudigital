import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  CalendarDays, User, Flag, X, Trash2, ChevronRight, ArrowLeft,
  Circle, Layers, Tag, MessageSquare, PanelRight, Paperclip, FileText
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PM_STATUSES, PM_STAGES, PM_PRIORITIES, PM_SUBTASK_STATUSES, stageLabel } from "../pm-constants";
import {
  useUpdatePmTask, useDeletePmTask, usePmSubtasks,
  usePmComments, usePmAttachments,
  useUpdatePmSubtask, usePmSubtaskComments, usePmSubtaskAttachments
} from "../hooks/use-pm-data";
import { PmSubtaskList } from "./PmSubtaskList";
import { PmCommentsSection } from "./PmCommentsSection";
import { PmAttachmentsSection } from "./PmAttachmentsSection";
import type { PmTask, PmSubtask } from "../pm-types";
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
  const updateTask = useUpdatePmTask();
  const deleteTask = useDeletePmTask();
  const updateSub = useUpdatePmSubtask();
  const subtasksQ = usePmSubtasks(task?.id ?? null);
  const commentsQ = usePmComments(task?.id ?? null);
  const attachmentsQ = usePmAttachments(task?.id ?? null);

  // Internal subtask navigation state
  const [activeSubtaskId, setActiveSubtaskId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Task editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  // Subtask editing state
  const [editingSubTitle, setEditingSubTitle] = useState(false);
  const [subTitleDraft, setSubTitleDraft] = useState("");
  const [editingSubDesc, setEditingSubDesc] = useState(false);
  const [subDescDraft, setSubDescDraft] = useState("");

  // Subtask data hooks
  const subCommentsQ = usePmSubtaskComments(activeSubtaskId);
  const subAttachmentsQ = usePmSubtaskAttachments(activeSubtaskId);

  if (!task) return null;

  const subtasks = subtasksQ.data ?? [];
  const activeSubtask = activeSubtaskId ? subtasks.find(s => s.id === activeSubtaskId) ?? null : null;

  const handleClose = () => {
    setActiveSubtaskId(null);
    setSidebarOpen(false);
    setEditingTitle(false);
    setEditingDesc(false);
    setEditingSubTitle(false);
    setEditingSubDesc(false);
    onClose();
  };

  const handleSelectSubtask = (sub: PmSubtask) => {
    setActiveSubtaskId(sub.id);
    setEditingSubTitle(false);
    setEditingSubDesc(false);
  };

  const handleBackToParent = () => {
    setActiveSubtaskId(null);
    setEditingSubTitle(false);
    setEditingSubDesc(false);
  };

  // ─── Render ───

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-xl border-border/50 shadow-2xl">

        {/* ─── Breadcrumb bar ─── */}
        <div className="flex items-center gap-1.5 border-b border-border/40 px-5 py-2 bg-card/50 shrink-0">
          {activeSubtask && (
            <Button variant="ghost" size="icon" className="h-6 w-6 mr-1" onClick={handleBackToParent}>
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          )}
          <span
            className={cn("text-xs truncate", activeSubtask ? "text-muted-foreground cursor-pointer hover:text-foreground transition" : "text-muted-foreground")}
            onClick={activeSubtask ? handleBackToParent : undefined}
          >
            {clientsMap[task.client_id] ?? "—"}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <span
            className={cn("text-xs truncate", activeSubtask ? "text-muted-foreground cursor-pointer hover:text-foreground transition" : "font-medium")}
            onClick={activeSubtask ? handleBackToParent : undefined}
          >
            {task.title}
          </span>
          {activeSubtask && (
            <>
              <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span className="text-xs font-medium truncate">{activeSubtask.title}</span>
            </>
          )}
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", sidebarOpen && "bg-primary/10 text-primary")}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title="Sidebar de subtarefas"
          >
            <PanelRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ─── Main content ─── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ─── LEFT: Task or Subtask detail ─── */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {activeSubtask ? (
              <SubtaskDetailView
                subtask={activeSubtask}
                membersMap={membersMap}
                members={members}
                comments={subCommentsQ.data ?? []}
                attachments={subAttachmentsQ.data ?? []}
                editingTitle={editingSubTitle}
                setEditingTitle={setEditingSubTitle}
                titleDraft={subTitleDraft}
                setTitleDraft={setSubTitleDraft}
                editingDesc={editingSubDesc}
                setEditingDesc={setEditingSubDesc}
                descDraft={subDescDraft}
                setDescDraft={setSubDescDraft}
              />
            ) : (
              <TaskDetailView
                task={task}
                subtasks={subtasks}
                comments={commentsQ.data ?? []}
                attachments={attachmentsQ.data ?? []}
                membersMap={membersMap}
                members={members}
                isAdmin={isAdmin}
                editingTitle={editingTitle}
                setEditingTitle={setEditingTitle}
                titleDraft={titleDraft}
                setTitleDraft={setTitleDraft}
                editingDesc={editingDesc}
                setEditingDesc={setEditingDesc}
                descDraft={descDraft}
                setDescDraft={setDescDraft}
                onSelectSubtask={handleSelectSubtask}
                activeSubtaskId={activeSubtaskId}
                onClose={handleClose}
              />
            )}
          </div>

          {/* ─── RIGHT: Subtask Sidebar ─── */}
          {sidebarOpen && (
            <div className="w-64 shrink-0 flex flex-col bg-card/30 border-l border-border/30 animate-in slide-in-from-right-5 duration-200">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Subtarefas</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{subtasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="py-1">
                  {subtasks.map(sub => {
                    const isActive = activeSubtaskId === sub.id;
                    const isDone = sub.status === "concluido";
                    return (
                      <div
                        key={sub.id}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 cursor-pointer transition text-sm",
                          isActive ? "bg-primary/10 text-primary border-l-2 border-l-primary" : "hover:bg-card/40",
                          isDone && !isActive && "opacity-50"
                        )}
                        onClick={() => handleSelectSubtask(sub)}
                      >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", statusDotColor(sub.status))} />
                        <span className={cn("truncate flex-1", isDone && "line-through")}>{sub.title}</span>
                      </div>
                    );
                  })}
                  {subtasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-6">Nenhuma subtarefa</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task Detail View (main content) ───

function TaskDetailView({
  task, subtasks, comments, attachments, membersMap, members, isAdmin,
  editingTitle, setEditingTitle, titleDraft, setTitleDraft,
  editingDesc, setEditingDesc, descDraft, setDescDraft,
  onSelectSubtask, activeSubtaskId, onClose,
}: {
  task: PmTask;
  subtasks: PmSubtask[];
  comments: any[];
  attachments: any[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  members: { id: string; name: string }[];
  isAdmin: boolean;
  editingTitle: boolean; setEditingTitle: (v: boolean) => void;
  titleDraft: string; setTitleDraft: (v: string) => void;
  editingDesc: boolean; setEditingDesc: (v: boolean) => void;
  descDraft: string; setDescDraft: (v: string) => void;
  onSelectSubtask: (sub: PmSubtask) => void;
  activeSubtaskId: string | null;
  onClose: () => void;
}) {
  const updateTask = useUpdatePmTask();
  const deleteTask = useDeletePmTask();
  const assignee = task.assignee_id ? membersMap[task.assignee_id] : undefined;

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
    <>
      <div className="flex-1 border-r border-border/30 overflow-y-auto">
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

            <PropertyRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Datas">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Início</span>
                <Input type="date" value={task.start_date ?? ""} onChange={(e) => updateTask.mutate({ id: task.id, start_date: e.target.value || null })} className="h-6 w-28 text-xs border-0 bg-transparent shadow-none p-0" />
                <span className="text-muted-foreground">→</span>
                <Input type="date" value={task.due_date ?? ""} onChange={(e) => updateTask.mutate({ id: task.id, due_date: e.target.value || null })} className="h-6 w-28 text-xs border-0 bg-transparent shadow-none p-0" />
              </div>
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
              taskId={task.id}
              subtasks={subtasks}
              membersMap={membersMap}
              members={members}
              parentTitle={task.title}
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
      </div>

      {/* Activity sidebar */}
      <div className="w-80 shrink-0 flex flex-col bg-card/10 hidden sm:flex">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Atividade</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <PmCommentsSection taskId={task.id} comments={comments} membersMap={membersMap} />
        </div>
      </div>
    </>
  );
}

// ─── Subtask Detail View ───

function SubtaskDetailView({
  subtask, membersMap, members, comments, attachments,
  editingTitle, setEditingTitle, titleDraft, setTitleDraft,
  editingDesc, setEditingDesc, descDraft, setDescDraft,
}: {
  subtask: PmSubtask;
  membersMap: Record<string, { name: string; avatar?: string }>;
  members: { id: string; name: string }[];
  comments: any[];
  attachments: any[];
  editingTitle: boolean; setEditingTitle: (v: boolean) => void;
  titleDraft: string; setTitleDraft: (v: string) => void;
  editingDesc: boolean; setEditingDesc: (v: boolean) => void;
  descDraft: string; setDescDraft: (v: string) => void;
}) {
  const updateSub = useUpdatePmSubtask();
  const assignee = subtask.assignee_id ? membersMap[subtask.assignee_id] : undefined;

  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== subtask.title) {
      updateSub.mutate({ id: subtask.id, title: titleDraft.trim(), task_id: subtask.task_id });
    }
    setEditingTitle(false);
  };

  const saveDesc = () => {
    updateSub.mutate({ id: subtask.id, description: descDraft, task_id: subtask.task_id });
    setEditingDesc(false);
  };

  return (
    <>
      <div className="flex-1 border-r border-border/30 overflow-y-auto">
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
              onClick={() => { setTitleDraft(subtask.title); setEditingTitle(true); }}
            >{subtask.title}</h1>
          )}

          {/* Properties grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
            <PropertyRow icon={<Circle className="h-3.5 w-3.5" />} label="Status">
              <Select value={subtask.status} onValueChange={(v) => updateSub.mutate({ id: subtask.id, status: v, task_id: subtask.task_id })}>
                <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1.5">
                  <Badge className={cn("text-[10px] uppercase font-bold tracking-wide px-2.5 py-0.5 rounded-md", subtaskStatusBadgeColor(subtask.status))}>
                    <SelectValue />
                  </Badge>
                </SelectTrigger>
                <SelectContent>
                  {PM_SUBTASK_STATUSES.map(s => (
                    <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow icon={<User className="h-3.5 w-3.5" />} label="Responsável">
              <Select value={subtask.assignee_id ?? "__none__"} onValueChange={(v) => updateSub.mutate({ id: subtask.id, assignee_id: v === "__none__" ? null : v, task_id: subtask.task_id })}>
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
                    <span className="text-xs text-muted-foreground">Ninguém</span>
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

            <PropertyRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Prazo">
              <Input
                type="date" value={subtask.due_date ?? ""}
                onChange={(e) => updateSub.mutate({ id: subtask.id, due_date: e.target.value || null, task_id: subtask.task_id })}
                className="h-7 w-36 text-xs border-0 bg-transparent shadow-none p-0"
              />
            </PropertyRow>

            <PropertyRow icon={<Layers className="h-3.5 w-3.5" />} label="Etapa">
              <Select value={subtask.stage} onValueChange={(v) => updateSub.mutate({ id: subtask.id, stage: v, task_id: subtask.task_id })}>
                <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PM_STAGES.map(s => (
                    <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>
          </div>

          {/* Description */}
          <div className="border-t border-border/20 pt-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" /> Descrição
            </h3>
            {editingDesc ? (
              <div className="space-y-2">
                <Textarea value={descDraft} onChange={(e) => setDescDraft(e.target.value)} className="min-h-[120px] text-sm resize-none" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveDesc}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingDesc(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div
                className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition min-h-[60px] py-2 rounded-md hover:bg-accent/20 px-2 -mx-2"
                onClick={() => { setDescDraft(subtask.description ?? ""); setEditingDesc(true); }}
              >
                {subtask.description || "Adicione uma descrição detalhada..."}
              </div>
            )}
          </div>

          {/* Attachments */}
          <div className="border-t border-border/20 pt-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-muted-foreground" /> Anexos
            </h3>
            <PmAttachmentsSection subtaskId={subtask.id} attachments={attachments} membersMap={membersMap} />
          </div>
        </div>
      </div>

      {/* Activity sidebar */}
      <div className="w-80 shrink-0 flex flex-col bg-card/10 hidden sm:flex">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Atividade</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <PmCommentsSection subtaskId={subtask.id} comments={comments} membersMap={membersMap} />
        </div>
      </div>
    </>
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

function subtaskStatusBadgeColor(key: string) {
  switch (key) {
    case "nao_iniciado": return "bg-muted-foreground/20 text-muted-foreground";
    case "em_producao": return "bg-primary/20 text-primary";
    case "aguardando": return "bg-yellow-500/20 text-yellow-600";
    case "em_revisao": return "bg-accent/50 text-accent-foreground";
    case "aprovado": return "bg-emerald-500/20 text-emerald-600";
    case "concluido": return "bg-emerald-500/20 text-emerald-600";
    case "bloqueado": return "bg-destructive/20 text-destructive";
    default: return "bg-muted-foreground/20 text-muted-foreground";
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
    case "nao_iniciado": return "bg-muted-foreground/40";
    case "em_producao": return "bg-primary";
    case "aguardando": return "bg-warning/60";
    case "em_revisao": return "bg-warning";
    case "aprovado": return "bg-success/60";
    case "bloqueado": return "bg-destructive";
    default: return "bg-muted-foreground";
  }
}
