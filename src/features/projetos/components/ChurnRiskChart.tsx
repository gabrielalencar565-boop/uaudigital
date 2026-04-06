import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useHealthScores, type HealthScore } from "../hooks/use-health-scores";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { AlertTriangle, ShieldCheck, ShieldAlert, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Churn risk estimation based on Health Score answers.
 *
 * Formula (per client):
 *   avg = mean of the 5 Health Score dimensions (0-10)
 *   churnRisk% = clamp(100 - avg * 10, 0, 100)
 *
 * Risk tiers:
 *   ≤ 20%  → Baixo  (green)
 *   ≤ 50%  → Médio  (amber)
 *   > 50%  → Alto   (red)
 */

function riskFromScore(s: HealthScore) {
  const avg =
    (s.resultado_percebido +
      s.alinhamento_estrategico +
      s.comunicacao_atendimento +
      s.qualidade_entregas +
      s.satisfacao_geral) /
    5;
  return Math.round(Math.max(0, Math.min(100, 100 - avg * 10)));
}

function riskTier(risk: number) {
  if (risk <= 20) return { label: "Baixo", color: "#10B981", tone: "text-emerald-500" };
  if (risk <= 50) return { label: "Médio", color: "#F59E0B", tone: "text-amber-500" };
  return { label: "Alto", color: "#EF4444", tone: "text-rose-500" };
}

function weakestDimension(s: HealthScore) {
  const dims = [
    { key: "Resultado", value: s.resultado_percebido },
    { key: "Alinhamento", value: s.alinhamento_estrategico },
    { key: "Comunicação", value: s.comunicacao_atendimento },
    { key: "Qualidade", value: s.qualidade_entregas },
    { key: "Satisfação", value: s.satisfacao_geral },
  ];
  dims.sort((a, b) => a.value - b.value);
  return dims[0];
}

export function ChurnRiskChart() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const scoresQ = useHealthScores(month, year);
  const clientsQ = useQuery({
    queryKey: ["clients_active_churn"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name")
        .eq("is_active", true)
        .eq("is_freelancer_sentinel", false)
        .order("name");
      return data ?? [];
    },
  });

  const scores = scoresQ.data ?? [];
  const clients = clientsQ.data ?? [];

  const chartData = useMemo(() => {
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    return scores
      .map((s) => {
        const risk = riskFromScore(s);
        const tier = riskTier(risk);
        const weak = weakestDimension(s);
        return {
          clientId: s.client_id,
          name: clientMap.get(s.client_id) ?? "—",
          risk,
          color: tier.color,
          tierLabel: tier.label,
          tierTone: tier.tone,
          weakDim: weak.key,
          weakVal: weak.value,
        };
      })
      .sort((a, b) => b.risk - a.risk);
  }, [scores, clients]);

  const highRisk = chartData.filter((c) => c.risk > 50);
  const medRisk = chartData.filter((c) => c.risk > 20 && c.risk <= 50);

  if (scores.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 py-6 px-5">
          <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold">Risco de Churn</p>
            <p className="text-xs text-muted-foreground">
              Nenhuma avaliação de Health Score registrada para este mês.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-5 px-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-base font-bold">Risco de Churn</p>
            <p className="text-xs text-muted-foreground">
              Estimativa baseada no Health Score — {scores.length} cliente{scores.length !== 1 ? "s" : ""} avaliado{scores.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          {highRisk.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
              <span className="text-xs font-semibold text-rose-500">
                {highRisk.length} alto risco
              </span>
            </div>
          )}
          {medRisk.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-500">
                {medRisk.length} risco médio
              </span>
            </div>
          )}
          {chartData.length - highRisk.length - medRisk.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-500">
                {chartData.length - highRisk.length - medRisk.length} baixo risco
              </span>
            </div>
          )}
        </div>

        {/* Bar chart */}
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="hsl(var(--border))"
                strokeOpacity={0.4}
              />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2.5 space-y-1">
                      <p className="text-xs font-bold text-foreground">{d.name}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Risco:</span>
                        <span className={cn("font-bold", d.tierTone)}>
                          {d.risk}% ({d.tierLabel})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Ponto fraco:</span>
                        <span className="font-medium text-foreground">
                          {d.weakDim} ({d.weakVal}/10)
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="risk" radius={[0, 4, 4, 0]} barSize={18}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* High-risk details */}
        {highRisk.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-rose-500 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Clientes que precisam de atenção imediata
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {highRisk.map((c) => (
                <div
                  key={c.clientId}
                  className="flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Ponto fraco: {c.weakDim} ({c.weakVal}/10)
                    </p>
                  </div>
                  <span className="text-lg font-bold text-rose-500 shrink-0 ml-2">
                    {c.risk}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
