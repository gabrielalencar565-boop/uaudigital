import { useState, useRef, useEffect } from "react";
import { Clapperboard, Palette, ChevronDown, Plus, Check, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { PM_ACTIVE_STAGES, getStageCircleColor, tagColor, tagDisplay } from "../pm-constants";
import { useUpdatePmTask, useCreatePmTask } from "../hooks/use-pm-data";
import { PmAssigneeSelector } from "./PmAssigneeSelector";
import { getFixedAssignee, getFixedWatchers, useDefaultFlowWithDates } from "./PmStageFlowConfig";
import type { PmTask } from "../pm-types";

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
  const videoTasks = childTasks.filter(c => c.post_type === "video");
  const designTasks = childTasks.filter(c => c.post_type === "design");

  const videoDone = videoTasks.filter(t => t.stage_current === "entrega").length;
  const designDone = designTasks.filter(t => t.stage_current === "entrega").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold">Planejamento</h3>
        <span className="text-xs text-muted-foreground">
          {videoDone + designDone} de {childTasks.length} subtarefas
        </span>
      </div>

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
      />
    </div>
  );
}

function PlanningSection({
  type, icon, label, headerBg, headerText, borderColor,
  parentTask, tasks, doneCount,
  membersMap, members, onSelectSubtask, activeSubtaskId,
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
}) {
  const updateTask = useUpdatePmTask();
  const createTask = useCreatePmTask();
  const { stageAssignees } = useDefaultFlowWithDates();
  const [isOpen, setIsOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  const total = tasks.length;
  const progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [editingId]);

  const handleQuickAdd = async () => {
    const newTask = await createTask.mutateAsync({
      client_id: parentTask.client_id,
      title: `Nova subtarefa de ${label.toLowerCase()}`,
      parent_task_id: parentTask.id,
      stage_current: parentTask.stage_current,
      assignee_id: parentTask.assignee_id ?? undefined,
      watchers: parentTask.watchers ?? [],
      post_type: type,
    } as any);
    // Start editing the new task's name immediately
    if (newTask?.id) {
      setEditingId(newTask.id);
      setEditValue(`Nova subtarefa de ${label.toLowerCase()}`);
    }
  };

  const handleRenameSubmit = (subId: string) => {
    if (editValue.trim() && editValue.trim() !== "") {
      updateTask.mutate({ id: subId, title: editValue.trim() } as any);
    }
    setEditingId(null);
    setEditValue("");
  };

  const startEditing = (sub: PmTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(sub.id);
    setEditValue(sub.title);
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
          <span className="text-xs opacity-80">{doneCount}/{total}</span>
          {total > 0 && (
            <div className="w-16 mx-1">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                <div
                  className={cn("h-full rounded-full transition-all", progress === 100 ? "bg-emerald-300" : "bg-white/70")}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 ml-auto transition-transform", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className={cn("ml-2 border-l-2 pl-2 mt-1", borderColor)}>
          {tasks.map((sub) => {
            const isDone = sub.stage_current === "entrega";
            const isActive = activeSubtaskId === sub.id;
            const isEditing = editingId === sub.id;
            const subAssignees = allAssigneeIds(sub);
            const circleColor = getStageCircleColor(sub.stage_current);

            return (
              <div
                key={sub.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-2 transition border-b border-border/10",
                  isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-card/40",
                  isDone && "opacity-60"
                )}
              >
                {/* Stage circle */}
                <div className="w-8 flex justify-center">
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

                {/* Tags + Title (click = inline edit) */}
                <div className="flex-1 min-w-0 flex items-center gap-1.5" onClick={(e) => startEditing(sub, e)}>
                  {(sub.tags ?? []).map(rawTag => {
                    const tc = tagColor(rawTag);
                    const name = tagDisplay(rawTag);
                    return <Badge key={rawTag} className={cn("text-[8px] h-4 px-1 gap-0.5 border-0 shrink-0", tc.bg, tc.text)}>{name}</Badge>;
                  })}
                  {isEditing ? (
                    <Input
                      ref={editRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-6 text-sm border-0 bg-transparent shadow-none focus-visible:ring-1 focus-visible:ring-primary/50 p-0 px-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit(sub.id);
                        if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
                      }}
                      onBlur={() => handleRenameSubmit(sub.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={cn("truncate text-sm cursor-text hover:text-primary transition-colors", isDone && "line-through text-muted-foreground")}>{sub.title}</span>
                  )}
                </div>

                {/* Assignee */}
                <div className="w-20 flex justify-center">
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

                {/* Navigate arrow - only this navigates to subtask detail */}
                <button
                  className="w-6 flex justify-center cursor-pointer"
                  onClick={() => onSelectSubtask?.(sub)}
                >
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition" />
                </button>
              </div>
            );
          })}

          {/* Quick add button */}
          <button
            onClick={handleQuickAdd}
            disabled={createTask.isPending}
            className="flex items-center gap-2 px-2 py-2 w-full text-muted-foreground/60 hover:text-primary hover:bg-card/40 transition rounded-b-md"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="text-xs">Adicionar subtarefa</span>
          </button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
