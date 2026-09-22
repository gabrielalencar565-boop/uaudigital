import { useMemo, useState } from "react";
import {
  format, subMonths, startOfMonth, endOfMonth, isWithinInterval,
  startOfWeek, endOfWeek, addWeeks, max, min,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronUp, ChevronDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { useTasks } from "@/features/data/queries";

interface TaskData {
  id: string;
  status: string;
  completed_at: string | null;
  due_date: string;
}

interface Props {
  tasks: TaskData[];
  allMonthTasks: TaskData[];
  todayKey: string;
  userId?: string;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isCompletedInRange(t: TaskData, start: Date, end: Date) {
  if (t.status !== "concluido" || !t.completed_at) return false;
  return isWithinInterval(new Date(t.completed_at), { start, end });
}

export function ProductivityWidget({ tasks, allMonthTasks, todayKey, userId }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const today = new Date(todayKey + "T12:00:00");

  // ── Semanas do mês atual (S1, S2, ... sempre numeradas, sem rótulo "Atual") ──
  const weekRanges = useMemo(() => {
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const ranges: { start: Date; end: Date; label: string; isCurrent: boolean }[] = [];

    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    let weekNum = 1;
    while (weekStart <= monthEnd) {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const clampedStart = max([weekStart, monthStart]);
      const clampedEnd = min([weekEnd, monthEnd]);
      const isCurrent = isWithinInterval(today, { start: clampedStart, end: clampedEnd });
      ranges.push({ start: clampedStart, end: clampedEnd, label: `S${weekNum}`, isCurrent });
      weekStart = addWeeks(weekStart, 1);
      weekNum++;
    }
    return ranges;
  }, [todayKey]);

  const weeklyData = useMemo(() => {
    return weekRanges.map((w) => ({
      label: w.label,
      value: allMonthTasks.filter((t) => isCompletedInRange(t, w.start, w.end)).length,
      isCurrent: w.isCurrent,
    }));
  }, [allMonthTasks, weekRanges]);

  const monthTotal = useMemo(
    () => allMonthTasks.filter((t) => isCompletedInRange(t, startOfMonth(today), endOfMonth(today))).length,
    [allMonthTasks, todayKey],
  );

  const weeklyAverage = useMemo(() => {
    if (weekRanges.length === 0) return 0;
    return monthTotal / weekRanges.length;
  }, [monthTotal, weekRanges]);

  // ── Histórico de 6 meses (busca própria, independente do mês selecionado no painel) ──
  const sixMonthsAgoStart = useMemo(() => startOfMonth(subMonths(today, 5)), [todayKey]);
  const historyQ = useTasks({
    start: format(sixMonthsAgoStart, "yyyy-MM-dd"),
    end: format(endOfMonth(today), "yyyy-MM-dd"),
    assignedUserId: userId,
  });

  const monthlyHistory = useMemo(() => {
    const months: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(today, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const count = (historyQ.data ?? []).filter((t) => isCompletedInRange(t as TaskData, start, end)).length;
      months.push({ key: format(d, "yyyy-MM"), label: capitalize(format(d, "MMM/yy", { locale: ptBR })), count });
    }
    return months;
  }, [historyQ.data, todayKey]);

  const maxHistoryCount = Math.max(1, ...monthlyHistory.map((m) => m.count));

  return (
    <div className="px-4 pb-4 pt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-[hsl(263_70%_60%)]">{monthTotal}</span> demanda{monthTotal === 1 ? "" : "s"} finalizada{monthTotal === 1 ? "" : "s"} em {capitalize(format(today, "MMMM yyyy", { locale: ptBR }))}
      </p>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="h-[140px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyData} margin={{ top: 10, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="prodGradPremium" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(263 70% 50%)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(263 70% 50%)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                  color: "hsl(var(--foreground))",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                }}
                formatter={(v: number) => [v, "Demandas"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="hsl(263 70% 55%)"
                strokeWidth={2.5}
                fill="url(#prodGradPremium)"
                dot={{ r: 3, fill: "hsl(263 70% 55%)", stroke: "hsl(263 70% 65%)", strokeWidth: 1 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(263 70% 65%)", fill: "hsl(263 70% 50%)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[hsl(263_70%_60%)]">
          {monthTotal === 0 ? "Sem demandas finalizadas ainda" : "Demandas finalizadas no mês"}
        </p>
        <p className="text-sm text-muted-foreground">Média: {weeklyAverage.toFixed(1)}/semana</p>
      </div>

      <div className="rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/40"
        >
          {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Histórico 6 meses
        </button>
        {historyOpen && (
          <div className="grid grid-cols-6 gap-2 px-4 pb-4">
            {monthlyHistory.map((m) => (
              <div key={m.key} className="flex flex-col items-center gap-1.5">
                <span className="text-sm font-semibold tabular-nums text-foreground">{m.count}</span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${Math.max(6, (m.count / maxHistoryCount) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
