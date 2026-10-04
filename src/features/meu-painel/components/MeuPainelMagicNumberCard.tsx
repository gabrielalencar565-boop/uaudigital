import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useMagic2Dashboard } from "@/features/magic2/hooks/use-magic2-dashboard";
import { getCycleMonthYear } from "@/features/magic2/Magic2Panel";
import { useMagicNumberConfig } from "@/features/data/queries";

// Visão geral do Magic Number (empresa toda, não é por usuário) encaixada
// no banner do Meu Painel — sempre mostra o ciclo atual (vira pro próximo mês após o dia D).
export function MeuPainelMagicNumberCard() {
  const { day: magicDay } = useMagicNumberConfig();
  const cycleMY = getCycleMonthYear(new Date(), magicDay);
  const { dashboard } = useMagic2Dashboard(cycleMY.year, cycleMY.month);

  return (
    <div className="flex w-full items-center justify-center">
      <ProgressRing
        value={dashboard.overallPct}
        size={108}
        stroke={9}

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
