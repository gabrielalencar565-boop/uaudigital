import { useMemo, useState } from "react";
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, Cell } from "recharts";
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

function GlowBar(props: any) {
  const { x, y, width, height, isCurrent } = props;
  if (!height || height <= 0) return null;
  return (
    <g>
      {isCurrent && (
        <rect x={x - 2} y={y - 2} width={width + 4} height={height + 4} rx={7} fill="none" stroke="hsl(263 70% 50%)" strokeWidth={0} filter="url(#barGlow)" />
      )}
      <rect x={x} y={y} width={width} height={height} rx={6} fill={isCurrent ? "hsl(263 70% 50%)" : "hsl(263 60% 70% / 0.35)"} />
    </g>
  );
}

function getMetricValue(tasks: TaskData[], mode: MetricMode): number {
  return mode === "tarefas"
    ? tasks.length
    : tasks.reduce((s, t) => s + (Number(t.point_value) || 0), 0);
}

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
        label: i === 0 ? "Atual" : `Sem ${4 - i}`,
        value: getMetricValue(completed, mode),
        isCurrent: i === 0,
      });
    }
    return weeks;
  }, [allMonthTasks, todayKey, mode]);

  // ── Weekly trend text ──
  const weeklyTrend = useMemo(() => {
    if (weeklyData.length < 2) return null;
    const current = weeklyData[weeklyData.length - 1]?.value ?? 0;
    const prev = weeklyData[weeklyData.length - 2]?.value ?? 0;
    const best = Math.max(...weeklyData.map((w) => w.value));
    if (current === best && current > 0) return { text: "Melhor semana do mês", positive: true };
    if (prev > 0 && current < prev) return { text: "Queda vs semana anterior", positive: false };
    if (prev > 0 && current > prev) return { text: "Crescimento vs semana anterior", positive: true };
    return null;
  }, [weeklyData]);

  // ── Comparison (respects mode) ──
  const comparison = useMemo(() => {
    const thisWeekStart = startOfWeek(today, { weekStartsOn: 1 });
    const lastWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
    const thisWeekCompleted = allMonthTasks.filter((t) => {
      if (t.status !== "concluido" || !t.completed_at) return false;
      return new Date(t.completed_at) >= thisWeekStart;
    });
    const lastWeekCompleted = allMonthTasks.filter((t) => {
      if (t.status !== "concluido" || !t.completed_at) return false;
      const d = new Date(t.completed_at);
      return isWithinInterval(d, { start: lastWeekStart, end: lastWeekEnd });
    });
    const thisVal = getMetricValue(thisWeekCompleted, mode);
    const lastVal = getMetricValue(lastWeekCompleted, mode);
    if (lastVal === 0) return { pct: thisVal > 0 ? 100 : 0, up: true };
    const pct = Math.round(((thisVal - lastVal) / lastVal) * 100);
    return { pct: Math.abs(pct), up: pct >= 0 };
  }, [allMonthTasks, todayKey, mode]);

  const dataKey = mode;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5 transition-all duration-300 hover:shadow-lg">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-sidebar/20 flex items-center justify-center">
            <Activity className="h-4 w-4 text-sidebar" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Sua produtividade</h3>
            <p className="text-[11px] text-muted-foreground">Performando ao longo do tempo</p>
          </div>
        </div>
        {/* Toggle */}
        <div className="flex rounded-lg overflow-hidden text-xs border border-border">
          <button
            onClick={() => setMode("tarefas")}
            className={cn(
              "px-3 py-1.5 font-medium transition-all duration-200",
              mode === "tarefas" ? "bg-sidebar text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Tarefas
          </button>
          <button
            onClick={() => setMode("pontos")}
            className={cn(
              "px-3 py-1.5 font-medium transition-all duration-200",
              mode === "pontos" ? "bg-sidebar text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Pontos
          </button>
        </div>
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Area chart - 2 cols */}
        <div className="md:col-span-2 rounded-xl p-4 border border-border bg-muted/30">
          <p className="text-xs text-muted-foreground mb-3 font-medium">Últimos 7 dias</p>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
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
                  formatter={(v: number) => [v, mode === "tarefas" ? "Tarefas" : "Pontos"]}
                  labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                />
                <Area
                  type="monotone"
                  dataKey={dataKey}
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

        {/* Right column: bar chart + comparison */}
        <div className="flex flex-col gap-4">
          {/* Bar chart */}
          <div className="rounded-xl p-4 flex-1 border border-border bg-muted/30">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground font-medium">Por semana</p>
              {weeklyTrend && (
                <span className={cn("text-[10px] font-semibold", weeklyTrend.positive ? "text-emerald-500" : "text-red-500")}>
                  {weeklyTrend.positive ? "↑" : "↓"} {weeklyTrend.text}
                </span>
              )}
            </div>
            <div className="h-[140px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barCategoryGap="18%">
                  <defs>
                    <filter id="barGlow">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={({ x, y, payload }: any) => (
                      <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill={payload.value === "Atual" ? "hsl(263 70% 50%)" : "hsl(var(--muted-foreground))"} fontWeight={payload.value === "Atual" ? 700 : 400}>
                        {payload.value}
                      </text>
                    )}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "hsl(var(--foreground))",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    }}
                    formatter={(v: number) => [v, mode === "tarefas" ? "Tarefas" : "Pontos"]}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Bar
                    dataKey="value"
                    shape={(props: any) => <GlowBar {...props} isCurrent={props.isCurrent ?? weeklyData[props.index]?.isCurrent} />}
                    label={({ x, y, width: w, value, index }: any) => {
                      const isCurrent = weeklyData[index]?.isCurrent;
                      return (
                        <text x={x + w / 2} y={y - 8} textAnchor="middle" fontSize={isCurrent ? 13 : 11} fontWeight={isCurrent ? 700 : 500} fill={isCurrent ? "hsl(263 70% 50%)" : "hsl(var(--muted-foreground))"}>
                          {value}
                        </text>
                      );
                    }}
                    animationDuration={800}
                    animationBegin={200}
                  >
                    {weeklyData.map((_, index) => (
                      <Cell key={index} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Comparison card */}
          <div
            className={cn(
              "rounded-xl border p-4 flex items-center gap-3 transition-all duration-200 hover:scale-[1.02]",
              comparison.up ? "border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5" : "border-red-500/20 bg-red-50 dark:bg-red-500/5"
            )}
          >
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", comparison.up ? "bg-emerald-500/15" : "bg-red-500/15")}>
              {comparison.up ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />}
            </div>
            <div>
              <p className={cn("text-lg font-bold tabular-nums", comparison.up ? "text-emerald-500" : "text-red-500")}>
                {comparison.up ? "+" : "-"}{comparison.pct}%
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">vs semana anterior ({mode === "tarefas" ? "tarefas" : "pontos"})</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
