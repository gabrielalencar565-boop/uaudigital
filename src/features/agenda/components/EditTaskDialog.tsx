import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ChevronDown, Trash2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { STAGES, type StageKey } from "@/lib/uau";
import { MemberMultiSelect } from "./MemberMultiSelect";
import { useTaskAssignees, useSetTaskAssignees } from "@/features/data/task-assignees-queries";
import { useSession } from "@/hooks/use-session";
import { useFreelancerClient } from "@/features/data/queries";
import type { TaskRow, TaskStatus, ClientRow, TeamMemberRow } from "@/features/data/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const AGENDA_STAGES = STAGES.filter((s) => s.key !== "revisao" && s.key !== "entrega");

const editTaskSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente"),
  stage: z.string().min(1),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  status: z.enum(["pendente", "em_andamento", "concluido"]),
  is_extra_demand: z.boolean().optional(),
  is_freelancer: z.boolean().optional(),
  freelancer_name: z.string().trim().max(120).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1).default(1),
  point_value: z.coerce.number().min(0).optional().or(z.literal("")).transform(v => v === "" ? undefined : v),
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
    quantity?: number;
    point_value?: number | null;
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
  const qc = useQueryClient();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const freelancerClientQ = useFreelancerClient();
  const freelancerClientId = freelancerClientQ.data?.id ?? null;

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
      is_freelancer: false,
      freelancer_name: "",
      quantity: 1,
      point_value: undefined,
    },
  });

  // Reset form when task changes
  useEffect(() => {
    if (task) {
      const isFreela = freelancerClientId ? task.client_id === freelancerClientId : false;
      form.reset({
        client_id: task.client_id,
        stage: task.stage,
        due_date: task.due_date,
        due_time: extractTime(task.due_at),
        description: task.description ?? "",
        status: task.status,
        is_extra_demand: task.is_extra_demand ?? false,
        is_freelancer: isFreela,
        freelancer_name: isFreela ? (task.title ?? "") : "",
        quantity: task.quantity ?? 1,
        point_value: task.point_value ?? undefined,
      });
    }
  }, [task, form, freelancerClientId]);

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

      const isFreela = values.is_freelancer && freelancerClientId;
      const effectiveClientId = isFreela ? freelancerClientId : values.client_id;
      const freelancerTitle = isFreela ? (values.freelancer_name || "Freelancer") : null;

      // Atualiza a tarefa (assigned_user_id = primeiro membro para compatibilidade)
      await onUpdate(task.id, {
        client_id: effectiveClientId,
        stage: values.stage as StageKey,
        assigned_user_id: selectedMembers[0],
        due_date: values.due_date,
        due_at,
        description: values.description || null,
        title: freelancerTitle,
        status: values.status,
        is_extra_demand: values.is_extra_demand ?? false,
        quantity: values.quantity ?? 1,
        point_value: values.point_value ?? null,
      });

      // Atualiza os assignees
      if (user) {
        await setAssignees.mutateAsync({
          taskId: task.id,
          userIds: selectedMembers,
          addedBy: user.id,
        });
      }

      // Recalcula pontos para todos os usuários afetados (antigos + novos)
      // em ambos os meses (caso a data tenha sido alterada)
      const previousUserIds = new Set<string>();
      if (task.assigned_user_id) previousUserIds.add(task.assigned_user_id);
      (assigneesQ.data ?? []).forEach((a) => previousUserIds.add(a.user_id));

      const allAffectedUserIds = new Set<string>([
        ...previousUserIds,
        ...selectedMembers,
      ]);

      const oldDate = task.due_date ? new Date(`${task.due_date}T00:00:00`) : null;
      const newDate = new Date(`${values.due_date}T00:00:00`);
      const periods = new Map<string, { year: number; month: number }>();
      if (oldDate) {
        const k = `${oldDate.getFullYear()}-${oldDate.getMonth() + 1}`;
        periods.set(k, { year: oldDate.getFullYear(), month: oldDate.getMonth() + 1 });
      }
      const k2 = `${newDate.getFullYear()}-${newDate.getMonth() + 1}`;
      periods.set(k2, { year: newDate.getFullYear(), month: newDate.getMonth() + 1 });

      await Promise.all(
        Array.from(allAffectedUserIds).flatMap((uid) =>
          Array.from(periods.values()).map(({ year, month }) =>
            supabase.rpc("recompute_metas_prazos", {
              _user_id: uid,
              _year: year,
              _month: month,
            }),
          ),
        ),
      );

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["performance_scores"] }),
        qc.invalidateQueries({ queryKey: ["performance_scores_metas"] }),
        qc.invalidateQueries({ queryKey: ["deadline_report_assignees"] }),
        qc.invalidateQueries({ queryKey: ["deadline_report_tasks"] }),
      ]);

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
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
            <DialogTitle>Editar tarefa</DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
          <form className="space-y-4 pt-4" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{form.watch("is_freelancer") ? "Nome do cliente freela" : "Cliente"}</Label>
                {form.watch("is_freelancer") ? (
                  <Input
                    placeholder="Ex.: João Silva Fotografia"
                    {...form.register("freelancer_name")}
                    disabled={!canManageTasks}
                  />
                ) : (
                  <Select
                    value={form.watch("client_id")}
                    onValueChange={(v) => form.setValue("client_id", v)}
                    disabled={!canManageTasks}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {clients.filter(c => !(c as any).is_freelancer_sentinel).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {!form.watch("is_freelancer") && form.formState.errors.client_id && (
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
                <DatePicker
                  value={form.watch("due_date")}
                  onChange={(v) => form.setValue("due_date", v)}
                  disabled={!canManageTasks}
                  className="w-full"
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

            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                <ChevronDown className="h-4 w-4 transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                <Label className="cursor-pointer">Descrição (opcional)</Label>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <Textarea
                  placeholder="Ex.: Captação de vídeos para o carrossel de Instagram"
                  {...form.register("description")}
                  disabled={!canManageTasks}
                  rows={3}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Quantidade - visível para Vídeo e Design */}
            {(form.watch("stage") === "edicao_videos" || form.watch("stage") === "design") && (
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  {...form.register("quantity", { valueAsNumber: true })}
                  disabled={!canManageTasks}
                  placeholder="Ex.: 6"
                />
                <p className="text-xs text-muted-foreground">
                  Pontuação: {form.watch("is_extra_demand") ? `${form.watch("quantity") || 1} × 1.5 = ${((form.watch("quantity") || 1) * 1.5).toFixed(1)} pts` : `${form.watch("quantity") || 1} × 1 = ${form.watch("quantity") || 1} pts`}
                </p>
              </div>
            )}

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

            {/* Pontos manuais - para demandas extras em etapas de social */}
            {form.watch("is_extra_demand") && !["edicao_videos", "design"].includes(form.watch("stage")) && (
              <div className="space-y-2">
                <Label>Pontos (Ajuste Estratégico)</Label>
                <Select
                  value={String(form.watch("point_value") ?? "")}
                  onValueChange={(v) => form.setValue("point_value", Number(v) as any)}
                  disabled={!canManageTasks}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="1">1 ponto</SelectItem>
                    <SelectItem value="2">2 pontos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Cliente Freela - abaixo de Demanda Extra */}
            {freelancerClientId && canManageTasks && (
              <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <Checkbox
                  id="edit_is_freelancer"
                  checked={form.watch("is_freelancer") ?? false}
                  onCheckedChange={(checked) => {
                    form.setValue("is_freelancer", !!checked);
                    if (checked) {
                      form.setValue("client_id", freelancerClientId);
                    } else {
                      form.setValue("client_id", "");
                      form.setValue("freelancer_name", "");
                    }
                  }}
                  disabled={!canManageTasks}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="edit_is_freelancer" className="cursor-pointer font-medium">
                    🎯 Cliente Freela
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Cliente freelancer que não está na lista geral
                  </p>
                </div>
              </div>
            )}

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
          </div>
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
