import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useHealthScores, type HealthScore } from "../hooks/use-health-scores";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Cell, ReferenceLine, LabelList,
} from "recharts";
import { ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── weights for weighted average ── */
const WEIGHTS: Record<string, number> = {
  resultado_percebido: 3,
  alinhamento_estrategico: 3,
  comunicacao_atendimento: 2,
  qualidade_entregas: 2,
  satisfacao_geral: 2,
};

const DIMENSION_LABELS: Record<string, string> = {
  resultado_percebido: "Resultado",
  alinhamento_estrategico: "Alinhamento",
  comunicacao_atendimento: "Comunicação",
  qualidade_entregas: "Qualidade",
  satisfacao_geral: "Satisfação",
};

function weightedAvg(s: HealthScore) {
  const totalWeight = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const weighted =
    s.resultado_percebido * WEIGHTS.resultado_percebido +
    s.alinhamento_estrategico * WEIGHTS.alinhamento_estrategico +
    s.comunicacao_atendimento * WEIGHTS.comunicacao_atendimento +
    s.qualidade_entregas * WEIGHTS.qualidade_entregas +
    s.satisfacao_geral * WEIGHTS.satisfacao_geral;
  return +(weighted / totalWeight).toFixed(1);
}

function barColor(val: number) {
  if (val >= 9) return "#10B981";   // green
  if (val >= 7) return "#F59E0B";   // amber
  return "#EF4444";                  // red
}

function classifyScore(avg: number) {
  if (avg >= 9) return { label: "Saudável", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", Icon: ShieldCheck };
  if (avg >= 7) return { label: "Atenção", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", Icon: AlertTriangle };
  return { label: "Crítico", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/20", Icon: ShieldAlert };
}

interface ClientChurnData {
  clientId: string;
  name: string;
  avg: number;
  classification: ReturnType<typeof classifyScore>;
  dimensions: { name: string; value: number; color: string }[];
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

  const clientData: ClientChurnData[] = useMemo(() => {
    const clientMap = new Map(clients.map((c) => [c.id, c.name]));
    return scores
      .map((s) => {
        const avg = weightedAvg(s);
        const dims = Object.entries(DIMENSION_LABELS).map(([key, label]) => {
          const val = s[key as keyof HealthScore] as number;
          return { name: label, value: val, color: barColor(val) };
        });
        return {
          clientId: s.client_id,
          name: clientMap.get(s.client_id) ?? "—",
          avg,
          classification: classifyScore(avg),
          dimensions: dims,
        };
      })
      .sort((a, b) => a.avg - b.avg);
  }, [scores, clients]);

  const critical = clientData.filter((c) => c.avg < 7);
  const attention = clientData.filter((c) => c.avg >= 7 && c.avg < 9);
  const healthy = clientData.filter((c) => c.avg >= 9);

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
    <div className="space-y-4">
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {critical.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
            <span className="text-xs font-semibold text-rose-500">
              {critical.length} crítico{critical.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        {attention.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold text-amber-500">
              {attention.length} atenção
            </span>
          </div>
        )}
        {healthy.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-500">
              {healthy.length} saudável{healthy.length !== 1 ? "is" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Per-client cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {clientData.map((c) => {
          const { Icon } = c.classification;
          return (
            <Card key={c.clientId} className="overflow-hidden">
              <CardContent className="py-4 px-5 space-y-4">
                {/* Client header with score */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center border", c.classification.bg)}>
                      <Icon className={cn("h-4 w-4", c.classification.color)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Health Score (ponderado)
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn("text-2xl font-extrabold tabular-nums", c.classification.color)}>
                      {c.avg}
                    </span>
                    <p className={cn("text-[11px] font-semibold", c.classification.color)}>
                      {c.classification.label}
                    </p>
                  </div>
                </div>

                {/* Bar chart per client */}
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={c.dimensions}
                      margin={{ top: 20, right: 8, left: -12, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                        strokeOpacity={0.4}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 10]}
                        ticks={[0, 2, 4, 6, 7, 8, 10]}
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <ReferenceLine
                        y={7}
                        stroke="#EF4444"
                        strokeDasharray="6 3"
                        strokeOpacity={0.6}
                        label={{
                          value: "Risco",
                          position: "right",
                          fill: "#EF4444",
                          fontSize: 10,
                          fontWeight: 600,
                        }}
                      />
                      <Tooltip
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.2 }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs">
                              <p className="font-bold text-foreground">{d.name}</p>
                              <p className="text-muted-foreground">
                                Nota: <span className="font-semibold text-foreground">{d.value}/10</span>
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={36}>
                        {c.dimensions.map((dim, idx) => (
                          <Cell key={idx} fill={dim.color} fillOpacity={0.85} />
                        ))}
                        <LabelList
                          dataKey="value"
                          position="top"
                          fill="hsl(var(--foreground))"
                          fontSize={12}
                          fontWeight={700}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
