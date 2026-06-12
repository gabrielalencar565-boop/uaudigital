import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TASK_TYPES, TASK_TYPE_LABEL, fmtDateTime, type CrmTaskType } from "../crm-constants";
import { useCrmTasks, useCreateTask, useUpdateTask, useDeleteTask } from "../hooks/use-crm-tasks";

interface Props {
  leadId: string;
  members: { user_id: string; display_name: string; avatar_url: string | null }[];
}

export function LeadTasksList({ leadId, members }: Props) {
  const { data: tasks = [] } = useCrmTasks(leadId);
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [tipo, setTipo] = useState<CrmTaskType>("ligacao");
  const [titulo, setTitulo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assigned, setAssigned] = useState<string>("");

  const add = async () => {
    if (!titulo.trim()) { toast.error("Informe o título"); return; }
    try {
      await create.mutateAsync({
        lead_id: leadId,
        tipo,
        titulo: titulo.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        assigned_user_id: assigned || null,
      });
      setTitulo(""); setDueAt("");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  };

  const toggle = async (id: string, completed: boolean) => {
    try {
      await update.mutateAsync({ id, patch: { status: completed ? "concluida" : "pendente", completed_at: completed ? new Date().toISOString() : null } });
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/50 p-3 space-y-2 bg-muted/20">
        <div className="grid grid-cols-2 gap-2">
          <Select value={tipo} onValueChange={(v) => setTipo(v as CrmTaskType)}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.emoji} {t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="h-9" />
        </div>
        <Input placeholder="Título da tarefa" value={titulo} onChange={(e) => setTitulo(e.target.value)} className="h-9" />
        <div className="flex gap-2">
          <Select value={assigned || "none"} onValueChange={(v) => setAssigned(v === "none" ? "" : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Sem responsável</SelectItem>
              {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
        </div>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">Sem tarefas</div>}
        {tasks.map((t) => {
          const overdue = t.status === "pendente" && t.due_at && new Date(t.due_at) < new Date();
          const member = members.find((m) => m.user_id === t.assigned_user_id);
          return (
            <div key={t.id} className={cn(
              "flex items-start gap-2 rounded-md border p-2.5",
              t.status === "concluida" ? "opacity-60 border-border/40" : overdue ? "border-rose-500/50 bg-rose-500/5" : "border-border/50",
            )}>
              <Checkbox checked={t.status === "concluida"} onCheckedChange={(c) => toggle(t.id, !!c)} className="mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm font-medium", t.status === "concluida" && "line-through")}>
                  <span className="mr-1">{TASK_TYPES.find((x) => x.value === t.tipo)?.emoji}</span>
                  {t.titulo}
                </div>
                <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                  <span>{TASK_TYPE_LABEL[t.tipo]}</span>
                  {t.due_at && <span className={cn(overdue && "text-rose-500 font-medium")}>· {fmtDateTime(t.due_at)}</span>}
                  {member && <span>· {member.display_name}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
