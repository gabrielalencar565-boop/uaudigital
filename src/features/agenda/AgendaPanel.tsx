import { useEffect, useMemo, useState } from "react";
import { addDays, addMonths, subMonths, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Filter, TriangleAlert, Calendar, Trash2, FileText, Cake, Star } from "lucide-react";
import { z } from "zod";
import { useAgendaSpecialDates, type SpecialDate } from "@/features/agenda/hooks/use-agenda-dates";
import { ManageInternalDatesDialog, getInternalDateIcon } from "@/features/agenda/components/ManageInternalDatesDialog";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { DndContext, DragEndEvent, DragOverlay, closestCenter } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { STAGES, STAGE_COLOR, type StageKey } from "@/lib/uau";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClients, useCreateTask, useDeleteTask, useFreelancerClient, useProfiles, useSetTaskStatus, useTasks, useTeamMembers, useUpdateTask, type TaskRow } from "@/features/data/queries";
import { AgendaTaskCard } from "@/features/agenda/components/AgendaTaskCard";
import { AgendaWeekTaskItem } from "@/features/agenda/components/AgendaWeekTaskItem";
import { EditTaskDialog } from "@/features/agenda/components/EditTaskDialog";
import { MemberMultiSelect } from "@/features/agenda/components/MemberMultiSelect";
import { DraggableTaskCard } from "@/features/agenda/components/DraggableTaskCard";
import { DayDropZone } from "@/features/agenda/components/DayDropZone";
import { TaskTrashPanel } from "@/features/agenda/components/TaskTrashPanel";
import { TaskActivityReport } from "@/features/agenda/components/TaskActivityReport";
import { useAddTaskAssignees, useTaskAssigneesByMonth } from "@/features/data/task-assignees-queries";
import { useMagic2InactiveAgendaClients } from "@/features/magic2/hooks/use-magic2";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/hooks/use-session";
import { useIsMobile } from "@/hooks/use-mobile";
function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join("");
}
function monthKey(d: Date) {
  return format(d, "yyyy-MM");
}

function ymdToLocalDate(ymd: string) {
  // Evita UTC shifting (00:00Z) em alguns dispositivos
  return new Date(`${ymd}T00:00:00`);
}
function formatDueTime(dueAt: string | null): string | undefined {
  if (!dueAt) return undefined;
  try {
    const d = new Date(dueAt);
    if (isNaN(d.getTime())) return undefined;
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return undefined;
  }
}

/** Verifica se o usuário pode interagir com a tarefa (marcar/desmarcar) */
function canUserInteractWithTask(
  userId: string | undefined
): boolean {
  // Qualquer usuário autenticado pode marcar/desmarcar tarefas
  return !!userId;
}
const createTaskSchema = z.object({
  client_id: z.string().uuid("Selecione um cliente"),
  stage: z.string().min(1),
  assigned_user_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um membro"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_time: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  description: z.string().trim().max(300).optional(),
  is_extra_demand: z.boolean().optional(),
  is_freelancer: z.boolean().optional(),
  freelancer_name: z.string().trim().max(120).optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  point_value: z.coerce.number().min(0).optional().or(z.literal("")).transform(v => v === "" ? undefined : v),
});
type CreateTaskValues = z.infer<typeof createTaskSchema>;
const AGENDA_STAGES = STAGES.filter(s => s.key !== "revisao" && s.key !== "entrega");
export function AgendaPanel() {
  const {
    user
  } = useSession();
  const {
    isAdmin, canManageTasks
  } = useRole(user?.id);
  const isMobile = useIsMobile();
  const normalizeName = useMemo(() => (v: string) => v.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}+/gu, "").replace(/\s+/g, " "), []);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState<"month" | "week">("month");
  const [filterClientId, setFilterClientId] = useState<string | "all">("all");
  const [filterUserId, setFilterUserId] = useState<string | "all">("all");
  const [filterStage, setFilterStage] = useState<string | "all">("all");
  const [selectedWeekDayKey, setSelectedWeekDayKey] = useState<string | null>(null);
  const mk = monthKey(cursor);
  const freelancerClientQ = useFreelancerClient();
  const freelancerClientId = freelancerClientQ.data?.id ?? null;
  const clientsQ = useClients();
  const teamQ = useTeamMembers();
  const profilesQ = useProfiles({ enabled: !!canManageTasks });

  const weekStart = useMemo(() => startOfWeek(cursor, {
    weekStartsOn: 0
  }), [cursor]);
  const weekStartKey = useMemo(() => format(weekStart, "yyyy-MM-dd"), [weekStart]);
  const weekEndKey = useMemo(() => format(addDays(weekStart, 6), "yyyy-MM-dd"), [weekStart]);

  const weekOptions = useMemo(() => {
    const baseMonth = startOfMonth(cursor);
    const first = startOfWeek(baseMonth, { weekStartsOn: 0 });
    const lastDay = endOfMonth(baseMonth);

    const out: { key: string; label: string }[] = [];
    let i = 0;
    for (let ws = first; ws <= lastDay || i === 0; ws = addDays(ws, 7)) {
      const we = addDays(ws, 6);
      const key = format(ws, "yyyy-MM-dd");
      const label = `Semana ${i + 1} (${format(ws, "dd/MM")}–${format(we, "dd/MM")})`;
      out.push({ key, label });
      i += 1;
      if (i > 6) break; // segurança
      // se já passou do mês e já tem pelo menos 1 semana, pode parar
      if (ws > lastDay) break;
    }
    return out;
  }, [cursor]);

  // Todos os usuários veem todas as tarefas da agenda (colaboradores, planejadores e admins)
  const tasksQ = useTasks(view === "week" ? {
    start: weekStartKey,
    end: weekEndKey,
    assignedUserId: filterUserId !== "all" ? filterUserId : undefined,
    clientId: filterClientId !== "all" ? filterClientId : undefined
  } : {
    month: mk,
    assignedUserId: filterUserId !== "all" ? filterUserId : undefined,
    clientId: filterClientId !== "all" ? filterClientId : undefined
  });
  const inactiveQ = useMagic2InactiveAgendaClients(cursor.getFullYear(), cursor.getMonth() + 1);
  const tasks = useMemo(() => {
    let list = tasksQ.data ?? [];
    const inactiveAgendaIds = inactiveQ.data?.inactiveAgendaIds;
    const inactiveNames = inactiveQ.data?.inactiveNames;
    if ((inactiveAgendaIds && inactiveAgendaIds.size > 0) || (inactiveNames && inactiveNames.size > 0)) {
      const clientNameById = new Map((clientsQ.data ?? []).map(c => [c.id, c.name] as const));
      list = list.filter(t => {
        if (inactiveAgendaIds?.has(t.client_id)) return false;
        const name = clientNameById.get(t.client_id);
        if (name && inactiveNames?.has(normalizeName(name))) return false;
        return true;
      });
    }
    // Filtro por etapa
    if (filterStage !== "all") {
      list = list.filter(t => t.stage === filterStage);
    }
    return list;
  }, [clientsQ.data, inactiveQ.data, normalizeName, tasksQ.data, filterStage]);
  const clients = useMemo(() => {
    const list = clientsQ.data ?? [];
    const inactiveAgendaIds = inactiveQ.data?.inactiveAgendaIds;
    const inactiveNames = inactiveQ.data?.inactiveNames;
    if ((!inactiveAgendaIds || inactiveAgendaIds.size === 0) && (!inactiveNames || inactiveNames.size === 0)) return list;
    return list.filter(c => {
      if (inactiveAgendaIds?.has(c.id)) return false;
      if (c.name && inactiveNames?.has(normalizeName(c.name))) return false;
      return true;
    });
  }, [clientsQ.data, inactiveQ.data, normalizeName]);
  const clientNameById = useMemo(() => new Map(clients.map(c => [c.id, c.name] as const)), [clients]);

  /** Resolve client name: for freelancer tasks, show title (freelancer name) instead */
  const resolveClientName = (task: TaskRow) => {
    if (freelancerClientId && task.client_id === freelancerClientId && task.title) {
      return task.title;
    }
    return clientNameById.get(task.client_id) ?? "—";
  };
  const team = teamQ.data ?? [];
  const teamById = useMemo(() => new Map(team.map(m => [m.user_id, m] as const)), [team]);

  // Admin vê apenas responsáveis com perfil + ativos.
  const profiles = profilesQ.data ?? [];
  const activeProfiles = useMemo(() => profiles.filter((p) => teamById.has(p.user_id)), [profiles, teamById]);
  useEffect(() => {
    // Se o cliente selecionado no filtro foi removido no Magic v2, volta para "Todos"
    if (filterClientId === "all") return;
    const inactiveAgendaIds = inactiveQ.data?.inactiveAgendaIds;
    const inactiveNames = inactiveQ.data?.inactiveNames;
    const rawClients = clientsQ.data ?? [];
    const selected = rawClients.find(c => c.id === filterClientId);
    if (!selected) return;
    const removed = (inactiveAgendaIds?.has(selected.id) ?? false) || (selected.name ? inactiveNames?.has(normalizeName(selected.name)) ?? false : false);
    if (removed) setFilterClientId("all");
  }, [clientsQ.data, filterClientId, inactiveQ.data, normalizeName]);
  const profilesById = useMemo(() => new Map(profiles.map(p => [p.user_id, p] as const)), [profiles]);

  // Busca múltiplos assignees por tarefa
  const assigneesQ = useTaskAssigneesByMonth(mk);
  const assigneesByTaskId = useMemo(() => {
    const map = new Map<string, { user_id: string; display_name: string; avatar_url?: string | null }[]>();
    for (const a of assigneesQ.data ?? []) {
      const member = teamById.get(a.user_id);
      if (!member) continue;
      const prev = map.get(a.task_id) ?? [];
      prev.push({
        user_id: a.user_id,
        display_name: member.display_name,
        avatar_url: member.avatar_url,
      });
      map.set(a.task_id, prev);
    }
    return map;
  }, [assigneesQ.data, teamById]);
  const createTask = useCreateTask();
  const addTaskAssignees = useAddTaskAssignees();
  const deleteTask = useDeleteTask();
  const setTaskStatus = useSetTaskStatus();
  const updateTask = useUpdateTask();
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDayKey, setDeleteDayKey] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreDayKey, setMoreDayKey] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<TaskRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Special dates (holidays, birthdays, internal recurring)
  const specialDatesMap = useAgendaSpecialDates(
    cursor.getFullYear(),
    cursor.getMonth() + 1,
    team.map((m) => ({ user_id: m.user_id, display_name: m.display_name, birth_date: m.birth_date ?? null }))
  );

  const form = useForm<CreateTaskValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      client_id: "",
      stage: "",
      assigned_user_ids: [],
      due_date: format(new Date(), "yyyy-MM-dd"),
      due_time: "",
      description: "",
      is_extra_demand: false,
      is_freelancer: false,
      freelancer_name: "",
      quantity: 1,
      point_value: undefined,
    }
  });
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), {
      weekStartsOn: 0
    });
    const end = endOfMonth(cursor);
    const out: Date[] = [];
    let d = start;
    while (d <= end || out.length % 7 !== 0) {
      out.push(d);
      d = addDays(d, 1);
      if (out.length >= 42) break;
    }
    return out;
  }, [cursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const t of tasks) {
      const key = t.due_date;
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, t]);
    }
    return map;
  }, [tasks]);
  const todayKey = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (view !== "week") return;
    const keys = weekDays.map((d) => format(d, "yyyy-MM-dd"));
    const next = keys.includes(todayKey) ? todayKey : keys[0] ?? null;
    setSelectedWeekDayKey(next);
  }, [todayKey, view, weekDays]);

  const overdueCount = tasks.filter(t => t.status !== "concluido" && t.due_date < todayKey).length;
  const dueTodayCount = tasks.filter(t => t.status !== "concluido" && t.due_date === todayKey).length;
  const onCreateTask = async (v: CreateTaskValues) => {
    if (!user) return;
    try {
      // Handle freelancer: override client_id and set title
      const isFreela = v.is_freelancer && freelancerClientId;
      const effectiveClientId = isFreela ? freelancerClientId : v.client_id;
      const freelancerTitle = isFreela ? (v.freelancer_name || "Freelancer") : null;

      if (!isFreela && !v.client_id) {
        toast.error("Selecione um cliente");
        return;
      }

      // Bloqueia criação se o cliente estiver removido do Magic v2 no mês/ano da tarefa
      if (!isFreela) {
        const [yy, mm] = String(v.due_date).split("-");
        const y = Number(yy);
        const m = Number(mm);
        if (y && m) {
          let inactiveData = inactiveQ.data;
          if (y !== cursor.getFullYear() || m !== cursor.getMonth() + 1) {
            const res = await supabase.from("magic2_cycles").select("is_active, magic2_clients ( id, name, magic2_client_links ( agenda_client_id ) )").eq("year", y).eq("month", m);
            if (res.error) throw res.error;
            const inactiveAgendaIds = new Set<string>();
            const inactiveNames = new Set<string>();
            for (const row of res.data ?? []) {
              if ((row as any).is_active !== false) continue;
              const name = String((row as any).magic2_clients?.name ?? "").trim();
              if (name) inactiveNames.add(normalizeName(name));
              const linksRaw = (row as any).magic2_clients?.magic2_client_links;
              if (Array.isArray(linksRaw)) {
                for (const l of linksRaw) {
                  const agendaId = l?.agenda_client_id as string | undefined;
                  if (agendaId) inactiveAgendaIds.add(agendaId);
                }
              } else {
                const agendaId = linksRaw?.agenda_client_id as string | undefined;
                if (agendaId) inactiveAgendaIds.add(agendaId);
              }
            }
            inactiveData = {
              inactiveAgendaIds,
              inactiveNames
            };
          }
          const clientName = (clientsQ.data ?? []).find(c => c.id === v.client_id)?.name;
          if (inactiveData?.inactiveAgendaIds?.has(v.client_id) || clientName && inactiveData?.inactiveNames?.has(normalizeName(clientName))) {
            toast.error("Cliente removido do Magic v2 neste mês — não é possível criar tarefas na Agenda.");
            return;
          }
        }
      }
      // Calcula due_at se horário foi fornecido
      let due_at: string | null = null;
      if (v.due_time && v.due_time.match(/^\d{2}:\d{2}$/)) {
        due_at = new Date(`${v.due_date}T${v.due_time}:00`).toISOString();
      }
      // Usa o primeiro membro como assigned_user_id (compatibilidade)
      const primaryUserId = v.assigned_user_ids[0];
      const result = await createTask.mutateAsync({
        client_id: effectiveClientId,
        stage: v.stage as StageKey,
        assigned_user_id: primaryUserId,
        due_date: v.due_date,
        due_at,
        title: freelancerTitle,
        description: v.description ?? null,
        created_by: user.id,
        is_extra_demand: v.is_extra_demand ?? false,
        quantity: v.quantity ?? 1,
        point_value: v.point_value ?? null,
      } as any);
      
      // Adiciona todos os membros na tabela task_assignees
      if (result?.id && v.assigned_user_ids.length > 0) {
        await addTaskAssignees.mutateAsync({
          taskId: result.id,
          userIds: v.assigned_user_ids,
          addedBy: user.id,
        });
      }
      
      toast.success("Tarefa criada. Ritmo mantido! ✨");
      setOpen(false);
      form.reset();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar tarefa");
    }
  };
  const toggleComplete = async (taskId: string, next: "pendente" | "em_andamento" | "concluido") => {
    if (!user) return;
    try {
      await setTaskStatus.mutateAsync({
        taskId,
        status: next,
        userId: user.id
      });
      if (next === "concluido") toast.success("Concluída! ✔ Atualizamos o cliente automaticamente.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar tarefa");
    }
  };
  const openCreateForDay = (day: string) => {
    form.setValue("due_date", day);
    setOpen(true);
  };
  const openDeleteForDay = (day: string) => {
    setDeleteDayKey(day);
    setDeleteOpen(true);
  };
  const openMoreForDay = (day: string) => {
    setMoreDayKey(day);
    setMoreOpen(true);
  };
  const onDeleteTask = async (taskId: string) => {
    if (!user?.id) {
      toast.error("Usuário não autenticado");
      return;
    }
    try {
      await deleteTask.mutateAsync({
        taskId,
        userId: user.id
      });
      toast.success("Tarefa movida para lixeira");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover tarefa");
    }
  };
  const openEditTask = (task: TaskRow) => {
    setEditTask(task);
    setEditOpen(true);
  };
  const handleUpdateTask = async (taskId: string, updates: any) => {
    await updateTask.mutateAsync({ taskId, updates });
  };

  // Drag and drop handler
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const activeTask = useMemo(() => {
    if (!activeTaskId) return null;
    return tasks.find(t => t.id === activeTaskId) ?? null;
  }, [activeTaskId, tasks]);

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveTaskId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;
    
    const taskId = String(active.id);
    const newDate = String(over.id);
    
    // Se o dia é o mesmo, não faz nada
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.due_date === newDate) return;
    
    try {
      await updateTask.mutateAsync({
        taskId,
        updates: { due_date: newDate },
      });
      toast.success("Tarefa movida!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao mover tarefa");
    }
  };

  return <DndContext
    collisionDetection={closestCenter}
    onDragStart={handleDragStart}
    onDragEnd={handleDragEnd}
  >
    <div className="space-y-6">
      {/* Title row */}
      <div className="flex items-center justify-between opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <h2 className="text-2xl font-bold tracking-tight">Agenda de projetos</h2>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setReportOpen(true)} className="gap-2 rounded-xl">
              <FileText className="h-4 w-4" /> Relatório
            </Button>
          )}
          {canManageTasks && (
            <Button variant="outline" size="sm" onClick={() => setTrashOpen(true)} className="gap-2 rounded-xl">
              <Trash2 className="h-4 w-4" /> Lixeira
            </Button>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="text-sm font-semibold">{overdueCount}</span>
          </div>
        </div>
      </div>

      {/* Dialog do relatório de atividades */}
      {isAdmin && (
        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
            <TaskActivityReport onClose={() => setReportOpen(false)} />
          </DialogContent>
        </Dialog>
      )}


      {/* Dialog da lixeira */}
      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 overflow-hidden">
          <TaskTrashPanel onClose={() => setTrashOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog de criar tarefa (abrirá via botão + no dia) */}
      {canManageTasks && <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-0 shrink-0">
              <DialogTitle>Criar tarefa</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <form className="space-y-4 pt-4" onSubmit={form.handleSubmit(onCreateTask)}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{form.watch("is_freelancer") ? "Nome do cliente freela" : "Cliente"}</Label>
                  {form.watch("is_freelancer") ? (
                    <Input
                      placeholder="Ex.: João Silva Fotografia"
                      {...form.register("freelancer_name")}
                      autoFocus
                    />
                  ) : (
                    <Select onValueChange={v => form.setValue("client_id", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {clients.filter(c => !c.is_freelancer_sentinel).map(c => <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {!form.watch("is_freelancer") && form.formState.errors.client_id && <p className="text-sm text-danger">{form.formState.errors.client_id.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Etapa</Label>
                  <Select onValueChange={v => form.setValue("stage", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {AGENDA_STAGES.map(s => <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.stage && <p className="text-sm text-danger">Selecione uma etapa</p>}
                  {!form.watch("is_extra_demand") && (() => {
                    const s = form.watch("stage");
                    const pts = s === "planejamento" ? "4 pts" : s === "pdf" ? "2 pts" : s === "captacao" ? "1.5 pts" : s === "revisao" || s === "entrega" ? "1 pt" : null;
                    return pts ? <p className="text-xs text-muted-foreground">Pontuação fixa: {pts}</p> : null;
                  })()}
                </div>
              </div>

              {/* Múltiplos membros */}
              <MemberMultiSelect
                members={team}
                selectedIds={form.watch("assigned_user_ids")}
                onChange={(ids) => form.setValue("assigned_user_ids", ids)}
                disabled={!canManageTasks}
                label="Membros da tarefa"
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <DatePicker value={form.watch("due_date")} onChange={(v) => form.setValue("due_date", v)} className="w-full" />
                </div>

                <div className="space-y-2">
                  <Label>Horário (opcional)</Label>
                  <Input type="time" {...form.register("due_time")} placeholder="HH:MM" />
                </div>
              </div>

              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180 [&[data-state=open]]:rotate-180" />
                  <Label className="cursor-pointer">Descrição (opcional)</Label>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <Textarea 
                    placeholder="Ex.: Captação de vídeos para o carrossel de Instagram" 
                    {...form.register("description")}
                    rows={2}
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
                    placeholder="Ex.: 6"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pontuação: {form.watch("is_extra_demand") ? `${form.watch("quantity") || 1} × 1.5 = ${((form.watch("quantity") || 1) * 1.5).toFixed(1)} pts` : `${form.watch("quantity") || 1} × 1 = ${form.watch("quantity") || 1} pts`}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                <Checkbox
                  id="is_extra_demand"
                  checked={form.watch("is_extra_demand") ?? false}
                  onCheckedChange={(checked) => form.setValue("is_extra_demand", !!checked)}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="is_extra_demand" className="cursor-pointer font-medium">
                    Demanda Extra
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Não marca no Magic Number, apenas no desempenho
                  </p>
                </div>
              </div>

              {/* Pontos manuais - visível para demandas extras em etapas de social */}
              {form.watch("is_extra_demand") && !["edicao_videos", "design"].includes(form.watch("stage")) && (
                <div className="space-y-2">
                  <Label>Pontos (Ajuste Estratégico)</Label>
                  <Select
                    value={String(form.watch("point_value") ?? "")}
                    onValueChange={(v) => form.setValue("point_value", Number(v) as any)}
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
              {freelancerClientId && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <Checkbox
                    id="is_freelancer"
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
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="is_freelancer" className="cursor-pointer font-medium">
                      🎯 Cliente Freela
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Cliente freelancer que não está na lista geral
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="submit" variant="brand" disabled={createTask.isPending}>
                  {createTask.isPending ? "Criando..." : "Criar"}
                </Button>
              </DialogFooter>
            </form>
            </div>
          </DialogContent>
        </Dialog>}

      {/* Dialog de remover tarefa (abrirá via botão - no dia) */}
      {canManageTasks && <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Remover tarefa</DialogTitle>
            </DialogHeader>

            <div className="space-y-2">
              {(deleteDayKey ? tasksByDay.get(deleteDayKey) ?? [] : []).length ? (deleteDayKey ? tasksByDay.get(deleteDayKey) ?? [] : []).map(t => <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/20 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{t.title ?? STAGES.find(s => s.key === t.stage)?.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.assigned_user_id}</p>
                    </div>
                    <Button type="button" variant="destructive" size="sm" disabled={deleteTask.isPending} onClick={() => onDeleteTask(t.id)}>
                      Remover
                    </Button>
                  </div>) : <p className="text-sm text-muted-foreground">Nenhuma tarefa nesse dia.</p>}
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>}

      {/* Dialog de ver mais tarefas (no grid mensal) */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {moreDayKey ? format(new Date(`${moreDayKey}T00:00:00`), "dd/MM · EEEE", {
                locale: ptBR,
              }) : "Tarefas"}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {(moreDayKey ? tasksByDay.get(moreDayKey) ?? [] : []).length ? (moreDayKey ? tasksByDay.get(moreDayKey) ?? [] : []).map(t => {
              const stageLabel = STAGES.find(s => s.key === t.stage)?.label ?? "Etapa";
              const assignee = teamById.get(t.assigned_user_id);
              const assigneeName = assignee?.display_name ?? "—";
              const clientName = resolveClientName(t);
              const canInteract = canUserInteractWithTask(user?.id);
              const members = assigneesByTaskId.get(t.id) ?? [];

              return <AgendaWeekTaskItem key={t.id} stageLabel={stageLabel} stage={t.stage} done={t.status === "concluido"} assigneeName={assigneeName} assigneeAvatarUrl={assignee?.avatar_url ?? undefined} members={members} clientName={clientName} dueTime={formatDueTime(t.due_at)} density="default" isExtraDemand={t.is_extra_demand} canInteract={canInteract} canDelete={!!canManageTasks} onToggle={() => {
                const next = t.status === "concluido" ? "pendente" : "concluido";
                toggleComplete(t.id, next);
              }} onDelete={() => onDeleteTask(t.id)} onClick={() => canManageTasks && openEditTask(t)} />;
            }) : <p className="text-sm text-muted-foreground">Nenhuma tarefa nesse dia.</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setMoreOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de edição de tarefa */}
      <EditTaskDialog
        task={editTask}
        open={editOpen}
        onOpenChange={setEditOpen}
        clients={clients}
        teamMembers={team}
        isAdmin={!!isAdmin}
        canManageTasks={!!canManageTasks}
        onUpdate={handleUpdateTask}
        onDelete={onDeleteTask}
        isPending={updateTask.isPending || deleteTask.isPending}
      />

      {isMobile ?
    // Modo lista para mobile (versão ampla/reduzida)
    <Card>
          <CardHeader className="space-y-3">
            <div>
              <CardTitle className="text-base">{format(cursor, "MMMM 'de' yyyy", {
              locale: ptBR
            })}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Filtros
              </CardDescription>
            </div>

            <Tabs value={view} onValueChange={v => setView(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="month" className="flex-1">Mês</TabsTrigger>
                <TabsTrigger value="week" className="flex-1">Semana</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setCursor(d => startOfMonth(subMonths(d, 1)))}>
                ←
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCursor(d => startOfMonth(addMonths(d, 1)))}>
                →
              </Button>

              {view === "week" ? (
                <Select
                  value={weekStartKey}
                  onValueChange={(v) => {
                    setCursor(ymdToLocalDate(v));
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Semana" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {weekOptions.map((w) => (
                      <SelectItem key={w.key} value={w.key}>
                        {w.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Select value={filterClientId} onValueChange={v => setFilterClientId(v as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Todos</SelectItem>
                  {clients.filter(c => !c.is_freelancer_sentinel).map(c => <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterUserId} onValueChange={v => setFilterUserId(v as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Todos</SelectItem>
                  {team.filter(m => m.is_active).map(m => <SelectItem key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterStage} onValueChange={v => setFilterStage(v as any)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Todas etapas</SelectItem>
                  {AGENDA_STAGES.map(s => <SelectItem key={s.key} value={s.key}>
                      {s.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {view === "week" ? <div className="-mx-6 overflow-x-auto px-6">
                <div className="flex gap-3">
                  {weekDays.map(d => {
            const key = format(d, "yyyy-MM-dd");
              const dayTasks = tasksByDay.get(key) ?? [];
              const selected = selectedWeekDayKey ? key === selectedWeekDayKey : key === todayKey;
              const mobileWeekSpecialDates = specialDatesMap.get(key) ?? [];
              const dow = format(d, "EEEE", {
                locale: ptBR
              });
              const dowTitle = dow ? dow.charAt(0).toUpperCase() + dow.slice(1) : "";
              return <button key={key} type="button" onClick={() => setSelectedWeekDayKey(key)} className={cn("min-w-[240px] max-w-[260px] flex-1 rounded-xl border border-border/60 bg-card/10 p-4 text-left shadow-sm transition", selected && "border-primary ring-2 ring-primary/40")}> 
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{dowTitle}</p>
                            <p className={cn("mt-1 text-4xl font-semibold leading-none tracking-tight", selected && "text-primary")}>{format(d, "dd")}</p>
                          </div>
                          {canManageTasks ? <span className="flex items-center gap-2">
                              <button type="button" className="grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-background/70 text-base leading-none text-foreground shadow-sm transition hover:bg-accent" onClick={e => {
                      e.stopPropagation();
                      openCreateForDay(key);
                    }} aria-label="Adicionar tarefa" title="Adicionar">
                                +
                              </button>
                            </span> : null}
                        </div>

                        <div className="mt-4 space-y-2">
                          {dayTasks.length ? dayTasks.map(t => {
                    const stageLabel = STAGES.find(s => s.key === t.stage)?.label ?? "Etapa";
                    const assignee = teamById.get(t.assigned_user_id);
                    const assigneeName = assignee?.display_name ?? "—";
                    const clientName = resolveClientName(t);
                    const canInteract = canUserInteractWithTask(user?.id);
                    const members = assigneesByTaskId.get(t.id) ?? [];
                    return <AgendaWeekTaskItem key={t.id} stageLabel={stageLabel} stage={t.stage} done={t.status === "concluido"} assigneeName={assigneeName} assigneeAvatarUrl={assignee?.avatar_url ?? undefined} members={members} clientName={clientName} dueTime={formatDueTime(t.due_at)} isExtraDemand={t.is_extra_demand} canInteract={canInteract} canDelete={!!canManageTasks} onToggle={() => {
                      const next = t.status === "concluido" ? "pendente" : "concluido";
                      toggleComplete(t.id, next);
                    }} onDelete={() => {
                      onDeleteTask(t.id);
                    }} onClick={() => canManageTasks && openEditTask(t)} />;
                  }) : <div className="grid min-h-[140px] place-items-center rounded-lg border border-border/60 bg-card/10 p-6">
                              <p className="text-sm text-muted-foreground">Sem tarefas</p>
                            </div>}
                        </div>
                      </button>;
            })}
                </div>
              </div> : (days.filter(d => d.getMonth() === cursor.getMonth())).map(d => {
          const key = format(d, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) ?? [];
          const hasOverdue = key < todayKey && dayTasks.some(t => t.status !== "concluido");
          if (!dayTasks.length) return null;
          return <div key={key} className={cn("space-y-2 rounded-lg border border-border/60 bg-card/10 p-3", hasOverdue && "ring-1 ring-danger/40")}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          {format(d, "dd/MM")} · {format(d, "EEEE", {
                    locale: ptBR
                  })}
                        </p>
                      </div>
                      <Badge variant={hasOverdue ? "destructive" : "secondary"} className="text-xs">
                        {dayTasks.length}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {dayTasks.map(t => {
                        const stageLabel = STAGES.find(s => s.key === t.stage)?.label ?? "Etapa";
                        const assignee = teamById.get(t.assigned_user_id);
                        const assigneeName = assignee?.display_name ?? "—";
                        const clientName = resolveClientName(t);
                        const canInteract = canUserInteractWithTask(user?.id);
                        const members = assigneesByTaskId.get(t.id) ?? [];

                        return <AgendaWeekTaskItem key={t.id} stageLabel={stageLabel} stage={t.stage} done={t.status === "concluido"} assigneeName={assigneeName} assigneeAvatarUrl={assignee?.avatar_url ?? undefined} members={members} clientName={clientName} dueTime={formatDueTime(t.due_at)} density="default" isExtraDemand={t.is_extra_demand} canInteract={canInteract} canDelete={!!canManageTasks} onToggle={() => {
                          const next = t.status === "concluido" ? "pendente" : "concluido";
                          toggleComplete(t.id, next);
                        }} onDelete={() => onDeleteTask(t.id)} onClick={() => canManageTasks && openEditTask(t)} />;
                      })}
                    </div>

                    {canManageTasks ? <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => openCreateForDay(key)}>
                          + Adicionar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openDeleteForDay(key)}>
                          Remover
                        </Button>
                      </div> : null}
                  </div>;
        })}

            {view !== "week" && tasks.length === 0 ? <div className="rounded-lg border border-border/60 bg-card/10 p-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma tarefa neste mês.</p>
              </div> : null}
          </CardContent>
        </Card> :
    // Desktop: grid de calendário (versão compacta original)
    <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-5 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}>
        <div className="space-y-4 mb-5">
          {/* Row 1: Mês/Semana toggle + Month nav + week selector */}
          <div className="flex flex-wrap items-center gap-4">
            <Tabs value={view} onValueChange={v => setView(v as any)}>
              <TabsList className="bg-muted/40 h-10 p-1 rounded-full gap-1">
                <TabsTrigger value="month" className="h-8 rounded-full text-sm data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md px-5 transition-all">Mês</TabsTrigger>
                <TabsTrigger value="week" className="h-8 rounded-full text-sm data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-md px-5 transition-all">Semana</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => startOfMonth(subMonths(d, 1)))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-base font-bold capitalize min-w-[160px] text-center">
                {format(cursor, "MMMM yyyy", { locale: ptBR })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => startOfMonth(addMonths(d, 1)))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {view === "week" && (
              <Select value={weekStartKey} onValueChange={(v) => setCursor(ymdToLocalDate(v))}>
                <SelectTrigger className="h-9 w-[220px] rounded-xl text-sm">
                  <SelectValue placeholder="Semana" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {weekOptions.map((w) => (
                    <SelectItem key={w.key} value={w.key}>{w.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select value={filterClientId} onValueChange={v => setFilterClientId(v as any)}>
                <SelectTrigger className="h-9 w-44 rounded-xl text-sm bg-muted/30 border-border/30">
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {clients.filter(c => !c.is_freelancer_sentinel).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterUserId} onValueChange={v => setFilterUserId(v as any)}>
                <SelectTrigger className="h-9 w-48 rounded-xl text-sm bg-muted/30 border-border/30">
                  <SelectValue placeholder="Toda a equipe" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Toda a equipe</SelectItem>
                  {team.filter(m => m.is_active).map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={m.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials(m.display_name)}</AvatarFallback>
                        </Avatar>
                        {m.display_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStage} onValueChange={v => setFilterStage(v as any)}>
                <SelectTrigger className="h-9 w-44 rounded-xl text-sm bg-muted/30 border-border/30">
                  <SelectValue placeholder="Todas as etapas" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Todas as etapas</SelectItem>
                  {AGENDA_STAGES.map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div>
          {view === "week" ? <div className="overflow-x-auto pb-4">
              {/* Grid horizontal com colunas mais largas */}
              <div className="flex gap-4 min-w-max">
                {weekDays.map(d => {
            const key = format(d, "yyyy-MM-dd");
            const dayTasks = tasksByDay.get(key) ?? [];
            const selected = selectedWeekDayKey ? key === selectedWeekDayKey : key === todayKey;
            const dow = format(d, "EEEE", {
              locale: ptBR
            });
            const dowTitle = dow ? dow.charAt(0).toUpperCase() + dow.slice(1) : "";
            const isToday = key === todayKey;
            const weekSpecialDates = specialDatesMap.get(key) ?? [];
            
            return <div 
              key={key} 
              className={cn(
                "w-[280px] flex-shrink-0 rounded-xl border bg-card/10 p-4 transition",
                selected && "border-primary ring-2 ring-primary/40",
                !selected && "border-border/60",
                isToday && !selected && "border-primary/50"
              )}
            > 
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", isToday && "text-primary")}>{dowTitle}</p>
                  <p className={cn(
                    "mt-1 text-3xl font-semibold leading-none tracking-tight",
                    selected && "text-primary",
                    isToday && !selected && "text-primary/80"
                  )}>
                    {format(d, "dd")}
                  </p>
                  {dayTasks.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {dayTasks.filter(t => t.status === "concluido").length}/{dayTasks.length} concluída(s)
                    </p>
                  )}
                </div>
                {canManageTasks ? <span className="flex items-center gap-2">
                    <button type="button" className="grid h-8 w-8 place-items-center rounded-md border border-border/60 bg-background/70 text-lg leading-none text-foreground shadow-sm transition hover:bg-accent" onClick={e => {
                    e.stopPropagation();
                    openCreateForDay(key);
                  }} aria-label="Adicionar tarefa" title="Adicionar">
                      +
                    </button>
                  </span> : null}
              </div>

              {/* Special dates in week view */}
              {weekSpecialDates.length > 0 && (
                <div className="space-y-1 mb-3">
                  {weekSpecialDates.map((sd, idx) => {
                    if (sd.type === "birthday") {
                      return (
                        <div key={`wsd-${idx}`} className="flex items-center gap-1.5 rounded-lg bg-warning/10 px-2 py-1.5">
                          <Cake className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                          <span className="text-xs font-medium text-warning">{sd.personName}</span>
                        </div>
                      );
                    }
                    if (sd.type === "holiday") {
                      return (
                        <div key={`wsd-${idx}`} className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5">
                          <Star className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                          <span className="text-xs font-medium text-primary">{sd.label}</span>
                        </div>
                      );
                    }
                    const WIcon = getInternalDateIcon(sd.icon ?? "calendar");
                    return (
                      <div key={`wsd-${idx}`} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: (sd.color ?? "#7C5CFF") + "15" }}>
                        <WIcon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: sd.color }} />
                        <span className="text-xs font-medium" style={{ color: sd.color }}>{sd.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Lista de tarefas com mais espaço */}
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {dayTasks.length ? dayTasks.map(t => {
                  const stageLabel = STAGES.find(s => s.key === t.stage)?.label ?? "Etapa";
                  const assignee = teamById.get(t.assigned_user_id);
                  const assigneeName = assignee?.display_name ?? "—";
                  const clientName = resolveClientName(t);
                  const canInteract = canUserInteractWithTask(user?.id);
                  const members = assigneesByTaskId.get(t.id) ?? [];
                  
                  return <AgendaWeekTaskItem 
                    key={t.id} 
                    stageLabel={stageLabel} 
                    stage={t.stage} 
                    done={t.status === "concluido"} 
                    assigneeName={assigneeName} 
                    assigneeAvatarUrl={assignee?.avatar_url ?? undefined} 
                    members={members}
                    clientName={clientName} 
                    dueTime={formatDueTime(t.due_at)} 
                    density="default"
                    isExtraDemand={t.is_extra_demand}
                    canInteract={canInteract} 
                    canDelete={!!canManageTasks} 
                    onToggle={() => {
                      const next = t.status === "concluido" ? "pendente" : "concluido";
                      toggleComplete(t.id, next);
                    }} 
                    onDelete={() => onDeleteTask(t.id)} 
                    onClick={() => canManageTasks && openEditTask(t)} 
                  />;
                }) : (
                  <div className="grid min-h-[120px] place-items-center rounded-lg border border-dashed border-border/60 bg-card/5 p-4">
                    <p className="text-sm text-muted-foreground">Sem tarefas</p>
                  </div>
                )}
              </div>
            </div>;
          })}
              </div>
            </div> : <>
              <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <div key={d} className="px-2 py-1">
                    {d}
                  </div>)}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-2">
                {days.map(d => {
                  const key = format(d, "yyyy-MM-dd");
                  const inMonth = d.getMonth() === cursor.getMonth();
                  const dayTasks = tasksByDay.get(key) ?? [];
                  const hasOverdue = key < todayKey && dayTasks.some(t => t.status !== "concluido");
                  const specialDates = specialDatesMap.get(key) ?? [];
                  const hasHoliday = specialDates.some((s) => s.type === "holiday");
                  
                  return (
                    <DayDropZone key={key} dayKey={key} isToday={key === todayKey} disabled={!canManageTasks}>
                      <div className={cn(
                        "relative min-h-28 rounded-xl border border-border/40 bg-card/20 p-2 transition calendar-card-hover",
                        inMonth ? "opacity-100" : "opacity-50",
                        hasOverdue && "ring-1 ring-danger/40",
                        hasHoliday && "bg-primary/5 border-primary/30"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className={cn(
                            "relative grid h-8 w-8 place-items-center rounded-full border border-border/60 bg-background/60 text-xs",
                            key === todayKey ? "text-primary" : "text-muted-foreground"
                          )} aria-label={`Dia ${format(d, "d")}`}>
                            <span>{format(d, "d")}</span>
                          </div>
                          {dayTasks.length ? (
                            <Badge variant={hasOverdue ? "destructive" : "secondary"} className="px-2">
                              {dayTasks.length}
                            </Badge>
                          ) : null}
                        </div>

                        {canManageTasks && (
                          <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
                            <button
                              type="button"
                              className="grid h-6 w-6 place-items-center rounded-md border border-border/60 bg-background/80 text-xs leading-none text-foreground shadow-sm transition hover:bg-accent"
                              onClick={() => openCreateForDay(key)}
                              title="Adicionar tarefa"
                              aria-label="Adicionar tarefa"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              className="grid h-6 w-6 place-items-center rounded-md border border-border/60 bg-background/80 text-xs leading-none text-foreground shadow-sm transition hover:bg-accent"
                              onClick={() => openDeleteForDay(key)}
                              title="Remover tarefa"
                              aria-label="Remover tarefa"
                            >
                              -
                            </button>
                          </div>
                        )}

                        {/* Special dates: holidays, birthdays, internal */}
                        {specialDates.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {specialDates.map((sd, idx) => {
                              if (sd.type === "birthday") {
                                return (
                                  <div key={`sd-${idx}`} className="flex items-center gap-1 rounded-md bg-warning/10 px-1.5 py-0.5">
                                    <Cake className="h-3 w-3 text-warning flex-shrink-0" />
                                    <span className="text-[10px] font-medium text-warning truncate">{sd.personName}</span>
                                  </div>
                                );
                              }
                              if (sd.type === "holiday") {
                                return (
                                  <div key={`sd-${idx}`} className="flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5">
                                    <Star className="h-3 w-3 text-primary flex-shrink-0" />
                                    <span className="text-[10px] font-medium text-primary truncate">{sd.label}</span>
                                  </div>
                                );
                              }
                              // internal
                              const InternalIcon = getInternalDateIcon(sd.icon ?? "calendar");
                              return (
                                <div key={`sd-${idx}`} className="flex items-center gap-1 rounded-md px-1.5 py-0.5" style={{ backgroundColor: (sd.color ?? "#7C5CFF") + "15" }}>
                                  <InternalIcon className="h-3 w-3 flex-shrink-0" style={{ color: sd.color }} />
                                  <span className="text-[10px] font-medium truncate" style={{ color: sd.color }}>{sd.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="mt-2 space-y-2">
                          {dayTasks.slice(0, 4).map(t => {
                            const stageLabel = t.stage === "planejamento" ? "Planej." : STAGES.find(s => s.key === t.stage)?.label ?? "Etapa";
                            const assignee = teamById.get(t.assigned_user_id);
                            const assigneeName = assignee?.display_name ?? "—";
                            const clientName = resolveClientName(t);
                            const canInteract = canUserInteractWithTask(user?.id);
                            const members = assigneesByTaskId.get(t.id) ?? [];

                            return (
                              <DraggableTaskCard
                                key={t.id}
                                task={t}
                                stageLabel={stageLabel}
                                done={t.status === "concluido"}
                                assigneeName={assigneeName}
                                assigneeAvatarUrl={assignee?.avatar_url ?? undefined}
                                members={members}
                                clientName={clientName}
                                dueTime={formatDueTime(t.due_at)}
                                canInteract={canInteract}
                                canDelete={!!canManageTasks}
                                canDrag={!!canManageTasks}
                                onToggle={() => {
                                  const next = t.status === "concluido" ? "pendente" : "concluido";
                                  toggleComplete(t.id, next);
                                }}
                                onDelete={() => onDeleteTask(t.id)}
                                onClick={() => canManageTasks && openEditTask(t)}
                              />
                            );
                          })}
                          {dayTasks.length > 4 && (
                            <button
                              type="button"
                              className="w-full rounded-md border border-border/60 bg-background/50 px-2 py-1 text-left text-[10px] text-muted-foreground transition hover:bg-accent"
                              onClick={() => openMoreForDay(key)}
                            >
                              +{dayTasks.length - 4} mais
                            </button>
                          )}
                        </div>
                      </div>
                    </DayDropZone>
                  );
                })}
              </div>
            </>}
        </div>
      </div>}
    </div>
  </DndContext>;
}