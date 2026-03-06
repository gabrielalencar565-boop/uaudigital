import { useRef, useState } from "react";
import {
  Circle, User, CalendarDays, Flag, Layers, Tag, Plus, FolderOpen,
  Upload, FileText, Image as ImageIcon, X, Paperclip, MessageSquare, ListTodo
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { PM_PRIORITIES, PM_STAGES, PM_STATUSES } from "../pm-constants";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { toast } from "sonner";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

function statusBadgeColor(key: string) {
  switch (key) {
    case "backlog": return "bg-muted-foreground/20 text-muted-foreground";
    case "em_andamento": return "bg-primary/20 text-primary";
    case "em_aprovacao": return "bg-yellow-500/20 text-yellow-600";
    case "concluido": return "bg-emerald-500/20 text-emerald-600";
    case "pausado": return "bg-muted-foreground/20 text-muted-foreground";
    case "cancelado": return "bg-destructive/20 text-destructive";
    default: return "bg-muted-foreground/20 text-muted-foreground";
  }
}

function priorityColor(key: string) {
  switch (key) {
    case "urgente": return "text-destructive";
    case "alta": return "text-yellow-600";
    case "media": return "text-primary";
    case "baixa": return "text-muted-foreground";
    default: return "text-muted-foreground";
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  members: { id: string; name: string }[];
  defaultStatus?: string;
}

export function PmCreateTaskDialog({ open, onClose, clients, members, defaultStatus }: Props) {
  const createTask = useCreatePmTask();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("media");
  const [stage, setStage] = useState("planejamento");
  const [status, setStatus] = useState(defaultStatus || "backlog");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  
  const [tagsRaw, setTagsRaw] = useState("");

  // Local subtasks for creation
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState("");

  // Local attachments preview
  const [attachments, setAttachments] = useState<File[]>([]);

  const reset = () => {
    setTitle(""); setDescription(""); setClientId(""); setPriority("media");
    setStage("planejamento"); setStatus(defaultStatus || "backlog"); setAssigneeId("");
    setDueDate(""); setTagsRaw("");
    setSubtasks([]); setNewSubtask(""); setAttachments([]);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !clientId) { toast.error("Preencha título e cliente"); return; }
    try {
      const parentTask = await createTask.mutateAsync({
        title: title.trim(),
        description: description || undefined,
        client_id: clientId,
        priority,
        stage_current: stage,
        assignee_id: assigneeId || undefined,
        due_date: dueDate || undefined,
        tags: tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [],
        useTemplate: false,
      });

      // Create subtasks as child tasks
      if (subtasks.length > 0 && parentTask?.id) {
        for (const subTitle of subtasks) {
          await createTask.mutateAsync({
            client_id: clientId,
            title: subTitle,
            parent_task_id: parentTask.id,
            stage_current: "planejamento",
          });
        }
      }

      toast.success("Tarefa criada!");
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar tarefa");
    }
  };

  const addSubtask = () => {
    if (!newSubtask.trim()) return;
    setSubtasks(prev => [...prev, newSubtask.trim()]);
    setNewSubtask("");
  };

  const removeSubtask = (idx: number) => setSubtasks(prev => prev.filter((_, i) => i !== idx));

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachments(prev => [...prev, ...files]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

  const selectedClient = clients.find(c => c.id === clientId);
  const selectedMember = members.find(m => m.id === assigneeId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent hideClose className="max-w-[90vw] w-[90vw] max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden rounded-xl border-border/50 shadow-2xl flex flex-col">
        <DialogTitle className="sr-only">Criar nova tarefa</DialogTitle>

        {/* ── Header ── */}
        <div className="px-8 pt-6 pb-4 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <FolderOpen className="h-3.5 w-3.5" />
            <span>{selectedClient?.name || "Selecione um cliente"}</span>
            <span className="text-muted-foreground/40">›</span>
            <span>Nova Tarefa</span>
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { reset(); onClose(); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome da tarefa..."
            className="text-2xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/30"
          />
        </div>

        {/* ── Body: main + comments sidebar ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* ── CENTER: scrollable content ── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="px-8 py-6 space-y-6">

              {/* Properties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-1">
                <PropertyRow icon={<Circle className="h-3.5 w-3.5" />} label="Status">
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1.5">
                      <Badge className={cn("text-[10px] uppercase font-bold tracking-wide px-2.5 py-0.5 rounded-md", statusBadgeColor(status))}>
                        <SelectValue />
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {PM_STATUSES.map(s => (
                        <SelectItem key={s.key} value={s.key} className="text-xs">{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropertyRow>

                <PropertyRow icon={<User className="h-3.5 w-3.5" />} label="Responsável">
                  <Select value={assigneeId || "__none__"} onValueChange={(v) => setAssigneeId(v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1.5">
                      {selectedMember ? (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-primary/20 text-primary">{initials(selectedMember.name)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{selectedMember.name}</span>
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

                <PropertyRow icon={<Flag className={cn("h-3.5 w-3.5", priorityColor(priority))} />} label="Prioridade">
                  <Select value={priority} onValueChange={setPriority}>
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

                <PropertyRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Data de entrega">
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-7 w-36 text-xs border-0 bg-transparent shadow-none p-0"
                  />
                </PropertyRow>

                <PropertyRow icon={<Layers className="h-3.5 w-3.5" />} label="Etapa">
                  <Select value={stage} onValueChange={setStage}>
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

                <PropertyRow icon={<Tag className="h-3.5 w-3.5" />} label="Tags">
                  <Input
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                    placeholder="ex: social, vídeo"
                    className="h-7 text-xs border-0 bg-transparent shadow-none p-0 focus-visible:ring-0 placeholder:text-muted-foreground/30"
                  />
                </PropertyRow>

                <PropertyRow icon={<FolderOpen className="h-3.5 w-3.5" />} label="Cliente *">
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1">
                      {selectedClient ? (
                        <span className="text-xs font-medium">{selectedClient.name}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Selecione</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </PropertyRow>
              </div>

              <Separator className="opacity-30" />

              {/* ── Description ── */}
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Descrição
                </h3>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Adicione uma descrição detalhada da tarefa..."
                  className="min-h-[120px] text-sm resize-none"
                />
              </div>

              <Separator className="opacity-30" />

              {/* ── Subtasks ── */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                  Subtarefas
                  {subtasks.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] ml-1">{subtasks.length}</Badge>
                  )}
                </h3>

                <p className="text-xs text-muted-foreground mb-3">
                  As subtarefas serão criadas automaticamente ao salvar. Após criar, clique nelas para editar detalhes.
                </p>

                {/* Custom subtasks list */}
                <div className="space-y-1.5 mb-2">
                  {subtasks.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 group rounded-md border border-border/30 bg-card/30 px-3 py-1.5">
                      <Circle className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <span className="text-sm flex-1">{s}</span>
                      <button onClick={() => removeSubtask(i)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add subtask input */}
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSubtask(); } }}
                    placeholder="Adicionar subtarefa..."
                    className="h-8 text-sm border-0 border-b border-border/30 rounded-none bg-transparent shadow-none px-0 focus-visible:ring-0"
                  />
                  <Button size="sm" variant="ghost" onClick={addSubtask} disabled={!newSubtask.trim()} className="h-7 text-xs">
                    Adicionar
                  </Button>
                </div>
              </div>

              <Separator className="opacity-30" />

              {/* ── Attachments ── */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  Anexos
                  {attachments.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] ml-1">{attachments.length}</Badge>
                  )}
                </h3>

                <div className="space-y-1.5 mb-3">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-md border border-border/30 bg-card/30 px-3 py-2 group">
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button onClick={() => removeFile(i)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>

                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="gap-1.5 text-xs">
                  <Upload className="h-3.5 w-3.5" /> Selecionar arquivo
                </Button>
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileAdd} multiple />
              </div>
            </div>
          </div>

          {/* ── RIGHT: Comments sidebar ── */}
          <div className="w-80 shrink-0 flex-col bg-card/10 border-l border-border/30 hidden sm:flex">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 shrink-0">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Atividade</span>
            </div>
            <div className="flex-1 flex items-center justify-center px-4">
              <p className="text-xs text-muted-foreground text-center italic">
                Os comentários estarão disponíveis após criar a tarefa.
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 border-t border-border/30 px-8 py-4 bg-card/50 shrink-0">
          <Button variant="ghost" onClick={() => { reset(); onClose(); }} className="text-sm">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={createTask.isPending} className="gap-1.5 text-sm px-6">
            <Plus className="h-4 w-4" />
            {createTask.isPending ? "Criando..." : "Criar Tarefa"}
          </Button>
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
