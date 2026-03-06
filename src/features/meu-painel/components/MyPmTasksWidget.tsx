import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Flag, GitBranch, MessageSquare, Paperclip, FileText } from "lucide-react";
import { differenceInCalendarDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { usePmTasks, usePmAllChildTasks } from "@/features/gestao/hooks/use-pm-data";
import type { PmTask } from "@/features/gestao/pm-types";

const PRIORITY_FLAG: Record<string, string> = {
  urgente: "text-destructive",
  alta: "text-warning",
  media: "text-foreground/60",
  baixa: "text-muted-foreground/40",
};

const STATUS_DOT: Record<string, string> = {
  backlog: "border-muted-foreground/50 bg-transparent",
  em_andamento: "border-warning bg-warning/30",
  em_aprovacao: "border-primary bg-primary/30",
  concluido: "border-success bg-success",
  pausado: "border-muted-foreground bg-muted-foreground/30",
  cancelado: "border-destructive bg-destructive/30",
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

  // Child tasks count per parent
  const childCounts = useMemo(() => {
    const m: Record<string, number> = {};
    (allChildQ.data ?? []).forEach(t => {
      if (t.parent_task_id) m[t.parent_task_id] = (m[t.parent_task_id] ?? 0) + 1;
    });
    return m;
  }, [allChildQ.data]);

  // My tasks (assigned to me, not completed/cancelled)
  const myTasks = useMemo(() => {
    if (!user?.id) return [];
    return (pmTasksQ.data ?? []).filter(t =>
      t.assignee_id === user.id &&
      !["concluido", "cancelado"].includes(t.status_global) &&
      !(t as any).is_draft
    );
  }, [pmTasksQ.data, user?.id]);

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

  const renderHeader = () => (
    <div className="grid grid-cols-[1fr_100px_140px_100px] gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border/30">
      <span>Nome</span>
      <span>Prioridade</span>
      <span>Data de vencimento</span>
      <span>Comentários</span>
    </div>
  );

  const renderRow = (t: PmTask) => {
    const clientName = clientsMap[t.client_id] ?? "";
    const due = dueDateLabel(t.due_date, todayKey);
    const commentCount = commentCounts[t.id] ?? 0;
    const childCount = childCounts[t.id] ?? 0;
    const dotClass = STATUS_DOT[t.status_global] ?? STATUS_DOT.backlog;
    const flagClass = PRIORITY_FLAG[t.priority] ?? PRIORITY_FLAG.baixa;

    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onOpenTask(t.id)}
        className="group grid w-full grid-cols-[1fr_100px_140px_100px] items-center gap-2 border-b border-border/20 px-3 py-2 text-left transition hover:bg-accent/30"
      >
        {/* Name */}
        <div className="flex min-w-0 items-center gap-2">
          {childCount > 0 && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className={cn("h-3 w-3 shrink-0 rounded-full border-2", dotClass)} />
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
    );
  };

  if (myTasks.length === 0 && !pmTasksQ.isLoading) return null;

  return (
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
