import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface Props {
  label: string;
  value: number;
  prevValue?: number;
  icon: React.ReactNode;
  accentClass?: string;
  sparkData?: number[];
}

export function MetricSparkCard({ label, value, prevValue, icon, accentClass = "text-sidebar", sparkData }: Props) {
  const variation = useMemo(() => {
    if (prevValue === undefined || prevValue === 0) return null;
    const pct = Math.round(((value - prevValue) / prevValue) * 100);
    return { pct: Math.abs(pct), up: pct >= 0 };
  }, [value, prevValue]);

  // Build sparkline SVG path
  const sparkPath = useMemo(() => {
    if (!sparkData || sparkData.length < 2) return null;
    const max = Math.max(...sparkData, 1);
    const w = 80;
    const h = 28;
    const step = w / (sparkData.length - 1);
    const points = sparkData.map((v, i) => `${i * step},${h - (v / max) * h}`);
    return `M${points.join(" L")}`;
  }, [sparkData]);

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5"
      style={{ background: "hsl(var(--card))", backdropFilter: "blur(12px)" }}
    >
      {/* Sparkline background */}
      {sparkPath && (
        <svg
          viewBox="0 0 80 28"
          className="absolute bottom-2 right-3 w-20 h-7 opacity-20"
          preserveAspectRatio="none"
        >
          <path d={sparkPath} fill="none" stroke="currentColor" strokeWidth="1.5" className={accentClass} />
        </svg>
      )}

      <div className="relative flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-sidebar/10")}>
          <span className={accentClass}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <AnimatedNumber value={value} className="text-2xl font-bold tabular-nums tracking-tight" />
            {variation && (
              <span
                className={cn("flex items-center gap-0.5 text-[10px] font-semibold tabular-nums cursor-default", variation.up ? "text-emerald-500" : "text-red-500")}
                title={`${variation.up ? "Aumento" : "Queda"} de ${variation.pct}% em relação ao mês anterior`}
              >
                {variation.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {variation.up ? "+" : "-"}{variation.pct}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
