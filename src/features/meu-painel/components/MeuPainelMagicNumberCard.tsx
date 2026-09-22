import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useMagic2Dashboard } from "@/features/magic2/hooks/use-magic2-dashboard";

// Visão geral do Magic Number (empresa toda, não é por usuário) encaixada
// no banner do Meu Painel — sempre mostra o mês atual.
export function MeuPainelMagicNumberCard() {
  const now = new Date();
  const { dashboard } = useMagic2Dashboard(now.getFullYear(), now.getMonth() + 1);

  return (
    <div className="flex w-full items-center justify-center">
      <ProgressRing
        value={dashboard.overallPct}
        size={108}
        stroke={9}
        tone={dashboard.overallPct === 100 ? "success" : "warning"}
        trackColor="rgba(255,255,255,0.2)"
        label={
          <div className="text-center">
            <div className="text-3xl font-bold leading-none text-white">{dashboard.overallPct}%</div>
            <div className="mt-1 text-[9px] leading-tight text-white/60">{dashboard.doneStages}/{dashboard.totalStages} etapas</div>
          </div>
        }
      />
    </div>
  );
}
