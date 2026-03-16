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

function MetricCard({ value, label, highlight }: { value: string; label: string; highlight?: boolean }) {
  return (
    <Card className={cn(
      "overflow-hidden relative group",
      highlight && "border-0 shadow-lg shadow-purple-500/20"
    )}
    style={highlight ? {
      borderRadius: 16,
      boxShadow: "0 8px 32px -8px rgba(124,58,237,0.18), 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)",
    } : undefined}
    >
      {highlight && (
        <>
          {/* Layer 1 — deep base gradient */}
          <div
            className="absolute -inset-8 opacity-90"
            style={{
              background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 25%, #7C3AED 50%, #5B21B6 75%, #4C1D95 100%)",
              backgroundSize: "300% 300%",
              animation: "gradientFlow 14s ease-in-out infinite",
            }}
          />
          {/* Layer 2 — organic translucent shapes */}
          <div
            className="absolute -inset-12 opacity-60"
            style={{
              background: "radial-gradient(ellipse 70% 60% at 25% 35%, #8B5CF6 0%, transparent 70%), radial-gradient(ellipse 55% 65% at 75% 65%, #5B21B6 0%, transparent 65%)",
              animation: "parallaxLayer2 12s ease-in-out infinite",
            }}
          />
          {/* Layer 3 — blurred accent blobs */}
          <div
            className="absolute -inset-16 opacity-50"
            style={{
              background: "radial-gradient(circle 280px at 20% 70%, #7C3AED 0%, transparent 60%), radial-gradient(circle 220px at 80% 25%, #6D28D9 0%, transparent 55%), radial-gradient(circle 160px at 55% 50%, #4C1D95 0%, transparent 50%)",
              filter: "blur(30px)",
              animation: "parallaxLayer3 9s ease-in-out infinite",
            }}
          />
          {/* Geometric grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              animation: "gridDrift 22s linear infinite",
            }}
          />
          {/* Glow border */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-40 group-hover:opacity-80"
            style={{ borderRadius: 16, boxShadow: "inset 0 0 0 1.5px rgba(167,139,250,0.3), 0 0 20px 0 rgba(124,58,237,0.08)" }}
          />
        </>
      )}
      <CardContent className="relative z-10 grid gap-2 p-4">
        <div className={cn(
          "text-4xl font-semibold tabular-nums tracking-tight",
          highlight && "text-white drop-shadow-sm"
        )}>{value}</div>
        <div className={cn(
          "text-xs font-semibold tracking-wide",
          highlight ? "text-white/70" : "text-muted-foreground"
        )}>{label}</div>
      </CardContent>
    </Card>
  );
}

function MetricRingCard({ value, label }: { value: number; label: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid place-items-center gap-2 p-4">
        <ProgressRing
          value={value}
          tone={value === 100 ? "success" : "warning"}
          size={84}
          stroke={10}
          label={<span className="text-xl font-semibold tracking-tight">{value}%</span>}
        />
        <div className="text-center text-xs font-semibold tracking-wide text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export function Magic2Dashboard({ dashboard, year, month, fullscreen }: { dashboard: Dashboard; year: number; month: number; fullscreen?: boolean }) {
  const isMobile = useIsMobile();
  const now = useNow();
  const dueDate = new Date(year, month - 1, 27);

  const deadlineLabel = `27/${String(month).padStart(2, "0")}`;
  const clients100Pct = dashboard.totalClients
    ? Math.round((dashboard.clients100 / dashboard.totalClients) * 100)
    : 0;

  // Ajuste APENAS de layout: reordena a exibição para PDF ficar ao lado de Alterações.
  const stagesForDashboard: { key: Magic2StageKey; label: string }[] = (() => {
    const order: Magic2StageKey[] = [
      "planejamento",
      "captacao",
      "edicao_videos",
      "design",
      "alteracoes",
      "pdf",
      "agendamento",
    ];
    const byKey = new Map(MAGIC2_STAGES.map((s) => [s.key, s] as const));
    return order.map((k) => byKey.get(k)).filter(Boolean) as { key: Magic2StageKey; label: string }[];
  })();

  return (
    <section className={cn("grid gap-6 items-stretch grid-cols-1 lg:grid-cols-[minmax(280px,400px)_1fr] xl:grid-cols-[460px_1fr]", fullscreen && "min-h-[calc(100vh-120px)] lg:grid-cols-[minmax(280px,360px)_1fr] xl:grid-cols-[380px_1fr] items-stretch")}>
      {/* Coluna esquerda: anel grande */}
      <Card className={cn("overflow-hidden flex flex-col relative group border-0", fullscreen && "self-stretch")}
        style={{
          borderRadius: 16,
          boxShadow: "0 8px 32px -8px rgba(124,58,237,0.18), 0 0 0 1px rgba(139,92,246,0.12), inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        {/* Layer 1 — deep base gradient */}
        <div
          className="absolute -inset-8 opacity-90"
          style={{
            background: "linear-gradient(135deg, #4C1D95 0%, #6D28D9 25%, #7C3AED 50%, #5B21B6 75%, #4C1D95 100%)",
            backgroundSize: "300% 300%",
            animation: "gradientFlow 14s ease-in-out infinite",
          }}
        />
        {/* Layer 2 — organic translucent shapes */}
        <div
          className="absolute -inset-12 opacity-60"
          style={{
            background: "radial-gradient(ellipse 70% 60% at 25% 35%, #8B5CF6 0%, transparent 70%), radial-gradient(ellipse 55% 65% at 75% 65%, #5B21B6 0%, transparent 65%)",
            animation: "parallaxLayer2 12s ease-in-out infinite",
          }}
        />
        {/* Layer 3 — blurred accent blobs */}
        <div
          className="absolute -inset-16 opacity-50"
          style={{
            background: "radial-gradient(circle 280px at 20% 70%, #7C3AED 0%, transparent 60%), radial-gradient(circle 220px at 80% 25%, #6D28D9 0%, transparent 55%), radial-gradient(circle 160px at 55% 50%, #4C1D95 0%, transparent 50%)",
            filter: "blur(30px)",
            animation: "parallaxLayer3 9s ease-in-out infinite",
          }}
        />
        {/* Geometric grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            animation: "gridDrift 22s linear infinite",
          }}
        />
        {/* Glow border */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-500 opacity-40 group-hover:opacity-80"
          style={{ borderRadius: 16, boxShadow: "inset 0 0 0 1.5px rgba(167,139,250,0.3), 0 0 20px 0 rgba(124,58,237,0.08)" }}
        />

        <CardHeader className="relative z-10">
          <CardTitle className={cn(isMobile ? "text-base" : "text-lg", "text-white drop-shadow-sm")}>Visão Geral</CardTitle>
          <CountdownTo27Badge due={dueDate} now={now} />
        </CardHeader>
        <CardContent className={cn("relative z-10 grid place-items-center flex-1 p-6", isMobile ? "pb-6" : "pb-10")}>
          <ProgressRing
            value={dashboard.overallPct}
            tone={dashboard.overallPct === 100 ? "success" : "warning"}
            size={fullscreen ? 280 : isMobile ? 220 : 320}
            stroke={isMobile ? 18 : 26}
            trackColor="rgba(91,33,182,0.45)"
            label={
              <div className="text-center">
                <div className={cn("font-semibold tabular-nums tracking-tight text-white drop-shadow-sm", isMobile ? "text-5xl" : fullscreen ? "text-5xl" : "text-7xl")}>
                  {dashboard.overallPct}%
                </div>
                <div className={cn("mt-2 text-white/60", isMobile ? "text-xs" : fullscreen ? "text-sm" : "text-sm")}>
                  {dashboard.doneStages}/{dashboard.totalStages} etapas
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Coluna direita: métricas (linha) + etapas (grade) */}
      <div className={cn("flex flex-col gap-6", fullscreen && "flex-1")}>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <MetricCard value={deadlineLabel} label="MAGIC NUMBER" highlight />
          <MetricCard value={String(dashboard.totalStages)} label="TOTAL" />
          <MetricCard value={String(dashboard.doneStages)} label="FEITOS" />
          <MetricCard value={String(dashboard.pendingStages)} label="PENDENTES" />
        </div>

        {/* 1ª linha (4): Planejamento, Captação, Edição, Design | 2ª linha (4): Alterações, PDF, Agendamento, Clientes 100% */}
        <div className={cn("grid gap-4 content-start grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", fullscreen && "content-start")}>
          {stagesForDashboard.map((st) => {
            const item = dashboard.byStage[st.key];
            return (
              <div key={st.key} className="grid justify-items-center gap-3">
                <ProgressRing
                  value={item?.pct ?? 0}
                  tone={(item?.pct ?? 0) === 100 ? "success" : "warning"}
                  size={fullscreen ? 140 : isMobile ? 110 : 160}
                  stroke={isMobile ? 12 : 18}
                  className="animate-fade-in"
                  label={
                    <div className={cn("font-semibold tabular-nums", isMobile ? "text-xl" : fullscreen ? "text-xl" : "text-2xl")}>
                      {item?.pct ?? 0}%
                    </div>
                  }
                />
                <div
                  className={cn(
                    "w-full whitespace-nowrap rounded-md bg-foreground text-center font-semibold tracking-wide text-background",
                    isMobile ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-xs",
                  )}
                >
                  {st.label.toUpperCase()}
                </div>
              </div>
            );
          })}

          {/* Abaixo de DESIGN (col 4) e ao lado de AGENDAMENTO (col 3) no xl */}
          <div className="grid justify-items-center gap-3">
            <ProgressRing
              value={clients100Pct}
              tone={clients100Pct === 100 ? "success" : "warning"}
              size={fullscreen ? 140 : isMobile ? 110 : 160}
              stroke={isMobile ? 12 : 18}
              className="animate-fade-in"
              label={
                <div className={cn("font-semibold tabular-nums", isMobile ? "text-xl" : fullscreen ? "text-xl" : "text-2xl")}>
                  {dashboard.clients100}
                </div>
              }
            />
            <div
              className={cn(
                "w-full whitespace-nowrap rounded-md bg-foreground text-center font-semibold tracking-wide text-background",
                isMobile ? "px-2 py-1.5 text-[10px]" : "px-3 py-2 text-xs",
              )}
            >
              CLIENTES 100%
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
