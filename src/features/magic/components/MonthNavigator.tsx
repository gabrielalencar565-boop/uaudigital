import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MonthNavigator({
  month,
  onMonthChange,
}: {
  month: number;
  onMonthChange: (month: number) => void;
}) {
  const goPrevMonth = () => onMonthChange(Math.max(1, month - 1));
  const goNextMonth = () => onMonthChange(Math.min(12, month + 1));

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Mês selecionado</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={goPrevMonth}
        disabled={month <= 1}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <select
        className="h-9 rounded-md border border-border bg-background px-3 text-sm"
        value={month}
        onChange={(e) => onMonthChange(Number(e.target.value))}
        aria-label="Selecionar mês"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={goNextMonth}
        disabled={month >= 12}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
