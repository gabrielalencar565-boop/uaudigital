import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/avatar/UserAvatar";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getDaysInMonth } from "date-fns";

type TeamMember = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

const LINE_COLORS = ["#8B5CF6", "#A78BFA", "#C4B5FD"] as const;
const MEDALS = ["🥇", "🥈", "🥉"] as const;

interface Props {
  top3: { user_id: string; total: number }[];
  teamById: Map<string, TeamMember>;
  year: number;
  month: number;
}

export function Top3DailyProgressChart({ top3, teamById, year, month }: Props) {
  const userIds = useMemo(() => top3.map((r) => r.user_id), [top3]);

  const tasksQ = useQuery({
    queryKey: ["top3_daily_tasks", year, month, userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const daysInMonth = getDaysInMonth(new Date(year, month - 1));
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

      // Get tasks assigned to top 3 users for this month
      const { data, error } = await supabase
        .from("tasks")
        .select("assigned_user_id, completed_at, due_date, status")
        .in("assigned_user_id", userIds)
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .is("deleted_at", null);

      if (error) throw error;
      return data ?? [];
    },
  });

  const chartData = useMemo(() => {
    const tasks = tasksQ.data ?? [];
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));

    // Count total tasks per user
    const totalByUser: Record<string, number> = {};
    for (const uid of userIds) {
      totalByUser[uid] = tasks.filter((t) => t.assigned_user_id === uid).length;
    }

    // Build cumulative completion per day
    const completedByUserDay: Record<string, Record<number, number>> = {};
    for (const uid of userIds) completedByUserDay[uid] = {};

    for (const t of tasks) {
      if (t.completed_at) {
        const d = new Date(t.completed_at);
        // Only count completions within this month
        if (d.getFullYear() === year && d.getMonth() + 1 === month) {
          const day = d.getDate();
          const uid = t.assigned_user_id;
          completedByUserDay[uid][day] = (completedByUserDay[uid][day] ?? 0) + 1;
        }
      }
    }

    // Build data points
    const points: Record<string, any>[] = [];
    const cumulative: Record<string, number> = {};
    for (const uid of userIds) cumulative[uid] = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const row: Record<string, any> = { day };
      for (let i = 0; i < userIds.length; i++) {
        const uid = userIds[i];
        cumulative[uid] += completedByUserDay[uid]?.[day] ?? 0;
        const total = totalByUser[uid] || 1;
        row[`u${i}`] = Math.round((cumulative[uid] / total) * 100);
      }
      points.push(row);
    }

    return points;
  }, [tasksQ.data, userIds, year, month]);

  if (userIds.length === 0) return null;

  const daysInMonth = getDaysInMonth(new Date(year, month - 1));

  // Build ideal linear progress line
  const idealData = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    ideal: Math.round(((i + 1) / daysInMonth) * 100),
  }));

  // Merge ideal into chart data
  const mergedData = chartData.map((pt, idx) => ({
    ...pt,
    ideal: idealData[idx]?.ideal ?? 0,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Progresso Diário do Top 3</CardTitle>
        <p className="text-xs text-muted-foreground">Conclusão acumulada de tarefas dia a dia</p>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {top3.slice(0, 3).map((row, idx) => {
            const member = teamById.get(row.user_id);
            return (
              <div key={row.user_id} className="flex items-center gap-2">
                <span className="text-sm">{MEDALS[idx]}</span>
                <UserAvatar avatarUrl={member?.avatar_url} name={member?.display_name} className="h-6 w-6" />
                <span className="text-xs font-medium">{member?.display_name ?? "—"}</span>
                <span
                  className="h-2.5 w-5 rounded-full"
                  style={{ backgroundColor: LINE_COLORS[idx] }}
                />
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <span className="h-0 w-5 border-t-2 border-dashed border-muted-foreground/40" />
            <span className="text-xs text-muted-foreground">Meta linear</span>
          </div>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mergedData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                      <p className="mb-1 font-medium">Dia {label}</p>
                      {payload.map((p: any) => (
                        <div key={p.dataKey} className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke }} />
                          <span className="text-muted-foreground">{p.dataKey === "ideal" ? "Meta" : teamById.get(top3[Number(p.dataKey.replace("u", ""))]?.user_id)?.display_name ?? "—"}</span>
                          <span className="ml-auto font-semibold tabular-nums">{p.value}%</span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              {/* Ideal dashed line */}
              <Line
                dataKey="ideal"
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                dot={false}
                strokeOpacity={0.4}
              />
              {/* Top 3 lines */}
              {top3.slice(0, 3).map((_, idx) => (
                <Line
                  key={idx}
                  dataKey={`u${idx}`}
                  stroke={LINE_COLORS[idx]}
                  strokeWidth={idx === 0 ? 3 : 2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
              <ReferenceLine x={27} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeOpacity={0.5} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
