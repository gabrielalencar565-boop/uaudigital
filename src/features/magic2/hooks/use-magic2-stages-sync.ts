import { useEffect } from "react";
import { useAppSettings } from "@/features/data/queries";
import { applyDisabledMagic2Stages, cacheDisabledMagic2Stages } from "@/features/magic2/magic2-stages";

const RELOAD_FLAG = "magic2-stages-reloaded-at";

/**
 * Mantém a lista de etapas do Magic Number (MAGIC2_STAGES) igual à configuração da agência. Se a configuração mudou desde a cópia guardada
 * no navegador (alguém ligou/desligou uma etapa), a página recarrega uma vez para todas as telas e cálculos usarem a lista nova.
 */
export function useMagic2StagesSync() {
  const q = useAppSettings();
  const disabled = q.data?.magic_number_disabled_stages;
  useEffect(() => {
    if (!disabled) return;
    cacheDisabledMagic2Stages(disabled);
    if (!applyDisabledMagic2Stages(disabled)) return;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
      if (Date.now() - last < 15_000) return; // evita laço de recarga
      sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
    } catch { /* segue e recarrega */ }
    window.location.reload();
  }, [disabled]);
}
