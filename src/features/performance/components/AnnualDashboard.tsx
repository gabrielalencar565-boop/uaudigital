import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ScatterChart, Scatter, ZAxis, Cell,
  ReferenceLine, ReferenceArea,
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

type TaskRow = {
  id: string;
  stage: string;
  status: string;
  due_date: string;
  completed_at: string | null;
  assigned_user_id: string;
  quantity: number;
  is_extra_demand: boolean;
  deleted_at: string | null;
};

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const STAGE_LABELS: Record<string, string> = {
  planejamento: "Planejamento",
  captacao: "Captação",
  edicao_videos: "Vídeos",
  design: "Design",
  pdf: "PDF",
  agendamento: "Agendamento",
};

const STAGE_POINTS: Record<string, { base: number; usesQty: boolean }> = {
  planejamento: { base: 4, usesQty: false },
  captacao: { base: 1.5, usesQty: false },
  edicao_videos: { base: 1, usesQty: true },
  design: { base: 1, usesQty: true },
  pdf: { base: 2, usesQty: false },
  agendamento: { base: 1, usesQty: false },
};

const QUANTITATIVE_STAGES = ["planejamento", "captacao", "edicao_videos", "design", "pdf", "agendamento"];

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.6)",
  "hsl(var(--primary) / 0.35)",
  "hsl(var(--accent-foreground) / 0.7)",
  "hsl(var(--muted-foreground) / 0.6)",
  "hsl(var(--destructive) / 0.6)",
];

const SCATTER_ZONE_COLORS = {
  topRight: "hsl(142 76% 36% / 0.08)",
  topLeft: "hsl(48 96% 53% / 0.08)",
  bottomRight: "hsl(48 96% 53% / 0.08)",
  bottomLeft: "hsl(0 84% 60% / 0.08)",
};

function quantitativePoints(task: TaskRow): number {
  const cfg = STAGE_POINTS[task.stage];
  if (!cfg) return 0;
  const wasOnTime = task.completed_at && new Date(task.completed_at).toISOString().slice(0, 10) <= task.due_date;
  if (!wasOnTime) return 0;
  return cfg.usesQty ? cfg.base * (task.quantity || 1) : cfg.base;
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
  // Fetch tasks for the year
  const tasksQ = useQuery({
    queryKey: ["annual_dashboard_tasks", year],
    queryFn: async () => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const { data, error } = await supabase
        .from("tasks")
        .select("id, stage, status, due_date, completed_at, assigned_user_id, quantity, is_extra_demand, deleted_at")
        .gte("due_date", startDate)
        .lte("due_date", endDate)
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const tasks = tasksQ.data ?? [];
  const completedTasks = useMemo(() => tasks.filter((t) => t.status === "concluido"), [tasks]);

  // 1.1 – Evolução Anual de Pontos Quantitativos (Line)
  const quantEvolution = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthStr = String(m).padStart(2, "0");
      const monthTasks = completedTasks.filter((t) => t.due_date.slice(5, 7) === monthStr);
      const total = monthTasks.reduce((sum, t) => sum + quantitativePoints(t), 0);
      return { month: MONTH_SHORT[i], total: Math.round(total * 10) / 10 };
    });
  }, [completedTasks]);

  // 1.2 – Produção Anual por Colaborador (Bar)
  const prodByCollab = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of completedTasks) {
      const pts = quantitativePoints(t);
      map.set(t.assigned_user_id, (map.get(t.assigned_user_id) ?? 0) + pts);
    }
    return team
      .map((m) => ({
        name: m.display_name?.split(" ")[0] ?? "?",
        user_id: m.user_id,
        total: Math.round((map.get(m.user_id) ?? 0) * 10) / 10,
      }))
      .sort((a, b) => b.total - a.total);
  }, [completedTasks, team]);

  // 1.3 – Produção por Tipo de Tarefa (Grouped Bar)
  const prodByType = useMemo(() => {
    return QUANTITATIVE_STAGES.map((stage) => {
      const stageTasks = completedTasks.filter((t) => t.stage === stage);
      const count = stageTasks.length;
      const units = stageTasks.reduce((s, t) => s + (STAGE_POINTS[stage]?.usesQty ? (t.quantity || 1) : 1), 0);
      return { stage: STAGE_LABELS[stage] ?? stage, count, units };
    });
  }, [completedTasks]);

  // 2.1 – Evolução Anual da Média Qualitativa (Line)
  const qualEvolution = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthScores = scores.filter((s) => s.month === m);
      if (!monthScores.length) return { month: MONTH_SHORT[i], media: null };
      const avg = monthScores.reduce(
        (s, r) => s + r.padrao_qualidade_uau + r.comprometimento + r.ambiente_organizado + r.aprendizado_continuo,
        0,
      ) / monthScores.length;
      return { month: MONTH_SHORT[i], media: Math.round(avg * 100) / 100 };
    });
  }, [scores]);

  // 2.2 – Índice de Responsabilidade (% no prazo + pontos perdidos)
  const responsibilityIndex = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthStr = String(m).padStart(2, "0");
      const monthTasks = tasks.filter((t) => t.due_date.slice(5, 7) === monthStr && t.status === "concluido");
      if (!monthTasks.length) return { month: MONTH_SHORT[i], pctOnTime: null, lost: 0 };
      let onTime = 0;
      let lost = 0;
      for (const t of monthTasks) {
        const completedDate = t.completed_at ? new Date(t.completed_at).toISOString().slice(0, 10) : null;
        if (completedDate && completedDate <= t.due_date) {
          onTime++;
        } else {
          lost++;
        }
      }
      return {
        month: MONTH_SHORT[i],
        pctOnTime: Math.round((onTime / monthTasks.length) * 100),
        lost,
      };
    });
  }, [tasks]);

  const totalLostYear = useMemo(() => responsibilityIndex.reduce((s, r) => s + r.lost, 0), [responsibilityIndex]);

  // 2.3 – Matriz Produção x Qualidade (Scatter)
  const scatterData = useMemo(() => {
    return team.map((m) => {
      const quantTotal = completedTasks
        .filter((t) => t.assigned_user_id === m.user_id)
        .reduce((s, t) => s + quantitativePoints(t), 0);
      const userScores = scores.filter((s) => s.user_id === m.user_id);
      const qualTotal = userScores.reduce(
        (s, r) => s + r.padrao_qualidade_uau + r.comprometimento + r.ambiente_organizado + r.aprendizado_continuo,
        0,
      );
      return {
        user_id: m.user_id,
        name: m.display_name,
        avatar_url: m.avatar_url,
        x: Math.round(quantTotal * 10) / 10,
        y: qualTotal,
      };
    }).filter((d) => d.x > 0 || d.y > 0);
  }, [team, completedTasks, scores]);

  const scatterMidX = useMemo(() => {
    if (!scatterData.length) return 0;
    const max = Math.max(...scatterData.map((d) => d.x));
    return Math.round(max / 2);
  }, [scatterData]);

  const scatterMidY = useMemo(() => {
    if (!scatterData.length) return 0;
    const max = Math.max(...scatterData.map((d) => d.y));
    return Math.round(max / 2);
  }, [scatterData]);

  const scatterMaxX = useMemo(() => Math.max(...scatterData.map((d) => d.x), 10), [scatterData]);
  const scatterMaxY = useMemo(() => Math.max(...scatterData.map((d) => d.y), 10), [scatterData]);

  if (!scores.length && !tasks.length) return null;

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
  };

  return (
    <div className="space-y-8 mt-6">
      {/* ════════════ BLOCO 1 — DESEMPENHO QUANTITATIVO ════════════ */}
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-primary mb-4 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-primary" />
          Desempenho Quantitativo
        </h3>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 1.1 – Evolução Anual Quantitativa */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-center">Evolução Anual de Pontos Quantitativos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={quantEvolution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} pts`, "Total"]} />
                  <Line
                    dataKey="total"
                    name="Pontos Quantitativos"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--primary))" }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 1.2 – Produção por Colaborador */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-center">Produção Anual por Colaborador</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={prodByCollab}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0]?.payload;
                      const member = teamById.get(d?.user_id);
                      return (
                        <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-xl text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={member?.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[8px]">{initials(member?.display_name ?? "?")}</AvatarFallback>
                            </Avatar>
                            <span className="font-semibold">{member?.display_name ?? "?"}</span>
                          </div>
                          <p className="tabular-nums font-bold text-primary">{d?.total} pts</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 1.3 – Produção por Tipo */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-center">Produção por Tipo de Tarefa</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={prodByType}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="stage" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="count" name="Entregas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="units" name="Unidades" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ════════════ BLOCO 2 — DESEMPENHO QUALITATIVO ════════════ */}
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-primary mb-4 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-full bg-accent-foreground/70" />
          Desempenho Qualitativo
        </h3>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 2.1 – Evolução Qualitativa */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-center">Evolução Anual da Média Qualitativa</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={qualEvolution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" domain={[0, 12]} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} pts`, "Média Qualitativa"]} />
                  <Line
                    dataKey="media"
                    name="Média Qualitativa"
                    stroke="hsl(var(--accent-foreground) / 0.7)"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "hsl(var(--accent-foreground) / 0.7)" }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 2.2 – Índice de Responsabilidade */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-center">
                Índice de Responsabilidade (Prazo)
              </CardTitle>
              <p className="text-xs text-muted-foreground text-center">
                Pontos perdidos por atraso no ano: <span className="font-bold text-destructive tabular-nums">{totalLostYear}</span>
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={responsibilityIndex}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: any, name: string) => {
                      if (name === "No Prazo") return [`${v}%`, name];
                      return [v, name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="pctOnTime" name="No Prazo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lost" name="Atrasadas" fill="hsl(var(--destructive) / 0.6)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 2.3 – Matriz Produção x Qualidade */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase text-center">Matriz Produção × Qualidade</CardTitle>
              <p className="text-xs text-muted-foreground text-center">Cada ponto = 1 colaborador</p>
            </CardHeader>
            <CardContent>
              {scatterData.length >= 1 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Quantitativo"
                      className="text-xs"
                      label={{ value: "Pontos Quantitativos", position: "insideBottom", offset: -5, className: "text-xs fill-muted-foreground" }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Qualitativo"
                      className="text-xs"
                      label={{ value: "Pontos Qualitativos", angle: -90, position: "insideLeft", className: "text-xs fill-muted-foreground" }}
                    />
                    <ZAxis range={[200, 200]} />

                    {/* Quadrant zones */}
                    <ReferenceArea x1={scatterMidX} x2={scatterMaxX * 1.1} y1={scatterMidY} y2={scatterMaxY * 1.1} fill={SCATTER_ZONE_COLORS.topRight} fillOpacity={1} />
                    <ReferenceArea x1={0} x2={scatterMidX} y1={scatterMidY} y2={scatterMaxY * 1.1} fill={SCATTER_ZONE_COLORS.topLeft} fillOpacity={1} />
                    <ReferenceArea x1={scatterMidX} x2={scatterMaxX * 1.1} y1={0} y2={scatterMidY} fill={SCATTER_ZONE_COLORS.bottomRight} fillOpacity={1} />
                    <ReferenceArea x1={0} x2={scatterMidX} y1={0} y2={scatterMidY} fill={SCATTER_ZONE_COLORS.bottomLeft} fillOpacity={1} />

                    <ReferenceLine x={scatterMidX} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                    <ReferenceLine y={scatterMidY} stroke="hsl(var(--border))" strokeDasharray="4 4" />

                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-xl text-xs">
                            <div className="flex items-center gap-2 mb-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={d?.avatar_url ?? undefined} />
                                <AvatarFallback className="text-[8px]">{initials(d?.name ?? "?")}</AvatarFallback>
                              </Avatar>
                              <span className="font-semibold">{d?.name}</span>
                            </div>
                            <p className="text-muted-foreground">Quantitativo: <span className="font-bold text-primary tabular-nums">{d?.x}</span></p>
                            <p className="text-muted-foreground">Qualitativo: <span className="font-bold text-primary tabular-nums">{d?.y}</span></p>
                          </div>
                        );
                      }}
                    />
                    <Scatter data={scatterData} fill="hsl(var(--primary))">
                      {scatterData.map((entry, idx) => (
                        <Cell key={entry.user_id} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Dados insuficientes para a matriz.</p>
              )}
              {scatterData.length >= 1 && (
                <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                  {scatterData.map((d, idx) => {
                    const member = teamById.get(d.user_id);
                    return (
                      <div key={d.user_id} className="flex items-center gap-1.5">
                        <Avatar className="h-5 w-5 border-2" style={{ borderColor: COLORS[idx % COLORS.length] }}>
                          <AvatarImage src={member?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-[8px]">{initials(member?.display_name ?? "?")}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{member?.display_name?.split(" ")[0]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
