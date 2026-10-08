import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Check } from "lucide-react";
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
  const [selectedStageIdx, setSelectedStageIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const selectCycle = useCallback((cycleId: string | null) => {
    setSelectedCycleId(cycleId);
    setSelectedStageIdx(-1);
  }, []);

  const toggleCurrentStage = useCallback(() => {
    if (!selectedCycleId || selectedStageIdx < 0 || selectedStageIdx >= MAGIC2_STAGES.length) return;
    const st = MAGIC2_STAGES[selectedStageIdx];
    const cell = byCycleStage.get(selectedCycleId)?.get(st.key);
    if (cell) {
      onToggleStage(cell.id, cell.completed);
    } else if (onCreateStage) {
      onCreateStage(selectedCycleId, st.key);
    }
  }, [selectedCycleId, selectedStageIdx, byCycleStage, onToggleStage, onCreateStage]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedCycleId) return;
      const cycleIdx = sortedCycles.findIndex((c) => c.id === selectedCycleId);
      if (cycleIdx === -1) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          setSelectedStageIdx((prev) => Math.min(prev + 1, MAGIC2_STAGES.length - 1));
          break;
        case "ArrowLeft":
          e.preventDefault();
          setSelectedStageIdx((prev) => Math.max(prev - 1, -1));
          break;
        case "ArrowDown":
          e.preventDefault();
          if (cycleIdx < sortedCycles.length - 1) setSelectedCycleId(sortedCycles[cycleIdx + 1].id);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (cycleIdx > 0) setSelectedCycleId(sortedCycles[cycleIdx - 1].id);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (!isBusy) toggleCurrentStage();
          break;
        case "Escape":
          e.preventDefault();
          setSelectedCycleId(null);
          setSelectedStageIdx(-1);
          break;
      }
    };

    el.addEventListener("keydown", handleKeyDown);
    return () => el.removeEventListener("keydown", handleKeyDown);
  }, [selectedCycleId, selectedStageIdx, sortedCycles, isBusy, toggleCurrentStage]);

  return (
    <Card>
      <CardHeader className={cn(isMobile && "px-4 pb-3")}>
        <CardTitle className={cn(isMobile ? "text-base" : "text-lg")}>Checklist</CardTitle>
        <CardDescription>{isMobile ? "Toque numa etapa para marcar ou desmarcar." : "Clique no cliente e use ← → para navegar entre etapas. Enter para marcar/desmarcar."}</CardDescription>
      </CardHeader>

      <CardContent className={cn("space-y-4", isMobile && "px-3 pb-3")}>
        <div ref={containerRef} tabIndex={0} className="outline-none">
        {isMobile ? (
          // One tap toggles a stage (no "select the client first" step); stages wrap as pills under the client's name.
          <div className="space-y-2.5">
            {sortedCycles.map((c) => {
              const stageMap = byCycleStage.get(c.id) ?? new Map();
              const progress = clientProgress.find((p) => p.cycleId === c.id);
              const complete = progress?.pct === 100;
              return (
                <div key={c.id} className="space-y-3 rounded-2xl border border-border/50 bg-card/20 p-3.5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold">{c.magic2_clients?.name ?? "—"}</p>
                      <span className={cn("shrink-0 text-xs font-semibold tabular-nums", complete ? "text-success" : "text-muted-foreground")}>
                        {progress?.done}/{progress?.total}
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", complete ? "bg-success" : "bg-primary")}
                        style={{ width: `${progress?.pct ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {MAGIC2_STAGES.map((st) => {
                      const cell = stageMap.get(st.key);
                      const completed = !!cell?.completed;
                      return (
                        <button
                          key={st.key}
                          type="button"
                          disabled={isBusy}
                          aria-pressed={completed}
                          onClick={() => {
                            if (cell) onToggleStage(cell.id, completed);
                            else if (onCreateStage) onCreateStage(c.id, st.key);
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60",
                            completed
                              ? "border-success/40 bg-success/15 text-success"
                              : "border-border/60 bg-transparent text-muted-foreground hover:bg-card/30",
                          )}
                        >
                          {completed ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="h-3 w-3 rounded-full border border-current opacity-50" />}
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
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
              {sortedCycles.map((c) => {
                const isSelected = selectedCycleId === c.id;
                return (
                <tr key={c.id} className={cn("border-t border-border/60 transition-colors", isSelected && "bg-primary/5")}>
                  <td className={cn("sticky left-0 z-10 w-[220px] bg-background px-3 py-3 text-sm font-medium", isSelected && "bg-primary/5")}>
                    <button
                      type="button"
                      onClick={() => selectCycle(isSelected ? null : c.id)}
                      className="flex w-full items-center gap-2 text-left group"
                    >
                      <span className={cn("transition-colors", isSelected && "text-primary underline underline-offset-2")}>
                        {c.magic2_clients?.name ?? "—"}
                      </span>
                    </button>
                  </td>
                  {MAGIC2_STAGES.map((st, stIdx) => {
                    const cell = byCycleStage.get(c.id)?.get(st.key);
                    const completed = !!cell?.completed;
                    const isFocused = isSelected && selectedStageIdx === stIdx;
                    const handleClick = () => {
                      if (!isSelected) {
                        selectCycle(c.id);
                        setSelectedStageIdx(stIdx);
                        return;
                      }
                      if (selectedStageIdx === stIdx) {
                        if (cell) onToggleStage(cell.id, completed);
                        else if (onCreateStage) onCreateStage(c.id, st.key);
                      } else {
                        setSelectedStageIdx(stIdx);
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
                            isFocused
                              ? "border-primary bg-primary/15 ring-2 ring-primary/30 scale-105"
                              : isSelected
                                ? "border-primary/40 bg-primary/10 hover:bg-primary/20"
                                : "border-border/60 bg-card/20 hover:bg-card/30",
                          )}
                          aria-label={`${c.magic2_clients?.name ?? "Cliente"} - ${st.label} - ${completed ? "Concluído" : "Pendente"}`}
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
              );
              })}
            </tbody>
          </table>
        </div>
        )}
        </div>
      </CardContent>
    </Card>
  );
}
