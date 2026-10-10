import { useState, type ComponentType, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Same block as the sections of Configurações → Agência: icon tile, title, small badge, chevron. Open or minimized is
// remembered on this browser; the content stays mounted while minimized, so edits in progress survive.
export function FluxoSection({
  id, icon: Icon, title, badge, description, defaultOpen = true, summary, children,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  badge?: string;
  description?: string;
  defaultOpen?: boolean;
  /** Shown under the title while the section is minimized. */
  summary?: ReactNode;
  children: ReactNode;
}) {
  const storageKey = `fluxo-section-${id}`;
  const [open, setOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved === null ? defaultOpen : saved === "1";
    } catch {
      return defaultOpen;
    }
  });
  const change = (next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch { /* preference only */ }
  };
  return (
    <Collapsible open={open} onOpenChange={change} className="overflow-hidden rounded-2xl border border-border/40 bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 text-sm font-semibold">{title}</span>
        {badge && <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{badge}</span>}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      {!open && summary && <div className="border-t border-border/30 px-5 py-4">{summary}</div>}
      <CollapsibleContent forceMount className="space-y-5 border-t border-border/30 px-5 py-5 data-[state=closed]:hidden">
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
