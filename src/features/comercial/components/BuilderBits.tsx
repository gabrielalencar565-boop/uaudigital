import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Rótulo + campo, no estilo compacto dos editores de automação e formulário. */
export function Lab({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const inputCls = "w-full rounded-[10px] border border-border/50 bg-muted/30 px-3 py-2 text-sm outline-none focus:border-ring/60 focus:ring-2 focus:ring-ring/40 disabled:opacity-50";

export function Sel({ options, className, ...rest }: { options: Array<[string, string]> } & Omit<SelectHTMLAttributes<HTMLSelectElement>, "children">) {
  return (
    <select {...rest} className={cn(inputCls, "pr-8", className)}>
      {options.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
    </select>
  );
}

export function StatusSwitch({ on, onLabel, offLabel, onClick, disabled }: { on: boolean; onLabel: string; offLabel: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn("inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50", on ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : "border-border text-muted-foreground hover:text-foreground")}
    >
      <i className={cn("relative h-3.5 w-6 rounded-full transition", on ? "bg-emerald-500" : "bg-muted-foreground/30")}>
        <b className={cn("absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all", on ? "left-3" : "left-0.5")} />
      </i>
      {on ? onLabel : offLabel}
    </button>
  );
}

export const fmtDateTime = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
};
