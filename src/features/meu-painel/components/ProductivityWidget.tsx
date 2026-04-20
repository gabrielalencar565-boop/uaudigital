import { useMemo, useState, useCallback } from "react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, eachDayOfInterval, addWeeks, max, min } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart, Cell } from "recharts";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizePmTagStageKey } from "@/features/gestao/utils/normalize-pm-tag-stage";

interface TaskData {
  id: string;
  status: string;
  completed_at: string | null;
  due_date: string;
  point_value?: number | null;
  late_penalty_value?: number | null;
  description?: string | null;
  stage: string;
  quantity?: number;
  is_extra_demand?: boolean;
}

interface Props {
  tasks: TaskData[];
  allMonthTasks: TaskData[];
  todayKey: string;
}

type MetricMode = "tarefas" | "pontos";

interface ScoringRow {
  stage: string;
  base_points: number;
  late_penalty: number;
  uses_quantity: boolean;
  extra_demand_multiplier: number;
}

function GlowBar(props: any) {
  const { x, y, width, height, isCurrent, isSelected } = props;
  if (!height || height <= 0) return null;
  const selectedColor = "hsl(263 55% 65%)";
  const currentColor = "hsl(263 70% 50%)";
  const barColor = isSelected ? selectedColor : isCurrent ? currentColor : "hsl(263 60% 70% / 0.35)";
  const highlighted = isCurrent || isSelected;
  return (
    <g style={{ cursor: "pointer" }}>
      {highlighted && (
        <rect x={x - 2} y={y - 2} width={width + 4} height={height + 4} rx={7} fill="none" stroke={isSelected ? selectedColor : currentColor} strokeWidth={isSelected ? 2 : 0} filter="url(#barGlow)" />
      )}
      <rect x={x} y={y} width={width} height={height} rx={6} fill={barColor} />
    </g>
  );
}

/** Extract pm_task_id from task description like pm:<uuid>:<stage>:<user> */
function extractPmTaskId(description: string | null | undefined): string | null {
  if (!description || !description.startsWith("pm:")) return null;
  const parts = description.split(":");
  if (parts.length >= 3) return parts[1];
  return null;
}

function isOnTime(task: TaskData): boolean | null {
  if (task.status !== "concluido" || !task.completed_at) return null;
  const completedSP = new Date(task.completed_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return completedSP <= task.due_date;
}

/**
 * Mirrors `AdminDeadlineReport.calcPoints` so the productivity widget reflects
 * exactly the same scoring rules configured in Admin → Pontuação:
 *  - On-time: snapshot `point_value` (already accounts for tags) or computed via base_points/quantity/extra demand
 *  - Late: snapshot `late_penalty_value` (already includes tag penalties) or stage `late_penalty` + sum of unique tag penalties
 */
function calcTaskPoints(
  task: TaskData,
  configMap: Map<string, ScoringRow>,
  pmTagsMap: Map<string, string[]>,
): number {
  const onTime = isOnTime(task);
  if (onTime === null) return 0;

  const cfg = configMap.get(task.stage);

  // ── Late delivery ──
  if (!onTime) {
    if (task.late_penalty_value != null) return task.late_penalty_value;

    let penalty = cfg?.late_penalty ?? -1;
    const pmId = extractPmTaskId(task.description);
    if (pmId) {
      const tags = pmTagsMap.get(pmId);
      if (tags) {
        const seen = new Set<string>();
        for (const tag of tags) {
          const tagName = tag.split(":")[0];
          const tagKey = normalizePmTagStageKey(tagName);
          if (seen.has(tagKey)) continue;
          seen.add(tagKey);
          const tagCfg = configMap.get(tagKey);
          if (tagCfg) penalty += tagCfg.late_penalty;
        }
      }
    }
    return penalty;
  }

  // ── On-time: snapshot wins ──
  if (task.point_value != null) return task.point_value;
  if (!cfg) return 1;

  let pts = cfg.base_points;
  if (cfg.uses_quantity) {
    pts *= (task.quantity ?? 1);
    if (task.is_extra_demand && cfg.extra_demand_multiplier > 0) {
      pts *= cfg.extra_demand_multiplier;
    }
  }
  return pts;
}

function getMetricValue(tasks: TaskData[], mode: MetricMode, configMap: Map<string, ScoringRow>, pmTagsMap: Map<string, string[]>): number {
  if (mode === "tarefas") return tasks.length;
  return tasks.reduce((s, t) => s + calcTaskPoints(t, configMap, pmTagsMap), 0);
}

export function ProductivityWidget({ tasks, allMonthTasks, todayKey }: Props) {
  const [mode, setMode] = useState<MetricMode>("tarefas");
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const today = new Date(todayKey + "T12:00:00");

  // ── Fetch scoring config ──
  const scoringQ = useQuery({
    queryKey: ["scoring_config"],
    queryFn: async () => {
      const { data } = await supabase.from("scoring_config").select("id, stage, label, base_points, late_penalty, uses_quantity, extra_demand_multiplier");
      return (data ?? []) as ScoringRow[];
    },
    staleTime: 5 * 60_000,
  });

  const configMap = useMemo(() => {
    const m = new Map<string, ScoringRow>();
    for (const r of scoringQ.data ?? []) m.set(r.stage, r);
    return m;
  }, [scoringQ.data]);

  // ── Fetch pm_tasks tags so we can apply tag-based late penalties ──
  const pmIds = useMemo(() => {
    const ids = new Set<string>();
    for (const t of allMonthTasks) {
      const pid = extractPmTaskId(t.description);
      if (pid) ids.add(pid);
    }
    return Array.from(ids);
  }, [allMonthTasks]);

  const pmTagsQ = useQuery({
    enabled: pmIds.length > 0,
    queryKey: ["productivity_pm_tags", pmIds.sort().join(",")],
    queryFn: async () => {
      if (pmIds.length === 0) return [] as { id: string; tags: string[] | null }[];
      const { data } = await supabase.from("pm_tasks").select("id, tags").in("id", pmIds);
      return (data ?? []) as { id: string; tags: string[] | null }[];
    },
    staleTime: 60_000,
  });

  const pmTagsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pt of pmTagsQ.data ?? []) {
      if (pt.tags && pt.tags.length > 0) map.set(pt.id, pt.tags);
    }
    return map;
  }, [pmTagsQ.data]);


  // ── Week ranges (weeks of the current month) ──
  const weekRanges = useMemo(() => {
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const ranges: { start: Date; end: Date; label: string; isCurrent: boolean }[] = [];

    let weekStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    let weekNum = 1;
    while (weekStart <= monthEnd) {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      // Clamp to month boundaries
      const clampedStart = max([weekStart, monthStart]);
      const clampedEnd = min([weekEnd, monthEnd]);
      const isCurrent = isWithinInterval(today, { start: clampedStart, end: clampedEnd });
      ranges.push({ start: clampedStart, end: clampedEnd, label: isCurrent ? "Atual" : `Sem ${weekNum}`, isCurrent });
      weekStart = addWeeks(weekStart, 1);
      weekNum++;
    }
    return ranges;
  }, [todayKey]);

  // ── Weekly data (bar chart) ──
  const weeklyData = useMemo(() => {
    return weekRanges.map((w, idx) => {
      const completed = allMonthTasks.filter((t) => {
        if (t.status !== "concluido" || !t.completed_at) return false;
        return isWithinInterval(new Date(t.completed_at), { start: w.start, end: w.end });
      });
      return {
        label: w.label,
        value: getMetricValue(completed, mode, configMap, pmTagsMap),
        isCurrent: w.isCurrent,
        index: idx,
      };
    });
  }, [allMonthTasks, todayKey, mode, weekRanges, configMap, pmTagsMap]);

  // ── Daily data based on selected week or last 7 days ──
  const dailyData = useMemo(() => {
    let days: Date[];
    let chartTitle: string;

    if (selectedWeekIndex !== null && weekRanges[selectedWeekIndex]) {
      const range = weekRanges[selectedWeekIndex];
      days = eachDayOfInterval({ start: range.start, end: range.end });
      chartTitle = range.isCurrent ? "Semana atual" : range.label;
    } else {
      days = [];
      for (let i = 6; i >= 0; i--) days.push(subDays(today, i));
      chartTitle = "Últimos 7 dias";
    }

    const result = days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      const label = format(d, "EEE", { locale: ptBR }).replace(".", "");
      const completed = allMonthTasks.filter(
        (t) => t.status === "concluido" && t.completed_at && format(new Date(t.completed_at), "yyyy-MM-dd") === key
      );
      return {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        date: key,
        tarefas: completed.length,
        pontos: completed.reduce((s, t) => s + calcTaskPoints(t, configMap, pmTagsMap), 0),
      };
    });

    return { data: result, title: chartTitle };
  }, [allMonthTasks, todayKey, selectedWeekIndex, weekRanges, configMap, pmTagsMap]);

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

  // ── Comparison ──
  const comparison = useMemo(() => {
    // Find current week index and previous week index from weekRanges
    const currentIdx = weekRanges.findIndex((w) => w.isCurrent);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : -1;

    const filterCompleted = (start: Date, end: Date) =>
      allMonthTasks.filter((t) => {
        if (t.status !== "concluido" || !t.completed_at) return false;
        return isWithinInterval(new Date(t.completed_at), { start, end });
      });

    const thisVal = currentIdx >= 0 ? getMetricValue(filterCompleted(weekRanges[currentIdx].start, weekRanges[currentIdx].end), mode, configMap, pmTagsMap) : 0;
    const lastVal = prevIdx >= 0 ? getMetricValue(filterCompleted(weekRanges[prevIdx].start, weekRanges[prevIdx].end), mode, configMap, pmTagsMap) : 0;

    if (lastVal === 0) return { pct: thisVal > 0 ? 100 : 0, up: true };
    const pct = Math.round(((thisVal - lastVal) / lastVal) * 100);
    return { pct: Math.abs(pct), up: pct >= 0 };
  }, [allMonthTasks, todayKey, mode, configMap, weekRanges, pmTagsMap]);

  const handleBarClick = useCallback((_: any, index: number) => {
    setSelectedWeekIndex((prev) => (prev === index ? null : index));
  }, []);

  const dataKey = mode;

  return (
    <div className="p-4 space-y-3">
      {/* Toggle */}
      <div className="flex justify-end">
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground font-medium">{dailyData.title}</p>
            {selectedWeekIndex !== null && (
              <button
                onClick={() => setSelectedWeekIndex(null)}
                className="text-[10px] text-primary hover:underline font-medium"
              >
                Ver últimos 7 dias
              </button>
            )}
          </div>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData.data}>
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
            <p className="text-[10px] text-muted-foreground/70 mb-2">Clique para detalhar</p>
            <div className="h-[148px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} barCategoryGap="18%" margin={{ top: 24, right: 4, bottom: 0, left: 4 }}>
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
                    tick={({ x, y, payload }: any) => {
                      const idx = weeklyData.findIndex((w) => w.label === payload.value);
                      const isSelected = idx === selectedWeekIndex;
                      const isCurrent = payload.value === "Atual";
                      return (
                        <text
                          x={x} y={y + 12} textAnchor="middle" fontSize={11}
                          fill={isSelected ? "hsl(263 55% 65%)" : isCurrent ? "hsl(263 70% 50%)" : "hsl(var(--muted-foreground))"}
                          fontWeight={isSelected || isCurrent ? 700 : 400}
                          style={{ cursor: "pointer" }}
                        >
                          {payload.value}
                        </text>
                      );
                    }}
                    interval={0}
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
                    onClick={handleBarClick}
                    style={{ cursor: "pointer" }}
                    shape={(props: any) => {
                      const idx = props.index;
                      const isSelected = idx === selectedWeekIndex;
                      return <GlowBar {...props} isCurrent={weeklyData[idx]?.isCurrent} isSelected={isSelected} />;
                    }}
                    label={({ x, y, width: w, value, index }: any) => {
                      const isCurrent = weeklyData[index]?.isCurrent;
                      const isSelected = index === selectedWeekIndex;
                      return (
                        <text
                          x={x + w / 2} y={y - 6} textAnchor="middle"
                          fontSize={isCurrent || isSelected ? 13 : 11}
                          fontWeight={isCurrent || isSelected ? 700 : 500}
                          fill={isSelected ? "hsl(263 55% 65%)" : isCurrent ? "hsl(263 70% 50%)" : "hsl(var(--muted-foreground))"}
                        >
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
