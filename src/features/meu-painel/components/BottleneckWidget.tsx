import { AlertOctagon, Zap } from "lucide-react";
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
  const topStageLabel = STAGES.find((s) => s.key === entries[0]?.[0])?.label ?? entries[0]?.[0] ?? "";

  return (
    <div
      className="rounded-2xl border border-border/40 p-5 space-y-4 transition-all duration-200 hover:shadow-lg"
      style={{
        background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card) / 0.85) 100%)",
        backdropFilter: "blur(12px)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertOctagon className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Onde você está travando</h3>
      </div>

      {/* Top bottleneck highlight */}
      <div
        className="rounded-xl p-3.5 border border-amber-500/25 flex items-center gap-3 transition-all duration-200 hover:scale-[1.01]"
        style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%)" }}
      >
        <div className="h-9 w-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-amber-500" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-400">
            Seu maior gargalo: {topStageLabel}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {maxCount} tarefa{maxCount > 1 ? "s" : ""} parada{maxCount > 1 ? "s" : ""} nessa etapa
          </p>
        </div>
      </div>

      {/* Stage bars */}
      <div className="space-y-3">
        {entries.slice(0, 5).map(([stage, count], i) => {
          const stageInfo = STAGES.find((s) => s.key === stage);
          const label = stageInfo?.label ?? stage;
          const pct = Math.round((count / maxCount) * 100);
          const isTop = i === 0;

          return (
            <div
              key={stage}
              className="space-y-1.5 opacity-0 transition-transform duration-200 hover:scale-[1.02]"
              style={{ animation: `fadeUp 0.4s ease-out forwards`, animationDelay: `${i * 0.06}s` }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className={cn("font-medium", isTop ? "text-amber-400" : "text-foreground/70")}>{label}</span>
                <span className={cn("tabular-nums font-bold", isTop ? "text-amber-400" : "text-foreground/60")}>
                  {count} tarefa{count > 1 ? "s" : ""}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    background: isTop
                      ? "linear-gradient(90deg, hsl(35 92% 50%), hsl(0 84% 60%))"
                      : "linear-gradient(90deg, hsl(var(--sidebar) / 0.5), hsl(var(--sidebar) / 0.3))",
                    boxShadow: isTop ? "0 0 8px rgba(245,158,11,0.3)" : "none",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
