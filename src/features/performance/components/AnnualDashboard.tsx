import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

type ScoreRow = {
  user_id: string;
  year: number;
  month: number;
  aprendizado_continuo: number;
  padrao_qualidade_uau: number;
  metas_prazos: number;
  ambiente_organizado: number;
  comprometimento: number;
  video_destaque: number;
  squad_destaque: number;
};

type TeamMember = {
  user_id: string;
  display_name: string;
  role_title: string;
  avatar_url: string | null;
};

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CRITERIA = [
  { key: "metas_prazos" as const, label: "Tarefas", max: 3 },
  { key: "padrao_qualidade_uau" as const, label: "Qualidade", max: 4 },
  { key: "comprometimento" as const, label: "Responsabilidade", max: 4 },
  { key: "ambiente_organizado" as const, label: "Organização", max: 3 },
  { key: "aprendizado_continuo" as const, label: "Aprendizado", max: 3 },
];

const PURPLE_COLORS = [
  "#8B5CF6",
  "#A78BFA",
  "#7C3AED",
  "#C4B5FD",
  "#6D28D9",
  "#DDD6FE",
];

function totalPoints(s: ScoreRow) {
  return s.aprendizado_continuo + s.padrao_qualidade_uau + s.metas_prazos +
    s.ambiente_organizado + s.comprometimento + (s.video_destaque ?? 0) + (s.squad_destaque ?? 0);
}

export function AnnualDashboard({
  scores,
  team,
  teamById,
  year,
}: {
  scores: ScoreRow[];
  team: TeamMember[];
  teamById: Map<string, TeamMember>;
  year: number;
}) {
  // --- KPIs ---
  const kpis = useMemo(() => {
    if (!scores.length) return null;

    const totalAll = scores.reduce((s, r) => s + totalPoints(r), 0);
    const months = new Set(scores.map((s) => s.month));
    const avgPerPerson = team.length > 0 && months.size > 0
      ? totalAll / team.length / months.size
      : 0;

    const monthTotals = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return scores.filter((s) => s.month === m).reduce((acc, s) => acc + totalPoints(s), 0);
    });
    const bestMonthIdx = monthTotals.indexOf(Math.max(...monthTotals));
    const bestMonth = MONTH_SHORT[bestMonthIdx];
    const bestMonthVal = monthTotals[bestMonthIdx];

    const totalVideo = scores.reduce((s, r) => s + (r.video_destaque > 0 ? 1 : 0), 0);

    const highPerformance = scores.filter((s) => {
      const base = s.aprendizado_continuo + s.padrao_qualidade_uau + s.metas_prazos +
        s.ambiente_organizado + s.comprometimento;
      return base >= 12;
    }).length;
    const consistencyPct = scores.length > 0 ? (highPerformance / scores.length) * 100 : 0;

    return { totalAll, avgPerPerson, bestMonth, bestMonthVal, totalVideo, consistencyPct, monthsEvaluated: months.size };
  }, [scores, team]);

  // --- Monthly evolution (area chart) ---
  const topUsersForChart = useMemo(() => {
    return [...team]
      .map((t) => ({
        ...t,
        total: scores.filter((s) => s.user_id === t.user_id).reduce((acc, s) => acc + totalPoints(s), 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [scores, team]);

  const monthlyEvolution = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const row: Record<string, any> = { month: MONTH_SHORT[i] };
      for (const u of topUsersForChart) {
        const s = scores.find((sc) => sc.user_id === u.user_id && sc.month === m);
        row[u.user_id] = s ? totalPoints(s) : null;
      }
      return row;
    });
  }, [scores, topUsersForChart]);

  // --- Category ranking (bar chart) ---
  const categoryRanking = useMemo(() => {
    return CRITERIA.map((c) => {
      const userTotals = team.map((t) => {
        const userScores = scores.filter((s) => s.user_id === t.user_id);
        const total = userScores.reduce((acc, s) => acc + s[c.key], 0);
        return { ...t, total };
      }).sort((a, b) => b.total - a.total);
      
      const top = userTotals[0];
      return {
        category: c.label,
        name: top?.display_name?.split(" ")[0] ?? "—",
        total: top?.total ?? 0,
        user_id: top?.user_id ?? "",
        avatar_url: top?.avatar_url ?? null,
      };
    });
  }, [scores, team]);

  if (!scores.length) return null;

  return (
    <div className="space-y-6 mt-6">
      {/* KPI Cards */}
      {kpis && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">Total Geral</p>
              <p className="text-3xl font-bold tabular-nums text-primary">{kpis.totalAll}</p>
              <p className="text-[10px] text-muted-foreground">pts acumulados</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">Média/Pessoa</p>
              <p className="text-3xl font-bold tabular-nums">{kpis.avgPerPerson.toFixed(1)}</p>
              <p className="text-[10px] text-muted-foreground">pts/mês/pessoa</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">Melhor Mês</p>
              <p className="text-3xl font-bold tabular-nums">{kpis.bestMonth}</p>
              <p className="text-[10px] text-muted-foreground">{kpis.bestMonthVal} pts</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">Meses Avaliados</p>
              <p className="text-3xl font-bold tabular-nums">{kpis.monthsEvaluated}</p>
              <p className="text-[10px] text-muted-foreground">de 12</p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs uppercase text-muted-foreground font-medium">🎬 Vídeo</p>
              <p className="text-3xl font-bold tabular-nums">{kpis.totalVideo}</p>
              <p className="text-[10px] text-muted-foreground">destaques</p>
            </CardContent>
          </Card>
          <Card className="flex flex-col items-center justify-center">
            <CardContent className="pt-4 pb-3 flex flex-col items-center">
              <p className="text-xs uppercase text-muted-foreground font-medium mb-1">Consistência</p>
              <ProgressRing
                value={Math.min(kpis.consistencyPct, 100)}
                size={70}
                stroke={8}
                tone={kpis.consistencyPct >= 70 ? "success" : kpis.consistencyPct >= 40 ? "warning" : "danger"}
                label={<span className="text-lg font-bold">{Math.round(kpis.consistencyPct)}%</span>}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Monthly evolution area chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase text-center">Evolução Mensal — Top 5</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={monthlyEvolution}>
              <defs>
                {topUsersForChart.map((u, idx) => (
                  <linearGradient key={u.user_id} id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PURPLE_COLORS[idx % PURPLE_COLORS.length]} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={PURPLE_COLORS[idx % PURPLE_COLORS.length]} stopOpacity={0.03} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-xl text-xs">
                      <p className="font-semibold mb-1.5">{label}</p>
                      {payload.map((p: any) => {
                        const member = teamById.get(p.dataKey);
                        return (
                          <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={member?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[8px]">{initials(member?.display_name ?? "?")}</AvatarFallback>
                            </Avatar>
                            <span className="text-muted-foreground">{member?.display_name?.split(" ")[0] ?? "?"}</span>
                            <span className="ml-auto font-bold tabular-nums" style={{ color: p.stroke }}>{p.value} pts</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }}
              />
              <Legend
                content={({ payload }) => (
                  <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                    {payload?.map((entry: any) => {
                      const member = teamById.get(entry.dataKey);
                      return (
                        <div key={entry.dataKey} className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5 border" style={{ borderColor: entry.color }}>
                            <AvatarImage src={member?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-[8px]">{initials(member?.display_name ?? "?")}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">{member?.display_name?.split(" ")[0] ?? "?"}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              />
              {topUsersForChart.map((u, idx) => (
                <Area
                  key={u.user_id}
                  type="monotone"
                  dataKey={u.user_id}
                  name={u.display_name?.split(" ")[0] ?? "?"}
                  stroke={PURPLE_COLORS[idx % PURPLE_COLORS.length]}
                  strokeWidth={2}
                  fill={`url(#grad-${idx})`}
                  dot={(props: any) => {
                    const { cx, cy, value } = props;
                    if (value == null || cx == null || cy == null) return <g />;
                    const member = teamById.get(u.user_id);
                    const size = 20;
                    const r = size / 2;
                    const clipId = `clip-${u.user_id}-${props.index}`;
                    return (
                      <g>
                        <defs>
                          <clipPath id={clipId}>
                            <circle cx={cx} cy={cy} r={r} />
                          </clipPath>
                        </defs>
                        <circle cx={cx} cy={cy} r={r + 1} fill={PURPLE_COLORS[idx % PURPLE_COLORS.length]} />
                        {member?.avatar_url ? (
                          <image
                            href={member.avatar_url}
                            x={cx - r}
                            y={cy - r}
                            width={size}
                            height={size}
                            clipPath={`url(#${clipId})`}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        ) : (
                          <>
                            <circle cx={cx} cy={cy} r={r} fill="hsl(var(--muted))" />
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={7} fontWeight={700} fill="hsl(var(--muted-foreground))">
                              {initials(member?.display_name ?? "?")}
                            </text>
                          </>
                        )}
                      </g>
                    );
                  }}
                  activeDot={{ r: 14, strokeWidth: 2, stroke: PURPLE_COLORS[idx % PURPLE_COLORS.length] }}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category ranking — who leads each competency */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm uppercase text-center">Líder por Competência</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryRanking} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="text-xs" />
              <YAxis
                dataKey="category"
                type="category"
                className="text-xs"
                width={100}
              />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload;
                  const member = teamById.get(d?.user_id);
                  return (
                    <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-xl text-xs">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[8px]">{initials(member?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{member?.display_name?.split(" ")[0] ?? d?.name}</span>
                        <span className="ml-auto font-bold tabular-nums text-primary">{d?.total} pts</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="total" name="Pontos" fill="#8B5CF6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {/* Avatars under chart */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
            {categoryRanking.map((c) => {
              const member = teamById.get(c.user_id);
              return (
                <div key={c.category} className="flex items-center gap-1.5">
                  <Avatar className="h-5 w-5 border border-primary/40">
                    <AvatarImage src={member?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[8px]">{initials(member?.display_name ?? "?")}</AvatarFallback>
                  </Avatar>
                  <span className="text-[11px] text-muted-foreground">{c.category}: <span className="font-semibold text-foreground">{c.name}</span></span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
