import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
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
  onTaskClick: (task: PmTask) => void;
  onCreateClick: (status?: string) => void;
  filters: { clientId?: string; assigneeId?: string; search?: string; fixedAssigneeClientIds?: Set<string> };
  isAdmin?: boolean;
}

export function PmKanbanBoard({ tasks, childTasksMap, clientsMap, membersMap, onTaskClick, onCreateClick, filters, isAdmin }: Props) {
  const updateTask = useUpdatePmTask();
  const [activeTask, setActiveTask] = useState<PmTask | null>(null);
  const { stageAssignees } = useDefaultFlowWithDates();

  // Link dialog state
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkExistingTask, setLinkExistingTask] = useState<{ id: string; due_date: string; title: string } | null>(null);
  const [pendingDragTask, setPendingDragTask] = useState<PmTask | null>(null);
  const [pendingDragStage, setPendingDragStage] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const filtered = useMemo(() => {
    let list = tasks.filter((t) => t.status_global !== "concluido");
    if (filters.clientId) list = list.filter((t) => t.client_id === filters.clientId);
    if (filters.assigneeId) {
      const fixedClients = filters.fixedAssigneeClientIds ?? new Set<string>();
      list = list.filter((t) => t.assignee_id === filters.assigneeId || fixedClients.has(t.client_id));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [tasks, filters]);

  const columns = useMemo(() => {
    return KANBAN_COLUMNS.map((col) => ({
      ...col,
      tasks: filtered.filter((t) => t.stage_current === col.key),
    }));
  }, [filtered]);

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

    // Check for existing completed agenda task for same client + target stage
    try {
      const sb = supabase as any;
      const { data: existing } = await sb
        .from("pm_tasks")
        .select("id, due_date, title")
        .eq("client_id", droppedTask.client_id)
        .eq("stage_current", newStage)
        .eq("status_global", "concluido")
        .is("parent_task_id", null)
        .limit(1);

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

  const activeMember = activeTask?.assignee_id ? membersMap[activeTask.assignee_id] : undefined;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {columns.map((col, idx) => {
          const circleColor = getStageCircleColor(col.key);
          return (
            <div key={col.key} className="flex w-[272px] min-w-[272px] flex-col rounded-2xl bg-muted/40 backdrop-blur-sm border border-[#6932c8] opacity-0"
              style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: `${idx * 0.07}s` }}>
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className={cn("h-2.5 w-2.5 rounded-full", circleColor.bg)} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/70">{col.label}</span>
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground/8 text-[10px] font-semibold text-foreground/50 px-1.5">
                    {col.tasks.length}
                  </span>
                </div>
                <button type="button" onClick={() => onCreateClick(col.key)}
                  className="rounded-lg p-1.5 text-muted-foreground/60 transition-all hover:bg-primary/10 hover:text-primary active:scale-95">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              {/* Cards */}
              <DroppableColumn id={col.key}>
                {col.tasks.map((task) => {
                  const member = task.assignee_id ? membersMap[task.assignee_id] : undefined;
                  return (
                    <DraggableCard key={task.id} task={task}>
                      <PmTaskCard
                        task={task}
                        clientName={clientsMap[task.client_id] ?? "—"}
                        assigneeName={member?.name}
                        assigneeAvatar={member?.avatar}
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
              assigneeName={activeMember?.name}
              assigneeAvatar={activeMember?.avatar}
              childTasks={childTasksMap[activeTask.id] ?? []}
              onClick={() => {}}
              isAdmin={isAdmin}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
