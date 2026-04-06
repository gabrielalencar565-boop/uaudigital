import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { type HealthScore } from "../hooks/use-health-scores";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, HeartPulse, Users, ChevronDown, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const WEIGHTS: Record<string, number> = {
  resultado_percebido: 3,
  alinhamento_estrategico: 3,
  comunicacao_atendimento: 2,
  qualidade_entregas: 2,
  satisfacao_geral: 2,
};
const TOTAL_WEIGHT = 12;

const CATEGORY_LABELS: Record<string, string> = {
  resultado_percebido: "Resultado percebido",
  alinhamento_estrategico: "Alinhamento estratégico",
  comunicacao_atendimento: "Comunicação e atendimento",
  qualidade_entregas: "Qualidade das entregas",
  satisfacao_geral: "Satisfação geral",
};

const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);

function weightedAvg(s: HealthScore) {
  const w = Object.entries(WEIGHTS).reduce(
    (acc, [key, weight]) => acc + ((s as any)[key] as number) * weight,
    0,
  );
  return +(w / TOTAL_WEIGHT).toFixed(1);
}

function barColor(score: number) {
  if (score >= 8) return "hsl(142, 71%, 45%)";
  if (score >= 6) return "hsl(45, 93%, 47%)";
  return "hsl(0, 84%, 60%)";
}

function barBg(score: number) {
  if (score >= 8) return "bg-emerald-500/15";
  if (score >= 6) return "bg-amber-500/15";
  return "bg-destructive/15";
}

const DONUT_COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(45, 93%, 47%)",
  "hsl(0, 84%, 60%)",
];

export function ChurnRiskModule() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const [viewMode, setViewMode] = useState<string>("overview");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

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

  const currentScores = useMemo(() => {
    const key = `${currentYear}-${currentMonth}`;
    return (allScores[key] ?? []).map((s) => ({
      ...s,
      avg: weightedAvg(s),
      clientName: clients.find((c) => c.id === s.client_id)?.name ?? "—",
    }));
  }, [allScores, currentMonth, currentYear, clients]);

  const distribution = useMemo(() => {
    const healthyClients = currentScores.filter((s) => s.avg >= 8);
    const attentionClients = currentScores.filter((s) => s.avg >= 6 && s.avg < 8);
    const riskClients = currentScores.filter((s) => s.avg < 6);
    return [
      { name: "Saudável", value: healthyClients.length, color: DONUT_COLORS[0], clients: healthyClients },
      { name: "Atenção", value: attentionClients.length, color: DONUT_COLORS[1], clients: attentionClients },
      { name: "Em risco", value: riskClients.length, color: DONUT_COLORS[2], clients: riskClients },
    ];
  }, [currentScores]);

  const evolutionData = useMemo(() => {
    return months.map((m) => {
      const key = `${m.year}-${m.month}`;
      const scores = allScores[key] ?? [];
      if (scores.length === 0) return { label: m.label, avg: null };
      const avg = scores.reduce((acc, s) => acc + weightedAvg(s), 0) / scores.length;
      return { label: m.label, avg: +avg.toFixed(1) };
    });
  }, [months, allScores]);

  const totalClients = currentScores.length;
  const riskCount = currentScores.filter((s) => s.avg < 6).length;
  const avgScore = totalClients > 0
    ? +(currentScores.reduce((a, s) => a + s.avg, 0) / totalClients).toFixed(1)
    : 0;

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

  // Client detail data
  const selectedScore = useMemo(() => {
    if (!selectedClientId) return null;
    return currentScores.find((s) => s.client_id === selectedClientId) ?? null;
  }, [selectedClientId, currentScores]);

  const clientDimensions = useMemo(() => {
    if (!selectedScore) return [];
    return CATEGORY_KEYS.map((key) => ({
      key,
      label: CATEGORY_LABELS[key],
      value: (selectedScore as any)[key] as number,
    }));
  }, [selectedScore]);

  const bestCategory = useMemo(() => {
    if (clientDimensions.length === 0) return null;
    return [...clientDimensions].sort((a, b) => b.value - a.value)[0];
  }, [clientDimensions]);

  const worstCategory = useMemo(() => {
    if (clientDimensions.length === 0) return null;
    return [...clientDimensions].sort((a, b) => a.value - b.value)[0];
  }, [clientDimensions]);

  // Sorted clients for dropdown (worst first)
  const sortedClients = useMemo(() => {
    return [...currentScores].sort((a, b) => a.avg - b.avg);
  }, [currentScores]);

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
    <Card className="border-border/60">
      <CardContent className="py-6 px-6 space-y-5">
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

        {/* Summary row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 py-3 px-4">
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{riskCount}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {riskCount === 1 ? "cliente em risco" : "clientes em risco"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 py-3 px-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <HeartPulse className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{avgScore}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Health Score médio</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 py-3 px-4">
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
          </div>
        </div>

        {/* Charts area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut Chart */}
        <Card className="border-border/60">
          <CardContent className="py-5 px-5 h-full flex flex-col">
            <h4 className="text-sm font-semibold mb-4">Distribuição de Risco</h4>
            <div className="flex items-center gap-6 flex-1">
              <div className="relative w-[200px] h-[200px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distribution.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold">{totalClients}</span>
                  <span className="text-[11px] text-muted-foreground">clientes</span>
                </div>
              </div>

              <TooltipProvider delayDuration={200}>
                <div className="flex flex-col gap-3">
                  {distribution.map((d) => (
                    <Tooltip key={d.name}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2.5 cursor-default">
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <div>
                            <p className="text-sm font-medium leading-none">{d.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {d.value} {d.value === 1 ? "cliente" : "clientes"}
                            </p>
                          </div>
                        </div>
                      </TooltipTrigger>
                      {d.clients.length > 0 && (
                        <TooltipContent side="right" className="max-w-[220px]">
                          <p className="font-medium text-xs mb-1">{d.name}</p>
                          <ul className="space-y-0.5">
                            {d.clients.map((c) => (
                              <li key={c.client_id} className="text-xs flex justify-between gap-3">
                                <span className="truncate">{c.clientName}</span>
                                <span className="tabular-nums font-medium shrink-0">{c.avg}</span>
                              </li>
                            ))}
                          </ul>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>

        {/* Right panel — toggle between overview and per-client */}
        <Card className="border-border/60">
          <CardContent className="py-5 px-5">
            {/* Toggle */}
            <div className="flex items-center justify-between mb-4 gap-3">
              <h4 className="text-sm font-semibold">Análise por Categoria</h4>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => { if (v) setViewMode(v); }}
                size="sm"
                className="bg-muted/50 rounded-lg p-0.5"
              >
                <ToggleGroupItem value="overview" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  Visão geral
                </ToggleGroupItem>
                <ToggleGroupItem value="client" className="text-xs px-3 h-7 rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm">
                  Por cliente
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {viewMode === "overview" ? (
              /* Overview: average bars for all clients */
              <div className="space-y-3">
                {CATEGORY_KEYS.map((key) => {
                  const avg = totalClients > 0
                    ? +(currentScores.reduce((a, s) => a + ((s as any)[key] as number), 0) / totalClients).toFixed(1)
                    : 0;
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[key]}</span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: barColor(avg) }}>{avg}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{ width: `${avg * 10}%`, backgroundColor: barColor(avg) }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Per-client view */
              <div className="space-y-4">
                {/* Client selector */}
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedClients.map((s) => {
                      const cls = s.avg >= 8 ? "🟢" : s.avg >= 6 ? "🟡" : "🔴";
                      return (
                        <SelectItem key={s.client_id} value={s.client_id}>
                          <span className="flex items-center gap-2">
                            <span>{cls}</span>
                            <span>{s.clientName}</span>
                            <span className="text-muted-foreground ml-auto text-xs">({s.avg})</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {selectedScore ? (
                  <div className="space-y-3">
                    {/* Score badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold tabular-nums" style={{ color: barColor(selectedScore.avg) }}>
                        {selectedScore.avg}
                      </span>
                      <span className="text-xs text-muted-foreground">/ 10</span>
                    </div>

                    {/* Category bars */}
                    {clientDimensions.map((d) => {
                      const hasDiff = bestCategory?.key !== worstCategory?.key;
                      const isWorst = hasDiff && worstCategory?.key === d.key && d.value < 8;
                      const isBest = hasDiff && bestCategory?.key === d.key;
                      return (
                        <div key={d.key} className={cn("space-y-1 rounded-lg px-2 py-1.5 -mx-2 transition-colors", isWorst && "bg-destructive/5")}>
                          <div className="flex items-center justify-between">
                            <span className={cn("text-xs", isWorst ? "text-destructive font-medium" : "text-muted-foreground")}>
                              {d.label}
                              {isBest && <span className="ml-1.5 text-emerald-500">★</span>}
                              {isWorst && <span className="ml-1.5">⚠</span>}
                            </span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: barColor(d.value) }}>{d.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{ width: `${d.value * 10}%`, backgroundColor: barColor(d.value) }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Diagnostic — only show when best and worst are different */}
                    {bestCategory && worstCategory && bestCategory.key !== worstCategory.key && (
                      <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                        {bestCategory.value >= 6 && (
                          <div className="flex items-start gap-2">
                            <ThumbsUp className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              <span className="font-medium text-emerald-500">{bestCategory.label}</span> é o ponto forte deste cliente
                            </p>
                          </div>
                        )}
                        {worstCategory.value < 8 && (
                          <div className="flex items-start gap-2">
                            <ThumbsDown className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              <span className="font-medium text-destructive">{worstCategory.label}</span> precisa de atenção
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Users className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">Selecione um cliente para ver o diagnóstico detalhado</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </CardContent>
    </Card>
  );
}
