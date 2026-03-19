import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { MAGIC2_STAGES, type Magic2StageKey } from "@/features/magic2/magic2-stages";
import { CountdownTo27Badge } from "@/features/magic2/components/CountdownTo27Badge";
import { useNow } from "@/hooks/use-now";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type Dashboard = {
  totalClients: number;
  totalStages: number;
  doneStages: number;
  pendingStages: number;
  overallPct: number;
  clients100: number;
  byStage: Record<Magic2StageKey, { done: number; total: number; pct: number }>;
};

/* ── Metric cards (top row) ── */

function MetricCard({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <Card
      className={cn(
        "overflow-hidden relative group flex-1 min-w-0",
        highlight && "border-0 shadow-lg shadow-purple-500/20"
      )}
      style={highlight ? {
        borderRadius: 16,
        boxShadow: "0 8px 32px -8px rgba(124,58,237,0.18), 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)",
      } : undefined}
    >
      {highlight && <GradientLayers />}
      <CardContent className="relative z-10 grid gap-1 p-3 sm:p-4">
        <div className={cn(
          "text-2xl sm:text-3xl lg:text-4xl font-semibold tabular-nums tracking-tight",
          highlight && "text-white drop-shadow-sm"
        )}>{value}</div>
        <div className={cn(
          "text-[10px] sm:text-xs font-semibold tracking-wide uppercase",
          highlight ? "text-white/70" : "text-muted-foreground"
        )}>{label}</div>
      </CardContent>
    </Card>
  );
}

/* ── Gradient layers reused across highlight cards ── */

function GradientLayers() {
  return (
    <>
      <div className="absolute -inset-8 opacity-90" style={{
        background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 25%, #7C3AED 50%, #5B21B6 75%, #4C1D95 100%)",
        backgroundSize: "300% 300%", animation: "gradientFlow 14s ease-in-out infinite",
      }} />
      <div className="absolute -inset-12 opacity-60" style={{
        background: "radial-gradient(ellipse 70% 60% at 25% 35%, #8B5CF6 0%, transparent 70%), radial-gradient(ellipse 55% 65% at 75% 65%, #5B21B6 0%, transparent 65%)",
        animation: "parallaxLayer2 12s ease-in-out infinite",
      }} />
      <div className="absolute -inset-16 opacity-50" style={{
        background: "radial-gradient(circle 280px at 20% 70%, #7C3AED 0%, transparent 60%), radial-gradient(circle 220px at 80% 25%, #6D28D9 0%, transparent 55%), radial-gradient(circle 160px at 55% 50%, #4C1D95 0%, transparent 50%)",
        filter: "blur(30px)", animation: "parallaxLayer3 9s ease-in-out infinite",
      }} />
      <div className="absolute inset-0 opacity-[0.07]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
        backgroundSize: "44px 44px", animation: "gridDrift 22s linear infinite",
      }} />
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-40 group-hover:opacity-80"
        style={{ borderRadius: 16, boxShadow: "inset 0 0 0 1.5px rgba(167,139,250,0.3), 0 0 20px 0 rgba(124,58,237,0.08)" }}
      />
    </>
  );
}

/* ── Stage ring widget ── */

function StageRingWidget({ label, pct, valueLabel, className, fullscreen }: { label: string; pct: number; valueLabel?: React.ReactNode; className?: string; fullscreen?: boolean }) {
  const isMobile = useIsMobile();
  const ringSize = isMobile ? 100 : fullscreen ? 200 : 180;
  const strokeWidth = isMobile ? 10 : fullscreen ? 18 : 20;
  return (
    <div className={cn("flex flex-col items-center gap-0 min-w-0", fullscreen && "justify-end", className)}>
      <div className={cn("flex items-center justify-center w-full", fullscreen ? "flex-1 min-h-0" : "")}>
        <ProgressRing
          value={pct}
          tone={pct === 100 ? "success" : "warning"}
          size={ringSize}
          stroke={strokeWidth}
          className={cn("animate-fade-in", fullscreen ? "max-w-full max-h-full" : "max-w-full")}
          label={
            valueLabel ?? (
              <span className={cn("font-semibold tabular-nums", isMobile ? "text-lg" : fullscreen ? "text-2xl" : "text-2xl")}>{pct}%</span>
            )
          }
        />
      </div>
      <div className={cn(
        "w-full whitespace-nowrap rounded-md bg-foreground text-center font-semibold tracking-wide text-background shrink-0 -mt-2",
        isMobile ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
      )}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}

/* ── Main dashboard ── */

export function Magic2Dashboard({ dashboard, year, month, fullscreen }: { dashboard: Dashboard; year: number; month: number; fullscreen?: boolean }) {
  const isMobile = useIsMobile();
  const now = useNow();
  const dueDate = new Date(year, month - 1, 27);
  const deadlineLabel = `27/${String(month).padStart(2, "0")}`;
  const clients100Pct = dashboard.totalClients
    ? Math.round((dashboard.clients100 / dashboard.totalClients) * 100)
    : 0;

  const stagesForDashboard: { key: Magic2StageKey; label: string }[] = (() => {
    const order: Magic2StageKey[] = [
      "planejamento", "captacao", "edicao_videos", "design",
      "alteracoes", "pdf", "agendamento",
    ];
    const byKey = new Map(MAGIC2_STAGES.map((s) => [s.key, s] as const));
    return order.map((k) => byKey.get(k)).filter(Boolean) as { key: Magic2StageKey; label: string }[];
  })();

  /* Mobile: single column stacked layout */
  if (isMobile) {
    return (
      <section className="flex flex-col gap-4">
        {/* Overview ring */}
        <Card className="overflow-hidden relative group border-0"
          style={{ borderRadius: 16, boxShadow: "0 8px 32px -8px rgba(124,58,237,0.18), 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)" }}
        >
          <GradientLayers />
          <CardHeader className="relative z-10 pb-2">
            <CardTitle className="text-base text-white drop-shadow-sm">Visão Geral</CardTitle>
            <CountdownTo27Badge due={dueDate} now={now} />
          </CardHeader>
          <CardContent className="relative z-10 grid place-items-center p-4 pb-6">
            <ProgressRing
              value={dashboard.overallPct}
              tone={dashboard.overallPct === 100 ? "success" : "warning"}
              size={200}
              stroke={16}
              trackColor="rgba(91,33,182,0.45)"
              label={
                <div className="text-center">
                  <div className="text-4xl font-semibold tabular-nums text-white drop-shadow-sm">{dashboard.overallPct}%</div>
                  <div className="mt-1 text-xs text-white/60">{dashboard.doneStages}/{dashboard.totalStages} etapas</div>
                </div>
              }
            />
          </CardContent>
        </Card>

        {/* Metric row */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard value={deadlineLabel} label="MAGIC NUMBER" highlight />
          <MetricCard value={String(dashboard.totalStages)} label="TOTAL" />
          <MetricCard value={String(dashboard.doneStages)} label="FEITOS" />
          <MetricCard value={String(dashboard.pendingStages)} label="PENDENTES" />
        </div>

        {/* Stage rings */}
        <div className="grid grid-cols-2 gap-3">
          {stagesForDashboard.map((st) => {
            const item = dashboard.byStage[st.key];
            return <StageRingWidget key={st.key} label={st.label} pct={item?.pct ?? 0} />;
          })}
          <StageRingWidget
            label="CLIENTES 100%"
            pct={clients100Pct}
            valueLabel={<span className="text-lg font-semibold tabular-nums">{dashboard.clients100}</span>}
          />
        </div>
      </section>
    );
  }

  /* Desktop / Tablet: 2-column layout that stretches to fill viewport */
  return (
    <section className={cn(
      "grid gap-4 items-stretch",
      fullscreen
        ? "flex-1 min-h-0 h-full grid-cols-[1fr_2fr]"
        : "grid-cols-[minmax(260px,360px)_1fr] lg:grid-cols-[minmax(300px,400px)_1fr] xl:grid-cols-[420px_1fr]"
    )} style={fullscreen ? { height: "100%" } : undefined}>

      {/* ── Left column: Overview card ── */}
      <Card
        className="overflow-hidden flex flex-col relative group border-0"
        style={{
          borderRadius: 16,
          boxShadow: "0 8px 32px -8px rgba(124,58,237,0.18), 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <GradientLayers />
        <CardHeader className="relative z-10 shrink-0">
          <CardTitle className="text-lg text-white drop-shadow-sm">Visão Geral</CardTitle>
          <p className="text-sm text-white/50">Percentual concluído no mês selecionado.</p>
          <CountdownTo27Badge due={dueDate} now={now} />
        </CardHeader>
        <CardContent className="relative z-10 flex-1 flex items-center justify-center p-6">
          <ProgressRing
            value={dashboard.overallPct}
            tone={dashboard.overallPct === 100 ? "success" : "warning"}
            size={fullscreen ? 400 : 340}
            stroke={fullscreen ? 30 : 28}
            trackColor="rgba(91,33,182,0.45)"
            label={
              <div className="text-center">
                <div className={cn(
                  "font-semibold tabular-nums tracking-tight text-white drop-shadow-sm",
                  fullscreen ? "text-6xl" : "text-7xl xl:text-8xl"
                )}>
                  {dashboard.overallPct}%
                </div>
                <div className="mt-2 text-base text-white/60">
                  {dashboard.doneStages}/{dashboard.totalStages} etapas
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* ── Right column: metrics + stage grid ── */}
      <div className="flex flex-col gap-3 min-h-0">
        {/* Top metrics row */}
        <div className="grid grid-cols-4 gap-2 shrink-0">
          <MetricCard value={deadlineLabel} label="MAGIC NUMBER" highlight />
          <MetricCard value={String(dashboard.totalStages)} label="TOTAL" />
          <MetricCard value={String(dashboard.doneStages)} label="FEITOS" />
          <MetricCard value={String(dashboard.pendingStages)} label="PENDENTES" />
        </div>

        {/* Stage rings grid — fills remaining height */}
        <div className={cn(
          "flex-1 min-h-0 grid gap-3",
          "grid-cols-4 grid-rows-2"
        )}>
          {stagesForDashboard.map((st) => {
            const item = dashboard.byStage[st.key];
            return (
              <StageRingWidget
                key={st.key}
                label={st.label}
                pct={item?.pct ?? 0}
                fullscreen={fullscreen}
              />
            );
          })}
          <StageRingWidget
            label="CLIENTES 100%"
            pct={clients100Pct}
            fullscreen={fullscreen}
            valueLabel={
              <span className={cn("font-semibold tabular-nums", fullscreen ? "text-2xl" : "text-2xl")}>
                {dashboard.clients100}
              </span>
            }
          />
        </div>
      </div>
    </section>
  );
}
