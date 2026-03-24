import { useMemo, useState } from "react";
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, BarChart3, Activity } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from "recharts";
import { cn } from "@/lib/utils";

interface TaskData {
  id: string;
  status: string;
  completed_at: string | null;
  due_date: string;
  point_value?: number | null;
}

interface Props {
  tasks: TaskData[];
  allMonthTasks: TaskData[];
  todayKey: string;
}

type MetricMode = "tarefas" | "pontos";

export function ProductivityWidget({ tasks, allMonthTasks, todayKey }: Props) {
  const [mode, setMode] = useState<MetricMode>("tarefas");
  const today = new Date(todayKey + "T12:00:00");

  // ── Daily data (last 7 days) ──
  const dailyData = useMemo(() => {
    const days: { label: string; date: string; tarefas: number; pontos: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, "yyyy-MM-dd");
      const label = format(d, "EEE", { locale: ptBR }).replace(".", "");
      const completed = allMonthTasks.filter(
        (t) => t.status === "concluido" && t.completed_at && format(new Date(t.completed_at), "yyyy-MM-dd") === key
      );
      days.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        date: key,
        tarefas: completed.length,
        pontos: completed.reduce((s, t) => s + (Number(t.point_value) || 0), 0),
      });
    }
    return days;
  }, [allMonthTasks, todayKey]);

  // ── Weekly data (last 4 weeks) ──
  const weeklyData = useMemo(() => {
    const weeks: { label: string; value: number; isCurrent: boolean }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
      const completed = allMonthTasks.filter((t) => {
        if (t.status !== "concluido" || !t.completed_at) return false;
        const d = new Date(t.completed_at);
        return isWithinInterval(d, { start: weekStart, end: weekEnd });
      });
      weeks.push({
        label: `Sem ${4 - i}`,
        value: mode === "tarefas" ? completed.length : completed.reduce((s, t) => s + (Number(t.point_value) || 0), 0),
        isCurrent: i === 0,
      });
    }
    return weeks;
  }, [allMonthTasks, todayKey, mode]);

  // ── Month comparison ──
  const comparison = useMemo(() => {
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });

    const thisWeekCount = allMonthTasks.filter((t) => {
      if (t.status !== "concluido" || !t.completed_at) return false;
      return new Date(t.completed_at) >= thisWeekStart;
    }).length;

    const lastWeekCount = allMonthTasks.filter((t) => {
      if (t.status !== "concluido" || !t.completed_at) return false;
      const d = new Date(t.completed_at);
      return isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd });
    }).length;

    if (lastWeekCount === 0) return { pct: thisWeekCount > 0 ? 100 : 0, up: true };
    const pct = Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);
    return { pct: Math.abs(pct), up: pct >= 0 };
  }, [allMonthTasks, todayKey]);

  const dataKey = mode;

  return (
    <div
      className="rounded-2xl border border-border/40 p-6 space-y-5"
      style={{
        background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.85) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-sidebar" />
            Sua produtividade
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Veja como você está performando ao longo do tempo</p>
        </div>
        {/* Toggle */}
        <div className="flex rounded-lg border border-border/60 overflow-hidden text-xs">
          <button
            onClick={() => setMode("tarefas")}
            className={cn(
              "px-3 py-1.5 font-medium transition-colors",
              mode === "tarefas" ? "bg-sidebar text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tarefas
          </button>
          <button
            onClick={() => setMode("pontos")}
            className={cn(
              "px-3 py-1.5 font-medium transition-colors",
              mode === "pontos" ? "bg-sidebar text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Pontos
          </button>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Line chart - 2 cols */}
        <div className="md:col-span-2 rounded-xl border border-border/30 p-4" style={{ background: "hsl(var(--card) / 0.6)" }}>
          <p className="text-xs text-muted-foreground mb-3 font-medium">Últimos 7 dias</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(263 70% 50%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(263 70% 50%)" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 10,
                    fontSize: 12,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
                  }}
                  formatter={(v: number) => [v, mode === "tarefas" ? "Tarefas" : "Pontos"]}
                />
                <Area type="monotone" dataKey={dataKey} stroke="hsl(263 70% 50%)" strokeWidth={2.5} fill="url(#prodGrad)" dot={{ r: 3, fill: "hsl(263 70% 50%)" }} activeDot={{ r: 5, strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right column: bar chart + comparison */}
        <div className="flex flex-col gap-4">
          {/* Bar chart */}
          <div className="rounded-xl border border-border/30 p-4 flex-1" style={{ background: "hsl(var(--card) / 0.6)" }}>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Por semana</p>
            <div className="h-[100px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[4, 4, 0, 0]}
                    fill="hsl(var(--muted) / 0.6)"
                    // @ts-ignore - recharts allows function for fill via Cell but we handle with shape
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison card */}
          <div
            className={cn(
              "rounded-xl border p-4 flex items-center gap-3",
              comparison.up
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5"
            )}
          >
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", comparison.up ? "bg-emerald-500/15" : "bg-red-500/15")}>
              {comparison.up ? (
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div>
              <p className={cn("text-lg font-bold tabular-nums", comparison.up ? "text-emerald-500" : "text-red-500")}>
                {comparison.up ? "+" : "-"}{comparison.pct}%
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">vs semana anterior</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
