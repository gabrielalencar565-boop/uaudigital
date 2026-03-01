import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import { MAGIC2_STAGES, type Magic2StageKey } from "@/features/magic2/magic2-stages";
import type { Magic2CycleRow, Magic2StageRow } from "@/features/magic2/hooks/use-magic2";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

type Props = {
  year: number;
  month: number;
  cycles: Magic2CycleRow[];
  stages: Magic2StageRow[];
  isBusy?: boolean;
  onToggleStage: (stageId: string, current: boolean) => void;
  onCreateStage?: (cycleId: string, stage: Magic2StageKey) => void;
};

export function Magic2Checklist({ year, month, cycles, stages, isBusy, onToggleStage, onCreateStage }: Props) {
  const isMobile = useIsMobile();
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const sortedCycles = useMemo(() => {
    const collator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });
    return [...(cycles ?? [])].sort((a, b) => {
      const an = a.magic2_clients?.name ?? "";
      const bn = b.magic2_clients?.name ?? "";
      return collator.compare(an, bn);
    });
  }, [cycles]);

  const byCycleStage = useMemo(() => {
    const map = new Map<string, Map<Magic2StageKey, { id: string; completed: boolean }>>();
    for (const s of stages ?? []) {
      const stageMap = map.get(s.cycle_id) ?? new Map();
      stageMap.set(s.stage, { id: s.id, completed: !!s.completed });
      map.set(s.cycle_id, stageMap);
    }
    return map;
  }, [stages]);

  const clientProgress = useMemo(() => {
    return sortedCycles.map((c) => {
      const stageMap = byCycleStage.get(c.id) ?? new Map();
      const total = MAGIC2_STAGES.length;
      const done = Array.from(stageMap.values()).filter((s) => s.completed).length;
      return { cycleId: c.id, name: c.magic2_clients?.name ?? "—", total, done, pct: Math.round((done / total) * 100) };
    });
  }, [byCycleStage, sortedCycles]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className={cn(isMobile ? "text-base" : "text-lg")}>Checklist</CardTitle>
        <CardDescription>Clique para marcar/desmarcar a etapa do cliente no mês.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isMobile ? (
          // Modo lista para mobile (versão ampla/reduzida)
          <div className="space-y-3">
            {sortedCycles.map((c) => {
              const stageMap = byCycleStage.get(c.id) ?? new Map();
              const progress = clientProgress.find((p) => p.cycleId === c.id);
              return (
                <div key={c.id} className={cn(
                  "space-y-3 rounded-lg border bg-card/10 p-4 transition-colors",
                  selectedCycleId === c.id ? "border-primary/60 bg-primary/5" : "border-border/60",
                )}>
                  <button
                    type="button"
                    onClick={() => setSelectedCycleId(selectedCycleId === c.id ? null : c.id)}
                    className="flex w-full items-center justify-between gap-3"
                  >
                    <p className="text-sm font-semibold text-left">{c.magic2_clients?.name ?? "—"}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={progress?.pct === 100 ? "success" : "secondary"} className="text-xs">
                        {progress?.done}/{progress?.total}
                      </Badge>
                      <ChevronRight className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        selectedCycleId === c.id && "rotate-90 text-primary",
                      )} />
                    </div>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    {MAGIC2_STAGES.map((st) => {
                      const cell = stageMap.get(st.key);
                      const completed = !!cell?.completed;
                      const handleClick = () => {
                        if (cell) {
                          onToggleStage(cell.id, completed);
                        } else if (onCreateStage) {
                          // Cria a stage on-demand e marca como concluído
                          onCreateStage(c.id, st.key);
                        }
                      };
                      return (
                        <button
                          key={st.key}
                          type="button"
                          onClick={handleClick}
                          disabled={isBusy}
                          className={cn(
                            "flex items-center gap-2 rounded-md border border-border/60 bg-card/20 px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                            "hover:bg-card/30",
                          )}
                        >
                          <Checkbox
                            checked={completed}
                            aria-hidden
                            className={cn(
                              "shrink-0",
                              completed
                                ? "border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                                : undefined,
                            )}
                          />
                          <span className="text-xs font-medium">{st.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Desktop: tabela horizontal (versão compacta original)
          <div className="overflow-auto">
          <table className="w-full table-fixed border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 w-[220px] bg-background px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                  Cliente
                </th>
                {MAGIC2_STAGES.map((st) => (
                  <th key={st.key} className="w-[120px] px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                    {st.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedCycles.map((c) => (
                <tr key={c.id} className={cn(
                  "border-t border-border/60 transition-colors",
                  selectedCycleId === c.id && "bg-primary/5",
                )}>
                  <td className={cn(
                    "sticky left-0 z-10 w-[220px] bg-background px-3 py-3 text-sm font-medium",
                    selectedCycleId === c.id && "bg-primary/5",
                  )}>
                    <button
                      type="button"
                      onClick={() => setSelectedCycleId(selectedCycleId === c.id ? null : c.id)}
                      className="flex w-full items-center gap-2 text-left group"
                    >
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:text-primary",
                        selectedCycleId === c.id && "rotate-90 text-primary",
                      )} />
                      <span className={cn(
                        selectedCycleId === c.id && "text-primary underline underline-offset-2",
                      )}>
                        {c.magic2_clients?.name ?? "—"}
                      </span>
                    </button>
                  </td>
                  {MAGIC2_STAGES.map((st) => {
                    const cell = byCycleStage.get(c.id)?.get(st.key);
                    const completed = !!cell?.completed;
                    const handleClick = () => {
                      if (cell) {
                        onToggleStage(cell.id, completed);
                      } else if (onCreateStage) {
                        // Cria a stage on-demand e marca como concluído
                        onCreateStage(c.id, st.key);
                      }
                    };
                    return (
                      <td key={st.key} className="px-3 py-2">
                        <button
                          type="button"
                          onClick={handleClick}
                          disabled={isBusy}
                          className={cn(
                            "flex w-full items-center justify-center rounded-md border px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-60",
                            selectedCycleId === c.id
                              ? "border-primary/40 bg-primary/10 hover:bg-primary/20"
                              : "border-border/60 bg-card/20 hover:bg-card/30",
                          )}
                          aria-label={`${c.magic2_clients?.name ?? "Cliente"} - ${st.label} - ${
                            completed ? "Concluído" : "Pendente"
                          }`}
                          title={completed ? "Concluído" : "Pendente"}
                        >
                          <Checkbox
                            checked={completed}
                            aria-hidden
                            className={cn(
                              completed
                                ? "border-success data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                                : undefined,
                            )}
                          />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
