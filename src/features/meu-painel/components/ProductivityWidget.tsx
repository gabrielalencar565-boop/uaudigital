import { useMemo, useState, useCallback, useRef } from "react";
import { format, subDays, startOfWeek, endOfWeek, isWithinInterval, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Activity, Sparkles } from "lucide-react";
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

// Custom bar shape with glow for current week
function GlowBar(props: any) {
  const { x, y, width, height, isCurrent } = props;
  if (!height || height <= 0) return null;
  return (
    <g>
      {isCurrent && (
        <rect
          x={x - 2}
          y={y - 2}
          width={width + 4}
          height={height + 4}
          rx={7}
          fill="none"
          stroke="hsl(263 70% 50%)"
          strokeWidth={0}
          filter="url(#barGlow)"
        />
      )}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill={isCurrent ? "hsl(263 70% 50%)" : "hsl(263 60% 45% / 0.25)"}
      />
    </g>
  );
}

export function ProductivityWidget({ tasks, allMonthTasks, todayKey }: Props) {
  const [mode, setMode] = useState<MetricMode>("tarefas");
  const today = new Date(todayKey + "T12:00:00");
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

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
        value: mode === "tarefas" ? completed.length : completed.reduce((s, t) => s + (Number(t.point_value) || 0), 0),
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

  // ── Comparison ──
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
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1 hover:scale-[1.005]"
      style={{
        borderRadius: 24,
        boxShadow: isHovered
          ? "0 16px 48px -8px rgba(124,58,237,0.25), 0 0 0 1px rgba(139,92,246,0.2), inset 0 0 0 1px rgba(255,255,255,0.08)"
          : "0 8px 32px -8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06), inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* Deep gradient background */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(145deg, hsl(263 50% 12%) 0%, hsl(240 30% 8%) 50%, hsl(263 40% 10%) 100%)",
      }} />
      {/* Noise */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }} />
      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(0,0,0,0.4) 100%)",
      }} />
      {/* Mouse glow */}
      {isHovered && (
        <div className="absolute pointer-events-none transition-opacity duration-300" style={{
          left: mousePos.x - 150, top: mousePos.y - 150, width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
        }} />
      )}
      {/* Border glow */}
      <div className="absolute inset-0 pointer-events-none rounded-[24px] transition-opacity duration-500 opacity-0 group-hover:opacity-100" style={{
        boxShadow: "inset 0 0 0 1.5px rgba(139,92,246,0.3), 0 0 20px rgba(124,58,237,0.1)",
      }} />

      {/* Content */}
      <div className="relative z-10 p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-sidebar/20 flex items-center justify-center">
              <Activity className="h-4 w-4 text-sidebar" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white/90">Sua produtividade</h3>
              <p className="text-[11px] text-white/40">Performando ao longo do tempo</p>
            </div>
          </div>
          {/* Toggle */}
          <div className="flex rounded-lg overflow-hidden text-xs border border-white/10">
            <button
              onClick={() => setMode("tarefas")}
              className={cn(
                "px-3 py-1.5 font-medium transition-all duration-200",
                mode === "tarefas" ? "bg-sidebar text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              Tarefas
            </button>
            <button
              onClick={() => setMode("pontos")}
              className={cn(
                "px-3 py-1.5 font-medium transition-all duration-200",
                mode === "pontos" ? "bg-sidebar text-white" : "text-white/40 hover:text-white/70"
              )}
            >
              Pontos
            </button>
          </div>
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Area chart - 2 cols */}
          <div className="md:col-span-2 rounded-xl p-4 border border-white/6" style={{ background: "rgba(255,255,255,0.02)" }}>
            <p className="text-xs text-white/40 mb-3 font-medium">Últimos 7 dias</p>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="prodGradPremium" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(263 70% 50%)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(263 70% 50%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.4)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(263 40% 10%)",
                      border: "1px solid rgba(139,92,246,0.3)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "white",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                    }}
                    formatter={(v: number) => [v, mode === "tarefas" ? "Tarefas" : "Pontos"]}
                    labelStyle={{ color: "rgba(255,255,255,0.6)" }}
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
            <div className="rounded-xl p-4 flex-1 border border-white/6" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-white/40 font-medium">Por semana</p>
                {weeklyTrend && (
                  <span className={cn("text-[10px] font-semibold", weeklyTrend.positive ? "text-emerald-400" : "text-red-400")}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={({ x, y, payload }: any) => (
                        <text x={x} y={y + 12} textAnchor="middle" fontSize={11} fill={payload.value === "Atual" ? "hsl(263 70% 65%)" : "rgba(255,255,255,0.35)"} fontWeight={payload.value === "Atual" ? 700 : 400}>
                          {payload.value}
                        </text>
                      )}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(263 40% 10%)",
                        border: "1px solid rgba(139,92,246,0.3)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "white",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      }}
                      formatter={(v: number) => [v, mode === "tarefas" ? "Tarefas" : "Pontos"]}
                      labelStyle={{ color: "rgba(255,255,255,0.6)" }}
                    />
                    <Bar
                      dataKey="value"
                      shape={(props: any) => <GlowBar {...props} isCurrent={props.isCurrent ?? weeklyData[props.index]?.isCurrent} />}
                      label={({ x, y, width: w, value, index }: any) => {
                        const isCurrent = weeklyData[index]?.isCurrent;
                        return (
                          <text
                            x={x + w / 2}
                            y={y - 8}
                            textAnchor="middle"
                            fontSize={isCurrent ? 13 : 11}
                            fontWeight={isCurrent ? 700 : 500}
                            fill={isCurrent ? "hsl(263 70% 70%)" : "rgba(255,255,255,0.5)"}
                          >
                            {value}
                          </text>
                        );
                      }}
                      animationDuration={800}
                      animationBegin={200}
                    >
                      {weeklyData.map((entry, index) => (
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
                comparison.up
                  ? "border-emerald-500/20"
                  : "border-red-500/20"
              )}
              style={{
                background: comparison.up
                  ? "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)"
                  : "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.02) 100%)",
              }}
            >
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", comparison.up ? "bg-emerald-500/15" : "bg-red-500/15")} style={{ boxShadow: comparison.up ? "0 0 10px rgba(16,185,129,0.15)" : "0 0 10px rgba(239,68,68,0.15)" }}>
                {comparison.up ? (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div>
                <p className={cn("text-lg font-bold tabular-nums", comparison.up ? "text-emerald-400" : "text-red-400")}>
                  {comparison.up ? "+" : "-"}{comparison.pct}%
                </p>
                <p className="text-[10px] text-white/35 leading-tight">vs semana anterior</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
