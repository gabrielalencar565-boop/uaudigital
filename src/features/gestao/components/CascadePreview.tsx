import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { computePlan, orderSteps, type CascadePlan, type CascadeStep } from "../lib/cascade";

// Timeline of a cascade: each step with its date. Either computed from a start date (preview while creating) or
// shown from an existing plan (`plan`), optionally marking the steps already done and how much each slipped.
export function CascadePreview({ steps, startDate, businessDays = true, plan, originalPlan, doneKeys, className }: {
  steps: CascadeStep[]; startDate?: string; businessDays?: boolean; plan?: CascadePlan; originalPlan?: CascadePlan; doneKeys?: Set<string>; className?: string;
}) {
  const shown = useMemo(() => plan ?? (startDate ? computePlan(steps, startDate, businessDays) : {}), [plan, startDate, steps, businessDays]);
  const rows = useMemo(
    () => orderSteps(steps).map((s) => ({ ...s, date: shown[s.key] })).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    [steps, shown],
  );
  if (rows.length === 0) return null;
  const label = (iso: string) => format(parseISO(iso), "EEE, dd/MM", { locale: ptBR });

  return (
    <ol className={cn("space-y-0.5", className)}>
      {rows.map((r, i) => {
        const done = doneKeys?.has(r.key);
        const slipped = originalPlan?.[r.key] && r.date && r.date > originalPlan[r.key];
        return (
          <li key={r.key} className="flex items-center gap-2.5 text-xs">
            <span className="relative flex w-3.5 shrink-0 justify-center self-stretch">
              <span className={cn("z-10 mt-1.5 h-2 w-2 rounded-full", done ? "bg-emerald-500" : "bg-muted-foreground/40")} />
              {i < rows.length - 1 && <span className="absolute bottom-[-2px] top-3.5 w-px bg-border" />}
            </span>
            <span className={cn("min-w-0 flex-1 truncate py-0.5", done ? "text-muted-foreground line-through" : "text-foreground/90")}>{r.label}</span>
            {r.date && (
              <span className={cn("shrink-0 tabular-nums", slipped ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                {label(r.date)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
