import { CalendarCheck, AlertTriangle, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";

interface Props {
  todayCount: number;
  overdueCount: number;
  upcomingCount: number;
}

export function DayQuickView({ todayCount, overdueCount, upcomingCount }: Props) {
  const items = [
    {
      label: "Hoje",
      count: todayCount,
      icon: CalendarCheck,
      color: todayCount === 0 ? "text-emerald-500" : "text-sidebar",
      bg: todayCount === 0 ? "bg-emerald-500/10" : "bg-sidebar/10",
      border: todayCount === 0 ? "border-emerald-500/20" : "border-sidebar/20",
    },
    {
      label: "Atrasadas",
      count: overdueCount,
      icon: AlertTriangle,
      color: overdueCount > 0 ? "text-red-500" : "text-muted-foreground",
      bg: overdueCount > 0 ? "bg-red-500/10" : "bg-muted/30",
      border: overdueCount > 0 ? "border-red-500/20" : "border-border/40",
    },
    {
      label: "Próximas",
      count: upcomingCount,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-0.5",
            item.border,
          )}
          style={{ background: "hsl(var(--card))", backdropFilter: "blur(12px)" }}
        >
          <div className={cn("absolute inset-0 opacity-30", item.bg)} />
          <div className="relative flex items-center gap-3">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
              <item.icon className={cn("h-4 w-4", item.color)} />
            </div>
            <div>
              <AnimatedNumber value={item.count} className={cn("text-2xl font-bold tabular-nums", item.color)} />
              <p className="text-[11px] text-muted-foreground font-medium">{item.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
