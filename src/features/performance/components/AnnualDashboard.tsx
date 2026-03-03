import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

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
  { key: "metas_prazos" as const, label: "Metas/Prazos", max: 3 },
  { key: "padrao_qualidade_uau" as const, label: "Qualidade", max: 4 },
  { key: "comprometimento" as const, label: "Responsabilidade", max: 4 },
  { key: "ambiente_organizado" as const, label: "Organização", max: 3 },
  { key: "aprendizado_continuo" as const, label: "Aprendizado", max: 3 },
];

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.6)",
  "hsl(var(--primary) / 0.35)",
  "hsl(var(--accent-foreground) / 0.7)",
  "hsl(var(--muted-foreground) / 0.6)",
  "hsl(var(--destructive) / 0.6)",
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
    const avgPerMonth = months.size > 0 ? totalAll / months.size : 0;
    const avgPerPerson = team.length > 0 && months.size > 0
      ? totalAll / team.length / months.size
      : 0;

    // Best month
    const monthTotals = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return scores.filter((s) => s.month === m).reduce((acc, s) => acc + totalPoints(s), 0);
    });
    const bestMonthIdx = monthTotals.indexOf(Math.max(...monthTotals));
    const bestMonth = MONTH_SHORT[bestMonthIdx];
    const bestMonthVal = monthTotals[bestMonthIdx];

    // Total bonuses
    const totalVideo = scores.reduce((s, r) => s + (r.video_destaque > 0 ? 1 : 0), 0);
    const totalSquad = scores.reduce((s, r) => s + (r.squad_destaque > 0 ? 1 : 0), 0);

    // Consistency: % of months with high performance per person
    const highPerformance = scores.filter((s) => {
      const base = s.aprendizado_continuo + s.padrao_qualidade_uau + s.metas_prazos +
        s.ambiente_organizado + s.comprometimento;
      return base >= 12; // ~70% of 17 max base
    }).length;
    const consistencyPct = scores.length > 0 ? (highPerformance / scores.length) * 100 : 0;

    return { totalAll, avgPerMonth, avgPerPerson, bestMonth, bestMonthVal, totalVideo, totalSquad, consistencyPct, monthsEvaluated: months.size };
  }, [scores, team]);

  // --- Monthly evolution (line chart) ---
  const monthlyEvolution = useMemo(() => {
    const topUsers = [...team]
      .map((t) => ({
        ...t,
        total: scores.filter((s) => s.user_id === t.user_id).reduce((acc, s) => acc + totalPoints(s), 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const row: Record<string, any> = { month: MONTH_SHORT[i] };
      for (const u of topUsers) {
        const s = scores.find((sc) => sc.user_id === u.user_id && sc.month === m);
        row[u.user_id] = s ? totalPoints(s) : null;
      }
      return row;
    });
  }, [scores, team]);

  const topUsersForChart = useMemo(() => {
    return [...team]
      .map((t) => ({
        ...t,
        total: scores.filter((s) => s.user_id === t.user_id).reduce((acc, s) => acc + totalPoints(s), 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [scores, team]);

  // --- Category average (bar chart) ---
  const categoryAvg = useMemo(() => {
    if (!scores.length) return [];
    const count = scores.length;
    return CRITERIA.map((c) => ({
      category: c.label,
      media: Math.round((scores.reduce((s, r) => s + r[c.key], 0) / count) * 100) / 100,
      max: c.max,
    }));
  }, [scores]);

  // --- Radar top 3 ---
  const radarData = useMemo(() => {
    const top3 = [...team]
      .map((t) => ({
        ...t,
        total: scores.filter((s) => s.user_id === t.user_id).reduce((acc, s) => acc + totalPoints(s), 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return CRITERIA.map((c) => {
      const row: Record<string, any> = { category: c.label };
      for (const u of top3) {
        const userScores = scores.filter((s) => s.user_id === u.user_id);
        const avg = userScores.length > 0
          ? userScores.reduce((s, r) => s + r[c.key], 0) / userScores.length
          : 0;
        row[u.user_id] = Math.round(avg * 100) / 100;
      }
      return row;
    });
  }, [scores, team]);

  const top3Users = useMemo(() => {
    return [...team]
      .map((t) => ({
        ...t,
        total: scores.filter((s) => s.user_id === t.user_id).reduce((acc, s) => acc + totalPoints(s), 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [scores, team]);

  // --- Monthly team total bar chart ---
  const monthlyTeamTotal = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const total = scores.filter((s) => s.month === m).reduce((acc, s) => acc + totalPoints(s), 0);
      return { month: MONTH_SHORT[i], total };
    });
  }, [scores]);

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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly evolution line chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase text-center">Evolução Mensal — Top 5</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Legend />
                {topUsersForChart.map((u, idx) => (
                  <Line
                    key={u.user_id}
                    dataKey={u.user_id}
                    name={u.display_name?.split(" ")[0] ?? "?"}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly team total bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase text-center">Total da Equipe por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyTeamTotal}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => [`${v} pts`, "Total"]}
                />
                <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category average bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm uppercase text-center">Média por Competência</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={categoryAvg} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" domain={[0, 4]} />
                <YAxis dataKey="category" type="category" className="text-xs" width={100} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(v: number) => [v.toFixed(2), "Média"]}
                />
                <Bar dataKey="media" name="Média" fill="hsl(var(--primary) / 0.7)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Radar chart top 3 */}
        {top3Users.length >= 2 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-center">Perfil de Competências — Top 3</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid className="stroke-border" />
                  <PolarAngleAxis dataKey="category" className="text-xs" />
                  <PolarRadiusAxis className="text-xs" domain={[0, 4]} />
                  {top3Users.map((u, idx) => (
                    <Radar
                      key={u.user_id}
                      dataKey={u.user_id}
                      name={u.display_name?.split(" ")[0] ?? "?"}
                      stroke={CHART_COLORS[idx]}
                      fill={CHART_COLORS[idx]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
