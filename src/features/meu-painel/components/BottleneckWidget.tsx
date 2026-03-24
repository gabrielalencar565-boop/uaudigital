import { AlertOctagon } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/uau";

interface Props {
  pendingByStage: Record<string, number>;
}

export function BottleneckWidget({ pendingByStage }: Props) {
  const entries = Object.entries(pendingByStage)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  const maxCount = entries[0]?.[1] ?? 1;

  return (
    <div
      className="rounded-2xl border border-border/40 p-5 space-y-4"
      style={{ background: "hsl(var(--card))", backdropFilter: "blur(12px)" }}
    >
      <div className="flex items-center gap-2">
        <AlertOctagon className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Onde você está travando</h3>
      </div>

      <div className="space-y-3">
        {entries.slice(0, 5).map(([stage, count], i) => {
          const stageInfo = STAGES.find((s) => s.key === stage);
          const label = stageInfo?.label ?? stage;
          const pct = Math.round((count / maxCount) * 100);
          const isTop = i === 0;

          return (
            <div key={stage} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className={cn("font-medium", isTop ? "text-amber-500" : "text-muted-foreground")}>{label}</span>
                <span className={cn("tabular-nums font-semibold", isTop ? "text-amber-500" : "text-foreground/70")}>
                  {count}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    isTop ? "bg-amber-500" : "bg-sidebar/50",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
