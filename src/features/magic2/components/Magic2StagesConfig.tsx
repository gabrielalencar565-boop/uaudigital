import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useAppSettings, useUpdateAppSettings } from "@/features/data/queries";
import { ALL_MAGIC2_STAGES, cacheDisabledMagic2Stages } from "@/features/magic2/magic2-stages";

/** Só para admin: liga/desliga quais etapas contam no Magic Number (checklist, painel, metas e análise mensal). Nada é apagado. */
export function Magic2StagesConfig() {
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
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
          <Settings2 className="h-3.5 w-3.5" /> Etapas{disabled.length > 0 ? ` (${disabled.length} desligada${disabled.length > 1 ? "s" : ""})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-1 p-3">
        <p className="text-sm font-medium">Etapas que contam no Magic Number</p>
        <div className="space-y-0.5 pt-1">
          {ALL_MAGIC2_STAGES.map((st) => {
            const on = !disabled.includes(st.key);
            return (
              <label key={st.key} className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/50">
                {st.label}
                <Switch checked={on} disabled={update.isPending} onCheckedChange={(v) => toggle(st.key, v)} />
              </label>
            );
          })}
        </div>
        <p className="px-2 pt-1 text-[11px] leading-snug text-muted-foreground">
          Etapa desligada deixa de contar no checklist, painel, metas e análise mensal, inclusive nos meses passados. Nada é apagado: ao ligar de novo, o histórico dela volta.
        </p>
      </PopoverContent>
    </Popover>
  );
}
