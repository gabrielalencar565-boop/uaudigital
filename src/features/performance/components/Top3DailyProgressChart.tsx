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

const LINE_COLORS = ["#F59E0B", "#94A3B8", "#F97316"] as const;
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
    queryKey: ["top3_daily_positions", year, month, userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const daysInMonth = getDaysInMonth(new Date(year, month - 1));
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

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

    // Build cumulative completions per user per day
    const completedByUserDay: Record<string, Record<number, number>> = {};
    for (const uid of userIds) completedByUserDay[uid] = {};

    for (const t of tasks) {
      if (t.completed_at) {
        const d = new Date(t.completed_at);
        if (d.getFullYear() === year && d.getMonth() + 1 === month) {
          const day = d.getDate();
          const uid = t.assigned_user_id;
          completedByUserDay[uid][day] = (completedByUserDay[uid][day] ?? 0) + 1;
        }
      }
    }

    // Build daily cumulative scores and derive positions
    const points: Record<string, any>[] = [];
    const cumulative: Record<string, number> = {};
    for (const uid of userIds) cumulative[uid] = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      // Update cumulative
      for (const uid of userIds) {
        cumulative[uid] += completedByUserDay[uid]?.[day] ?? 0;
      }

      // Rank by cumulative score (higher = better position)
      const sorted = [...userIds]
        .map((uid) => ({ uid, score: cumulative[uid] }))
        .sort((a, b) => b.score - a.score);

      // Assign positions (1 = best)
      const row: Record<string, any> = { day };
      for (let i = 0; i < userIds.length; i++) {
        const uid = userIds[i];
        const pos = sorted.findIndex((s) => s.uid === uid) + 1;
        row[`u${i}`] = pos;
      }
      points.push(row);
    }

    return points;
  }, [tasksQ.data, userIds, year, month]);

  if (userIds.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Corrida do Top 3</CardTitle>
        <p className="text-xs text-muted-foreground">Mudança de posições dia a dia baseada em tarefas concluídas</p>
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
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
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
                domain={[1, 3]}
                reversed
                ticks={[1, 2, 3]}
                tickFormatter={(v) => `${v}º`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
                      <p className="mb-1 font-medium">Dia {label}</p>
                      {payload
                        .filter((p: any) => p.dataKey !== "ideal")
                        .sort((a: any, b: any) => (a.value as number) - (b.value as number))
                        .map((p: any) => {
                          const idx = Number(p.dataKey.replace("u", ""));
                          const member = teamById.get(top3[idx]?.user_id);
                          return (
                            <div key={p.dataKey} className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke }} />
                              <span className="text-muted-foreground">{member?.display_name ?? "—"}</span>
                              <span className="ml-auto font-semibold tabular-nums">{p.value}º</span>
                            </div>
                          );
                        })}
                    </div>
                  );
                }}
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
                  type="stepAfter"
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
