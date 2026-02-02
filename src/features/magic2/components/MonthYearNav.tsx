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
  onYearChange,
}: {
  month: number;
  year: number;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
}) {
  const now = new Date();
  const baseYear = now.getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => baseYear - 3 + i);
  const monthLabel = getMonthAbbrPtBr(year, month);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-2">
      <Select value={String(month)} onValueChange={(v) => onMonthChange(clampMonth(Number(v)))}>
        <SelectTrigger className="h-9 w-[120px]" aria-label="Mês">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent className="z-50 bg-popover">
          {months.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {getMonthNamePtBr(year, m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger className="h-9 w-[120px]">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent className="z-50 bg-popover">
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
