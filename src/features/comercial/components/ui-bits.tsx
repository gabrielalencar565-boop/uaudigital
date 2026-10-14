import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { diffDays, initials, shortDate, type Activity, type DueStatus } from "../lib/rules";
import type { TeamMember } from "../hooks/use-comercial";

/** "atrasado 2d · follow-up", "hoje · reunião", "16/10 · ligação" ou "sem próxima ação". */
export function DueBadge({ status, next, today, className }: { status: DueStatus | null; next?: Activity; today: string; className?: string }) {
  if (!status) return null;
  if (status === "none" || !next) {
    return <span className={cn("inline-flex w-fit items-center rounded-md border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground", className)}>sem próxima ação</span>;
  }
  const d = diffDays(next.due_date, today);
  const label = status === "late" ? `atrasado ${-d}d` : status === "today" ? "hoje" : shortDate(next.due_date);
  const tone =
    status === "late" ? "bg-red-500/10 text-red-500" : status === "today" ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500";
  return (
    <span className={cn("inline-flex w-fit items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium", tone, className)}>
      {label} · {next.type.toLowerCase()}
    </span>
  );
}

export function OwnerAvatar({ member, size = "h-6 w-6" }: { member?: TeamMember | null; size?: string }) {
  const name = member?.display_name ?? "Sem responsável";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Avatar className={cn(size, "shrink-0")}>
          <AvatarImage src={member?.avatar_url ?? undefined} alt={name} />
          <AvatarFallback className="bg-primary/15 text-[9px] font-semibold text-primary">{member ? initials(name) : "–"}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}

export function PageHead({ title, right, subtitle }: { title: string; right?: ReactNode; subtitle?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function Panel({ title, children, className, right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-border/50 bg-card p-4", className)}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="text-sm font-semibold">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "late" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border/50 bg-card p-4">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("truncate text-2xl font-semibold tabular-nums", tone === "late" && "text-red-500")}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-xs text-muted-foreground">{children}</div>;
}

/** Barra horizontal proporcional (funil agora, origem dos leads). */
export function BarRow({ label, value, max, text, title }: { label: string; value: number; max: number; text: string; title?: string }) {
  return (
    <div className="grid grid-cols-[minmax(80px,140px)_1fr_auto] items-center gap-3 text-xs" title={title}>
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-muted">
        <i className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%` }} />
      </span>
      <span className="tabular-nums text-foreground/80">{text}</span>
    </div>
  );
}
