import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Clock } from "lucide-react";
import { MAGIC2_STAGES, type Magic2StageKey } from "@/features/magic2/magic2-stages";
import type { Magic2CycleRow } from "@/features/magic2/hooks/use-magic2";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  cycles: Magic2CycleRow[];
  scheduledByClient: Map<string, Set<Magic2StageKey>>;
  isLoading?: boolean;
};

export function Magic2Fluxo({ cycles, scheduledByClient, isLoading }: Props) {
  const isMobile = useIsMobile();

  const sortedCycles = useMemo(() => {
    const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
    return [...(cycles ?? [])].sort((a, b) => {
      const an = a.magic2_clients?.name ?? "";
      const bn = b.magic2_clients?.name ?? "";
      return collator.compare(an, bn);
    });
  }, [cycles]);

  const totalStages = MAGIC2_STAGES.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn(isMobile ? "text-base" : "text-lg")}>Fluxo de agendamento</CardTitle>
        <CardDescription>
          Verde: etapa com tarefa já agendada no mês. Cinza: ainda sem data. Atualiza automaticamente.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading && sortedCycles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : sortedCycles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente ativo neste mês.</p>
        ) : (
          <div className="space-y-3">
            {sortedCycles.map((c) => {
              const scheduled = scheduledByClient.get(c.client_id) ?? new Set<Magic2StageKey>();
              const done = MAGIC2_STAGES.reduce(
                (acc, st) => acc + (scheduled.has(st.key) ? 1 : 0),
                0,
              );
              const pct = Math.round((done / totalStages) * 100);
              const complete = done === totalStages;

              return (
                <div key={c.id} className="rounded-lg border border-border/60 bg-card/10 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-sm font-semibold truncate">
                      {c.magic2_clients?.name ?? "—"}
                    </p>
                    <Badge
                      variant={complete ? "success" : done > 0 ? "secondary" : "outline"}
                      className="shrink-0 text-xs"
                    >
                      {done}/{totalStages} etapas agendadas · {pct}%
                    </Badge>
                  </div>

                  <div
                    className={cn(
                      "grid gap-2",
                      isMobile ? "grid-cols-2" : "grid-cols-4 lg:grid-cols-7",
                    )}
                  >
                    {MAGIC2_STAGES.map((st) => {
                      const on = scheduled.has(st.key);
                      return (
                        <div
                          key={st.key}
                          className={cn(
                            "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium transition",
                            on
                              ? "border-success bg-success text-white"
                              : "border-border/60 bg-muted/20 text-muted-foreground",
                          )}
                          title={on ? "Etapa agendada" : "Etapa sem data agendada"}
                        >
                          {on ? (
                            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          ) : (
                            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          )}
                          <span className="truncate">{st.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
