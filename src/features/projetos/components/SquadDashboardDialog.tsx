import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Users, Zap, BarChart2, Target
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  BarChart, Bar, Cell,
} from "recharts";

const STAGE_ORDER = ["planejamento", "captacao", "edicao_videos", "design", "pdf", "alteracoes", "agendamento"] as const;
const STAGE_LABELS: Record<string, string> = {
  planejamento: "Planejamento", captacao: "Captação", edicao_videos: "Vídeo",
  design: "Design", pdf: "PDF", alteracoes: "Alterações", agendamento: "Agendamento",
};
const STAGE_COLORS: Record<string, string> = {
  planejamento: "#8B5CF6", captacao: "#3B82F6", edicao_videos: "#06B6D4",
  design: "#EC4899", pdf: "#F59E0B", alteracoes: "#EF4444", agendamento: "#10B981",
};

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

interface SquadDashboardDialogProps {
  open: boolean;
  onClose: () => void;
  squad: any;
  squadIcon: React.ComponentType<any>;
  stageProgress: Record<string, any>[];
  stagePerf: Record<string, { completed: number; total: number; percent: number }>;
  clients: Array<{
    clientId: string;
    name: string;
    stages: any[];
    completed: number;
    total: number;
    percent: number;
    prevPercent: number;
    speed: number;
    prevSpeed: number;
    insights: string[];
  }>;
  squadInsights: string[];
  sqData: any;
  teamMap: Record<string, { user_id: string; display_name: string; avatar_url: string | null; role_title: string }>;
  squadMemberIds: string[];
  allTasks: any[];
}

export function SquadDashboardDialog({
  open, onClose, squad, squadIcon: SquadIcon, stageProgress, stagePerf,
  clients, squadInsights, sqData, teamMap, squadMemberIds, allTasks,
}: SquadDashboardDialogProps) {
  const [clientsCollapsed, setClientsCollapsed] = useState(false);
  const now = new Date();

  // ── Bottleneck detection ──
  const bottleneck = useMemo(() => {
    let worst = { key: "", label: "", percent: 101, completed: 0, total: 0 };
    for (const k of STAGE_ORDER) {
      const p = stagePerf[k];
      if (!p || p.total === 0) continue;
      if (p.percent < worst.percent) {
        worst = { key: k, label: STAGE_LABELS[k], percent: p.percent, completed: p.completed, total: p.total };
      }
    }
    return worst.percent < 100 ? worst : null;
  }, [stagePerf]);

  // ── Member productivity ──
  const memberProductivity = useMemo(() => {
    if (!squadMemberIds.length) return [];

    // Count tasks completed this month by each member
    const memberStats: Record<string, { total: number; done: number }> = {};
    squadMemberIds.forEach(uid => { memberStats[uid] = { total: 0, done: 0 }; });

    for (const t of allTasks) {
      if (!t.assignee_id || !memberStats[t.assignee_id]) continue;
      memberStats[t.assignee_id].total++;
      if (t.status_global === "concluido") memberStats[t.assignee_id].done++;
    }

    return Object.entries(memberStats)
      .map(([uid, stats]) => {
        const member = teamMap[uid];
        return {
          uid,
          name: member?.display_name ?? "—",
          avatar: member?.avatar_url ?? null,
          role: member?.role_title ?? "",
          done: stats.done,
          total: stats.total,
          percent: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
        };
      })
      .sort((a, b) => b.done - a.done || b.percent - a.percent);
  }, [squadMemberIds, allTasks, teamMap]);

  const maxDone = Math.max(1, ...memberProductivity.map(m => m.done));

  if (!squad) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        {/* ── Premium Header ── */}
        <div
          className="relative px-8 pt-8 pb-6"
          style={{ background: `linear-gradient(135deg, ${squad.color}18 0%, ${squad.color}06 100%)` }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/80 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ background: `linear-gradient(135deg, ${squad.color}, ${squad.color}aa)` }}
              >
                <SquadIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Dashboard — {squad.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {format(now, "MMMM yyyy", { locale: ptBR })} • Visão estratégica do squad
                </p>
              </div>
            </div>
            {sqData && (
              <div className="text-right hidden sm:block">
                <div className="text-3xl font-bold text-foreground">{sqData.percentComplete}<span className="text-base font-normal text-muted-foreground">%</span></div>
                <p className="text-xs text-muted-foreground">{sqData.completedEtapas}/{sqData.totalEtapas} etapas</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-8 pb-8 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* ── 1. Bottleneck Alert ── */}
          {bottleneck && (
            <div
              className="relative overflow-hidden rounded-2xl border p-5"
              style={{
                borderColor: `${STAGE_COLORS[bottleneck.key]}30`,
                background: `linear-gradient(135deg, ${STAGE_COLORS[bottleneck.key]}08 0%, transparent 100%)`,
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-[0.04] -translate-y-1/2 translate-x-1/2"
                style={{ backgroundColor: STAGE_COLORS[bottleneck.key] }} />
              <div className="flex items-start gap-4">
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${STAGE_COLORS[bottleneck.key]}18` }}
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: STAGE_COLORS[bottleneck.key] }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground">Gargalo atual</p>
                    <Badge variant="outline" className="text-[10px] font-bold border-0 px-2 py-0.5" style={{
                      backgroundColor: `${STAGE_COLORS[bottleneck.key]}15`,
                      color: STAGE_COLORS[bottleneck.key],
                    }}>
                      {bottleneck.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Apenas <strong className="text-foreground">{bottleneck.completed}/{bottleneck.total}</strong> clientes concluíram esta etapa ({bottleneck.percent}%).
                    Esta é a etapa mais travada do ciclo — foco aqui pode destravar o fluxo.
                  </p>
                  {/* Mini progress */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full bg-border/20 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${bottleneck.percent}%`, backgroundColor: STAGE_COLORS[bottleneck.key] }}
                      />
                    </div>
                    <span className="text-xs font-bold" style={{ color: STAGE_COLORS[bottleneck.key] }}>{bottleneck.percent}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── 2. Stage Progress Chart ── */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-sidebar/10 flex items-center justify-center">
                <BarChart2 className="h-4.5 w-4.5 text-sidebar" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Evolução por Etapa</p>
                <p className="text-xs text-muted-foreground">Progresso diário de conclusão</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {STAGE_ORDER.map(k => (
                <div key={k} className="flex items-center gap-1.5 text-xs">
                  <div
                    className={cn("h-2.5 w-2.5 rounded-sm", bottleneck?.key === k && "ring-2 ring-offset-1")}
                    style={{ backgroundColor: STAGE_COLORS[k], ...(bottleneck?.key === k ? { ringColor: STAGE_COLORS[k] } : {}) }}
                  />
                  <span className={cn("font-medium", bottleneck?.key === k ? "text-foreground font-bold" : "text-muted-foreground")}>
                    {STAGE_LABELS[k]}
                  </span>
                </div>
              ))}
            </div>

            {/* Chart */}
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stageProgress} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {STAGE_ORDER.map(k => (
                      <linearGradient key={`sg-${k}`} id={`sd-grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={STAGE_COLORS[k]} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={STAGE_COLORS[k]} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={35} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-popover border border-border rounded-xl shadow-xl px-3.5 py-3 space-y-1.5">
                          <p className="text-xs font-bold text-foreground">Dia {label}</p>
                          {payload
                            .filter((e: any) => e.value !== undefined)
                            .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0))
                            .map((entry: any) => (
                              <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
                                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[entry.dataKey as string] }} />
                                <span className="text-muted-foreground">{STAGE_LABELS[entry.dataKey as string]}:</span>
                                <span className="font-bold text-foreground">{entry.value}%</span>
                              </div>
                            ))}
                        </div>
                      );
                    }}
                  />
                  {STAGE_ORDER.map(k => (
                    <Area
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={STAGE_COLORS[k]}
                      strokeWidth={bottleneck?.key === k ? 3.5 : 2}
                      strokeDasharray={bottleneck?.key === k ? undefined : undefined}
                      fill={`url(#sd-grad-${k})`}
                      dot={false}
                      connectNulls={false}
                      animationDuration={800}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Stage completion cards — all 7 */}
            <div className="grid grid-cols-7 gap-2">
              {STAGE_ORDER.map(k => {
                const perf = stagePerf[k];
                const isBottleneck = bottleneck?.key === k;
                return (
                  <div
                    key={k}
                    className={cn(
                      "relative rounded-xl border p-3 text-center transition-all",
                      isBottleneck ? "border-transparent shadow-md" : "border-border/30",
                    )}
                    style={isBottleneck ? {
                      background: `linear-gradient(135deg, ${STAGE_COLORS[k]}12 0%, ${STAGE_COLORS[k]}04 100%)`,
                      borderColor: `${STAGE_COLORS[k]}40`,
                    } : undefined}
                  >
                    {isBottleneck && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <AlertTriangle className="h-3.5 w-3.5" style={{ color: STAGE_COLORS[k] }} />
                      </div>
                    )}
                    <div className="h-2 w-2 rounded-full mx-auto mb-2" style={{ backgroundColor: STAGE_COLORS[k] }} />
                    <p className="text-[10px] font-bold text-foreground leading-tight">{STAGE_LABELS[k]}</p>
                    <p className="text-lg font-bold mt-1" style={{ color: isBottleneck ? STAGE_COLORS[k] : undefined }}>
                      {perf?.percent ?? 0}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">{perf ? `${perf.completed}/${perf.total}` : "—"}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 3. Member Productivity ── */}
          {memberProductivity.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-sidebar/10 flex items-center justify-center">
                  <Users className="h-4.5 w-4.5 text-sidebar" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Produtividade por Colaborador</p>
                  <p className="text-xs text-muted-foreground">Ranking de tarefas concluídas no mês</p>
                </div>
              </div>

              <div className="space-y-2">
                {memberProductivity.map((m, idx) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const medal = idx < 3 ? medals[idx] : null;
                  const barWidth = maxDone > 0 ? Math.round((m.done / maxDone) * 100) : 0;
                  const isTop = idx === 0 && m.done > 0;

                  return (
                    <div
                      key={m.uid}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl border px-4 py-3 transition-all",
                        isTop ? "border-transparent shadow-md" : "border-border/30 hover:border-border/60",
                      )}
                      style={isTop ? {
                        background: `linear-gradient(135deg, ${squad.color}10 0%, ${squad.color}04 100%)`,
                      } : undefined}
                    >
                      {/* Rank */}
                      <span className="text-sm font-bold min-w-[28px] text-center">
                        {medal ?? `${idx + 1}º`}
                      </span>

                      {/* Avatar */}
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={m.avatar ?? undefined} alt={m.name} />
                        <AvatarFallback className="text-[10px] bg-muted">{initials(m.name)}</AvatarFallback>
                      </Avatar>

                      {/* Info + bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{m.name}</p>
                          {isTop && m.done > 0 && (
                            <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-0" style={{
                              backgroundColor: `${squad.color}15`,
                              color: squad.color,
                            }}>
                              TOP
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-2 rounded-full bg-border/20 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${barWidth}%`,
                                background: `linear-gradient(90deg, ${squad.color}, ${squad.color}88)`,
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-foreground">{m.done}</p>
                        <p className="text-[10px] text-muted-foreground">{m.total > 0 ? `${m.percent}% de ${m.total}` : "sem tarefas"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 4. Client Breakdown (collapsible) ── */}
          {clients.length > 0 && (
            <div className="space-y-3">
              <button
                onClick={() => setClientsCollapsed(!clientsCollapsed)}
                className="flex items-center gap-3 w-full group"
              >
                <div className="h-9 w-9 rounded-xl bg-sidebar/10 flex items-center justify-center shrink-0">
                  <Target className="h-4.5 w-4.5 text-sidebar" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-sm font-bold text-foreground">Desempenho por Cliente</p>
                  <p className="text-xs text-muted-foreground">{clients.length} clientes no squad</p>
                </div>
                <div className="h-8 w-8 rounded-xl border border-border/30 flex items-center justify-center group-hover:bg-muted/50 transition-colors">
                  {clientsCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {!clientsCollapsed && (
                <div className="space-y-2 pl-12">
                  {clients.map(c => (
                    <div key={c.clientId} className="flex items-center gap-3 rounded-xl border border-border/20 px-4 py-3 hover:border-border/40 transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                          {c.percent === 100 && (
                            <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 border-0 bg-emerald-500/10 text-emerald-600">
                              Completo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-border/20 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${c.percent}%`, backgroundColor: squad.color }}
                            />
                          </div>
                          <span className="text-xs font-bold text-foreground shrink-0">{c.percent}%</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-muted-foreground">{c.completed}/{c.total}</span>
                        {c.prevPercent > 0 && (
                          <div className="flex items-center gap-0.5 text-[10px] justify-end">
                            {c.percent > c.prevPercent ? <TrendingUp className="h-2.5 w-2.5 text-emerald-500" /> : c.percent < c.prevPercent ? <TrendingDown className="h-2.5 w-2.5 text-rose-500" /> : null}
                            <span className={cn(c.percent > c.prevPercent ? "text-emerald-500" : c.percent < c.prevPercent ? "text-rose-500" : "text-muted-foreground")}>
                              {c.prevPercent}% ant.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Squad Insights ── */}
          {squadInsights.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {squadInsights.map((ins, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-accent/30 rounded-xl px-3 py-2">
                  <Zap className="h-3 w-3 text-sidebar shrink-0" />
                  <span className="text-muted-foreground">{ins}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
