import { useState } from "react";
import { format } from "date-fns";
import {
  CalendarDays, User, Flag, X, ChevronRight, Trash2,
  Circle, Layers, Tag, MessageSquare, Paperclip, ListTodo, FileText
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PM_SUBTASK_STATUSES, PM_STAGES, stageLabel } from "../pm-constants";
import { useUpdatePmSubtask, usePmComments, usePmAttachments } from "../hooks/use-pm-data";
import { PmCommentsSection } from "./PmCommentsSection";
import { PmAttachmentsSection } from "./PmAttachmentsSection";
import type { PmSubtask } from "../pm-types";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

function statusBadgeColor(key: string) {
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

interface Props {
  subtask: PmSubtask | null;
  open: boolean;
  onClose: () => void;
  parentTitle: string;
  membersMap: Record<string, { name: string; avatar?: string }>;
  members: { id: string; name: string }[];
}

export function PmSubtaskDetailDialog({ subtask, open, onClose, parentTitle, membersMap, members }: Props) {
  const updateSub = useUpdatePmSubtask();
  const commentsQ = usePmComments(subtask?.id ?? null);
  const attachmentsQ = usePmAttachments(subtask?.id ?? null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");

  if (!subtask) return null;

  const assignee = subtask.assignee_id ? membersMap[subtask.assignee_id] : undefined;
  const comments = commentsQ.data ?? [];
  const attachments = attachmentsQ.data ?? [];

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
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-xl border-border/50 shadow-2xl">
        <DialogTitle className="sr-only">{subtask.title}</DialogTitle>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 border-b border-border/30 px-6 py-3 bg-card/50 shrink-0">
          <span className="text-xs text-muted-foreground truncate">{parentTitle}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="text-xs font-medium truncate">{subtask.title}</span>
          <div className="flex-1" />
          <span className="text-[10px] text-muted-foreground">
            {subtask.created_at ? `Criada em ${format(new Date(subtask.created_at), "dd 'de' MMM")}` : ""}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Main split */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* LEFT content */}
          <ScrollArea className="flex-1 border-r border-border/30">
            <div className="px-8 py-6 space-y-6">
              {/* Title */}
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
                  onClick={() => { setTitleDraft(subtask.title); setEditingTitle(true); }}
                >
                  {subtask.title}
                </h1>
              )}

              {/* Properties grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-1">
                <PropertyRow icon={<Circle className="h-3.5 w-3.5" />} label="Status">
                  <Select value={subtask.status} onValueChange={(v) => updateSub.mutate({ id: subtask.id, status: v, task_id: subtask.task_id })}>
                    <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1.5">
                      <Badge className={cn("text-[10px] uppercase font-bold tracking-wide px-2.5 py-0.5 rounded-md", statusBadgeColor(subtask.status))}>
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
                  <Select
                    value={subtask.assignee_id ?? "__none__"}
                    onValueChange={(v) => updateSub.mutate({ id: subtask.id, assignee_id: v === "__none__" ? null : v, task_id: subtask.task_id })}
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
                    type="date"
                    value={subtask.due_date ?? ""}
                    onChange={(e) => updateSub.mutate({ id: subtask.id, due_date: e.target.value || null, task_id: subtask.task_id })}
                    className="h-7 w-36 text-xs border-0 bg-transparent shadow-none p-0"
                  />
                </PropertyRow>

                <PropertyRow icon={<Layers className="h-3.5 w-3.5" />} label="Etapa">
                  <Select value={subtask.stage} onValueChange={(v) => updateSub.mutate({ id: subtask.id, stage: v, task_id: subtask.task_id })}>
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
              </div>

              <Separator className="opacity-30" />

              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Descrição
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

              <Separator className="opacity-30" />

              {/* Attachments */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Anexos
                </h3>
                <PmAttachmentsSection taskId={subtask.id} attachments={attachments} membersMap={membersMap} />
              </div>
            </div>
          </ScrollArea>

          {/* RIGHT: Activity / Comments */}
          <div className="w-80 shrink-0 flex flex-col bg-card/10 hidden sm:flex">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border/30">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Atividade</span>
            </div>
            <ScrollArea className="flex-1 px-4 py-3">
              <PmCommentsSection taskId={subtask.id} comments={comments} membersMap={membersMap} />
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PropertyRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-2 min-h-[40px] hover:bg-accent/30 rounded-md px-2 -mx-2 transition-colors">
      <div className="flex items-center gap-2 w-32 shrink-0 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
