import * as React from "react";
import { format, addDays, startOfWeek, nextSaturday, addWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface QuickOption {
  label: string;
  sublabel: string;
  date: Date;
}

function getQuickOptions(): QuickOption[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = addDays(today, 1);
  const nextSat = nextSaturday(today);
  const nextMon = startOfWeek(addWeeks(today, 1), { weekStartsOn: 1 });
  const nextWeekendFri = addDays(nextMon, 4);
  const twoWeeks = addDays(today, 14);
  const fourWeeks = addDays(today, 28);

  const dayName = (d: Date) => format(d, "EEE", { locale: ptBR });
  const dateFmt = (d: Date) => format(d, "dd MMM", { locale: ptBR });

  return [
    { label: "Hoje", sublabel: dayName(today), date: today },
    { label: "Amanhã", sublabel: dayName(tomorrow), date: tomorrow },
    { label: "Este final de semana", sublabel: "sáb", date: nextSat },
    { label: "Semana que vem", sublabel: "seg", date: nextMon },
    { label: "Próximo final de semana", sublabel: dateFmt(nextWeekendFri), date: nextWeekendFri },
    { label: "2 semanas", sublabel: dateFmt(twoWeeks), date: twoWeeks },
    { label: "4 semanas", sublabel: dateFmt(fourWeeks), date: fourWeeks },
  ];
}

interface DatePickerProps {
  value?: string; // yyyy-MM-dd
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({ value, onChange, placeholder = "Selecionar data", className, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const quickOptions = React.useMemo(() => getQuickOptions(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDate = value ? new Date(value + "T12:00:00") : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange?.(format(date, "yyyy-MM-dd"));
      setOpen(false);
    }
  };

  const handleQuickSelect = (date: Date) => {
    onChange?.(format(date, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "justify-start gap-2 font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 z-[150]" align="start" sideOffset={4}>
        <div className="flex">
          {/* Quick options */}
          <div className="border-r border-border p-2 min-w-[200px]">
            {quickOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => handleQuickSelect(opt.date)}
                className={cn(
                  "flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
                  value && format(opt.date, "yyyy-MM-dd") === value && "bg-accent font-medium"
                )}
              >
                <span>{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
              </button>
            ))}
          </div>
          {/* Calendar */}
          <div className="p-1">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              locale={ptBR}
              initialFocus
              className="pointer-events-auto"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Inline variant for use in table cells or compact spaces */
export function DatePickerInline({
  value,
  onChange,
  className,
  disabled,
}: Omit<DatePickerProps, "placeholder">) {
  const [open, setOpen] = React.useState(false);
  const quickOptions = React.useMemo(() => getQuickOptions(), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedDate = value ? new Date(value + "T12:00:00") : undefined;

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange?.(format(date, "yyyy-MM-dd"));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1.5 text-xs hover:underline focus:outline-none",
            !value && "text-muted-foreground",
            disabled && "opacity-50 pointer-events-none",
            className
          )}
        >
          <CalendarIcon className="h-3 w-3" />
          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "—"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <div className="flex">
          <div className="border-r border-border p-2 min-w-[200px]">
            {quickOptions.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => {
                  onChange?.(format(opt.date, "yyyy-MM-dd"));
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent",
                  value && format(opt.date, "yyyy-MM-dd") === value && "bg-accent font-medium"
                )}
              >
                <span>{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.sublabel}</span>
              </button>
            ))}
          </div>
          <div className="p-1">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              locale={ptBR}
              initialFocus
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
