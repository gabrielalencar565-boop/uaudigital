import { useState, useRef, useEffect } from "react";
import { Clapperboard, Palette, ChevronDown, Plus, Check, ChevronRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { PM_ACTIVE_STAGES, getStageCircleColor, tagColor, tagDisplay } from "../pm-constants";
import { useUpdatePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import { getFixedAssignee, getFixedWatchers, useDefaultFlowWithDates } from "./PmStageFlowConfig";
import type { PmTask } from "../pm-types";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SubtaskTrashDialog } from "./SubtaskTrashDialog";

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("");
}

interface Props {
  parentTask: PmTask;
  childTasks: PmTask[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  members?: { id: string; name: string }[];
  onSelectSubtask?: (task: PmTask) => void;
  activeSubtaskId?: string | null;
}

export function PmPlanningSubtasks({ parentTask, childTasks, membersMap, members, onSelectSubtask, activeSubtaskId }: Props) {
  const updateTask = useUpdatePmTask();
  const [showTrash, setShowTrash] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const videoTasks = childTasks.filter(c => c.post_type === "video");
  const designTasks = childTasks.filter(c => c.post_type === "design");

  const videoDone = videoTasks.filter(t => t.stage_current === "entrega").length;
  const designDone = designTasks.filter(t => t.stage_current === "entrega").length;

  const sb2 = supabase as any;
  const deletedSubsQ = useQuery<PmTask[]>({
    queryKey: ["pm_deleted_planning_subtasks", parentTask.id],
    enabled: showTrash,
    queryFn: async () => {
      const { data, error } = await sb2
        .from("pm_tasks")
        .select("*")
        .eq("parent_task_id", parentTask.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleRestore = (subId: string) => {
    setRestoringId(subId);
    updateTask.mutate({ id: subId, deleted_at: null, deleted_by: null } as any, {
      onSuccess: () => {
        deletedSubsQ.refetch();
        toast.success("Subtarefa restaurada!");
        setRestoringId(null);
      },
      onError: () => setRestoringId(null),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold">Planejamento</h3>
        <span className="text-xs text-muted-foreground">
          {videoDone + designDone} de {childTasks.length} subtarefas
        </span>
        <button
          onClick={() => setShowTrash(!showTrash)}
          className={cn(
            "h-auto px-2 py-0.5 flex items-center gap-1 rounded-md text-xs transition-all",
            showTrash
              ? "bg-destructive/10 text-destructive"
              : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted"
          )}
          title="Lixeira de subtarefas"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Lixeira
        </button>
      </div>

      {/* Trash panel */}
      {showTrash && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs font-semibold text-destructive">Subtarefas excluídas</span>
          </div>
          {deletedSubsQ.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (deletedSubsQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma subtarefa na lixeira</p>
          ) : (
            <ScrollArea className={cn((deletedSubsQ.data ?? []).length > 4 && "h-[180px]")}>
              <div className="space-y-1">
                {(deletedSubsQ.data ?? []).map(sub => (
                  <div key={sub.id} className="flex items-center gap-2 rounded-md border border-border/30 bg-card/50 px-2 py-1.5">
                    <span className="flex-1 truncate text-xs text-muted-foreground line-through">{sub.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      disabled={restoringId === sub.id}
                      onClick={() => handleRestore(sub.id)}
                    >
                      {restoringId === sub.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      Restaurar
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      <PlanningSection
        type="video"
        icon={<Clapperboard className="h-4 w-4" />}
        label="Vídeo"
        headerBg="bg-blue-500"
        headerText="text-white"
        borderColor="border-blue-500/30"
        parentTask={parentTask}
        tasks={videoTasks}
        doneCount={videoDone}
        membersMap={membersMap}
        members={members}
        onSelectSubtask={onSelectSubtask}
        activeSubtaskId={activeSubtaskId}
        onDeleted={() => deletedSubsQ.refetch()}
      />

      <PlanningSection
        type="design"
        icon={<Palette className="h-4 w-4" />}
        label="Design"
        headerBg="bg-teal-500"
        headerText="text-white"
        borderColor="border-teal-500/30"
        parentTask={parentTask}
        tasks={designTasks}
        doneCount={designDone}
        membersMap={membersMap}
        members={members}
        onSelectSubtask={onSelectSubtask}
        activeSubtaskId={activeSubtaskId}
        onDeleted={() => deletedSubsQ.refetch()}
      />
    </div>
  );
}

function PlanningSection({
  type, icon, label, headerBg, headerText, borderColor,
  parentTask, tasks, doneCount,
  membersMap, members, onSelectSubtask, activeSubtaskId, onDeleted,
}: {
  type: "video" | "design";
  icon: React.ReactNode;
  label: string;
  headerBg: string;
  headerText: string;
  borderColor: string;
  parentTask: PmTask;
  tasks: PmTask[];
  doneCount: number;
  membersMap: Record<string, { name: string; avatar?: string }>;
  members?: { id: string; name: string }[];
  onSelectSubtask?: (task: PmTask) => void;
  activeSubtaskId?: string | null;
  onDeleted?: () => void;
}) {
  const updateTask = useUpdatePmTask();
  const createTask = useCreatePmTask();
  const { stageAssignees } = useDefaultFlowWithDates();
  const [isOpen, setIsOpen] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  const total = tasks.length;

  useEffect(() => {
    if (isAdding && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isAdding]);

  const handleSoftDelete = async (subId: string, title: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    updateTask.mutate({ id: subId, deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null } as any, {
      onSuccess: () => onDeleted?.(),
    });
    toast("Subtarefa movida para lixeira");
    setDeletingId(null);
  };

  const handleStartAdd = () => {
    setNewTitle("");
    setIsAdding(true);
  };

  const handleConfirmAdd = async () => {
    if (!newTitle.trim()) {
      setIsAdding(false);
      return;
    }
    await createTask.mutateAsync({
      client_id: parentTask.client_id,
      title: newTitle.trim(),
      parent_task_id: parentTask.id,
      stage_current: parentTask.stage_current,
      assignee_id: parentTask.assignee_id ?? undefined,
      watchers: parentTask.watchers ?? [],
      post_type: type,
    } as any);
    setNewTitle("");
    setIsAdding(false);
  };

  const toggleAssignee = (subId: string, sub: PmTask, memberId: string) => {
    const currentWatchers = sub.watchers ?? [];
    if (sub.assignee_id === memberId) {
      const remaining = currentWatchers.filter(w => w !== memberId);
      updateTask.mutate({ id: subId, assignee_id: remaining[0] ?? null, watchers: remaining.slice(1) } as any);
    } else if (currentWatchers.includes(memberId)) {
      updateTask.mutate({ id: subId, watchers: currentWatchers.filter(w => w !== memberId) } as any);
    } else if (!sub.assignee_id) {
      updateTask.mutate({ id: subId, assignee_id: memberId } as any);
    } else {
      updateTask.mutate({ id: subId, watchers: [...currentWatchers, memberId] } as any);
    }
  };

  const allAssigneeIds = (sub: PmTask) => [
    ...(sub.assignee_id ? [sub.assignee_id] : []),
    ...(sub.watchers ?? []).filter(w => w !== sub.assignee_id),
  ];

  const changeStage = (subId: string, newStage: string) => {
    const fixedAssignee = getFixedAssignee(stageAssignees, newStage, parentTask.client_id);
    const fixedWatchers = getFixedWatchers(stageAssignees, newStage, parentTask.client_id);
    const updates: any = { id: subId, stage_current: newStage as any };
    if (fixedAssignee !== undefined) {
      updates.assignee_id = fixedAssignee;
      updates.watchers = fixedWatchers;
    }
    updateTask.mutate(updates);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className={cn(
          "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg transition-all hover:opacity-90",
          headerBg, headerText
        )}>
          {icon}
          <span className="font-semibold text-sm">{label}</span>
          <span className="text-xs opacity-80">{total}</span>
          <ChevronDown className={cn("h-3.5 w-3.5 ml-auto transition-transform", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className={cn("ml-2 border-l-2 pl-2 mt-1", borderColor)}>
          {tasks.map((sub) => {
            const isDone = sub.stage_current === "entrega";
            const isActive = activeSubtaskId === sub.id;
            const subAssignees = allAssigneeIds(sub);
            const circleColor = getStageCircleColor(sub.stage_current);

            return (
              <div
                key={sub.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-2 transition border-b border-border/10 cursor-pointer",
                  isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-card/40",
                  isDone && "opacity-60"
                )}
                onClick={() => onSelectSubtask?.(sub)}
              >
                {/* Stage circle */}
                <div className="w-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
                        circleColor.border,
                        isDone && `${circleColor.bg} border-emerald-500`
                      )}>
                        {isDone && <Check className="h-3 w-3 text-white" />}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-1" align="start">
                      {PM_ACTIVE_STAGES.map(s => {
                        const sColor = getStageCircleColor(s.key);
                        const isEntrega = s.key === "entrega";
                        const isSelected = sub.stage_current === s.key;
                        return (
                          <button
                            key={s.key}
                            className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition", isSelected && "bg-accent")}
                            onClick={() => changeStage(sub.id, s.key)}
                          >
                            <span className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0", sColor.border, isEntrega && `${sColor.bg}`)}>
                              {isEntrega && <Check className="h-2.5 w-2.5 text-white" />}
                            </span>
                            {s.label}
                            {isSelected && <Check className="h-3 w-3 ml-auto text-primary" />}
                          </button>
                        );
                      })}
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Tags + Title */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  {(sub.tags ?? []).map(rawTag => {
                    const tc = tagColor(rawTag);
                    const name = tagDisplay(rawTag);
                    return <Badge key={rawTag} className={cn("text-[8px] h-4 px-1 gap-0.5 border-0 shrink-0", tc.bg, tc.text)}>{name}</Badge>;
                  })}
                  <span className={cn("truncate text-sm hover:text-primary transition-colors", isDone && "line-through text-muted-foreground")}>{sub.title}</span>
                </div>

                {/* Assignee */}
                <div className="w-20 flex justify-center" onClick={(e) => e.stopPropagation()}>
                  {members && members.length > 0 ? (
                    <PmAssigneeSelector
                      selectedIds={subAssignees}
                      membersMap={membersMap}
                      members={members}
                      onToggle={(mId) => toggleAssignee(sub.id, sub, mId)}
                    >
                      <button className="flex items-center -space-x-1">
                        {subAssignees.length > 0 ? subAssignees.slice(0, 2).map(id => {
                          const m = membersMap[id];
                          if (!m) return null;
                          return (
                            <Avatar key={id} className="h-5 w-5 border border-background">
                              <AvatarImage src={m.avatar} />
                              <AvatarFallback className="text-[7px] bg-primary/10 text-primary">{initials(m.name)}</AvatarFallback>
                            </Avatar>
                          );
                        }) : (
                          <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30" />
                        )}
                      </button>
                    </PmAssigneeSelector>
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-dashed border-muted-foreground/30" />
                  )}
                </div>

                {/* Trash + chevron */}
                <div className="w-14 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded-md text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-all"
                    onClick={(e) => { e.stopPropagation(); setDeletingId(sub.id); }}
                    title="Mover para lixeira"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition" onClick={() => onSelectSubtask?.(sub)} />
                </div>

                {/* Delete confirmation */}
                <AlertDialog open={deletingId === sub.id} onOpenChange={(open) => !open && setDeletingId(null)}>
                  <AlertDialogContent className="z-[200]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir subtarefa?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A subtarefa <strong>"{sub.title}"</strong> será movida para a lixeira. Os pontos de performance não serão contabilizados.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleSoftDelete(sub.id, sub.title)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}

          {/* Add subtask: input or button */}
          {isAdding ? (
            <div className="flex items-center gap-2 px-2 py-2">
              <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                ref={addInputRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={`Nome da subtarefa...`}
                className="h-7 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 placeholder:text-muted-foreground/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmAdd();
                  if (e.key === "Escape") { setIsAdding(false); setNewTitle(""); }
                }}
                onBlur={handleConfirmAdd}
              />
            </div>
          ) : (
            <button
              onClick={handleStartAdd}
              className="flex items-center gap-2 px-2 py-2 w-full text-muted-foreground/60 hover:text-primary hover:bg-card/40 transition rounded-b-md"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="text-xs">Adicionar subtarefa</span>
            </button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
