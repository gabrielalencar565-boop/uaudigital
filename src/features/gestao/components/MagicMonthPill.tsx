import { Flag } from "lucide-react";

/** Selo do mês em que o Magic Number e a pontuação contam (o que vem em destaque ao criar a tarefa). */
export function MagicMonthPill({ label, month, custom }: { label: string; month: string; custom?: boolean }) {
  return (
    <div className="space-y-0.5">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground">
        <Flag className="h-3.5 w-3.5" />
        {label}: {month}
      </span>
      <p className="text-xs text-muted-foreground">{custom ? "Mês escolhido à mão." : "Conta no mês do prazo."}</p>
    </div>
  );
}
