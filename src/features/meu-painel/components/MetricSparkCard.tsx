import { useMemo } from "react";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Tone = "violet" | "emerald" | "amber" | "red";

const TONE_STYLES: Record<Tone, { glow: string; chip: string; icon: string; ring: string; spark: string }> = {
  violet: {
    glow: "radial-gradient(130% 130% at 12% -10%, rgba(99,102,241,0.45) 0%, transparent 60%), linear-gradient(155deg, #17141f 0%, #0b0b0f 100%)",
    chip: "bg-indigo-400/15",
    icon: "text-indigo-300",
    ring: "shadow-[inset_0_0_0_1px_rgba(129,140,248,0.16)]",
    spark: "text-indigo-300/70",
  },
  emerald: {
    glow: "radial-gradient(130% 130% at 12% -10%, rgba(52,211,153,0.4) 0%, transparent 60%), linear-gradient(155deg, #131c16 0%, #0b0f0c 100%)",
    chip: "bg-emerald-400/15",
    icon: "text-emerald-300",
    ring: "shadow-[inset_0_0_0_1px_rgba(52,211,153,0.16)]",
    spark: "text-emerald-300/70",
  },
  amber: {
    glow: "radial-gradient(130% 130% at 12% -10%, rgba(251,191,36,0.4) 0%, transparent 60%), linear-gradient(155deg, #1c1710 0%, #0f0c08 100%)",
    chip: "bg-amber-400/15",
    icon: "text-amber-300",
    ring: "shadow-[inset_0_0_0_1px_rgba(251,191,36,0.16)]",
    spark: "text-amber-300/70",
  },
  red: {
    glow: "radial-gradient(130% 130% at 12% -10%, rgba(248,113,113,0.42) 0%, transparent 60%), linear-gradient(155deg, #1e1213 0%, #0f0a0a 100%)",
    chip: "bg-red-400/15",
    icon: "text-red-300",
    ring: "shadow-[inset_0_0_0_1px_rgba(248,113,113,0.18)]",
    spark: "text-red-300/70",
  },
};

interface Props {
  label: string;
  value: number;
  prevValue?: number;
  icon: React.ReactNode;
  tone?: Tone;
  description?: string;
  sparkData?: number[];
}

export function MetricSparkCard({ label, value, prevValue, icon, tone = "violet", description, sparkData }: Props) {
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

  const t = TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated",
        t.ring,
      )}
      style={{ background: t.glow }}
    >
      {/* Sparkline background */}
      {sparkPath && (
        <svg
          viewBox="0 0 80 28"
          className={cn("absolute bottom-2 right-3 w-20 h-7 opacity-40", t.spark)}
          preserveAspectRatio="none"
        >
          <path d={sparkPath} fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}

      {description && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="absolute right-3 top-3 text-white/30 hover:text-white/60 transition-colors" aria-label={`Sobre ${label}`}>
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs z-[9999] max-w-[220px] whitespace-normal">
              {description}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      <div className="relative flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", t.chip)}>
          <span className={t.icon}>{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-white/50 font-medium uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2 mt-0.5">
            <AnimatedNumber value={value} className="text-2xl font-bold tabular-nums tracking-tight text-white" />
            {variation && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("flex items-center gap-0.5 text-[10px] font-semibold tabular-nums cursor-default", variation.up ? "text-emerald-400" : "text-red-400")}>
                      {variation.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {variation.up ? "+" : "-"}{variation.pct}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs z-[9999] max-w-[220px] whitespace-normal">
                    {variation.up ? "Aumento" : "Queda"} de {variation.pct}% em relação ao mês anterior
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
