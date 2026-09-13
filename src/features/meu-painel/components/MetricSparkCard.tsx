import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Tone = "violet" | "emerald" | "amber" | "red";

const TONE_STYLES: Record<Tone, { glow: string; chip: string; icon: string }> = {
  violet: {
    glow: "radial-gradient(120% 120% at 15% 0%, rgba(99,102,241,1) 0%, transparent 65%)",
    chip: "bg-indigo-500/10 dark:bg-indigo-400/15",
    icon: "text-indigo-600 dark:text-indigo-300",
  },
  emerald: {
    glow: "radial-gradient(120% 120% at 15% 0%, rgba(16,185,129,1) 0%, transparent 65%)",
    chip: "bg-emerald-500/10 dark:bg-emerald-400/15",
    icon: "text-emerald-600 dark:text-emerald-300",
  },
  amber: {
    glow: "radial-gradient(120% 120% at 15% 0%, rgba(245,158,11,1) 0%, transparent 65%)",
    chip: "bg-amber-500/10 dark:bg-amber-400/15",
    icon: "text-amber-600 dark:text-amber-300",
  },
  red: {
    glow: "radial-gradient(120% 120% at 15% 0%, rgba(239,68,68,1) 0%, transparent 65%)",
    chip: "bg-red-500/10 dark:bg-red-400/15",
    icon: "text-red-600 dark:text-red-300",
  },
};

interface Props {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: Tone;
  description?: string;
}

export function MetricSparkCard({ label, value, icon, tone = "violet", description }: Props) {
  const t = TONE_STYLES[tone];

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated">
      {/* Subtle per-category tint, low opacity so it blends with the card in both themes instead of overpowering it */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] dark:opacity-[0.16]" style={{ background: t.glow }} />

      {description && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="absolute right-3 top-3 text-muted-foreground/40 hover:text-muted-foreground transition-colors" aria-label={`Sobre ${label}`}>
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
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
          <AnimatedNumber value={value} className="text-2xl font-bold tabular-nums tracking-tight text-foreground mt-0.5" />
        </div>
      </div>
    </div>
  );
}
