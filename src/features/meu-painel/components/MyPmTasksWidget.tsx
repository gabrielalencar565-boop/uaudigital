import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Flag, GitBranch, ListChecks, MessageSquare, FileText } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { usePmTasks, usePmAllChildTasks } from "@/features/gestao/hooks/use-pm-data";
import { getStageCircleColor, stageLabel } from "@/features/gestao/pm-constants";
import type { PmTask } from "@/features/gestao/pm-types";

const PRIORITY_FLAG: Record<string, string> = {
  urgente: "text-destructive",
  alta: "text-warning",
  media: "text-foreground/60",
  baixa: "text-muted-foreground/40",
};

function dueDateLabel(dueDate: string | null, todayKey: string, isDone = false) {
  if (!dueDate) return { text: "—", color: "text-muted-foreground" };
  const today = new Date(todayKey + "T00:00:00");
  const due = new Date(dueDate + "T00:00:00");
  const diff = differenceInCalendarDays(due, today);

  const text = diff < -1 ? format(due, "dd/MM/yyyy")
    : diff === -1 ? "Ontem"
    : diff === 0 ? "Hoje"
    : diff === 1 ? "Amanhã"
    : format(due, "dd/MM/yyyy");

  if (isDone) return { text, color: "text-success" };

  if (diff < -1) return { text, color: "text-destructive" };
  if (diff === -1) return { text, color: "text-destructive" };
  if (diff === 0) return { text, color: "text-warning" };
  if (diff === 1) return { text, color: "text-foreground" };
  return { text, color: "text-muted-foreground" };
}

interface Props {
  onOpenTask: (taskId: string) => void;
}

export function MyPmTasksWidget({ onOpenTask }: Props) {
  const { user } = useSession();
  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");

  const pmTasksQ = usePmTasks();
  const allChildQ = usePmAllChildTasks();

  // Clients
  const clientsQ = useQuery({
    queryKey: ["clients_all"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      return data ?? [];
    },
  });
  const clientsMap = useMemo(() => {
    const m: Record<string, string> = {};
    (clientsQ.data ?? []).forEach(c => { m[c.id] = c.name; });
    return m;
  }, [clientsQ.data]);

  // Comments count per task
  const commentsQ = useQuery({
    queryKey: ["pm_comments_counts"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pm_comments")
        .select("task_id");
      return data ?? [];
    },
  });
  const commentCounts = useMemo(() => {
    const m: Record<string, number> = {};
    (commentsQ.data ?? []).forEach((c: any) => {
      if (c.task_id) m[c.task_id] = (m[c.task_id] ?? 0) + 1;
    });
    return m;
  }, [commentsQ.data]);

  // Child tasks grouped by parent
  const childTasksByParent = useMemo(() => {
    const m: Record<string, PmTask[]> = {};
    (allChildQ.data ?? []).forEach(t => {
      if (t.parent_task_id) {
        if (!m[t.parent_task_id]) m[t.parent_task_id] = [];
        m[t.parent_task_id].push(t);
      }
    });
    return m;
  }, [allChildQ.data]);

  const childCounts = useMemo(() => {
    const m: Record<string, number> = {};
    Object.entries(childTasksByParent).forEach(([parentId, children]) => {
      m[parentId] = children.length;
    });
    return m;
  }, [childTasksByParent]);

  // My tasks (assigned to me, including completed and overdue)
  const myTasks = useMemo(() => {
    if (!user?.id) return [];
    return (pmTasksQ.data ?? []).filter(t =>
      t.assignee_id === user.id &&
      !["cancelado"].includes(t.status_global) &&
      !(t as any).is_draft
    );
  }, [pmTasksQ.data, user?.id]);

  // Tasks/subtasks in "alteracoes" stage assigned to me
  const alteracoesTasks = useMemo(() => {
    if (!user?.id) return [];
    const allData = pmTasksQ.data ?? [];
    const childData = allChildQ.data ?? [];
    const combined = [...allData, ...childData];
    return combined.filter(t =>
      t.stage_current === "alteracoes" &&
      (t.assignee_id === user.id || (t.watchers ?? []).includes(user.id)) &&
      !["concluido", "cancelado"].includes(t.status_global) &&
      !(t as any).is_draft
    );
  }, [pmTasksQ.data, allChildQ.data, user?.id]);

  const alteracoesParents = useMemo(() => alteracoesTasks.filter(t => !t.parent_task_id), [alteracoesTasks]);
  const alteracoesChildren = useMemo(() => {
    const m: Record<string, PmTask[]> = {};
    alteracoesTasks.filter(t => t.parent_task_id).forEach(t => {
      const pid = t.parent_task_id!;
      if (!m[pid]) m[pid] = [];
      m[pid].push(t);
    });
    return m;
  }, [alteracoesTasks]);

  // Group by overdue, today, upcoming, completed
  const groups = useMemo(() => {
    const overdue: PmTask[] = [];
    const todayGroup: PmTask[] = [];
    const upcoming: PmTask[] = [];
    const noDue: PmTask[] = [];
    const completed: PmTask[] = [];

    myTasks.forEach(t => {
      if (t.status_global === "concluido") { completed.push(t); return; }
      if (!t.due_date) { noDue.push(t); return; }
      const diff = differenceInCalendarDays(new Date(t.due_date + "T00:00:00"), today);
      if (diff < 0) overdue.push(t);
      else if (diff === 0) todayGroup.push(t);
      else upcoming.push(t);
    });

    const sortByDue = (a: PmTask, b: PmTask) => {
      const da = a.due_date ?? "";
      const db = b.due_date ?? "";
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.localeCompare(db);
    };

    overdue.sort(sortByDue);
    todayGroup.sort(sortByDue);
    upcoming.sort(sortByDue);
    completed.sort(sortByDue);

    return { overdue, today: todayGroup, upcoming, noDue, completed };
  }, [myTasks, todayKey]);

  const [openOverdue, setOpenOverdue] = useState(true);
  const [openToday, setOpenToday] = useState(true);
  const [openUpcoming, setOpenUpcoming] = useState(false);
  const [openCompleted, setOpenCompleted] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedAlteracoes, setExpandedAlteracoes] = useState<Set<string>>(new Set());

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const renderHeader = () => (
    <div className="hidden sm:grid grid-cols-[1fr_100px_140px_100px] gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border/30">
      <span>Nome</span>
      <span>Prioridade</span>
      <span>Data de vencimento</span>
      <span>Comentários</span>
    </div>
  );

  const renderRow = (t: PmTask) => {
    const due = dueDateLabel(t.due_date, todayKey);
    const commentCount = commentCounts[t.id] ?? 0;
    const childCount = childCounts[t.id] ?? 0;
    const stageColor = getStageCircleColor(t.stage_current);
    const isDone = t.stage_current === "entrega";
    const flagClass = PRIORITY_FLAG[t.priority] ?? PRIORITY_FLAG.baixa;
    const isExpanded = expandedTasks.has(t.id);
    const children = childTasksByParent[t.id] ?? [];

    return (
      <div key={t.id}>
        <button
          type="button"
          onClick={() => onOpenTask(t.id)}
          className="group w-full border-b border-border/20 px-3 py-2 text-left transition hover:bg-accent/30"
        >
          {/* Mobile: stacked layout */}
          <div className="flex sm:hidden min-w-0 items-start gap-2">
            {childCount > 0 && (
              <button
                type="button"
                className="shrink-0 p-0.5 rounded hover:bg-accent transition mt-0.5"
                onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
              >
                <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
              </button>
            )}
            <span className={cn(
              "h-3 w-3 shrink-0 rounded-full border-2 mt-0.5",
              stageColor.border,
              isDone && stageColor.bg,
            )} />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">{t.title}</span>
              <div className="flex items-center gap-2 mt-1">
                <Flag className={cn("h-3 w-3 shrink-0", flagClass)} />
                <span className={cn("text-[11px] font-medium", due.color)}>{due.text}</span>
                {commentCount > 0 && (
                  <span className="flex items-center gap-0.5 text-muted-foreground">
                    <MessageSquare className="h-3 w-3" />
                    <span className="text-[10px] font-medium text-foreground">{commentCount}</span>
                  </span>
                )}
                {childCount > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <GitBranch className="h-3 w-3" /> {childCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Desktop: grid layout */}
          <div className="hidden sm:grid grid-cols-[1fr_100px_140px_100px] items-center gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {childCount > 0 && (
                <button
                  type="button"
                  className="shrink-0 p-0.5 rounded hover:bg-accent transition"
                  onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
                >
                  <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                </button>
              )}
              <span className={cn(
                "h-3 w-3 shrink-0 rounded-full border-2",
                stageColor.border,
                isDone && stageColor.bg,
              )} />
              <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
                {t.title}
              </span>
              {t.description && (
                <FileText className="h-3 w-3 shrink-0 text-muted-foreground/50" />
              )}
              {childCount > 0 && (
                <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-muted-foreground">
                  <GitBranch className="h-3 w-3" /> {childCount}
                </span>
              )}
            </div>
            <div>
              <Flag className={cn("h-3.5 w-3.5", flagClass)} />
            </div>
            <div className={cn("text-[13px] font-medium", due.color)}>
              {due.text}
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              {commentCount > 0 && (
                <span className="text-[12px] font-medium text-foreground">{commentCount}</span>
              )}
            </div>
          </div>
        </button>

        {/* Expanded subtasks */}
        {isExpanded && children.length > 0 && (
          <div className="border-b border-border/20">
            {children.map(sub => {
              const subDue = dueDateLabel(sub.due_date, todayKey);
              const subStageColor = getStageCircleColor(sub.stage_current);
              const subIsDone = sub.stage_current === "entrega";
              const subFlagClass = PRIORITY_FLAG[sub.priority] ?? PRIORITY_FLAG.baixa;
              const subCommentCount = commentCounts[sub.id] ?? 0;

              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onOpenTask(sub.id)}
                  className="w-full px-3 py-1.5 text-left transition hover:bg-accent/30 pl-8 sm:pl-10"
                >
                  {/* Mobile subtask */}
                  <div className="flex sm:hidden min-w-0 items-start gap-2">
                    <span className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full border-2 mt-0.5",
                      subStageColor.border,
                      subIsDone && subStageColor.bg,
                    )} />
                    <div className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[12px] font-medium text-foreground/80", subIsDone && "line-through text-muted-foreground")}>
                        {sub.title}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Flag className={cn("h-2.5 w-2.5", subFlagClass)} />
                        <span className={cn("text-[10px] font-medium", subDue.color)}>{subDue.text}</span>
                      </div>
                    </div>
                  </div>
                  {/* Desktop subtask */}
                  <div className="hidden sm:grid grid-cols-[1fr_100px_140px_100px] items-center gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full border-2",
                        subStageColor.border,
                        subIsDone && subStageColor.bg,
                      )} />
                      <span className={cn("min-w-0 truncate text-[12px] font-medium text-foreground/80", subIsDone && "line-through text-muted-foreground")}>
                        {sub.title}
                      </span>
                    </div>
                    <div>
                      <Flag className={cn("h-3 w-3", subFlagClass)} />
                    </div>
                    <div className={cn("text-[12px] font-medium", subDue.color)}>
                      {subDue.text}
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      {subCommentCount > 0 && (
                        <span className="text-[11px] font-medium text-foreground">{subCommentCount}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (myTasks.length === 0 && !pmTasksQ.isLoading) {
    return (
      <Card className="rounded-2xl border border-border bg-card shadow-sm">
        <CardHeader className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base font-semibold">Atribuídas a mim</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Alert for tasks in Alterações */}
      {alteracoesParents.length > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: 'linear-gradient(135deg, #ffcc01 0%, #f5b800 100%)' }}>
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-black/10 backdrop-blur-sm flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-black/80" />
              </div>
              <div>
                <p className="text-sm font-bold text-black/90 tracking-tight">
                  {alteracoesParents.length} {alteracoesParents.length === 1 ? "tarefa" : "tarefas"} em Alteração
                </p>
                <p className="text-[11px] text-black/50 font-medium">Aguardando correção</p>
              </div>
            </div>
          </div>
          <div className="px-3 pb-3 space-y-1">
            {alteracoesParents.map(t => {
              const subs = alteracoesChildren[t.id] ?? [];
              const isExp = expandedAlteracoes.has(t.id);
              return (
                <div key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTask(t.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all hover:bg-black/8 active:scale-[0.99]"
                  >
                    {subs.length > 0 && (
                      <span
                        role="button"
                        className="shrink-0 p-1 rounded-lg hover:bg-black/10 transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedAlteracoes(prev => {
                            const next = new Set(prev);
                            if (next.has(t.id)) next.delete(t.id); else next.add(t.id);
                            return next;
                          });
                        }}
                      >
                        <ChevronRight className={cn("h-3.5 w-3.5 text-black/50 transition-transform", isExp && "rotate-90")} />
                      </span>
                    )}
                    <span className="h-2 w-2 shrink-0 rounded-full bg-black/70 ring-2 ring-black/10" />
                    <span className="truncate font-semibold text-black/85">{t.title}</span>
                    <span className="ml-auto shrink-0 rounded-md bg-black/8 px-2 py-0.5 text-[10px] font-bold text-black/50 tracking-wide">
                      {clientsMap[t.client_id] ?? ""}
                    </span>
                  </button>
                  {isExp && subs.length > 0 && (
                    <div className="pl-10 space-y-0.5 pb-1">
                      {subs.map(sub => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onOpenTask(sub.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition hover:bg-black/8"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-black/40" />
                          <span className="truncate font-medium text-black/70">{sub.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {alteracoesTasks.filter(t => t.parent_task_id && !alteracoesParents.some(p => p.id === t.parent_task_id)).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenTask(t.id)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-all hover:bg-black/8"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-black/70 ring-2 ring-black/10" />
                <span className="truncate font-semibold text-black/85">{t.title}</span>
                <span className="ml-auto shrink-0 rounded-md bg-black/8 px-2 py-0.5 text-[10px] font-bold text-black/50 tracking-wide">
                  {clientsMap[t.client_id] ?? ""}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Atribuídas a mim</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
        {/* Em atraso */}
        {groups.overdue.length > 0 && (
          <Collapsible open={openOverdue} onOpenChange={setOpenOverdue}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-accent/20">
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !openOverdue && "-rotate-90")} />
                <span className="text-sm font-semibold text-destructive">Em atraso</span>
                <span className="text-xs text-muted-foreground">{groups.overdue.length}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {renderHeader()}{groups.overdue.map(renderRow)}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Hoje */}
        {groups.today.length > 0 && (
          <Collapsible open={openToday} onOpenChange={setOpenToday}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-accent/20">
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !openToday && "-rotate-90")} />
                <span className="text-sm font-semibold text-foreground">Hoje</span>
                <span className="text-xs text-muted-foreground">{groups.today.length}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {renderHeader()}{groups.today.map(renderRow)}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Próximas */}
        {groups.upcoming.length > 0 && (
          <Collapsible open={openUpcoming} onOpenChange={setOpenUpcoming}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-accent/20">
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !openUpcoming && "-rotate-90")} />
                <span className="text-sm font-semibold text-foreground">Próximas</span>
                <span className="text-xs text-muted-foreground">{groups.upcoming.length}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {renderHeader()}{groups.upcoming.map(renderRow)}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Sem data */}
        {groups.noDue.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-sm font-semibold text-muted-foreground">Sem data</span>
              <span className="text-xs text-muted-foreground">{groups.noDue.length}</span>
            </div>
            {renderHeader()}
            {groups.noDue.map(renderRow)}
          </>
        )}

        {/* Concluídas */}
        {groups.completed.length > 0 && (
          <Collapsible open={openCompleted} onOpenChange={setOpenCompleted}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-accent/20">
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !openCompleted && "-rotate-90")} />
                <span className="text-sm font-semibold text-success">Concluídas</span>
                <span className="text-xs text-muted-foreground">{groups.completed.length}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {renderHeader()}{groups.completed.map(renderRow)}
            </CollapsibleContent>
          </Collapsible>
        )}

        {myTasks.length === 0 && !pmTasksQ.isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma tarefa atribuída a você
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
