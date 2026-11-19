import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import { ALL_MAGIC2_STAGES, cacheDisabledMagic2Stages } from "@/features/magic2/magic2-stages";

/** Liga/desliga quais etapas contam no Magic Number (checklist, painel, metas e análise mensal). Nada é apagado. Fica em Ajustes da agência. */
export function Magic2StagesConfig({ label = "Magic Number" }: { label?: string }) {
  const settingsQ = useAppSettings();
  const update = useUpdateAppSettings();
  const disabled = settingsQ.data?.magic_number_disabled_stages ?? [];

  const toggle = (key: string, nextOn: boolean) => {
    const next = nextOn ? disabled.filter((k) => k !== key) : [...disabled, key];
    if (ALL_MAGIC2_STAGES.length - next.length < 1) { toast.error("Pelo menos uma etapa precisa continuar ligada."); return; }
    update.mutate({ magic_number_disabled_stages: next }, {
      onSuccess: () => {
        cacheDisabledMagic2Stages(next);
        toast.success(nextOn ? "Etapa ligada — recarregando…" : "Etapa desligada — recarregando…");
        window.setTimeout(() => window.location.reload(), 600);
      },
      onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
    });
  };

  return (
    <div className="max-w-md space-y-2">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Etapas que contam no {label}</label>
      <div className="divide-y divide-border/50 rounded-xl border border-border/60">
        {ALL_MAGIC2_STAGES.map((st) => (
          <label key={st.key} className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
            {st.label}
            <Switch checked={!disabled.includes(st.key)} disabled={update.isPending || settingsQ.isLoading} onCheckedChange={(v) => toggle(st.key, v)} />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Etapa desligada deixa de contar no checklist, painel, metas e análise mensal, inclusive nos meses passados. Nada é apagado: ao ligar de novo, o histórico dela volta. A página recarrega ao salvar.
      </p>
    </div>
  );
}
