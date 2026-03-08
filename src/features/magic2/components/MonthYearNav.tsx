import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function clampMonth(m: number) {
  return Math.min(12, Math.max(1, m));
}

function getMonthAbbrPtBr(year: number, month: number) {
  // pt-BR costuma retornar "jan."; removemos pontuação e padronizamos em minúsculas.
  const raw = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(new Date(year, month - 1, 1));
  return raw.replace(/\./g, "").toLowerCase();
}

function getMonthNamePtBr(year: number, month: number) {
  const raw = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(year, month - 1, 1));
  // Ex.: "janeiro" -> "Janeiro"
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
  const monthLabel = getMonthAbbrPtBr(year, month);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => {
        if (month === 1) { onMonthChange(12); onYearChange(year - 1); }
        else onMonthChange(clampMonth(month - 1));
      }}>←</Button>

      <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
        <SelectTrigger className="w-28 h-9">
          <SelectValue>{getMonthNamePtBr(year, month)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m} value={String(m)}>{getMonthNamePtBr(year, m)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger className="w-20 h-9">
          <SelectValue>{year}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button variant="outline" size="sm" onClick={() => {
        if (month === 12) { onMonthChange(1); onYearChange(year + 1); }
        else onMonthChange(clampMonth(month + 1));
      }}>→</Button>
    </div>
  );
}

























}