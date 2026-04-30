import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStageCircleColor } from "../pm-constants";
import type { PmTask } from "../pm-types";
import { PmTaskCard } from "./PmTaskCard";
import { useUpdatePmTask } from "../hooks/use-pm-data";
import { useDefaultFlowWithDates, getFixedAssignee, getFixedWatchers } from "./PmStageFlowConfig";
import { LinkOrDateDialog } from "./LinkOrDateDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KANBAN_COLUMNS = [
  { key: "captacao", label: "Captação" },
  { key: "planejamento", label: "Planejamento" },
  { key: "design", label: "Design" },
  { key: "edicao_videos", label: "Vídeo" },
  { key: "revisao", label: "Revisão" },
  { key: "alteracoes", label: "Alteração" },
  { key: "pdf", label: "PDF" },
  { key: "agendamento", label: "Agendamento" },
  { key: "entrega", label: "Concluído" },
] as const;

/* ── Draggable wrapper ── */
function DraggableCard({ task, children }: { task: PmTask; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });
  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 50 : undefined }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={cn("touch-none", isDragging && "opacity-40")}>
      {children}
    </div>
  );
}

/* ── Droppable column ── */
function DroppableColumn({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(
      "flex flex-col gap-2 px-2 pb-3 transition-all duration-200 rounded-xl min-h-[60px]",
      isOver && "bg-primary/10 ring-2 ring-primary/30 ring-inset scale-[1.01]"
    )}>
      {children}
    </div>
  );
}

interface Props {
  tasks: PmTask[];
  childTasksMap: Record<string, PmTask[]>;
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  avatarsPrimed: boolean;
  onTaskClick: (task: PmTask) => void;
  onCreateClick: (status?: string) => void;
  filters: { clientId?: string; assigneeId?: string; search?: string; fixedAssigneeClientIds?: Set<string>; stage?: string };
  isAdmin?: boolean;
}

export function PmKanbanBoard({ tasks, childTasksMap, clientsMap, membersMap, avatarsPrimed, onTaskClick, onCreateClick, filters, isAdmin }: Props) {
  const updateTask = useUpdatePmTask();
  const [activeTask, setActiveTask] = useState<PmTask | null>(null);
  const { stageAssignees } = useDefaultFlowWithDates();

  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkExistingTask, setLinkExistingTask] = useState<{ id: string; due_date: string; title: string } | null>(null);
  const [pendingDragTask, setPendingDragTask] = useState<PmTask | null>(null);
  const [pendingDragStage, setPendingDragStage] = useState<string | null>(null);

  // Collapsed columns state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const manualOverrideRef = useRef<Set<string>>(new Set());
  const prevFilterRef = useRef(filters.assigneeId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getTaskAssignees = (pmTask: PmTask) => {
    const ids = Array.from(new Set([
      pmTask.assignee_id,
      ...(pmTask.watchers ?? []),
    ].filter((id): id is string => Boolean(id))));

    return ids.flatMap((id) => {
      const member = membersMap[id];
      if (!member) return [];
      return [{ id, name: member.name, avatar: member.avatar }];
    });
  };

  const filtered = useMemo(() => {
    let list = tasks.filter((t) => t.status_global !== "concluido" && t.status_global !== "pausado");
    if (filters.clientId) list = list.filter((t) => t.client_id === filters.clientId);
    if (filters.assigneeId) {
      const fixedClients = filters.fixedAssigneeClientIds ?? new Set<string>();
      list = list.filter((t) =>
        t.assignee_id === filters.assigneeId ||
        (t.watchers ?? []).includes(filters.assigneeId!) ||
        fixedClients.has(t.client_id)
      );
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    }
    if (filters.stage) {
      const stageKey = filters.stage;
      const isPeriodic = stageKey.startsWith("custom_");
      list = list.filter((t: any) =>
        isPeriodic ? t.periodic_stage_key === stageKey : (t.stage_current === stageKey && !t.periodic_stage_key)
      );
    }
    return list;
  }, [tasks, filters]);

  const columns = useMemo(() => {
    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      tasks: filtered
        .filter((t) => t.stage_current === col.key)
        .sort((a, b) => {
          const da = a.due_date ?? "";
          const db = b.due_date ?? "";
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da.localeCompare(db);
        }),
    }));
  }, [filtered]);

  // Auto-collapse empty columns when assignee filter changes
  useEffect(() => {
    const filterChanged = prevFilterRef.current !== filters.assigneeId;
    prevFilterRef.current = filters.assigneeId;

    if (filterChanged) {
      manualOverrideRef.current.clear();
    }

    if (filters.assigneeId && filters.assigneeId !== "__all__") {
      const next: Record<string, boolean> = {};
      for (const col of columns) {
        if (manualOverrideRef.current.has(col.key)) {
          next[col.key] = collapsed[col.key] ?? false;
        } else {
          next[col.key] = col.tasks.length === 0;
        }
      }
      setCollapsed(next);
    } else if (filterChanged) {
      setCollapsed({});
    }
  }, [filters.assigneeId, columns]);

  const toggleCollapse = useCallback((key: string) => {
    manualOverrideRef.current.add(key);
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const task = (event.active.data.current as any)?.task as PmTask | undefined;
    setActiveTask(task ?? null);
  };

  const applyMove = (droppedTask: PmTask, newStage: string, overrideDueDate?: string) => {
    const fixedAssignee = getFixedAssignee(stageAssignees, newStage, droppedTask.client_id);
    const fixedWatchers = getFixedWatchers(stageAssignees, newStage, droppedTask.client_id);

    const parentUpdates: any = { id: droppedTask.id, stage_current: newStage };
    if (fixedAssignee !== undefined) {
      parentUpdates.assignee_id = fixedAssignee;
      parentUpdates.watchers = fixedWatchers;
    }
    if (overrideDueDate) parentUpdates.due_date = overrideDueDate;

    updateTask.mutate(parentUpdates as any, { onError: () => toast.error("Erro ao mover tarefa") });

    const children = childTasksMap[droppedTask.id] ?? [];
    for (const child of children) {
      const childUpdates: any = { id: child.id, stage_current: newStage };
      if (fixedAssignee !== undefined) {
        childUpdates.assignee_id = fixedAssignee;
        childUpdates.watchers = fixedWatchers;
      }
      updateTask.mutate(childUpdates as any);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const droppedTask = (active.data.current as any)?.task as PmTask | undefined;
    if (!droppedTask) return;
    const newStage = over.id as string;
    if (droppedTask.stage_current === newStage) return;

    // Skip link dialog for extra demand tasks
    if (droppedTask.is_extra_demand) {
      applyMove(droppedTask, newStage);
      return;
    }

    // Check for existing agenda task in the same month/client/stage
    try {
      const sb = supabase as any;
      const base = droppedTask.due_date ? new Date(`${droppedTask.due_date}T12:00:00`) : new Date();
      const monthStart = format(new Date(base.getFullYear(), base.getMonth(), 1), "yyyy-MM-dd");
      const monthEnd = format(new Date(base.getFullYear(), base.getMonth() + 1, 0), "yyyy-MM-dd");

      let query = sb
        .from("pm_tasks")
        .select("id, due_date, title")
        .eq("client_id", droppedTask.client_id)
        .eq("stage_current", newStage)
        .neq("status_global", "concluido")
        .eq("is_extra_demand", false)
        .is("deleted_at", null)
        .is("parent_task_id", null)
        .not("due_date", "is", null)
        .gte("due_date", monthStart)
        .lte("due_date", monthEnd)
        .neq("id", droppedTask.id)
        .order("due_date", { ascending: true })
        .limit(1);

      // When dragging to revisão, only match same post_type
      if (newStage === "revisao" && droppedTask.post_type) {
        query = query.eq("post_type", droppedTask.post_type);
      }

      const { data: existing } = await query;

      if (existing && existing.length > 0 && existing[0].due_date) {
        setPendingDragTask(droppedTask);
        setPendingDragStage(newStage);
        setLinkExistingTask(existing[0]);
        setLinkDialogOpen(true);
        return;
      }
    } catch (_) { /* proceed normally */ }

    applyMove(droppedTask, newStage);
  };

  const handleLinkChoice = (dueDate: string) => {
    if (pendingDragTask && pendingDragStage) {
      applyMove(pendingDragTask, pendingDragStage, dueDate);
    }
    setPendingDragTask(null);
    setPendingDragStage(null);
  };

  return (
    <>
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {columns.map((col, idx) => {
          const circleColor = getStageCircleColor(col.key);
          const isCollapsed = !!collapsed[col.key];

          if (isCollapsed) {
            return (
              <button
                key={col.key}
                type="button"
                onClick={() => toggleCollapse(col.key)}
                className="flex min-w-[44px] w-[44px] h-[180px] shrink-0 flex-col items-center justify-between rounded-2xl bg-muted/40 backdrop-blur-sm border border-[#6932c8] py-3 cursor-pointer transition-all duration-300 hover:bg-muted/60 hover:border-primary/60 opacity-0"
                style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: `${idx * 0.07}s` }}
              >
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", circleColor.bg)} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50 [writing-mode:vertical-lr] rotate-180 whitespace-nowrap">
                  {col.label}
                </span>
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/8 text-[10px] font-semibold text-foreground/50 px-1">
                  {col.tasks.length}
                </span>
              </button>
            );
          }

          return (
            <div key={col.key} className="flex w-[272px] min-w-[272px] flex-col rounded-2xl bg-muted/40 backdrop-blur-sm border border-[#6932c8] opacity-0 transition-all duration-300"
              style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: `${idx * 0.07}s` }}>
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3">
                <button type="button" onClick={() => toggleCollapse(col.key)}
                  className="flex items-center gap-2.5 group cursor-pointer">
                  <span className={cn("h-2.5 w-2.5 rounded-full", circleColor.bg)} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/70 group-hover:text-foreground transition-colors">{col.label}</span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/8 text-[10px] font-semibold text-foreground/50 px-1.5">
                    {col.tasks.length}
                  </span>
                </button>
                <button type="button" onClick={() => onCreateClick(col.key)}
                  className="rounded-lg p-1.5 text-muted-foreground/60 transition-all hover:bg-primary/10 hover:text-primary active:scale-95">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              {/* Cards */}
              <DroppableColumn id={col.key}>
                {col.tasks.map((task) => {
                  const cardAssignees = getTaskAssignees(task);
                  return (
                    <DraggableCard key={task.id} task={task}>
                      <PmTaskCard
                        task={task}
                        clientName={clientsMap[task.client_id] ?? "—"}
                        assignees={cardAssignees}
                        avatarsPrimed={avatarsPrimed}
                        childTasks={childTasksMap[task.id] ?? []}
                        onClick={() => onTaskClick(task)}
                        isAdmin={isAdmin}
                      />
                    </DraggableCard>
                  );
                })}
                {col.tasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <div className="h-8 w-8 rounded-xl bg-foreground/5 flex items-center justify-center">
                      <Plus className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                    <p className="text-[11px] text-muted-foreground/40 font-medium">Nenhuma tarefa</p>
                  </div>
                )}
              </DroppableColumn>
            </div>
          );
        })}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask && (
          <div className="w-[256px] opacity-90 rotate-2 scale-105">
            <PmTaskCard
              task={activeTask}
              clientName={clientsMap[activeTask.client_id] ?? "—"}
              assignees={getTaskAssignees(activeTask)}
              avatarsPrimed={avatarsPrimed}
              childTasks={childTasksMap[activeTask.id] ?? []}
              onClick={() => {}}
              isAdmin={isAdmin}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>

    <LinkOrDateDialog
      open={linkDialogOpen}
      onClose={() => { setLinkDialogOpen(false); setPendingDragTask(null); setPendingDragStage(null); }}
      existingTask={linkExistingTask}
      onLink={handleLinkChoice}
      onSelectDate={handleLinkChoice}
    />
    </>
  );
}

