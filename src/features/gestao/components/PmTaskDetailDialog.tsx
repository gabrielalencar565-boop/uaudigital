import { useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays, User, Flag, X, Trash2, ChevronRight,
  Circle, Layers, Tag, Clock, MessageSquare, Paperclip
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PM_STATUSES, PM_STAGES, PM_PRIORITIES, stageLabel } from "../pm-constants";
import { useUpdatePmTask, useDeletePmTask, usePmSubtasks, usePmComments, usePmAttachments } from "../hooks/use-pm-data";
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
  const updateTask = useUpdatePmTask();
  const deleteTask = useDeletePmTask();
  const subtasksQ = usePmSubtasks(task?.id ?? null);
  const commentsQ = usePmComments(task?.id ?? null);
  const attachmentsQ = usePmAttachments(task?.id ?? null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  if (!task) return null;

  const subtasks = subtasksQ.data ?? [];
  const comments = commentsQ.data ?? [];
  const attachments = attachmentsQ.data ?? [];
  const done = subtasks.filter((s) => s.status === "concluido").length;
  const total = subtasks.length;
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

  const statusBadgeColor = (key: string) => {
    switch (key) {
      case "backlog": return "bg-muted-foreground text-muted";
      case "em_andamento": return "bg-primary text-primary-foreground";
      case "em_aprovacao": return "bg-warning text-warning-foreground";
      case "concluido": return "bg-success text-success-foreground";
      case "pausado": return "bg-muted-foreground/50 text-muted";
      case "cancelado": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted-foreground text-muted";
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-5xl p-0 flex flex-col [&>button]:hidden">
        {/* Top breadcrumb bar */}
        <div className="flex items-center gap-1.5 border-b border-border/40 px-5 py-2 bg-card/50 shrink-0">
          <span className="text-xs text-muted-foreground">{clientsMap[task.client_id] ?? "—"}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">{stageLabel(task.stage_current)}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs font-medium truncate">{task.title}</span>
          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground">
            {task.created_at ? `Criada em ${format(new Date(task.created_at), "dd 'de' MMM")}` : ""}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main split */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT content */}
          <ScrollArea className="flex-1 border-r border-border/30">
            <div className="px-6 py-5 space-y-6">
              {/* Title - large like ClickUp */}
              {editingTitle ? (
                <Input
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                  className="text-2xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              ) : (
                <h1
                  className="cursor-pointer text-2xl font-bold hover:text-primary transition-colors"
                  onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
                >
                  {task.title}
                </h1>
              )}

              {/* Properties - 2 column grid like ClickUp */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {/* Status */}
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

                {/* Responsáveis */}
                <PropertyRow icon={<User className="h-3.5 w-3.5" />} label="Responsáveis">
                  <Select
                    value={task.assignee_id ?? "__none__"}
                    onValueChange={(v) => updateTask.mutate({ id: task.id, assignee_id: v === "__none__" ? null : v })}
                  >
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

                {/* Datas */}
                <PropertyRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Datas">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Início</span>
                    <Input
                      type="date"
                      value={task.start_date ?? ""}
                      onChange={(e) => updateTask.mutate({ id: task.id, start_date: e.target.value || null })}
                      className="h-6 w-28 text-xs border-0 bg-transparent shadow-none p-0"
                    />
                    <span className="text-muted-foreground">→</span>
                    <CalendarDays className="h-3 w-3 text-muted-foreground" />
                    <Input
                      type="date"
                      value={task.due_date ?? ""}
                      onChange={(e) => updateTask.mutate({ id: task.id, due_date: e.target.value || null })}
                      className="h-6 w-28 text-xs border-0 bg-transparent shadow-none p-0"
                    />
                  </div>
                </PropertyRow>

                {/* Prioridade */}
                <PropertyRow icon={<Flag className="h-3.5 w-3.5" />} label="Prioridade">
                  <Select value={task.priority} onValueChange={(v) => updateTask.mutate({ id: task.id, priority: v as any })}>
                    <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PM_PRIORITIES.map(p => (
                        <SelectItem key={p.key} value={p.key} className="text-xs">{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropertyRow>

                {/* Etapa */}
                <PropertyRow icon={<Layers className="h-3.5 w-3.5" />} label="Etapa">
                  <Select value={task.stage_current} onValueChange={(v) => updateTask.mutate({ id: task.id, stage_current: v as any })}>
                    <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PM_STAGES.map(s => (
                        <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropertyRow>

                {/* Etiquetas */}
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
                <PmSubtaskList taskId={task.id} subtasks={subtasks} membersMap={membersMap} members={members} />
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
          </ScrollArea>

          {/* RIGHT: Activity sidebar */}
          <div className="w-80 shrink-0 flex flex-col bg-card/10 hidden sm:flex">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Activity</span>
            </div>
            <ScrollArea className="flex-1 px-4 py-3">
              <PmCommentsSection taskId={task.id} comments={comments} membersMap={membersMap} />
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* Property row - inline label + value */
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
