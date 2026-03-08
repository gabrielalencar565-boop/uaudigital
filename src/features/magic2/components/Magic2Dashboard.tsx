import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { MAGIC2_STAGES, type Magic2StageKey } from "@/features/magic2/magic2-stages";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";

type Dashboard = {
  totalClients: number;
  totalStages: number;
  doneStages: number;
  pendingStages: number;
  overallPct: number;
  clients100: number;
  byStage: Record<Magic2StageKey, { done: number; total: number; pct: number }>;
};

function MetricCard({ value, label }: { value: string; label: string }) {
  const num = parseFloat(value);
  const isNumeric = !isNaN(num) && value.trim() !== "";
  return (
    <Card className="overflow-hidden">
      <CardContent className="grid gap-2 p-4">
        {isNumeric ? (
          <AnimatedNumber value={num} className="text-4xl font-semibold tracking-tight" />
        ) : (
          <div className="text-4xl font-semibold tabular-nums tracking-tight">{value}</div>
        )}
        <div className="text-xs font-semibold tracking-wide text-muted-foreground">{label}</div>
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
          label={<AnimatedNumber value={value} suffix="%" className="text-xl font-semibold tracking-tight" />}
        />
        <div className="text-center text-xs font-semibold tracking-wide text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

export function Magic2Dashboard({ dashboard, year, month, fullscreen }: { dashboard: Dashboard; year: number; month: number; fullscreen?: boolean }) {
  const isMobile = useIsMobile();

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
    <section className={cn("grid gap-6 items-stretch", isMobile ? "grid-cols-1" : "lg:grid-cols-[460px_1fr]", fullscreen && "min-h-[calc(100vh-120px)]")}>
      {/* Coluna esquerda: anel grande */}
      <Card className="overflow-hidden flex flex-col">
        <CardHeader>
          <CardTitle className={cn(isMobile ? "text-base" : "text-lg")}>Visão Geral</CardTitle>
          <CardDescription>Percentual concluído no mês selecionado.</CardDescription>
        </CardHeader>
        <CardContent className={cn("grid place-items-center flex-1 p-6", isMobile ? "pb-6" : "pb-10")}>
          <ProgressRing
            value={dashboard.overallPct}
            tone={dashboard.overallPct === 100 ? "success" : "warning"}
            size={fullscreen ? 400 : isMobile ? 220 : 320}
            stroke={isMobile ? 18 : 24}
            label={
              <div className="text-center">
                <div className={cn("font-semibold tabular-nums tracking-tight", isMobile ? "text-5xl" : "text-6xl")}>
                  {dashboard.overallPct}%
                </div>
                <div className={cn("mt-2 text-muted-foreground", isMobile ? "text-[11px]" : "text-xs")}>
                  {dashboard.doneStages}/{dashboard.totalStages} etapas
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>

      {/* Coluna direita: métricas (linha) + etapas (grade) */}
      <div className={cn("flex flex-col gap-6", fullscreen && "flex-1")}>
        <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4")}>
          <MetricCard value={deadlineLabel} label="MAGIC NUMBER" />
          <MetricCard value={String(dashboard.totalStages)} label="TOTAL" />
          <MetricCard value={String(dashboard.doneStages)} label="FEITOS" />
          <MetricCard value={String(dashboard.pendingStages)} label="PENDENTES" />
        </div>

        {/* 1ª linha (4): Planejamento, Captação, Edição, Design | 2ª linha (4): Alterações, PDF, Agendamento, Clientes 100% */}
        <div className={cn("grid gap-4 content-start", isMobile ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4", fullscreen && "flex-1 content-center")}>
          {stagesForDashboard.map((st) => {
            const item = dashboard.byStage[st.key];
            return (
              <div key={st.key} className="grid justify-items-center gap-3">
                <ProgressRing
                  value={item?.pct ?? 0}
                  tone={(item?.pct ?? 0) === 100 ? "success" : "warning"}
                  size={fullscreen ? 200 : isMobile ? 120 : 170}
                  stroke={isMobile ? 12 : 14}
                  className="animate-fade-in"
                  label={
                    <div className={cn("font-semibold tabular-nums", isMobile ? "text-2xl" : "text-3xl")}>
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
              size={fullscreen ? 200 : isMobile ? 120 : 170}
              stroke={isMobile ? 12 : 14}
              className="animate-fade-in"
              label={
                <div className={cn("font-semibold tabular-nums", isMobile ? "text-2xl" : "text-3xl")}>
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
