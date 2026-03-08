import { useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TimerReset } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MAGIC_STAGES, type MagicStageKey, clamp } from "@/lib/uau";
import { useClientStages, useClients } from "@/features/data/queries";
import { useAllClientStages, useAllClientCycleStages, useClientCycles } from "@/features/data/stages-queries";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { MonthNavigator } from "@/features/magic/components/MonthNavigator";
import { ClientMonthCard } from "@/features/magic/components/ClientMonthCard";
import { MonthlyCountdownBadge } from "@/features/magic/components/MonthlyCountdownBadge";
import { CreateClientDialog } from "@/features/magic/components/CreateClientDialog";
import { MagicChecklistTable } from "@/features/magic/MagicChecklistTable";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
type MonthlyCategoryKey = "designer" | "editor";
const MONTHLY_CATEGORIES: Array<{
  key: MonthlyCategoryKey;
  label: string;
  stage: MagicStageKey;
}> = [{
  key: "designer",
  label: "Designer",
  stage: "design"
}, {
  key: "editor",
  label: "Vídeo",
  stage: "edicao_videos"
}];

const MAGIC_STAGE_KEY_SET = new Set<string>(MAGIC_STAGES.map((s) => s.key));

// DATE columns come as "YYYY-MM-DD".
// new Date("YYYY-MM-DD") is parsed as UTC and can shift to the previous day in some timezones.
function dateOnlyToLocalDate(dateOnly: string) {
  const [y, m, d] = dateOnly.split("-").map(n => Number(n));
  if (!y || !m || !d) return new Date(dateOnly);
  return new Date(y, m - 1, d);
}
export function MagicPanel({
  mode = "full"
}: {
  mode?: "full" | "dayview";
}) {
  const {
    user
  } = useSession();
  const {
    isAdmin
  } = useRole(user?.id);
  const [tab, setTab] = useState<"checklist" | "dashboard" | "mensal">(mode === "dayview" ? "dashboard" : "checklist");
  const clientsQ = useClients();
  const allStagesQ = useAllClientStages();
  const now = new Date();
  const year = now.getFullYear();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const cyclesQ = useClientCycles(year);
  const cycleStagesQ = useAllClientCycleStages(year);
  const clients = clientsQ.data ?? [];
  const allStages = allStagesQ.data ?? [];
  const cycles = cyclesQ.data ?? [];
  const cycleStages = cycleStagesQ.data ?? [];

  const activeClientIdsForMonth = useMemo(() => {
    const set = new Set<string>();
    for (const row of cycles) {
      if (row.year === year && row.month === month && row.is_active) set.add(row.client_id);
    }
    return set;
  }, [cycles, month, year]);

  const activeClients = useMemo(() => {
    return clients.filter((c) => activeClientIdsForMonth.has(c.id));
  }, [activeClientIdsForMonth, clients]);
  const monthDue = useMemo(() => new Date(year, month - 1, 27, 23, 59, 59), [year, month]);
  const monthCycleStages = useMemo(() => {
    return cycleStages.filter((row) => row.year === year && row.month === month);
  }, [cycleStages, year, month]);
  const dashboardMonthSummary = useMemo(() => {
    const totalClients = activeClients.length;
    const totalStages = totalClients * MAGIC_STAGES.length;
    const doneStages = monthCycleStages.filter(
      (s) => s.completed && MAGIC_STAGE_KEY_SET.has(s.stage) && activeClientIdsForMonth.has(s.client_id),
    ).length;
    const pendingStages = Math.max(0, totalStages - doneStages);
    const overallPct = totalStages ? Math.round(doneStages / totalStages * 100) : 0;
    const byStage = MAGIC_STAGES.reduce((acc, st) => {
      const stageRows = monthCycleStages.filter(
        (r) => r.stage === st.key && activeClientIdsForMonth.has(r.client_id),
      );
      const stageDone = stageRows.filter(r => r.completed).length;
      const stageTotal = totalClients; // 1 row per client per stage
      const stagePct = stageTotal ? Math.round(stageDone / stageTotal * 100) : 0;
      acc[st.key] = {
        total: stageTotal,
        done: stageDone,
        pct: stagePct
      };
      return acc;
    }, {} as Record<MagicStageKey, {
      total: number;
      done: number;
      pct: number;
    }>);
    return {
      totalClients,
      totalStages,
      doneStages,
      pendingStages,
      overallPct,
      byStage
    };
  }, [activeClientIdsForMonth, activeClients.length, monthCycleStages]);
  const monthly = useMemo(() => {
    const byClientMonth = new Map<string, {
      completedCount: number;
      latestDone: Date | null;
    }>();
    const byClientMonthStage = new Map<string, {
      completed: boolean;
      completedAt: Date | null;
    }>();
    for (const row of cycleStages) {
      if (!MAGIC_STAGE_KEY_SET.has(row.stage)) continue;
      const key = `${row.client_id}:${row.month}`;
      const prev = byClientMonth.get(key) ?? {
        completedCount: 0,
        latestDone: null
      };
      if (row.completed) {
        prev.completedCount += 1;
        if (row.completed_at) {
          const d = new Date(row.completed_at);
          prev.latestDone = !prev.latestDone || d > prev.latestDone ? d : prev.latestDone;
        }
      }
      byClientMonth.set(key, prev);

      // status por categoria (ex.: Designer/Editor) baseado na data preenchida (completed_at)
      const stageKey = row.stage as MagicStageKey;
      const k2 = `${row.client_id}:${row.month}:${stageKey}`;
      byClientMonthStage.set(k2, {
        completed: !!row.completed,
        completedAt: row.completed_at ? new Date(row.completed_at) : null
      });
    }
    const months = Array.from({
      length: 12
    }, (_, i) => i + 1);
    return months.map(m => {
      const due = new Date(year, m - 1, 27, 23, 59, 59);
      const activeIds = new Set(
        cycles.filter((c) => c.year === year && c.month === m && c.is_active).map((c) => c.client_id),
      );
      const monthClients = clients.filter((c) => activeIds.has(c.id));
      const totalClients = monthClients.length;
      const totalStages = totalClients * MAGIC_STAGES.length;

      // % deve seguir a mesma regra da Visão Geral (Dashboard): etapas concluídas / total de etapas do mês
      const doneStages = cycleStages.filter(
        (row) =>
          row.year === year &&
          row.month === m &&
          row.completed &&
          MAGIC_STAGE_KEY_SET.has(row.stage) &&
          activeIds.has(row.client_id),
      ).length;
      const overallPct = totalStages ? Math.round(doneStages / totalStages * 100) : 0;
      let doneOnTime = 0;
      let doneLate = 0;
      let inProgress = 0;
      let sumDaysBefore = 0;
      let sumDaysCount = 0;
      const categories = MONTHLY_CATEGORIES.map(cat => {
        let onTime = 0;
        let late = 0;
        let pending = 0;
        for (const c of monthClients) {
          const row = byClientMonthStage.get(`${c.id}:${m}:${cat.stage}`);
          if (!row?.completed) {
            pending += 1;
            continue;
          }
          if (row.completedAt && row.completedAt <= due) onTime += 1;else late += 1;
        }
        const total = monthClients.length;
        const onTimePct = total ? Math.round(onTime / total * 100) : 0;
        const tone = onTimePct >= 80 ? "success" : onTimePct >= 50 ? "warning" : "destructive";
        return {
          ...cat,
          total,
          onTime,
          late,
          pending,
          onTimePct,
          tone
        };
      });
      for (const c of monthClients) {
        const k = `${c.id}:${m}`;
        const st = byClientMonth.get(k);
        const completedAll = (st?.completedCount ?? 0) >= MAGIC_STAGES.length;
        if (!completedAll) {
          inProgress += 1;
          continue;
        }
        const latest = st?.latestDone;
        if (latest && latest <= due) {
          doneOnTime += 1;
          const daysBefore = Math.max(0, differenceInCalendarDays(due, latest));
          sumDaysBefore += daysBefore;
          sumDaysCount += 1;
        } else {
          doneLate += 1;
        }
      }
      const pct = overallPct;
      const avgDays = sumDaysCount ? Math.round(sumDaysBefore / sumDaysCount * 10) / 10 : null;
      return {
        month: m,
        pct,
        totalClients,
        doneOnTime,
        doneLate,
        inProgress,
        avgDays,
        categories
      };
    });
  }, [clients, cycles, cycleStages, year]);
  const monthlyWithDelta = useMemo(() => {
    return monthly.map(m => {
      const prev = monthly.find(x => x.month === m.month - 1);
      const deltaPp = prev ? m.pct - prev.pct : null;
      return {
        ...m,
        deltaPp
      };
    });
  }, [monthly]);
  const summary = useMemo(() => {
    const today = new Date();
    const totalClients = clients.length;
    const totalStages = totalClients * MAGIC_STAGES.length;
    let riskClients = 0;
    for (const c of clients) {
      const daysLeft = differenceInCalendarDays(dateOnlyToLocalDate(c.magic_due_date), today);
      if (daysLeft < 0) riskClients++;
    }
    const doneStages = allStages.filter(s => s.completed && MAGIC_STAGE_KEY_SET.has(s.stage)).length;
    const pendingStages = Math.max(0, totalStages - doneStages);
    const overallPct = totalStages ? Math.round(doneStages / totalStages * 100) : 0;
    const byStage = MAGIC_STAGES.reduce((acc, st) => {
      const stageRows = allStages.filter(r => r.stage === st.key);
      const stageDone = stageRows.filter(r => r.completed).length;
      const stageTotal = totalClients; // 1 row per client per stage
      const stagePct = stageTotal ? Math.round(stageDone / stageTotal * 100) : 0;
      acc[st.key] = {
        total: stageTotal,
        done: stageDone,
        pct: stagePct
      };
      return acc;
    }, {} as Record<MagicStageKey, {
      total: number;
      done: number;
      pct: number;
    }>);
    return {
      totalClients,
      riskClients,
      totalStages,
      doneStages,
      pendingStages,
      overallPct,
      byStage
    };
  }, [clients, allStages]);
  const headlineDate = useMemo(() => {
    // Sempre mostra o Magic Number do mês selecionado (dia 27).
    return format(new Date(year, month - 1, 27), "dd/MM");
  }, [year, month]);
  const loading = clientsQ.isLoading || allStagesQ.isLoading;
  return <div className="space-y-6">
      {/* Cabeçalho fixo (não some ao rolar) */}
      <div className="sticky top-0 z-30 -mx-6 bg-background/80 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}>
        <div className="flex-col gap-3 sm:items-end sm:justify-between flex sm:flex-row bg-success-foreground">
          

          <div className="flex items-center gap-2">
            {/* Contagem regressiva do mês selecionado (vence dia 27) */}
            <MonthlyCountdownBadge due={monthDue} />
          </div>
        </div>

        {mode === "dayview" ? null : <div className="mt-4">
            <Tabs value={tab} onValueChange={v => setTab(v as any)}>
              <TabsList className="bg-card/40">
                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                <TabsTrigger value="mensal">Mensal</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>}
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        {mode === "dayview" ? null : <TabsContent value="checklist" className="mt-0">
          <MagicChecklistTable year={year} month={month} onMonthChange={setMonth} />

           {activeClients.length === 0 ? <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TimerReset className="h-5 w-5" />
                    Comece cadastrando um cliente
                  </CardTitle>
                  <CardDescription>
                    Depois você cria tarefas na Agenda — e ao concluir, o checklist do cliente atualiza automaticamente.
                  </CardDescription>
                </CardHeader>
                {isAdmin ? <CardContent>
                    <CreateClientDialog year={year} month={month} triggerLabel="Cadastrar cliente" />
                  </CardContent> : null}
              </Card>
            </div> : null}
          </TabsContent>}

        <TabsContent value="dashboard" className="mt-0 opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}>
           {activeClients.length === 0 ? <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TimerReset className="h-5 w-5" />
                  Comece cadastrando um cliente
                </CardTitle>
                <CardDescription>
                  Depois você cria tarefas na Agenda — e ao concluir, o checklist do cliente atualiza automaticamente.
                </CardDescription>
              </CardHeader>
              {isAdmin ? <CardContent>
                  <CreateClientDialog year={year} month={month} triggerLabel="Cadastrar cliente" />
                </CardContent> : null}
            </Card> : <div className="space-y-6">
              {/* Dashboard geral */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Dashboard do mês</h3>
                  
                </div>
                <MonthNavigator month={month} onMonthChange={setMonth} />
              </div>

              <section className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg">Visão Geral</CardTitle>
                    <CardDescription>Percentual concluído no mês selecionado.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid place-items-center pb-8">
                    <ProgressRing value={dashboardMonthSummary.overallPct} size={300} stroke={22} label={<div className="text-center">
                          <div className="text-5xl font-semibold tabular-nums tracking-tight">
                            {dashboardMonthSummary.overallPct}%
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {dashboardMonthSummary.doneStages}/{dashboardMonthSummary.totalStages} etapas
                          </div>
                        </div>} />
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  {/* KPIs topo */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <KpiStat value={headlineDate} label="Magic Number" />
                    <KpiStat value={loading ? "—" : String(dashboardMonthSummary.totalStages)} label="Total" />
                    <KpiStat value={loading ? "—" : String(dashboardMonthSummary.doneStages)} label="Feitos" />
                    <KpiStat value={loading ? "—" : String(dashboardMonthSummary.pendingStages)} label="Pendentes" />
                    <KpiStat value={loading ? "—" : String(dashboardMonthSummary.totalClients)} label="Clientes" round />
                  </div>

                  {/* Etapas */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                    {MAGIC_STAGES.map(st => {
                  const item = dashboardMonthSummary.byStage[st.key];
                  return <div key={st.key} className="grid justify-items-center gap-3">
                          <ProgressRing value={item?.pct ?? 0} size={140} stroke={14} className="animate-fade-in" label={<div className="text-3xl font-semibold tabular-nums">{item?.pct ?? 0}%</div>} />
                          <div className="w-full whitespace-nowrap rounded-md bg-foreground px-3 py-2 text-center text-xs font-semibold tracking-wide text-background">
                            {st.label.toUpperCase()}
                          </div>
                        </div>;
                })}
                  </div>
                </div>
              </section>

              {/* Lista de clientes */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {activeClients.map((c) => (
                  <ClientMonthCard
                    key={c.id}
                    client={c}
                    due={monthDue}
                    stages={monthCycleStages.filter((s) => s.client_id === c.id)}
                  />
                ))}
              </div>
            </div>}
        </TabsContent>

        {mode === "dayview" ? null : <TabsContent value="mensal" className="mt-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Visão mensal</h3>
              <p className="text-sm text-muted-foreground">Resumo por mês (concluído / no prazo / atraso) + comparação.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {monthlyWithDelta.map(m => <Card key={m.month} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{String(m.month).padStart(2, "0")}/{year}</CardTitle>
                      <CardDescription>Magic Number: dia 27</CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold tabular-nums">{m.pct}%</div>
                      <div className="text-xs text-muted-foreground">
                        {m.deltaPp === null ? "—" : `${m.deltaPp > 0 ? "+" : ""}${m.deltaPp}pp vs mês anterior`}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-md border border-border/60 bg-card/20 p-2">
                      <div className="text-xs text-muted-foreground">No prazo</div>
                      <div className="font-semibold tabular-nums">{m.doneOnTime}</div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-card/20 p-2">
                      <div className="text-xs text-muted-foreground">Atraso</div>
                      <div className="font-semibold tabular-nums">{m.doneLate}</div>
                    </div>
                    <div className="rounded-md border border-border/60 bg-card/20 p-2">
                      <div className="text-xs text-muted-foreground">Em aberto</div>
                      <div className="font-semibold tabular-nums">{m.inProgress}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {m.categories.map(c => <div key={c.key} className="flex items-center justify-between rounded-md border border-border/60 bg-card/20 px-3 py-2">
                        <div className="text-sm font-medium">{c.label}</div>
                        <div className="text-sm tabular-nums">
                          {c.onTimePct}% <span className="text-xs text-muted-foreground">no prazo</span>
                        </div>
                      </div>)}
                  </div>
                </CardContent>
              </Card>)}
          </div>
        </TabsContent>}
      </Tabs>
    </div>;
}
function KpiStat({
  value,
  label,
  round
}: {
  value: string;
  label: string;
  round?: boolean;
}) {
  return <div className="grid gap-2">
      {round ? <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-4 border-primary text-2xl font-semibold tabular-nums">
          {value}
        </div> : <div className="text-center text-4xl font-semibold tabular-nums tracking-tight">{value}</div>}

      <div className="rounded-md bg-foreground px-3 py-2 text-center text-xs font-semibold tracking-wide text-background">
        {label.toUpperCase()}
      </div>
    </div>;
}