import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, GitBranch, ListChecks, MessageSquare } from "lucide-react";
import { differenceInCalendarDays, eachDayOfInterval, endOfWeek, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { usePmTasks, useMyChildTasks } from "@/features/gestao/hooks/use-pm-data";
import { getStageCircleColor, stageAbbr, stageLabel } from "@/features/gestao/pm-constants";
import type { PmTask } from "@/features/gestao/pm-types";
import { CleaningTurnBanner } from "./CleaningTurnBanner";

export function dueDateLabel(dueDate: string | null, todayKey: string, isDone = false) {
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

// Largura (em px) do próprio card a partir da qual a tabela de colunas cabe; abaixo disso
// usa o layout empilhado (nome + prazo embaixo), senão a coluna do nome some ("...").
const WIDE_LAYOUT_MIN_PX = 600;

export function MyPmTasksWidget({ onOpenTask }: Props) {
  const { user } = useSession();
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (!rootEl) return;
    const ro = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= WIDE_LAYOUT_MIN_PX));
    ro.observe(rootEl);
    return () => ro.disconnect();
  }, [rootEl]);
  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");
  const currentMonthKey = format(today, "yyyy-MM");
  const weekEndKey = useMemo(() => format(endOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd"), [todayKey]);
  const [rangeMode, setRangeMode] = useState<"hoje" | "semana">("hoje");
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);

  const pmTasksQ = usePmTasks();

  // My tasks (assigned to me, including completed and overdue) — computed before the child
  // query below so its own task ids can scope that fetch to just what this widget needs.
  const myTasks = useMemo(() => {
    if (!user?.id) return [];
    return (pmTasksQ.data ?? []).filter(t =>
      (t.assignee_id === user.id || (t.watchers ?? []).includes(user.id)) &&
      !["cancelado"].includes(t.status_global) &&
      !(t as any).is_draft
    );
  }, [pmTasksQ.data, user?.id]);

  const myTaskIds = useMemo(() => myTasks.map(t => t.id), [myTasks]);
  const allChildQ = useMyChildTasks(user?.id, myTaskIds);

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
    const todayDate = new Date(todayKey + "T00:00:00");

    myTasks.forEach(t => {
      if (t.status_global === "concluido") {
        if ((t.due_date ?? "").startsWith(currentMonthKey)) completed.push(t);
        return;
      }
      if (!t.due_date) { noDue.push(t); return; }
      const diff = differenceInCalendarDays(new Date(t.due_date + "T00:00:00"), todayDate);
      if (diff < 0) overdue.push(t);
      else if (diff === 0) todayGroup.push(t);
      else if (rangeMode === "semana" && t.due_date <= weekEndKey) upcoming.push(t);
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
  }, [myTasks, todayKey, currentMonthKey, rangeMode, weekEndKey]);

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

  // Dias que ainda faltam na semana (de hoje até o fim dela), com quantas tarefas em aberto vencem em cada um
  const weekDays = useMemo(() => {
    const open = myTasks.filter((t) => t.status_global !== "concluido" && t.due_date);
    return eachDayOfInterval({ start: new Date(todayKey + "T00:00:00"), end: new Date(weekEndKey + "T00:00:00") }).map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return { key, letter: format(d, "EEEEE", { locale: ptBR }).toUpperCase(), full: format(d, "EEEE, d 'de' MMMM", { locale: ptBR }), count: open.filter((t) => t.due_date === key).length };
    });
  }, [myTasks, todayKey, weekEndKey]);

  // Nome da tarefa em destaque e o cliente embaixo: "[Doce Rio] - Design - Novembro" vira "Design · Novembro" com "Doce Rio" embaixo
  const splitTitle = (t: PmTask) => {
    const client = clientsMap[t.client_id];
    const bracket = t.title.match(/^\[([^\]]+)\]\s*-\s*(.+)$/);
    if (bracket) return { main: bracket[2].replace(/\s+-\s+/g, " · "), sub: client ?? bracket[1] };
    if (client && t.title.startsWith(`${client} - `)) return { main: t.title.slice(client.length + 3).replace(/\s+-\s+/g, " · "), sub: client };
    return { main: t.title, sub: client ?? "" };
  };

  const renderCard = (t: PmTask) => {
    const isDone = t.stage_current === "entrega" || t.status_global === "concluido";
    const due = dueDateLabel(t.due_date, todayKey, isDone);
    const commentCount = commentCounts[t.id] ?? 0;
    const childCount = childCounts[t.id] ?? 0;
    const stageColor = getStageCircleColor(t.stage_current);
    const isExpanded = expandedTasks.has(t.id);
    const children = childTasksByParent[t.id] ?? [];
    const { main, sub } = splitTitle(t);

    return (
      <div key={t.id} className="px-4">
        <div className="border-b border-border/30 transition hover:bg-muted/20">
          <button type="button" onClick={() => onOpenTask(t.id)} className="w-full py-2.5 text-left">
            <div className="flex items-center gap-2">
              <span
                className={cn("rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold tracking-wide", stageColor.text)}
                style={{ background: "color-mix(in srgb, currentColor 16%, transparent)" }}
              >
                {stageAbbr(t.stage_current)}
              </span>
              <span className={cn("ml-auto text-[11px] font-medium", due.color)}>{due.text}</span>
              {commentCount > 0 && (
                <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground"><MessageSquare className="h-3 w-3" />{commentCount}</span>
              )}
              {childCount > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={isExpanded ? "Esconder subtarefas" : "Ver subtarefas"}
                  onClick={(e) => { e.stopPropagation(); toggleExpand(t.id); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleExpand(t.id); } }}
                  className="flex items-center gap-0.5 rounded px-1 text-[11px] text-muted-foreground hover:bg-accent"
                >
                  <GitBranch className="h-3 w-3" />{childCount}
                  <ChevronRight className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-90")} />
                </span>
              )}
            </div>
            <span className="mt-1.5 block truncate text-[13px] font-medium text-foreground">{main}</span>
            {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
          </button>
          {isExpanded && children.length > 0 && (
            <div className="space-y-0.5 pb-2 pl-3">
              {children.map((sub2) => {
                const subDue = dueDateLabel(sub2.due_date, todayKey, sub2.stage_current === "entrega");
                return (
                  <button key={sub2.id} type="button" onClick={() => onOpenTask(sub2.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-accent/40">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", getStageCircleColor(sub2.stage_current).bg)} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/80">{sub2.title}</span>
                    <span className={cn("shrink-0 text-[10px] font-medium", subDue.color)}>{subDue.text}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const groupTitle = (label: string, count: number, tone = "text-foreground") => (
    <>
      <span className={cn("text-[11px] font-semibold uppercase tracking-wider", tone)}>{label}</span>
      <span className="text-[11px] text-muted-foreground">{count}</span>
    </>
  );

  if (myTasks.length === 0 && !pmTasksQ.isLoading) {
    return (
      <Card className="h-full rounded-2xl border border-border bg-card shadow-sm">
        <CardHeader className="px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ListChecks className="h-4 w-4" />
            </div>
            <CardTitle className="text-base font-semibold">Minhas tarefas</CardTitle>
          </div>
        </CardHeader>
        <CleaningTurnBanner />
        <CardContent className="px-5 pb-5">
          <p className="text-sm text-muted-foreground">Nenhuma tarefa atribuída no momento.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div ref={setRootEl} data-wide={wide} className="group/tw flex flex-col gap-3">
      <Card className="flex-1">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <ListChecks className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Minhas tarefas</CardTitle>
            <Tabs value={rangeMode} onValueChange={(v) => setRangeMode(v as any)} className="ml-auto">
              <TabsList className="bg-muted/40 h-8 p-1 rounded-full gap-1 border border-border/30">
                <TabsTrigger value="hoje" className="h-6 rounded-full text-xs data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-sm px-3 transition-all">Hoje</TabsTrigger>
                <TabsTrigger value="semana" className="h-6 rounded-full text-xs data-[state=active]:bg-sidebar data-[state=active]:text-sidebar-foreground data-[state=active]:shadow-sm px-3 transition-all">Semana</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>

        {(alteracoesParents.length > 0 || alteracoesTasks.length > 0) && (
          <div className="mx-5 mb-3 space-y-1.5">
            {/* cada tarefa em alteração é o seu próprio bloco amarelo */}
            {alteracoesParents.map((t) => {
              const subs = alteracoesChildren[t.id] ?? [];
              const isExp = expandedAlteracoes.has(t.id);
              return (
                <div key={t.id} className="overflow-hidden rounded-xl bg-[#ffcc01] text-black">
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => onOpenTask(t.id)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-black/5 active:scale-[0.99]"
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold">{t.title}</span>
                      <span className="shrink-0 text-[11px] font-semibold text-black/55">{clientsMap[t.client_id] ?? ""}</span>
                    </button>
                    {subs.length > 0 && (
                      <button
                        type="button"
                        aria-label={isExp ? "Esconder subtarefas" : "Ver subtarefas"}
                        aria-expanded={isExp}
                        onClick={() => setExpandedAlteracoes((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; })}
                        className="mr-1 shrink-0 rounded-lg p-2 transition hover:bg-black/10"
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", isExp && "rotate-180")} />
                      </button>
                    )}
                  </div>
                  {isExp && subs.length > 0 && (
                    <div className="space-y-0.5 border-t border-black/10 px-2 pb-2 pt-1.5">
                      {subs.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onOpenTask(sub.id)}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition hover:bg-black/8"
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-black/40" />
                          <span className="truncate font-medium text-black/75">{sub.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {alteracoesTasks.filter((t) => t.parent_task_id && !alteracoesParents.some((p) => p.id === t.parent_task_id)).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenTask(t.id)}
                className="flex w-full items-center gap-2.5 rounded-xl bg-[#ffcc01] px-3.5 py-2.5 text-left text-black transition hover:brightness-95 active:scale-[0.99]"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{t.title}</span>
                <span className="shrink-0 text-[11px] font-semibold text-black/55">{clientsMap[t.client_id] ?? ""}</span>
              </button>
            ))}
          </div>
        )}
        <CleaningTurnBanner />
        <CardContent className="p-0 pb-2">
        {/* Em atraso */}
        {groups.overdue.length > 0 && (
          <Collapsible open={openOverdue} onOpenChange={setOpenOverdue}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-accent/20">
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !openOverdue && "-rotate-90")} />
                {groupTitle("Em atraso", groups.overdue.length, "text-destructive")}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>{groups.overdue.map(renderCard)}</CollapsibleContent>
          </Collapsible>
        )}

        {rangeMode === "hoje" ? (
          groups.today.length > 0 && (
            <Collapsible open={openToday} onOpenChange={setOpenToday}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-accent/20">
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !openToday && "-rotate-90")} />
                  {groupTitle("Hoje", groups.today.length)}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>{groups.today.map(renderCard)}</CollapsibleContent>
            </Collapsible>
          )
        ) : (
          <div className="pt-1">
            {/* faixa de dias: toque num dia para ver só as tarefas dele */}
            <div className="flex gap-1 px-4 pb-2">
              {weekDays.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDay(d.key)}
                  title={d.full}
                  aria-pressed={selectedDay === d.key}
                  className={cn(
                    "flex-1 rounded-xl border px-1 py-1.5 text-center text-[10.5px] transition",
                    selectedDay === d.key ? "border-primary bg-primary text-primary-foreground" : "border-border/50 text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {d.letter}
                  <span className={cn("block text-[13px] font-medium", selectedDay === d.key ? "text-primary-foreground" : d.count ? "text-foreground" : "text-muted-foreground/60")}>{d.count}</span>
                </button>
              ))}
            </div>
            {(() => {
              const day = weekDays.find((d) => d.key === selectedDay) ?? weekDays[0];
              const list = myTasks.filter((t) => t.status_global !== "concluido" && t.due_date === day?.key);
              return list.length > 0
                ? list.map(renderCard)
                : <p className="px-4 py-3 text-center text-xs text-muted-foreground">Nenhuma tarefa para {day?.key === todayKey ? "hoje" : "esse dia"}.</p>;
            })()}
          </div>
        )}

        {/* Sem data */}
        {groups.noDue.length > 0 && (
          <>
            <div className="flex items-center gap-2 px-4 py-2">{groupTitle("Sem data", groups.noDue.length, "text-muted-foreground")}</div>
            {groups.noDue.map(renderCard)}
          </>
        )}

        {/* Concluídas */}
        {groups.completed.length > 0 && (
          <Collapsible open={openCompleted} onOpenChange={setOpenCompleted}>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-accent/20">
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !openCompleted && "-rotate-90")} />
                {groupTitle("Concluídas", groups.completed.length, "text-success")}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>{groups.completed.map(renderCard)}</CollapsibleContent>
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
