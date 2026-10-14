import type { LucideIcon } from "lucide-react";
import { PageHead } from "../components/ui-bits";

export function EmBreve({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: string }) {
  return (
    <div className="space-y-4">
      <PageHead title={title} />
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="h-6 w-6" /></span>
        <h3 className="text-base font-semibold">{title} — em breve</h3>
        <p className="max-w-md text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
