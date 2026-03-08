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
    <div className="flex items-center gap-1.5">
      <Select value={String(month)} onValueChange={(v) => onMonthChange(clampMonth(Number(v)))}>
        <SelectTrigger className="h-8 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {getMonthNamePtBr(year, m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger className="h-8 w-[80px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}



































}