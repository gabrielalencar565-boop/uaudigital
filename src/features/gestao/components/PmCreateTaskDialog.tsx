import { useState } from "react";
import {
  Circle, User, CalendarDays, Flag, Layers, Tag, Plus, ChevronDown
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { PM_PRIORITIES, PM_STAGES, PM_STATUSES } from "../pm-constants";
import { useCreatePmTask } from "../hooks/use-pm-data";
import { toast } from "sonner";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
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

interface Props {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  members: { id: string; name: string }[];
  defaultStatus?: string;
}

export function PmCreateTaskDialog({ open, onClose, clients, members, defaultStatus }: Props) {
  const createTask = useCreatePmTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState("");
  const [priority, setPriority] = useState("media");
  const [stage, setStage] = useState("planejamento");
  const [status, setStatus] = useState(defaultStatus || "backlog");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [useTemplate, setUseTemplate] = useState(true);
  const [tagsRaw, setTagsRaw] = useState("");
  const [descOpen, setDescOpen] = useState(false);

  const reset = () => {
    setTitle(""); setDescription(""); setClientId(""); setPriority("media");
    setStage("planejamento"); setStatus(defaultStatus || "backlog"); setAssigneeId("");
    setStartDate(""); setDueDate(""); setUseTemplate(true); setTagsRaw(""); setDescOpen(false);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !clientId) { toast.error("Preencha título e cliente"); return; }
    try {
      await createTask.mutateAsync({
        title: title.trim(),
        description: description || undefined,
        client_id: clientId,
        priority,
        stage_current: stage,
        assignee_id: assigneeId || undefined,
        due_date: dueDate || undefined,
        tags: tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [],
        useTemplate,
      });
      toast.success("Tarefa criada!");
      reset();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar tarefa");
    }
  };

  const selectedClient = clients.find(c => c.id === clientId);
  const selectedMember = members.find(m => m.id === assigneeId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-3">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nome da tarefa"
            className="text-2xl font-bold border-0 bg-transparent p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Properties grid */}
        <div className="px-6 pb-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {/* Status */}
            <PropertyRow icon={<Circle className="h-3.5 w-3.5" />} label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1.5">
                  <Badge className={cn("text-[10px] uppercase font-bold tracking-wide px-2.5 py-0.5 rounded", statusBadgeColor(status))}>
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

            {/* Responsável */}
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
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-6 w-28 text-xs border-0 bg-transparent shadow-none p-0"
                />
                <span className="text-muted-foreground">→</span>
                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-6 w-28 text-xs border-0 bg-transparent shadow-none p-0"
                />
              </div>
            </PropertyRow>

            {/* Prioridade */}
            <PropertyRow icon={<Flag className="h-3.5 w-3.5" />} label="Prioridade">
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

            {/* Etapa */}
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

            {/* Etiquetas */}
            <PropertyRow icon={<Tag className="h-3.5 w-3.5" />} label="Etiquetas">
              <Input
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="ex: social, vídeo"
                className="h-6 text-xs border-0 bg-transparent shadow-none p-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
              />
            </PropertyRow>

            {/* Cliente */}
            <PropertyRow icon={<Layers className="h-3.5 w-3.5" />} label="Cliente *">
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-7 border-0 bg-transparent shadow-none p-0 w-auto gap-1">
                  {selectedClient ? (
                    <span className="text-xs">{selectedClient.name}</span>
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
        </div>

        {/* Description */}
        <div className="px-6 pb-3 border-t border-border/20 pt-3">
          <Collapsible open={descOpen} onOpenChange={setDescOpen}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition cursor-pointer">
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", descOpen && "rotate-0", !descOpen && "-rotate-90")} />
              Descrição
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Adicione uma descrição..."
                className="min-h-[100px] text-sm"
              />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Template option */}
        <div className="px-6 pb-3 border-t border-border/20 pt-3">
          <div className="flex items-center gap-2">
            <Checkbox id="tpl" checked={useTemplate} onCheckedChange={(v) => setUseTemplate(!!v)} />
            <Label htmlFor="tpl" className="cursor-pointer text-sm text-muted-foreground">
              Criar subtarefas do template padrão (7 etapas)
            </Label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border/40 px-6 py-3 bg-card/50">
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={createTask.isPending} className="gap-1.5">
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
    <div className="flex items-center gap-2 py-1.5 min-h-[36px]">
      <div className="flex items-center gap-1.5 w-28 shrink-0 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
