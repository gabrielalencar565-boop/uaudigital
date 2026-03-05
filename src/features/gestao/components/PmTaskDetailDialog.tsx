import { useState } from "react";
import { format } from "date-fns";
import { CalendarDays, User, Tag, Layers, Flag, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PM_STATUSES, PM_STAGES, PM_PRIORITIES, statusColor, stageLabel, priorityMeta } from "../pm-constants";
import { useUpdatePmTask, useDeletePmTask, usePmSubtasks, usePmComments, usePmAttachments } from "../hooks/use-pm-data";
import { PmSubtaskList } from "./PmSubtaskList";
import { PmCommentsSection } from "./PmCommentsSection";
import { PmAttachmentsSection } from "./PmAttachmentsSection";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";

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

  const prio = priorityMeta(task.priority);
  const subtasks = subtasksQ.data ?? [];
  const comments = commentsQ.data ?? [];
  const attachments = attachmentsQ.data ?? [];
  const done = subtasks.filter((s) => s.status === "concluido").length;
  const total = subtasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="border-b border-border/40 p-4">
          <div className="flex items-start justify-between gap-2">
            {editingTitle ? (
              <Input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === "Enter" && saveTitle()}
                className="text-lg font-semibold"
              />
            ) : (
              <h2
                className="cursor-pointer text-lg font-semibold hover:text-primary"
                onClick={() => { setTitleDraft(task.title); setEditingTitle(true); }}
              >
                {task.title}
              </h2>
            )}
          </div>

          {/* Meta row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className={cn(statusColor(task.status_global), "text-xs")}>{PM_STATUSES.find(s => s.key === task.status_global)?.label}</Badge>
            <Badge variant="outline" className="text-xs">{stageLabel(task.stage_current)}</Badge>
            <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold", prio.bg, prio.color)}>
              <Flag className="h-3 w-3" /> {prio.label}
            </span>
            <span className="text-xs text-muted-foreground">{clientsMap[task.client_id] ?? "—"}</span>
          </div>

          {/* Properties */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Status</span>
              <Select value={task.status_global} onValueChange={(v) => updateTask.mutate({ id: task.id, status_global: v as any })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PM_STATUSES.map(s => <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Etapa</span>
              <Select value={task.stage_current} onValueChange={(v) => updateTask.mutate({ id: task.id, stage_current: v as any })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PM_STAGES.map(s => <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Prioridade</span>
              <Select value={task.priority} onValueChange={(v) => updateTask.mutate({ id: task.id, priority: v as any })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PM_PRIORITIES.map(p => <SelectItem key={p.key} value={p.key} className="text-xs">{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Responsável</span>
              <Select value={task.assignee_id ?? ""} onValueChange={(v) => updateTask.mutate({ id: task.id, assignee_id: v || null })}>
                <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Ninguém" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">Ninguém</SelectItem>
                  {members.map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date */}
          <div className="mt-2 flex items-center gap-4">
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-muted-foreground" />
              <Input
                type="date"
                value={task.due_date ?? ""}
                onChange={(e) => updateTask.mutate({ id: task.id, due_date: e.target.value || null })}
                className="h-7 w-36 text-xs border-0 bg-transparent p-0"
              />
            </div>
            {total > 0 && (
              <span className="text-xs text-muted-foreground">Progresso: {progress}%</span>
            )}
          </div>
        </div>

        {/* Body tabs */}
        <Tabs defaultValue="subtasks" className="p-4">
          <TabsList className="bg-card/40">
            <TabsTrigger value="subtasks" className="text-xs">Subtarefas ({total})</TabsTrigger>
            <TabsTrigger value="description" className="text-xs">Descrição</TabsTrigger>
            <TabsTrigger value="comments" className="text-xs">Comentários ({comments.length})</TabsTrigger>
            <TabsTrigger value="attachments" className="text-xs">Anexos ({attachments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="subtasks" className="mt-3">
            <PmSubtaskList taskId={task.id} subtasks={subtasks} membersMap={membersMap} />
          </TabsContent>

          <TabsContent value="description" className="mt-3">
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
                className="cursor-pointer rounded-md border border-dashed border-border/40 p-3 text-sm text-foreground/80 hover:bg-card/20"
                onClick={() => { setDescDraft(task.description ?? ""); setEditingDesc(true); }}
              >
                {task.description || "Clique para adicionar descrição..."}
              </div>
            )}
          </TabsContent>

          <TabsContent value="comments" className="mt-3">
            <PmCommentsSection taskId={task.id} comments={comments} membersMap={membersMap} />
          </TabsContent>

          <TabsContent value="attachments" className="mt-3">
            <PmAttachmentsSection taskId={task.id} attachments={attachments} membersMap={membersMap} />
          </TabsContent>
        </Tabs>

        {/* Footer */}
        {isAdmin && (
          <div className="border-t border-border/40 p-3 flex justify-end">
            <Button variant="destructive" size="sm" onClick={handleDelete}>Excluir tarefa</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
