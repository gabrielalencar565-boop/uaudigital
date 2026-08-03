import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar, Check, ChevronDown, Filter, GripVertical,
  History, Maximize2, Minimize2, Plus, Search, User,
} from "lucide-react";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTasks, useTeamMembers } from "@/features/data/queries";
import { useTaskAssigneesByMonth } from "@/features/data/task-assignees-queries";
import { useUpdatePmTask } from "../hooks/use-pm-data";
import { getStageCircleColor, stageLabel } from "../pm-constants";
import type { PmTask } from "../pm-types";

const WEEKDAY_FULL = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAYS_DEFAULT = [1, 2, 3, 4, 5];
const PREFS_KEY = "pauta_prefs_v1";

const BAR_GRADIENT = "linear-gradient(90deg, #4C1D95 0%, #6D28D9 45%, #7C3AED 100%)";

function loadPrefs(): { selectedDays: number[]; minimal: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}");
    return {
      selectedDays: Array.isArray(raw.selectedDays) ? raw.selectedDays : WEEKDAYS_DEFAULT,
      minimal: !!raw.minimal,
    };
  } catch {
    return { selectedDays: WEEKDAYS_DEFAULT, minimal: false };
  }
}

function savePrefs(p: { selectedDays: number[]; minimal: boolean }) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

// A "ciclo" runs from the 28th of one month through the 27th of the next.
// `anchor` is the 1st-of-month Date representing the cycle's END month.
function cycleEnd(anchor: Date) {
  return new Date(anchor.getFullYear(), anchor.getMonth(), 27);
}
function cycleStart(anchor: Date) {
  const end = cycleEnd(anchor);
  return new Date(end.getFullYear(), end.getMonth() - 1, 28);
}
function cycleNumber(anchor: Date) {
  return anchor.getMonth() + 1;
}
function anchorForDate(d: Date) {
  return d.getDate() >= 28 ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : new Date(d.getFullYear(), d.getMonth(), 1);
}
function anchorKey(anchor: Date) {
  return format(anchor, "yyyy-MM");
}

interface Assignee {
  id: string;
  name: string;
  avatar?: string;
}

interface Props {
  tasks: PmTask[];
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  clients: { id: string; name: string }[];
  currentUserId: string | null;
  onTaskClick: (t: PmTask) => void;
  onAddClick: (userId: string, dayKey: string) => void;
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

function TaskCard({ task, clientsMap, todayKey, minimal, onClick, dragHandleProps, isDragging }: {
  task: PmTask;
  clientsMap: Record<string, string>;
  todayKey: string;
  minimal: boolean;
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
        "group relative w-full rounded-lg border pl-1.5 pr-1.5 text-[11px] leading-tight transition-colors",
        minimal ? "py-0.5" : "py-1",
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
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left" title={`${task.title} — ${clientsMap[task.client_id] ?? ""}`}>
          {minimal ? (
            <span className={cn("flex items-center gap-1.5 truncate font-medium", done && "line-through")}>
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", done ? "bg-success-foreground" : overdue ? "bg-destructive-foreground" : color.bg)} />
              <span className="truncate">{task.title}</span>
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", done ? "bg-success-foreground" : overdue ? "bg-destructive-foreground" : color.bg)} />
                <span className={cn("truncate font-medium", done && "line-through")}>{clientsMap[task.client_id] ?? task.title}</span>
              </span>
              <span className={cn("block truncate", done || overdue ? "text-current/80" : "text-muted-foreground/70")}>
                {stageLabel(task.stage_current)}
              </span>
            </>
          )}
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

function DayCell({ id, userId, dayKey, tasksInCell, clientsMap, todayKey, minimal, onTaskClick, onAddClick }: {
  id: string;
  userId: string;
  dayKey: string;
  tasksInCell: PmTask[];
  clientsMap: Record<string, string>;
  todayKey: string;
  minimal: boolean;
  onTaskClick: (t: PmTask) => void;
  onAddClick: (userId: string, dayKey: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-full bg-background px-1.5 py-1.5 space-y-1 align-top min-h-[40px] transition-colors",
        isOver ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : "hover:bg-muted/30",
      )}
    >
      {tasksInCell.map((t) => (
        <DraggableTaskCard key={t.id} task={t} clientsMap={clientsMap} todayKey={todayKey} minimal={minimal} onClick={() => onTaskClick(t)} />
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

function BarIconButton({ label, active, badge, onClick, children }: {
  label: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-colors",
            active ? "bg-white/35" : "bg-white/15 hover:bg-white/25",
          )}
        >
          {children}
          {!!badge && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-primary">
              {badge}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function PmTeamWeekView({ tasks, clientsMap, membersMap, clients, currentUserId, onTaskClick, onAddClick }: Props) {
  const [cursor, setCursor] = useState(() => anchorForDate(new Date()));
  const [activeTask, setActiveTask] = useState<PmTask | null>(null);
  const updateTask = useUpdatePmTask();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const [search, setSearch] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>(() => loadPrefs().selectedDays);
  const [minimal, setMinimal] = useState(() => loadPrefs().minimal);
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [filterCollaborators, setFilterCollaborators] = useState<Set<string>>(new Set());
  const [filterClients, setFilterClients] = useState<Set<string>>(new Set());
  const [filterRoles, setFilterRoles] = useState<Set<string>>(new Set());
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => savePrefs({ selectedDays, minimal }), [selectedDays, minimal]);

  const membersQ = useTeamMembers();
  const allTeamMembers = useMemo(
    () =>
      [...(membersQ.data ?? [])].sort((a, b) =>
        a.role_title === b.role_title
          ? a.display_name.localeCompare(b.display_name, "pt-BR")
          : a.role_title.localeCompare(b.role_title, "pt-BR"),
      ),
    [membersQ.data],
  );
  const roleOptions = useMemo(() => Array.from(new Set(allTeamMembers.map((m) => m.role_title))).sort(), [allTeamMembers]);

  const teamMembers = useMemo(() => {
    let list = allTeamMembers;
    if (myTasksOnly && currentUserId) list = list.filter((m) => m.user_id === currentUserId);
    if (filterCollaborators.size > 0) list = list.filter((m) => filterCollaborators.has(m.user_id));
    if (filterRoles.size > 0) list = list.filter((m) => filterRoles.has(m.role_title));
    return list;
  }, [allTeamMembers, myTasksOnly, currentUserId, filterCollaborators, filterRoles]);

  const cycleStartDate = cycleStart(cursor);
  const cycleEndDateVal = cycleEnd(cursor);
  const startKey = format(cycleStartDate, "yyyy-MM-dd");
  const endKey = format(cycleEndDateVal, "yyyy-MM-dd");

  // Legacy `tasks` table also needs to be included so this view matches
  // what Agenda shows — same merge pattern as AgendaCalendarView. A ciclo
  // always spans exactly the start month and the end month, so both
  // calendar months are queried and merged.
  const legacyTasksQ = useTasks({ start: startKey, end: endKey });
  const startMonthKey = format(cycleStartDate, "yyyy-MM");
  const endMonthKey = format(cycleEndDateVal, "yyyy-MM");
  const legacyAssigneesStartQ = useTaskAssigneesByMonth(startMonthKey);
  const legacyAssigneesEndQ = useTaskAssigneesByMonth(startMonthKey === endMonthKey ? undefined : endMonthKey);

  const legacyAssigneesByTaskId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of [...(legacyAssigneesStartQ.data ?? []), ...(legacyAssigneesEndQ.data ?? [])]) {
      const prev = map.get(row.task_id) ?? [];
      if (!prev.includes(row.user_id)) prev.push(row.user_id);
      map.set(row.task_id, prev);
    }
    return map;
  }, [legacyAssigneesStartQ.data, legacyAssigneesEndQ.data]);

  const tasksByPersonDay = useMemo(() => {
    const map = new Map<string, PmTask[]>();
    const push = (userId: string, dayKey: string, task: PmTask) => {
      const key = `${userId}_${dayKey}`;
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, task]);
    };

    const q = search.trim().toLowerCase();
    const roleByUserId = new Map(allTeamMembers.map((m) => [m.user_id, m.role_title]));

    const passesCommonFilters = (clientId: string, title: string, assignees: Assignee[]) => {
      if (filterClients.size > 0 && !filterClients.has(clientId)) return false;
      if (q) {
        const clientName = clientsMap[clientId] ?? "";
        const inTitle = title.toLowerCase().includes(q);
        const inClient = clientName.toLowerCase().includes(q);
        const inAssignee = assignees.some((a) => a.name.toLowerCase().includes(q));
        const inRole = assignees.some((a) => (roleByUserId.get(a.id) ?? "").toLowerCase().includes(q));
        if (!inTitle && !inClient && !inAssignee && !inRole) return false;
      }
      return true;
    };

    for (const t of tasks) {
      if (!t.due_date || t.due_date < startKey || t.due_date > endKey) continue;
      const assignees = getTaskAssignees(t, membersMap);
      if (!passesCommonFilters(t.client_id, t.title, assignees)) continue;
      for (const a of assignees) push(a.id, t.due_date, t);
    }

    for (const lt of legacyTasksQ.data ?? []) {
      if (lt.description?.startsWith("pm:")) continue;
      if (!lt.due_date) continue;
      const extra = legacyAssigneesByTaskId.get(lt.id) ?? [];
      const allAssignees = Array.from(new Set([lt.assigned_user_id, ...extra].filter(Boolean))) as string[];
      const assignees = allAssignees.map((id) => ({ id, ...membersMap[id] })).filter((m): m is Assignee => Boolean(m.name));
      if (!passesCommonFilters(lt.client_id, lt.title ?? lt.stage, assignees)) continue;
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
      for (const userId of allAssignees) push(userId, lt.due_date, asPm);
    }

    return map;
  }, [tasks, legacyTasksQ.data, legacyAssigneesByTaskId, membersMap, clientsMap, allTeamMembers, filterClients, search, startKey, endKey]);

  const taskById = useMemo(() => {
    const map = new Map<string, PmTask>();
    for (const list of tasksByPersonDay.values()) {
      for (const t of list) map.set(t.id, t);
    }
    return map;
  }, [tasksByPersonDay]);

  const weeks = useMemo(() => {
    const out: Date[][] = [];
    let weekStart = startOfWeek(cycleStartDate, { weekStartsOn: 0 });
    while (weekStart <= cycleEndDateVal) {
      out.push(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
      weekStart = addDays(weekStart, 7);
    }
    return out;
  }, [cycleStartDate, cycleEndDateVal]);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  const currentWeekValue = useMemo(() => {
    const idx = weeks.findIndex((weekDays) => weekDays.some((d) => format(d, "yyyy-MM-dd") === todayKey));
    return idx === -1 ? [] : [`week-${idx}`];
  }, [weeks, todayKey]);
  const accordionKey = `${anchorKey(cursor)}_${selectedDays.join("")}_${myTasksOnly}_${filterCollaborators.size}_${filterClients.size}_${filterRoles.size}_${search}`;

  const cycleOptions = useMemo(() => {
    const base = anchorForDate(new Date());
    const out: { key: string; anchor: Date }[] = [];
    for (let i = -18; i <= 12; i++) {
      const anchor = new Date(base.getFullYear(), base.getMonth() + i, 1);
      out.push({ key: anchorKey(anchor), anchor });
    }
    return out;
  }, []);

  const activeFilterCount = filterCollaborators.size + filterClients.size + filterRoles.size;

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

  const toggleInSet = (set: Set<string>, setSet: (s: Set<string>) => void, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSet(next);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards" }}>
        {/* Barra única — Magic Number, ciclo, busca e ações */}
        <div
          className="flex items-center gap-3 rounded-2xl px-4 py-2.5 shadow-lg overflow-x-auto"
          style={{ background: BAR_GRADIENT, boxShadow: "0 12px 30px -12px rgba(76,29,149,0.5)" }}
        >
          <div className="flex w-fit shrink-0 flex-col items-start">
            <p className="w-fit text-[10px] font-semibold uppercase text-white/70 leading-tight">Magic Number</p>
            <p className="w-fit text-2xl font-bold text-white leading-tight">{format(cycleEndDateVal, "dd/MM")}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-medium text-white hover:bg-white/25 transition-colors"
              >
                <span className="whitespace-nowrap capitalize">
                  Ciclo {cycleNumber(cursor)} · {format(cycleEndDateVal, "MMM", { locale: ptBR })}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-white/70" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-1 max-h-80 overflow-y-auto">
              {cycleOptions.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setCursor(opt.anchor)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-muted",
                    anchorKey(cursor) === opt.key && "bg-accent font-semibold",
                  )}
                >
                  <span>Ciclo {cycleNumber(opt.anchor)} de {opt.anchor.getFullYear()}</span>
                  <span className="text-xs text-muted-foreground">{format(cycleStart(opt.anchor), "dd/MM")} – {format(cycleEnd(opt.anchor), "dd/MM")}</span>
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <div className="relative w-full max-w-[220px] shrink">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tarefas..."
              className="h-9 w-full rounded-xl bg-white/15 pl-9 pr-3 text-sm text-white placeholder:text-white/60 outline-none focus:bg-white/25 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <span>
                  <BarIconButton label="Selecionar dias" active={selectedDays.length !== 5}>
                    <Calendar className="h-4 w-4" />
                  </BarIconButton>
                </span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 space-y-1 p-2">
                {WEEKDAY_FULL.map((label, idx) => (
                  <label key={idx} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={selectedDays.includes(idx)}
                      onCheckedChange={(checked) =>
                        setSelectedDays((prev) => (checked ? Array.from(new Set([...prev, idx])).sort() : prev.filter((d) => d !== idx)))
                      }
                    />
                    {label}
                  </label>
                ))}
                <div className="flex flex-wrap gap-1 pt-1 border-t mt-1">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}>Selecionar todos</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDays(WEEKDAYS_DEFAULT)}>Dias úteis</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDays([])}>Limpar seleção</Button>
                </div>
              </PopoverContent>
            </Popover>

            <BarIconButton label="Modo minimalista" active={minimal} onClick={() => setMinimal((v) => !v)}>
              {minimal ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </BarIconButton>

            <BarIconButton label="Minhas tarefas" active={myTasksOnly} onClick={() => setMyTasksOnly((v) => !v)}>
              <User className="h-4 w-4" />
            </BarIconButton>

            <Popover>
              <PopoverTrigger asChild>
                <span>
                  <BarIconButton label="Filtros" active={activeFilterCount > 0} badge={activeFilterCount}>
                    <Filter className="h-4 w-4" />
                  </BarIconButton>
                </span>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-0">
                <Command>
                  <CommandInput placeholder="Buscar..." />
                  <CommandList className="max-h-72">
                    <CommandEmpty>Nada encontrado</CommandEmpty>
                    <CommandGroup heading="Colaboradores">
                      {allTeamMembers.map((m) => (
                        <CommandItem key={m.user_id} onSelect={() => toggleInSet(filterCollaborators, setFilterCollaborators, m.user_id)}>
                          <Check className={cn("mr-2 h-3.5 w-3.5", filterCollaborators.has(m.user_id) ? "opacity-100" : "opacity-0")} />
                          {m.display_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup heading="Clientes">
                      {clients.map((c) => (
                        <CommandItem key={c.id} onSelect={() => toggleInSet(filterClients, setFilterClients, c.id)}>
                          <Check className={cn("mr-2 h-3.5 w-3.5", filterClients.has(c.id) ? "opacity-100" : "opacity-0")} />
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandGroup heading="Cargos">
                      {roleOptions.map((r) => (
                        <CommandItem key={r} onSelect={() => toggleInSet(filterRoles, setFilterRoles, r)}>
                          <Check className={cn("mr-2 h-3.5 w-3.5", filterRoles.has(r) ? "opacity-100" : "opacity-0")} />
                          {r}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                <div className="flex items-center justify-between border-t p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setFilterCollaborators(new Set());
                      setFilterClients(new Set());
                      setFilterRoles(new Set());
                    }}
                  >
                    Limpar filtros
                  </Button>
                  <span className="text-xs text-muted-foreground">{activeFilterCount} ativo{activeFilterCount !== 1 ? "s" : ""}</span>
                </div>
              </PopoverContent>
            </Popover>

            <BarIconButton label="Histórico" onClick={() => setHistoryOpen(true)}>
              <History className="h-4 w-4" />
            </BarIconButton>
          </div>
          </div>
        </div>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <Accordion key={accordionKey} type="multiple" defaultValue={currentWeekValue} className="space-y-3">
            {weeks.map((weekDays, weekIdx) => {
              const visibleDays = weekDays.filter((d) => selectedDays.includes(d.getDay()));
              if (visibleDays.length === 0) return null;
              return (
                <AccordionItem key={weekIdx} value={`week-${weekIdx}`} className="rounded-2xl border border-border/30 bg-card overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <span className="font-semibold text-sm">
                      Semana {weekIdx + 1}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({format(weekDays[0], "d MMM", { locale: ptBR })} – {format(weekDays[6], "d MMM", { locale: ptBR })})
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0">
                    <div className="overflow-x-auto">
                      <div
                        className="min-w-[760px] grid gap-px bg-black/10"
                        style={{ gridTemplateColumns: `220px repeat(${visibleDays.length}, 1fr)` }}
                      >
                        <div className="bg-background px-3 py-2" />
                        {visibleDays.map((d, i) => {
                          const isToday = format(d, "yyyy-MM-dd") === todayKey;
                          return (
                            <div key={i} className="bg-background px-3 py-2 text-center">
                              <p className="text-xs font-semibold text-muted-foreground">{WEEKDAY_SHORT[d.getDay()]}</p>
                              <p className={cn("text-sm font-bold", isToday && "text-primary")}>{format(d, "d")}</p>
                            </div>
                          );
                        })}

                        {teamMembers.map((member) => (
                          <div key={member.user_id} className="contents">
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-background sticky left-0">
                              <UserAvatar avatarUrl={member.avatar_url} name={member.display_name} className="h-7 w-7 shrink-0" fallbackClassName="text-[10px] font-bold bg-primary/10 text-primary" />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold leading-4">{member.display_name}</p>
                                <p className="truncate text-[11px] text-muted-foreground leading-3">{member.role_title}</p>
                              </div>
                            </div>
                            {visibleDays.map((d, i) => {
                              const dayKey = format(d, "yyyy-MM-dd");
                              const dayTasks = tasksByPersonDay.get(`${member.user_id}_${dayKey}`) ?? [];
                              return (
                                <div key={i} className="group h-full">
                                  <DayCell
                                    id={`${member.user_id}_${dayKey}`}
                                    userId={member.user_id}
                                    dayKey={dayKey}
                                    tasksInCell={dayTasks}
                                    clientsMap={clientsMap}
                                    todayKey={todayKey}
                                    minimal={minimal}
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
              );
            })}
          </Accordion>
          <DragOverlay>
            {activeTask && (
              <div className="w-[200px]">
                <TaskCard task={activeTask} clientsMap={clientsMap} todayKey={todayKey} minimal={minimal} onClick={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>

        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Histórico</SheetTitle>
            </SheetHeader>
            <p className="mt-4 text-sm text-muted-foreground">
              O histórico de alterações da Pauta (criação, movimentação, troca de responsável/cliente, conclusão, exclusão) ainda está em construção e chega em uma próxima atualização.
            </p>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  );
}
