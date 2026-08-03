import { useMemo, useState } from "react";
import { addDays, endOfMonth, format, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import { cn } from "@/lib/utils";
import { useTasks, useTeamMembers } from "@/features/data/queries";
import { useTaskAssigneesByMonth } from "@/features/data/task-assignees-queries";
import { getStageCircleColor, stageLabel } from "../pm-constants";
import type { PmTask } from "../pm-types";

const WEEKDAY_LABELS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

interface Assignee {
  id: string;
  name: string;
  avatar?: string;
}

interface Props {
  tasks: PmTask[];
  clientsMap: Record<string, string>;
  membersMap: Record<string, { name: string; avatar?: string }>;
  onTaskClick: (t: PmTask) => void;
}

function getTaskAssignees(task: PmTask, membersMap: Record<string, { name: string; avatar?: string }>): Assignee[] {
  const ids = Array.from(new Set([task.assignee_id, ...(task.watchers ?? [])].filter((id): id is string => Boolean(id))));
  return ids
    .map((id) => ({ id, ...membersMap[id] }))
    .filter((m): m is Assignee => Boolean(m.name));
}

export function PmTeamWeekView({ tasks, clientsMap, membersMap, onTaskClick }: Props) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  const membersQ = useTeamMembers();
  const teamMembers = useMemo(
    () =>
      [...(membersQ.data ?? [])].sort((a, b) =>
        a.role_title === b.role_title
          ? a.display_name.localeCompare(b.display_name, "pt-BR")
          : a.role_title.localeCompare(b.role_title, "pt-BR"),
      ),
    [membersQ.data],
  );

  // Legacy `tasks` table also needs to be included so this view matches
  // what Kanban/Agenda show — same merge pattern as AgendaCalendarView.
  const monthKey = format(cursor, "yyyy-MM");
  const legacyTasksQ = useTasks({ month: monthKey });
  const legacyAssigneesQ = useTaskAssigneesByMonth(monthKey);

  const legacyAssigneesByTaskId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of legacyAssigneesQ.data ?? []) {
      const prev = map.get(row.task_id) ?? [];
      if (!prev.includes(row.user_id)) prev.push(row.user_id);
      map.set(row.task_id, prev);
    }
    return map;
  }, [legacyAssigneesQ.data]);

  // key = `${userId}_${yyyy-MM-dd}` -> tasks
  const tasksByPersonDay = useMemo(() => {
    const map = new Map<string, PmTask[]>();
    const push = (userId: string, dayKey: string, task: PmTask) => {
      const key = `${userId}_${dayKey}`;
      const prev = map.get(key) ?? [];
      map.set(key, [...prev, task]);
    };

    for (const t of tasks) {
      if (!t.due_date) continue;
      for (const a of getTaskAssignees(t, membersMap)) push(a.id, t.due_date, t);
    }

    for (const lt of legacyTasksQ.data ?? []) {
      if (lt.description?.startsWith("pm:")) continue;
      if (!lt.due_date) continue;
      const extra = legacyAssigneesByTaskId.get(lt.id) ?? [];
      const allAssignees = Array.from(new Set([lt.assigned_user_id, ...extra].filter(Boolean)));
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
      for (const userId of allAssignees) push(userId as string, lt.due_date, asPm);
    }

    return map;
  }, [tasks, legacyTasksQ.data, legacyAssigneesByTaskId, membersMap]);

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(cursor);
    const out: Date[][] = [];
    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    while (weekStart <= monthEnd) {
      out.push(Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)));
      weekStart = addDays(weekStart, 7);
    }
    return out;
  }, [cursor]);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-4 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards" }}>
      {/* Toolbar: navegação de mês */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/30 bg-muted/20 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCursor((d) => addDays(startOfMonth(d), -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCursor((d) => addDays(endOfMonth(d), 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select
          value={String(cursor.getMonth())}
          onValueChange={(v) => setCursor((d) => new Date(d.getFullYear(), Number(v), 1))}
        >
          <SelectTrigger className="h-9 w-[120px] rounded-full text-sm font-medium bg-background/60 border-border/30 capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {Array.from({ length: 12 }, (_, i) => (
              <SelectItem key={i} value={String(i)} className="capitalize">
                {format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(cursor.getFullYear())}
          onValueChange={(v) => setCursor((d) => new Date(Number(v), d.getMonth(), 1))}
        >
          <SelectTrigger className="h-9 w-[90px] rounded-full text-sm font-medium bg-background/60 border-border/30">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {Array.from({ length: 5 }, (_, i) => {
              const y = new Date().getFullYear() - 1 + i;
              return (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <Accordion type="multiple" defaultValue={weeks.map((_, i) => `week-${i}`)} className="space-y-3">
        {weeks.map((weekDays, weekIdx) => (
          <AccordionItem
            key={weekIdx}
            value={`week-${weekIdx}`}
            className="rounded-2xl border border-border/30 bg-card overflow-hidden"
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <span className="font-semibold text-sm">
                Semana {weekIdx + 1}{" "}
                <span className="text-muted-foreground font-normal">
                  ({format(weekDays[0], "d MMM", { locale: ptBR })} – {format(weekDays[4], "d MMM", { locale: ptBR })})
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
              <div className="overflow-x-auto">
                <div className="min-w-[760px] grid" style={{ gridTemplateColumns: "220px repeat(5, 1fr)" }}>
                  {/* Header row */}
                  <div className="border-b border-r border-border/20 bg-muted/30 px-3 py-2" />
                  {weekDays.map((d, i) => {
                    const isToday = format(d, "yyyy-MM-dd") === todayKey;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "border-b border-r border-border/20 last:border-r-0 px-3 py-2 text-center",
                          isToday ? "bg-primary/5" : "bg-muted/30",
                        )}
                      >
                        <p className="text-xs font-semibold text-muted-foreground">{WEEKDAY_LABELS[i]}</p>
                        <p className={cn("text-sm font-bold", isToday && "text-primary")}>{format(d, "d")}</p>
                      </div>
                    );
                  })}

                  {/* Person rows */}
                  {teamMembers.map((member) => (
                    <div key={member.user_id} className="contents">
                      <div className="flex items-center gap-2 border-b border-r border-border/20 px-3 py-2.5 bg-background sticky left-0">
                        <UserAvatar
                          avatarUrl={member.avatar_url}
                          name={member.display_name}
                          className="h-7 w-7 shrink-0"
                          fallbackClassName="text-[10px] font-bold bg-primary/10 text-primary"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold leading-4">{member.display_name}</p>
                          <p className="truncate text-[11px] text-muted-foreground leading-3">{member.role_title}</p>
                        </div>
                      </div>
                      {weekDays.map((d, i) => {
                        const dayKey = format(d, "yyyy-MM-dd");
                        const dayTasks = tasksByPersonDay.get(`${member.user_id}_${dayKey}`) ?? [];
                        return (
                          <div
                            key={i}
                            className="border-b border-r border-border/20 last:border-r-0 px-1.5 py-1.5 space-y-1 align-top"
                          >
                            {dayTasks.map((t) => {
                              const color = getStageCircleColor(t.stage_current);
                              const isDone = t.status_global === "concluido" || t.stage_current === "entrega";
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => onTaskClick(t)}
                                  className={cn(
                                    "w-full text-left rounded-lg border px-1.5 py-1 text-[11px] leading-tight transition-colors hover:bg-muted/60",
                                    isDone ? "opacity-50 border-border/20" : "border-border/30",
                                  )}
                                  title={`${t.title} — ${clientsMap[t.client_id] ?? ""}`}
                                >
                                  <span className="flex items-center gap-1">
                                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color.bg)} />
                                    <span className="truncate font-medium">{clientsMap[t.client_id] ?? t.title}</span>
                                  </span>
                                  <span className="block truncate text-muted-foreground/70">
                                    {stageLabel(t.stage_current)}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
