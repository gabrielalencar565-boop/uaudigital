import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";

interface FinMetricCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  variation?: number | null;
  /** Show variation as absolute number instead of percentage */
  variationAbsolute?: boolean;
  variationLabel?: string;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "danger" | "warning" | "muted";
  className?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

const toneClasses: Record<string, string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
  muted: "text-muted-foreground",
};

export function FinMetricCard({
  title, value, prefix = "R$", suffix, decimals = 2,
  variation, variationAbsolute, variationLabel = "vs mês anterior",
  icon, tone = "default", className, onClick, children,
}: FinMetricCardProps) {
  const isPositiveVar = variation != null && variation > 0;
  const isNegativeVar = variation != null && variation < 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group",
        onClick && "cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          {icon && (
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
              {icon}
            </div>
          )}
        </div>

        <div className={cn("text-2xl font-bold tracking-tight", toneClasses[tone])}>
          {prefix && <span className="text-lg font-semibold mr-1">{prefix}</span>}
          <AnimatedNumber value={value} decimals={decimals} className={cn("text-2xl font-bold", toneClasses[tone])} glow={false} />
          {suffix && <span className="text-lg font-semibold ml-0.5">{suffix}</span>}
        </div>

        {variation != null && (
          <div className="flex items-center gap-1.5 mt-2">
            {isPositiveVar ? (
              <div className="flex items-center gap-1 text-success bg-success/10 px-1.5 py-0.5 rounded-md">
                <TrendingUp className="h-3 w-3" />
                <span className="text-xs font-semibold">+{variationAbsolute ? Math.round(variation!) : variation!.toFixed(1) + "%"}</span>
              </div>
            ) : isNegativeVar ? (
              <div className="flex items-center gap-1 text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-md">
                <TrendingDown className="h-3 w-3" />
                <span className="text-xs font-semibold">{variationAbsolute ? Math.round(variation!) : variation!.toFixed(1) + "%"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
                <Minus className="h-3 w-3" />
                <span className="text-xs font-semibold">0</span>
              </div>
            )}
            <span className="text-[10px] text-muted-foreground">{variationLabel}</span>
          </div>
        )}

        {children}
      </CardContent>
    </Card>
  );
}

// Simple large metric card (no variation)
export function FinMetricCardSimple({
  title, value, prefix = "R$", decimals = 2, tone = "default", icon, className, suffix,
}: Pick<FinMetricCardProps, "title" | "value" | "prefix" | "decimals" | "tone" | "icon" | "className" | "suffix">) {
  return (
    <Card className={cn("transition-all duration-200 hover:shadow-md hover:-translate-y-0.5", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
          {icon && <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">{icon}</div>}
        </div>
        <div className={cn("text-2xl font-bold tracking-tight", toneClasses[tone])}>
          {prefix && <span className="text-lg font-semibold mr-1">{prefix}</span>}
          <AnimatedNumber value={value} decimals={decimals} className={cn("text-2xl font-bold", toneClasses[tone])} glow={false} />
          {suffix && <span className="text-lg font-semibold ml-0.5">{suffix}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
