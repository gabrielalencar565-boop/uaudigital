import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Flag, GitBranch, MessageSquare, FileText } from "lucide-react";
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

function dueDateLabel(dueDate: string | null, todayKey: string) {
  if (!dueDate) return { text: "—", color: "text-muted-foreground" };
  const today = new Date(todayKey + "T00:00:00");
  const due = new Date(dueDate + "T00:00:00");
  const diff = differenceInCalendarDays(due, today);

  if (diff < -1) return { text: `${format(due, "M/d/yy")}`, color: "text-destructive" };
  if (diff === -1) return { text: "Ontem", color: "text-destructive" };
  if (diff === 0) return { text: "Hoje", color: "text-warning" };
  if (diff === 1) return { text: "Amanhã", color: "text-foreground" };
  return { text: format(due, "M/d/yy"), color: "text-muted-foreground" };
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

  // My tasks (assigned to me, not completed/cancelled)
  const myTasks = useMemo(() => {
    if (!user?.id) return [];
    return (pmTasksQ.data ?? []).filter(t =>
      t.assignee_id === user.id &&
      !["concluido", "cancelado"].includes(t.status_global) &&
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

  // Group by overdue, today, upcoming
  const groups = useMemo(() => {
    const overdue: PmTask[] = [];
    const todayGroup: PmTask[] = [];
    const upcoming: PmTask[] = [];
    const noDue: PmTask[] = [];

    myTasks.forEach(t => {
      if (!t.due_date) { noDue.push(t); return; }
      const diff = differenceInCalendarDays(new Date(t.due_date + "T00:00:00"), today);
      if (diff < 0) overdue.push(t);
      else if (diff === 0) todayGroup.push(t);
      else upcoming.push(t);
    });

    return { overdue, today: todayGroup, upcoming, noDue };
  }, [myTasks, todayKey]);

  const [openOverdue, setOpenOverdue] = useState(true);
  const [openToday, setOpenToday] = useState(true);
  const [openUpcoming, setOpenUpcoming] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpand = (taskId: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const renderHeader = () => (
    <div className="grid grid-cols-[1fr_100px_140px_100px] gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border/30">
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
          className="group grid w-full grid-cols-[1fr_100px_140px_100px] items-center gap-2 border-b border-border/20 px-3 py-2 text-left transition hover:bg-accent/30"
        >
          {/* Name */}
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

          {/* Priority */}
          <div>
            <Flag className={cn("h-3.5 w-3.5", flagClass)} />
          </div>

          {/* Due date */}
          <div className={cn("text-[13px] font-medium", due.color)}>
            {due.text}
          </div>

          {/* Comments */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            {commentCount > 0 && (
              <span className="text-[12px] font-medium text-foreground">{commentCount}</span>
            )}
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
                  className="group grid w-full grid-cols-[1fr_100px_140px_100px] items-center gap-2 px-3 py-1.5 text-left transition hover:bg-accent/30 pl-10"
                >
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
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (myTasks.length === 0 && !pmTasksQ.isLoading) return null;

  return (
    <div className="space-y-3">
      {/* Alert for tasks in Alterações */}
      {alteracoesTasks.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-sm font-semibold text-amber-500">
              {alteracoesTasks.length} {alteracoesTasks.length === 1 ? "tarefa" : "tarefas"} em Alteração
            </span>
          </div>
          <div className="space-y-1.5">
            {alteracoesTasks.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenTask(t.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-amber-500/10"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
                <span className="truncate font-medium text-foreground">{t.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{clientsMap[t.client_id] ?? ""}</span>
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
              {renderHeader()}
              {groups.overdue.map(renderRow)}
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
              {renderHeader()}
              {groups.today.map(renderRow)}
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
              {renderHeader()}
              {groups.upcoming.map(renderRow)}
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

        {myTasks.length === 0 && !pmTasksQ.isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma tarefa atribuída a você
          </div>
        )}
      </CardContent>
    </Card>
  );
}
