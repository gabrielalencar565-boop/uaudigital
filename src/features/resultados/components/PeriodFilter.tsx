import { useState } from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import type { DateRange as DayRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PRESET_PERIODS, resolveRange, type PeriodSelection } from "../lib/report-metrics";

const toKey = (d: Date) => format(d, "yyyy-MM-dd");
const fromKey = (key: string) => parse(key, "yyyy-MM-dd", new Date());

// One compact control for the whole report period: a button showing the current window that opens
// the presets (7/15/30/60/90 days) plus "Personalizado" with a date-range picker.
export function PeriodFilter({ value, onChange }: { value: PeriodSelection; onChange: (next: PeriodSelection) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(value.kind === "custom");
  const current = resolveRange(value);
  const [draft, setDraft] = useState<DayRange | undefined>(() =>
    value.kind === "custom" ? { from: fromKey(value.from), to: fromKey(value.to) } : undefined,
  );

  const pick = (days: (typeof PRESET_PERIODS)[number]) => {
    onChange({ kind: "preset", days });
    setCustom(false);
    setOpen(false);
  };

  const applyCustom = () => {
    if (!draft?.from) return;
    const to = draft.to ?? draft.from;
    const [a, b] = draft.from <= to ? [draft.from, to] : [to, draft.from];
    onChange({ kind: "custom", from: toKey(a), to: toKey(b) });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 rounded-full">
          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
          {current.label}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex flex-col gap-0.5">
          {PRESET_PERIODS.map((d) => {
            const selected = value.kind === "preset" && value.days === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => pick(d)}
                className={cn(
                  "flex min-w-44 items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60",
                  selected && "bg-accent/60 font-medium",
                )}
              >
                Últimos {d} dias
                {selected && <Check className="h-3.5 w-3.5 text-violet-500" />}
              </button>
            );
          })}
          <div className="my-1 border-t border-border/50" />
          <button
            type="button"
            onClick={() => setCustom((c) => !c)}
            className={cn(
              "flex min-w-44 items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60",
              (custom || value.kind === "custom") && "bg-accent/60 font-medium",
            )}
          >
            Personalizado
            {value.kind === "custom" ? <Check className="h-3.5 w-3.5 text-violet-500" /> : <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", custom && "rotate-180")} />}
          </button>
        </div>

        {custom && (
          <div className="mt-1 border-t border-border/50 pt-1">
            <Calendar
              mode="range"
              locale={ptBR}
              // Inline styles (not Tailwind classes) so the range stays clearly visible in every theme.
              modifiersStyles={{
                range_start: { backgroundColor: "#6d3cf0", color: "#fff", borderRadius: 8 },
                range_end: { backgroundColor: "#6d3cf0", color: "#fff", borderRadius: 8 },
                range_middle: { backgroundColor: "rgba(109, 60, 240, 0.24)", color: "inherit", borderRadius: 0 },
              }}
              selected={draft}
              onSelect={setDraft}
              disabled={{ after: new Date() }}
              defaultMonth={draft?.from ?? new Date()}
            />
            <div className="flex items-center justify-between gap-2 px-3 pb-2">
              <p className="text-xs text-muted-foreground">
                {draft?.from ? `${format(draft.from, "dd/MM/yyyy")}${draft.to ? ` – ${format(draft.to, "dd/MM/yyyy")}` : ""}` : "Escolha o primeiro e o último dia"}
              </p>
              <Button size="sm" className="h-8 rounded-full" disabled={!draft?.from} onClick={applyCustom}>
                Aplicar
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
