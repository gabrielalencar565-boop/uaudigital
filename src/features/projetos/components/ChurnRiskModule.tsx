import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useHealthScores, type HealthScore } from "../hooks/use-health-scores";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Users, HeartPulse, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const WEIGHTS: Record<string, number> = {
  resultado_percebido: 3,
  alinhamento_estrategico: 3,
  comunicacao_atendimento: 2,
  qualidade_entregas: 2,
  satisfacao_geral: 2,
};
const TOTAL_WEIGHT = 12;

function weightedAvg(s: HealthScore) {
  const w = Object.entries(WEIGHTS).reduce(
    (acc, [key, weight]) => acc + ((s as any)[key] as number) * weight,
    0,
  );
  return +(w / TOTAL_WEIGHT).toFixed(1);
}

function classify(score: number) {
  if (score >= 8) return { label: "Saudável", color: "hsl(var(--chart-2))", ring: "ring-emerald-500/30", bg: "bg-emerald-500" };
  if (score >= 6) return { label: "Atenção", color: "hsl(var(--chart-4))", ring: "ring-amber-500/30", bg: "bg-amber-500" };
  return { label: "Em risco", color: "hsl(var(--destructive))", ring: "ring-destructive/30", bg: "bg-destructive" };
}

const DONUT_COLORS = [
  "hsl(142, 71%, 45%)", // green
  "hsl(45, 93%, 47%)",  // yellow
  "hsl(0, 84%, 60%)",   // red
];

export function ChurnRiskModule() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Fetch last 6 months of health scores
  const months = useMemo(() => {
    const arr: { month: number; year: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      arr.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        label: format(d, "MMM/yy", { locale: ptBR }),
      });
    }
    return arr;
  }, [currentMonth, currentYear]);

  const allScoresQ = useQuery({
    queryKey: ["health_scores_6months", currentYear, currentMonth],
    queryFn: async () => {
      const results: Record<string, HealthScore[]> = {};
      for (const m of months) {
        const { data, error } = await supabase
          .from("health_scores" as any)
          .select("*")
          .eq("month", m.month)
          .eq("year", m.year);
        if (!error) results[`${m.year}-${m.month}`] = (data ?? []) as unknown as HealthScore[];
      }
      return results;
    },
  });

  const clientsQ = useQuery({
    queryKey: ["active_clients_churn"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .eq("is_freelancer_sentinel", false);
      return data ?? [];
    },
  });

  const allScores = allScoresQ.data ?? {};
  const clients = clientsQ.data ?? [];

  // Current month scores with weighted averages
  const currentScores = useMemo(() => {
    const key = `${currentYear}-${currentMonth}`;
    return (allScores[key] ?? []).map((s) => ({
      ...s,
      avg: weightedAvg(s),
      clientName: clients.find((c) => c.id === s.client_id)?.name ?? "—",
    }));
  }, [allScores, currentMonth, currentYear, clients]);

  // Distribution for donut
  const distribution = useMemo(() => {
    const healthy = currentScores.filter((s) => s.avg >= 8).length;
    const attention = currentScores.filter((s) => s.avg >= 6 && s.avg < 8).length;
    const risk = currentScores.filter((s) => s.avg < 6).length;
    return [
      { name: "Saudável", value: healthy, color: DONUT_COLORS[0] },
      { name: "Atenção", value: attention, color: DONUT_COLORS[1] },
      { name: "Em risco", value: risk, color: DONUT_COLORS[2] },
    ];
  }, [currentScores]);

  // Evolution line chart data
  const evolutionData = useMemo(() => {
    return months.map((m) => {
      const key = `${m.year}-${m.month}`;
      const scores = allScores[key] ?? [];
      if (scores.length === 0) return { label: m.label, avg: null };
      const avg = scores.reduce((acc, s) => acc + weightedAvg(s), 0) / scores.length;
      return { label: m.label, avg: +avg.toFixed(1) };
    });
  }, [months, allScores]);

  // Summary metrics
  const totalClients = currentScores.length;
  const riskCount = currentScores.filter((s) => s.avg < 6).length;
  const avgScore = totalClients > 0
    ? +(currentScores.reduce((a, s) => a + s.avg, 0) / totalClients).toFixed(1)
    : 0;

  // Trend: compare last two months with data
  const trend = useMemo(() => {
    const withData = evolutionData.filter((d) => d.avg !== null);
    if (withData.length < 2) return "stable";
    const last = withData[withData.length - 1]!.avg!;
    const prev = withData[withData.length - 2]!.avg!;
    const diff = last - prev;
    if (diff > 0.3) return "up";
    if (diff < -0.3) return "down";
    return "stable";
  }, [evolutionData]);

  const trendConfig = {
    up: { label: "Melhorando", icon: TrendingUp, color: "text-emerald-500" },
    down: { label: "Piorando", icon: TrendingDown, color: "text-destructive" },
    stable: { label: "Estável", icon: Minus, color: "text-muted-foreground" },
  };
  const TrendIcon = trendConfig[trend].icon;

  const isLoading = allScoresQ.isLoading || clientsQ.isLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Carregando dados de risco...
        </CardContent>
      </Card>
    );
  }

  if (totalClients === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          Nenhuma avaliação de Health Score encontrada para este mês.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-4.5 w-4.5 text-destructive" />
        </div>
        <div>
          <h3 className="text-base font-semibold">Risco de Churn</h3>
          <p className="text-xs text-muted-foreground">Visão da saúde da carteira de clientes</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/60">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{riskCount}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {riskCount === 1 ? "cliente em risco" : "clientes em risco"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <HeartPulse className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{avgScore}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Health Score médio</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="py-4 px-4 flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
              trend === "up" ? "bg-emerald-500/10" : trend === "down" ? "bg-destructive/10" : "bg-muted"
            )}>
              <TrendIcon className={cn("h-4 w-4", trendConfig[trend].color)} />
            </div>
            <div>
              <p className={cn("text-lg font-semibold", trendConfig[trend].color)}>
                {trendConfig[trend].label}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">Tendência mensal</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut Chart */}
        <Card className="border-border/60">
          <CardContent className="py-5 px-5">
            <h4 className="text-sm font-semibold mb-4">Distribuição de Risco</h4>
            <div className="flex items-center gap-6">
              <div className="relative w-[160px] h-[160px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {distribution.filter((d) => d.value > 0).map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold">{totalClients}</span>
                  <span className="text-[10px] text-muted-foreground">clientes</span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-3">
                {distribution.map((d) => (
                  <div key={d.name} className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <div>
                      <p className="text-sm font-medium leading-none">{d.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {d.value} {d.value === 1 ? "cliente" : "clientes"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Chart — Evolution */}
        <Card className="border-border/60">
          <CardContent className="py-5 px-5">
            <h4 className="text-sm font-semibold mb-4">Evolução do Health Score</h4>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 10]}
                    ticks={[0, 2, 4, 6, 8, 10]}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value}`, "Score médio"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
