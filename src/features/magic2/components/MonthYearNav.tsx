import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function clampMonth(m: number) {
  return Math.min(12, Math.max(1, m));
}

function getMonthNamePtBr(year: number, month: number) {
  const raw = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(year, month - 1, 1));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function MonthYearNav({
  month,
  year,
  onMonthChange,
  onYearChange





}: {month: number;year: number;onMonthChange: (m: number) => void;onYearChange: (y: number) => void;}) {
  const now = new Date();
  const baseYear = now.getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => baseYear - 3 + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
        if (month === 1) { onMonthChange(12); onYearChange(year - 1); }
        else onMonthChange(clampMonth(month - 1));
      }}>
        ‹
      </Button>

      <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
        <SelectTrigger className="w-[120px] h-8 text-sm">
          <SelectValue>{getMonthNamePtBr(year, month)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={String(m)}>{getMonthNamePtBr(year, m)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger className="w-[80px] h-8 text-sm">
          <SelectValue>{year}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
        if (month === 12) { onMonthChange(1); onYearChange(year + 1); }
        else onMonthChange(clampMonth(month + 1));
      }}>
        ›
      </Button>
    </div>
  );
}
}