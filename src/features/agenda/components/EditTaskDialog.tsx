import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { STAGES, type StageKey } from "@/lib/uau";
import { MemberMultiSelect } from "./MemberMultiSelect";
import { useTaskAssignees, useSetTaskAssignees } from "@/features/data/task-assignees-queries";
import { useSession } from "@/hooks/use-session";
import type { TaskRow, TaskStatus, ClientRow, TeamMemberRow } from "@/features/data/queries";

const AGENDA_STAGES = STAGES.filter((s) => s.key !== "revisao" && s.key !== "entrega");

const editTaskSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente"),
  stage: z.string().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  status: z.enum(["pendente", "em_andamento", "concluido"]),
  is_extra_demand: z.boolean().optional(),
});

type EditTaskValues = z.infer<typeof editTaskSchema>;

interface EditTaskDialogProps {
  task: TaskRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientRow[];
  teamMembers?: TeamMemberRow[];
  isAdmin: boolean;
  canManageTasks: boolean;
  onUpdate: (taskId: string, updates: {
    client_id?: string;
    stage?: StageKey;
    assigned_user_id?: string;
    due_date?: string;
    due_at?: string | null;
    description?: string | null;
    title?: string | null;
    status?: TaskStatus;
    is_extra_demand?: boolean;
  }) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  isPending?: boolean;
}

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
  clients,
  teamMembers,
  isAdmin,
  canManageTasks,
  onUpdate,
  onDelete,
  isPending,
}: EditTaskDialogProps) {
  const { user } = useSession();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  // Busca assignees existentes da tarefa
  const assigneesQ = useTaskAssignees(task ? [task.id] : undefined);
  const setAssignees = useSetTaskAssignees();

  // Extrai horário do due_at se existir
  const extractTime = (dueAt: string | null): string => {
    if (!dueAt) return "";
    try {
      const d = new Date(dueAt);
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${hours}:${minutes}`;
    } catch {
      return "";
    }
  };

  const form = useForm<EditTaskValues>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: {
      client_id: "",
      stage: "",
      due_date: format(new Date(), "yyyy-MM-dd"),
      due_time: "",
      description: "",
      status: "pendente",
      is_extra_demand: false,
    },
  });

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      form.reset({
        client_id: task.client_id,
        stage: task.stage,
        due_date: task.due_date,
        due_time: extractTime(task.due_at),
        description: task.description ?? "",
        status: task.status,
        is_extra_demand: task.is_extra_demand ?? false,
      });
    }
  }, [task, form]);

  // Sincroniza membros selecionados quando assignees carregam
  useEffect(() => {
    if (!task) return;
    const assignees = assigneesQ.data ?? [];
    const assigneeIds = assignees.map((a) => a.user_id);
    // Se não há assignees na tabela, usa o assigned_user_id (fallback)
    if (assigneeIds.length === 0 && task.assigned_user_id) {
      setSelectedMembers([task.assigned_user_id]);
    } else {
      setSelectedMembers(assigneeIds);
    }
  }, [assigneesQ.data, task]);

  const handleSubmit = async (values: EditTaskValues) => {
    if (!task) return;
    if (selectedMembers.length === 0) {
      toast.error("Selecione ao menos um membro");
      return;
    }

    try {
      let due_at: string | null = null;
      if (values.due_time && values.due_time.match(/^\d{2}:\d{2}$/)) {
        due_at = new Date(`${values.due_date}T${values.due_time}:00`).toISOString();
      }

      // Atualiza a tarefa (assigned_user_id = primeiro membro para compatibilidade)
      await onUpdate(task.id, {
        client_id: values.client_id,
        stage: values.stage as StageKey,
        assigned_user_id: selectedMembers[0],
        due_date: values.due_date,
        due_at,
        description: values.description || null,
        title: null, // Limpa title já que usamos description agora
        status: values.status,
        is_extra_demand: values.is_extra_demand ?? false,
      });

      // Atualiza os assignees
      if (user) {
        await setAssignees.mutateAsync({
          taskId: task.id,
          userIds: selectedMembers,
          addedBy: user.id,
        });
      }

      toast.success("Tarefa atualizada!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar tarefa");
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      await onDelete(task.id);
      toast.success("Tarefa removida");
      setDeleteConfirmOpen(false);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover tarefa");
    }
  };

  if (!task) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
          </DialogHeader>

          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={form.watch("client_id")}
                  onValueChange={(v) => form.setValue("client_id", v)}
                  disabled={!canManageTasks}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.client_id && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.client_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select
                  value={form.watch("stage")}
                  onValueChange={(v) => form.setValue("stage", v)}
                  disabled={!canManageTasks}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {AGENDA_STAGES.map((s) => (
                      <SelectItem key={s.key} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.stage && (
                  <p className="text-sm text-destructive">Selecione uma etapa</p>
                )}
              </div>
            </div>

            {/* Múltiplos membros */}
            <MemberMultiSelect
              members={teamMembers ?? []}
              selectedIds={selectedMembers}
              onChange={setSelectedMembers}
              disabled={!canManageTasks}
              label="Membros da tarefa"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as TaskStatus)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  {...form.register("due_date")}
                  disabled={!canManageTasks}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Horário (opcional)</Label>
              <Input
                type="time"
                {...form.register("due_time")}
                placeholder="HH:MM"
                disabled={!canManageTasks}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Ex.: Captação de vídeos para o carrossel de Instagram"
                {...form.register("description")}
                disabled={!canManageTasks}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <Checkbox
                id="edit_is_extra_demand"
                checked={form.watch("is_extra_demand") ?? false}
                onCheckedChange={(checked) => form.setValue("is_extra_demand", !!checked)}
                disabled={!canManageTasks}
              />
              <div className="space-y-0.5">
                <Label htmlFor="edit_is_extra_demand" className="cursor-pointer font-medium">
                  Demanda Extra
                </Label>
                <p className="text-xs text-muted-foreground">
                  Não marca no Magic Number, apenas no desempenho
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              {canManageTasks && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onOpenChange(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="brand" disabled={isPending || setAssignees.isPending}>
                  {isPending || setAssignees.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta tarefa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
