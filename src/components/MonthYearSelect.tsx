import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Seletor de mês + ano no estilo da Agenda (dois selects arredondados), para o mês ficar igual em todas as abas. */
export function MonthYearSelect({ value, onChange, className }: { value: Date; onChange: (next: Date) => void; className?: string }) {
  const thisYear = new Date().getFullYear();
  const years = Array.from(new Set([thisYear - 1, thisYear, thisYear + 1, thisYear + 2, value.getFullYear()])).sort((a, b) => a - b);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={String(value.getMonth())} onValueChange={(v) => onChange(new Date(value.getFullYear(), Number(v), 1))}>
        <SelectTrigger aria-label="Mês" className="h-9 w-[120px] rounded-full border-border/30 bg-background/60 text-sm font-medium capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-50 bg-popover">
          {Array.from({ length: 12 }, (_, i) => (
            <SelectItem key={i} value={String(i)} className="capitalize">{format(new Date(2024, i, 1), "MMMM", { locale: ptBR })}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(value.getFullYear())} onValueChange={(v) => onChange(new Date(Number(v), value.getMonth(), 1))}>
        <SelectTrigger aria-label="Ano" className="h-9 w-[90px] rounded-full border-border/30 bg-background/60 text-sm font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-50 bg-popover">
          {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
