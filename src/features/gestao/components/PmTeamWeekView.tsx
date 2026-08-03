import { useMemo, useState } from "react";
import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, GripVertical, Plus } from "lucide-react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { cn } from "@/lib/utils";
import { useTasks, useTeamMembers } from "@/features/data/queries";
import { useTaskAssigneesByMonth } from "@/features/data/task-assignees-queries";
import { useUpdatePmTask } from "../hooks/use-pm-data";
import { isPeriodicStageKey } from "../hooks/use-periodic-stages";
import { getStageCircleColor, stageLabel } from "../pm-constants";
import type { PmTask } from "../pm-types";

const WEEKDAY_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

interface Assignee {
  id: string;
  name: string;
  avatar?: string;
}

interface Props {
  tasks: PmTask[];
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (t: PmTask) => void;
  onAddClick: (userId: string, dayKey: string) => void;
  filterClient: string;
  filterAssignee: string;
  filterStage: string;
  search: string;
}

function getTaskAssignees(task: PmTask, membersMap: Record<string, { name: string; avatar?: string }>): Assignee[] {
  const ids = Array.from(new Set([task.assignee_id, ...(task.watchers ?? [])].filter((id): id is string => Boolean(id))));
  return ids
    .map((id) => ({ id, ...membersMap[id] }))
    .filter((m): m is Assignee => Boolean(m.name));
}

function isTaskDone(t: PmTask) {
  return t.status_global === "concluido" || t.stage_current === "entrega";
}

function TaskCard({ task, clientsMap, todayKey, onClick, dragHandleProps, isDragging }: {
  task: PmTask;
  clientsMap: Record<string, string>;
  todayKey: string;
  onClick: () => void;
  dragHandleProps?: { listeners?: any; attributes?: any; setActivatorNodeRef?: (el: HTMLElement | null) => void };
  isDragging?: boolean;
}) {
  const color = getStageCircleColor(task.stage_current);
  const done = isTaskDone(task);
  const overdue = !done && !!task.due_date && task.due_date < todayKey;
  const draggable = !task.id.startsWith("legacy_");

  return (
    <div
      className={cn(
        "group relative w-full rounded-lg border pl-1.5 pr-1.5 py-1 text-[11px] leading-tight transition-colors",
        done
          ? "bg-success border-success text-success-foreground"
          : overdue
          ? "bg-destructive border-destructive text-destructive-foreground"
          : "border-border/30 hover:bg-muted/60",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1">
        {draggable && (
          <span
            ref={dragHandleProps?.setActivatorNodeRef}
            {...(dragHandleProps?.listeners ?? {})}
            {...(dragHandleProps?.attributes ?? {})}
            className={cn(
              "mt-0.5 shrink-0 cursor-grab touch-none opacity-0 group-hover:opacity-100 active:cursor-grabbing",
              done || overdue ? "text-current/60" : "text-muted-foreground/40",
            )}
          >
            <GripVertical className="h-3 w-3" />
          </span>
        )}
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 flex-1 text-left"
          title={`${task.title} — ${clientsMap[task.client_id] ?? ""}`}
        >
          <span className="flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", done ? "bg-success-foreground" : overdue ? "bg-destructive-foreground" : color.bg)} />
            <span className={cn("truncate font-medium", done && "line-through")}>
              {clientsMap[task.client_id] ?? task.title}
            </span>
          </span>
          <span className={cn("block truncate", done || overdue ? "text-current/80" : "text-muted-foreground/70")}>
            {stageLabel(task.stage_current)}
          </span>
        </button>
      </div>
    </div>
  );
}

function DraggableTaskCard(props: Omit<Parameters<typeof TaskCard>[0], "dragHandleProps" | "isDragging">) {
  const draggable = !props.task.id.startsWith("legacy_");
  const { setNodeRef, listeners, attributes, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: props.task.id,
    data: { task: props.task },
    disabled: !draggable,
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard {...props} dragHandleProps={{ listeners, attributes, setActivatorNodeRef }} isDragging={isDragging} />
    </div>
  );
}

function DayCell({ id, userId, dayKey, tasksInCell, clientsMap, todayKey, onTaskClick, onAddClick }: {
  id: string;
  userId: string;
  dayKey: string;
  tasksInCell: PmTask[];
  clientsMap: Record<string, string>;
  todayKey: string;
  onTaskClick: (t: PmTask) => void;
  onAddClick: (userId: string, dayKey: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border-b border-r border-border/20 last:border-r-0 px-1.5 py-1.5 space-y-1 align-top min-h-[52px] transition-colors",
        isOver && "bg-primary/5 ring-1 ring-inset ring-primary/30",
      )}
    >
      {tasksInCell.map((t) => (
        <DraggableTaskCard key={t.id} task={t} clientsMap={clientsMap} todayKey={todayKey} onClick={() => onTaskClick(t)} />
      ))}
      <button
        type="button"
        onClick={() => onAddClick(userId, dayKey)}
        className="flex w-full items-center justify-center rounded-lg border border-dashed border-border/40 py-1 text-muted-foreground/50 opacity-0 transition-opacity hover:border-primary/40 hover:text-primary group-hover:opacity-100 focus:opacity-100"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

export function PmTeamWeekView({ tasks, clientsMap, membersMap, onTaskClick, onAddClick, filterClient, filterAssignee, filterStage, search }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [activeTask, setActiveTask] = useState<PmTask | null>(null);
  const updateTask = useUpdatePmTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const membersQ = useTeamMembers();
  const teamMembers = useMemo(
    () =>
      [...(membersQ.data ?? [])].sort((a, b) =>
        a.role_title === b.role_title
          ? a.display_name.localeCompare(b.display_name, "pt-BR")
          : a.role_title.localeCompare(b.role_title, "pt-BR"),
      ),
    [membersQ.data],
  );

  // Legacy `tasks` table also needs to be included so this view matches
  // what Agenda shows — same merge pattern as AgendaCalendarView.
  const monthKey = format(cursor, "yyyy-MM");
  const legacyTasksQ = useTasks({ month: monthKey });
  const legacyAssigneesQ = useTaskAssigneesByMonth(monthKey);

  const legacyAssigneesByTaskId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of legacyAssigneesQ.data ?? []) {
      const prev = map.get(row.task_id) ?? [];
      if (!prev.includes(row.user_id)) prev.push(row.user_id);
      map.set(row.task_id, prev);
    }
    return map;
  }, [legacyAssigneesQ.data]);

  // key = `${userId}_${yyyy-MM-dd}` -> tasks (userId is a UUID and dayKey is
  // yyyy-MM-dd, neither contains "_", so this stays unambiguous to split later)
  const tasksByPersonDay = useMemo(() => {
    const map = new Map<string, PmTask[]>();
    const push = (userId: string, dayKey: string, task: PmTask) => {
      const key = `${userId}_${dayKey}`;
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, task]);
    };

    const q = search.trim().toLowerCase();

    for (const t of tasks) {
      if (!t.due_date) continue;
      if (filterClient !== "__all__" && t.client_id !== filterClient) continue;
      if (filterStage !== "__all__") {
        const isPeriodic = isPeriodicStageKey(filterStage);
        if (isPeriodic ? t.periodic_stage_key !== filterStage : (t.stage_current !== filterStage || !!t.periodic_stage_key)) continue;
      }
      if (q) {
        const clientName = clientsMap[t.client_id] ?? "";
        if (!t.title.toLowerCase().includes(q) && !clientName.toLowerCase().includes(q)) continue;
      }
      const assignees = getTaskAssignees(t, membersMap);
      if (filterAssignee !== "__all__" && !assignees.some((a) => a.id === filterAssignee)) continue;
      for (const a of assignees) push(a.id, t.due_date, t);
    }

    for (const lt of legacyTasksQ.data ?? []) {
      if (lt.description?.startsWith("pm:")) continue;
      if (!lt.due_date) continue;
      if (filterClient !== "__all__" && lt.client_id !== filterClient) continue;
      if (filterStage !== "__all__") {
        if (isPeriodicStageKey(filterStage) || lt.stage !== filterStage) continue;
      }
      if (q) {
        const clientName = clientsMap[lt.client_id] ?? "";
        if (!(lt.title ?? "").toLowerCase().includes(q) && !clientName.toLowerCase().includes(q)) continue;
      }
      const extra = legacyAssigneesByTaskId.get(lt.id) ?? [];
      const allAssignees = Array.from(new Set([lt.assigned_user_id, ...extra].filter(Boolean)));
      if (filterAssignee !== "__all__" && !allAssignees.includes(filterAssignee)) continue;
      const asPm: PmTask = {
        id: `legacy_${lt.id}`,
        project_id: null,
        client_id: lt.client_id,
        title: lt.title ?? lt.stage,
        description: lt.description ?? null,
        priority: "media",
        status_global: lt.status === "concluido" ? "concluido" : lt.status === "em_andamento" ? "em_andamento" : "backlog",
        stage_current: lt.stage,
        start_date: null,
        due_date: lt.due_date,
        created_by: lt.created_by,
        assignee_id: lt.assigned_user_id,
        watchers: extra.filter((id) => id !== lt.assigned_user_id),
        tags: [],
        created_at: "",
        updated_at: "",
        parent_task_id: null,
        origin_task_id: null,
        cover_url: null,
        is_extra_demand: lt.is_extra_demand,
        post_type: null,
        posting_date: null,
        posting_time: null,
        caption: null,
      };
      for (const userId of allAssignees) push(userId as string, lt.due_date, asPm);
    }

    return map;
  }, [tasks, legacyTasksQ.data, legacyAssigneesByTaskId, membersMap, clientsMap, filterClient, filterAssignee, filterStage, search]);

  const taskById = useMemo(() => {
    const map = new Map<string, PmTask>();
    for (const list of tasksByPersonDay.values()) {
      for (const t of list) map.set(t.id, t);
    }
    return map;
  }, [tasksByPersonDay]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const out: Date[][] = [];
    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    while (weekStart <= monthEnd) {
      out.push(Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)));
      weekStart = addDays(weekStart, 7);
    }
    return out;
  }, [cursor]);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  // Only the week containing today starts expanded; the rest start collapsed.
  // Re-derived (and the Accordion remounted, see key= below) whenever the
  // month or the active filters change, so it always re-centers on "now".
  const currentWeekValue = useMemo(() => {
    const idx = weeks.findIndex((weekDays) => weekDays.some((d) => format(d, "yyyy-MM-dd") === todayKey));
    return idx === -1 ? [] : [`week-${idx}`];
  }, [weeks, todayKey]);
  const accordionKey = `${monthKey}_${filterClient}_${filterAssignee}_${filterStage}_${search}`;

  const handleDragStart = (e: DragStartEvent) => {
    const task = (e.active.data.current as { task?: PmTask } | undefined)?.task;
    setActiveTask(task ?? taskById.get(String(e.active.id)) ?? null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;
    const taskId = String(active.id);
    if (taskId.startsWith("legacy_")) return;
    const sep = String(over.id).lastIndexOf("_");
    if (sep === -1) return;
    const userId = String(over.id).slice(0, sep);
    const dayKey = String(over.id).slice(sep + 1);
    const task = taskById.get(taskId);
    if (!task || (task.assignee_id === userId && task.due_date === dayKey)) return;
    updateTask.mutate({ id: taskId, assignee_id: userId, due_date: dayKey });
  };

  return (
    <div className="space-y-4 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards" }}>
      {/* Toolbar: navegação de mês */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/30 bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCursor((d) => addDays(startOfMonth(d), -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCursor((d) => addDays(endOfMonth(d), 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select
          value={String(cursor.getMonth())}
          onValueChange={(v) => setCursor((d) => new Date(d.getFullYear(), Number(v), 1))}
        >
          <SelectTrigger className="h-9 w-[120px] rounded-full text-sm font-medium bg-background/60 border-border/30 capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i} value={String(i)} className="capitalize">
                {format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(cursor.getFullYear())}
          onValueChange={(v) => setCursor((d) => new Date(Number(v), d.getMonth(), 1))}
        >
          <SelectTrigger className="h-9 w-[90px] rounded-full text-sm font-medium bg-background/60 border-border/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {Array.from({ length: 5 }, (_, i) => {
              const y = new Date().getFullYear() - 1 + i;
              return (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <Accordion key={accordionKey} type="multiple" defaultValue={currentWeekValue} className="space-y-3">
          {weeks.map((weekDays, weekIdx) => (
            <AccordionItem
              key={weekIdx}
              value={`week-${weekIdx}`}
              className="rounded-2xl border border-border/30 bg-card overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <span className="font-semibold text-sm">
                  Semana {weekIdx + 1}{" "}
                  <span className="text-muted-foreground font-normal">
                    ({format(weekDays[0], "d MMM", { locale: ptBR })} – {format(weekDays[4], "d MMM", { locale: ptBR })})
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-0 pb-0">
                <div className="overflow-x-auto">
                  <div className="min-w-[760px] grid" style={{ gridTemplateColumns: "220px repeat(5, 1fr)" }}>
                    {/* Header row */}
                    <div className="border-b border-r border-border/20 bg-muted/30 px-3 py-2" />
                    {weekDays.map((d, i) => {
                      const isToday = format(d, "yyyy-MM-dd") === todayKey;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "border-b border-r border-border/20 last:border-r-0 px-3 py-2 text-center",
                            isToday ? "bg-primary/5" : "bg-muted/30",
                          )}
                        >
                          <p className="text-xs font-semibold text-muted-foreground">{WEEKDAY_LABELS[i]}</p>
                          <p className={cn("text-sm font-bold", isToday && "text-primary")}>{format(d, "d")}</p>
                        </div>
                      );
                    })}

                    {/* Person rows */}
                    {teamMembers.map((member) => (
                      <div key={member.user_id} className="contents">
                        <div className="flex items-center gap-2 border-b border-r border-border/20 px-3 py-2.5 bg-background sticky left-0">
                          <UserAvatar
                            avatarUrl={member.avatar_url}
                            name={member.display_name}
                            className="h-7 w-7 shrink-0"
                            fallbackClassName="text-[10px] font-bold bg-primary/10 text-primary"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold leading-4">{member.display_name}</p>
                            <p className="truncate text-[11px] text-muted-foreground leading-3">{member.role_title}</p>
                          </div>
                        </div>
                        {weekDays.map((d, i) => {
                          const dayKey = format(d, "yyyy-MM-dd");
                          const dayTasks = tasksByPersonDay.get(`${member.user_id}_${dayKey}`) ?? [];
                          return (
                            <div key={i} className="group">
                              <DayCell
                                id={`${member.user_id}_${dayKey}`}
                                userId={member.user_id}
                                dayKey={dayKey}
                                tasksInCell={dayTasks}
                                clientsMap={clientsMap}
                                todayKey={todayKey}
                                onTaskClick={onTaskClick}
                                onAddClick={onAddClick}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <DragOverlay>
          {activeTask && (
            <div className="w-[200px]">
              <TaskCard task={activeTask} clientsMap={clientsMap} todayKey={todayKey} onClick={() => {}} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
