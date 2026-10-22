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
import { usePeriodicStages } from "@/features/gestao/hooks/use-periodic-stages";
import { getPeriodicTime, getStageBadgeFor, stripPeriodicTime } from "@/features/gestao/lib/stage-badge";
import type { PmTask } from "@/features/gestao/pm-types";
import { CleaningTurnBanner } from "./CleaningTurnBanner";

/** Horário da tarefa ("HH:MM"): o de entrega ou, nas periódicas (reuniões etc.), o que já vem no título/postagem. */
function timeOf(t: PmTask): string | null {
  if (t.due_time) return t.due_time.slice(0, 5);
  if (t.periodic_stage_key) {
    const pt = getPeriodicTime(t);
    if (pt && /^\d{1,2}:\d{2}/.test(pt)) return pt.padStart(5, "0").slice(0, 5);
  }
  return null;
}

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
  // relógio do "Próxima": atualiza a cada minuto
  const [nowTick, setNowTick] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNowTick(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const pmTasksQ = usePmTasks();
  const { data: periodicStages = [] } = usePeriodicStages();

  // My tasks (assigned to me, including completed and overdue) — computed before the child
  // query below so its own task ids can scope that fetch to just what this widget needs.
  const myTasks = useMemo(() => {
    if (!user?.id) return [];
    return (pmTasksQ.data ?? []).filter(t =>
      (t.assignee_id === user.id || (t.watchers ?? []).includes(user.id)) &&
      // "pausado" = a revisão que já foi mandada para Alteração: a tarefa segue com quem recebeu a alteração, não fica na lista de quem revisou
      !["cancelado", "pausado"].includes(t.status_global) &&
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
    const rootById = new Map(allData.map((r) => [r.id, r] as const));
    return combined.filter(t =>
      t.stage_current === "alteracoes" &&
      (t.assignee_id === user.id || (t.watchers ?? []).includes(user.id)) &&
      !["concluido", "cancelado"].includes(t.status_global) &&
      !(t as any).is_draft &&
      // Uma subtarefa só conta como alteração enquanto a tarefa-mãe dela ainda está em alteração: se a mãe já seguiu o fluxo,
      // a subtarefa que ficou para trás com a etapa antiga não pode voltar para Minhas tarefas (era o bug do "volta como alteração").
      (!t.parent_task_id || rootById.get(t.parent_task_id)?.stage_current === "alteracoes")
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

  // quem já aparece no grupo "Alteração" não repete nas outras listas (Em atraso, Hoje...)
  const alteracaoIds = useMemo(() => new Set(alteracoesParents.map((t) => t.id)), [alteracoesParents]);

  // Group by overdue, today, upcoming, completed
  const groups = useMemo(() => {
    const overdue: PmTask[] = [];
    const todayGroup: PmTask[] = [];
    const upcoming: PmTask[] = [];
    const noDue: PmTask[] = [];
    const completed: PmTask[] = [];
    const todayDate = new Date(todayKey + "T00:00:00");

    myTasks.forEach(t => {
      if (alteracaoIds.has(t.id)) return;
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
      if (da !== db) return da.localeCompare(db);
      // mesmo dia: quem tem horário vem primeiro, do mais cedo ao mais tarde
      const ta = timeOf(a);
      const tb = timeOf(b);
      if (ta && tb) return ta.localeCompare(tb);
      if (ta || tb) return ta ? -1 : 1;
      return 0;
    };

    overdue.sort(sortByDue);
    todayGroup.sort(sortByDue);
    upcoming.sort(sortByDue);
    completed.sort(sortByDue);

    return { overdue, today: todayGroup, upcoming, noDue, completed };
  }, [myTasks, alteracaoIds, todayKey, currentMonthKey, rangeMode, weekEndKey]);

  // Próxima tarefa de hoje com horário que ainda não passou (sobe para o topo da aba Hoje, com quanto falta)
  const nextToday = useMemo(() => {
    const nowHHMM = format(nowTick, "HH:mm");
    const upcoming = groups.today
      .map((t) => ({ t, time: timeOf(t) }))
      .filter((x): x is { t: PmTask; time: string } => !!x.time && x.time > nowHHMM)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (upcoming.length === 0) return null;
    const { t, time } = upcoming[0];
    const [h, m] = time.split(":").map(Number);
    const diffMin = h * 60 + m - (nowTick.getHours() * 60 + nowTick.getMinutes());
    const left = diffMin >= 60 ? `${Math.floor(diffMin / 60)}h${diffMin % 60 ? ` ${diffMin % 60}min` : ""}` : `${diffMin}min`;
    return { task: t, time, left };
  }, [groups.today, nowTick]);

  const [openOverdue, setOpenOverdue] = useState(true);
  const [openToday, setOpenToday] = useState(true);
  const [openUpcoming, setOpenUpcoming] = useState(false);
  const [openCompleted, setOpenCompleted] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedAlteracoes, setExpandedAlteracoes] = useState<Set<string>>(new Set());
  const [openAlteracoes, setOpenAlteracoes] = useState(true);

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
    const open = myTasks.filter((t) => t.status_global !== "concluido" && t.due_date && !alteracaoIds.has(t.id));
    return eachDayOfInterval({ start: new Date(todayKey + "T00:00:00"), end: new Date(weekEndKey + "T00:00:00") }).map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return { key, letter: format(d, "EEEEE", { locale: ptBR }).toUpperCase(), full: format(d, "EEEE, d 'de' MMMM", { locale: ptBR }), count: open.filter((t) => t.due_date === key).length };
    });
  }, [myTasks, alteracaoIds, todayKey, weekEndKey]);

  // Nome da tarefa em destaque e o cliente embaixo: "[Doce Rio] - Design - Novembro" vira "Design · Novembro" com "Doce Rio" embaixo
  const splitTitle = (t: PmTask) => {
    const client = clientsMap[t.client_id];
    // tarefas periódicas (reuniões etc.): o título que a pessoa escreveu (sem a hora no fim) e o cliente embaixo
    if (t.periodic_stage_key) return { main: stripPeriodicTime(t.title), sub: client ?? "" };
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
    const badge = getStageBadgeFor(t, childTasksByParent[t.id] ?? [], periodicStages);
    const time = timeOf(t);
    const isExpanded = expandedTasks.has(t.id);
    const children = childTasksByParent[t.id] ?? [];
    const { main, sub } = splitTitle(t);

    return (
      <div key={t.id} className="px-4">
        <div className="border-b border-border/30 transition hover:bg-muted/20">
          <button type="button" onClick={() => onOpenTask(t.id)} className="w-full py-2.5 text-left">
            <div className="flex items-center gap-2">
              <span className={cn("rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-white", badge.bg)} style={badge.style}>
                {badge.abbr}
              </span>
              <span className={cn("ml-auto text-[11px] font-medium", due.color)}>{due.text}{time ? ` · ${time}` : ""}</span>
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

        <CleaningTurnBanner />
        {alteracoesTasks.length > 0 && (
          <Collapsible open={openAlteracoes} onOpenChange={setOpenAlteracoes} className="mx-3 mb-2 rounded-xl border border-[#f4c430]/35 bg-[#f4c430]/[0.06] pb-1">
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left">
                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !openAlteracoes && "-rotate-90")} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#f4c430]">Alteração</span>
                <span className="ml-auto rounded-full bg-[#f4c430]/20 px-2 text-[11px] tabular-nums text-[#f4c430]">{alteracoesTasks.filter((t) => !t.parent_task_id || !alteracoesParents.some((p) => p.id === t.parent_task_id)).length}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {alteracoesParents.map((t) => {
                const subs = alteracoesChildren[t.id] ?? [];
                const isExp = expandedAlteracoes.has(t.id);
                const badge = getStageBadgeFor(t, childTasksByParent[t.id] ?? [], periodicStages);
                const { main, sub } = splitTitle(t);
                return (
                  <div key={t.id}>
                    <div className="flex items-center gap-2.5 px-3 py-2 transition hover:bg-[#f4c430]/[0.06]">
                      <button type="button" onClick={() => onOpenTask(t.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-white", badge.bg)} style={badge.style}>{badge.abbr}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-foreground">{main}</span>
                          {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
                        </span>
                      </button>
                      {subs.length > 0 ? (
                        <button
                          type="button"
                          aria-label={isExp ? "Esconder subtarefas" : "Ver subtarefas"}
                          aria-expanded={isExp}
                          onClick={() => setExpandedAlteracoes((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; })}
                          className="flex shrink-0 items-center gap-0.5 rounded px-1 text-[11px] text-muted-foreground hover:bg-accent"
                        >
                          <GitBranch className="h-3 w-3" />{subs.length}
                          <ChevronRight className={cn("h-3 w-3 transition-transform", isExp && "rotate-90")} />
                        </button>
                      ) : (
                        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                      )}
                    </div>
                    {isExp && subs.length > 0 && (
                      <div className="space-y-0.5 pb-1 pl-12 pr-3">
                        {subs.map((s2) => (
                          <button
                            key={s2.id}
                            type="button"
                            onClick={() => onOpenTask(s2.id)}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-accent/40"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f4c430]" />
                            <span className="truncate font-medium text-foreground/90">{s2.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {alteracoesTasks.filter((t) => t.parent_task_id && !alteracoesParents.some((p) => p.id === t.parent_task_id)).map((t) => {
                const badge = getStageBadgeFor(t, [], periodicStages);
                const { main, sub } = splitTitle(t);
                return (
                  <button key={t.id} type="button" onClick={() => onOpenTask(t.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#f4c430]/[0.06]">
                    <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-white", badge.bg)} style={badge.style}>{badge.abbr}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">{main}</span>
                      {sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}
                    </span>
                    <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
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

        {rangeMode === "hoje" && nextToday && (() => {
          const t = nextToday.task;
          const badge = getStageBadgeFor(t, childTasksByParent[t.id] ?? [], periodicStages);
          const { main, sub } = splitTitle(t);
          return (
            <button
              type="button"
              onClick={() => onOpenTask(t.id)}
              className="mx-4 mb-2 mt-3 block w-[calc(100%-2rem)] rounded-[10px] bg-gradient-to-br from-[#4a2bb8] via-[#6d3fe0] to-[#8f62f2] px-2.5 py-[7px] text-left text-white transition hover:brightness-110 active:scale-[0.99]"
            >
              <span className="flex items-center gap-[7px]">
                <span className="text-[10px] uppercase tracking-wide text-white/85">Próxima</span>
                <span className="text-sm font-semibold tabular-nums leading-none">{nextToday.time}</span>
                <span className={cn("rounded-[5px] px-1.5 py-0.5 text-[9.5px] font-bold tracking-wide text-white ring-1 ring-white/30", badge.bg)} style={badge.style}>{badge.abbr}</span>
                <span className="ml-auto whitespace-nowrap text-[10.5px] text-white/85">em {nextToday.left}</span>
              </span>
              <span className="mt-[3px] block truncate text-[12.5px] font-medium">
                {main}
                {sub && <span className="font-normal text-white/80"> · {sub}</span>}
              </span>
            </button>
          );
        })()}

        {rangeMode === "hoje" ? (
          // se a única tarefa de hoje é a "Próxima" (já em destaque), não sobra lista nenhuma para mostrar
          groups.today.filter((t) => t.id !== nextToday?.task.id).length > 0 && (
            <Collapsible open={openToday} onOpenChange={setOpenToday}>
              <CollapsibleTrigger asChild>
                <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-accent/20">
                  <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", !openToday && "-rotate-90")} />
                  {groupTitle("Hoje", groups.today.length)}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>{groups.today.filter((t) => t.id !== nextToday?.task.id).map(renderCard)}</CollapsibleContent>
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
