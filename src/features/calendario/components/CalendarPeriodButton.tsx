import { useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarRange } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePeriodPreview, useResetCalendarPeriod, useSetCalendarPeriod } from "../hooks/use-calendar-data";

// Período do calendário (ex.: "28/10 a 27/11"). Normalmente é o ciclo do Dia D; aqui dá para ajustar quando for preciso levar, por exemplo, a última
// semana de outubro junto com novembro: o início de novembro vira 21/10, o calendário de outubro termina um dia antes e os posts dessa semana passam
// para novembro — inclusive no link do cliente, que mostra tudo o que está no calendário.

const fmt = (d: string) => format(parseISO(d), "dd/MM");

export function CalendarPeriodButton({
  calendar,
  stdStart,
  stdEnd,
  clientCalendarIds,
}: {
  calendar: { id: string; cycle_start: string; cycle_end: string };
  stdStart: string;
  stdEnd: string;
  clientCalendarIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(calendar.cycle_start);
  const [end, setEnd] = useState(calendar.cycle_end);
  const setPeriod = useSetCalendarPeriod();
  const resetPeriod = useResetCalendarPeriod();
  const adjusted = calendar.cycle_start !== stdStart || calendar.cycle_end !== stdEnd;
  const valid = !!start && !!end && start <= end;
  const changed = start !== calendar.cycle_start || end !== calendar.cycle_end;

  // Prévia: quantos posts entram e quantos saem deste calendário com o novo período
  const from = valid ? (start < calendar.cycle_start ? start : calendar.cycle_start) : null;
  const to = valid ? (end > calendar.cycle_end ? end : calendar.cycle_end) : null;
  const previewQ = usePeriodPreview(open && valid && changed ? clientCalendarIds : [], from, to);
  const preview = useMemo(() => {
    const rows = previewQ.data ?? [];
    const inNew = (d: string) => d >= start && d <= end;
    const inOld = (d: string) => d >= calendar.cycle_start && d <= calendar.cycle_end;
    return {
      entram: rows.filter((r) => inNew(r.publish_date) && !inOld(r.publish_date)).length,
      saem: rows.filter((r) => inOld(r.publish_date) && !inNew(r.publish_date)).length,
    };
  }, [previewQ.data, start, end, calendar.cycle_start, calendar.cycle_end]);
  const extraDays = valid ? Math.max(0, differenceInCalendarDays(parseISO(calendar.cycle_start), parseISO(start))) : 0;

  const apply = async () => {
    try {
      await setPeriod.mutateAsync({ calendarId: calendar.id, start, end });
      toast.success(`Período ajustado: ${fmt(start)} a ${fmt(end)}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ajustar o período");
    }
  };
  const reset = async () => {
    try {
      await resetPeriod.mutateAsync(calendar.id);
      toast.success("Período voltou ao padrão");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível voltar ao padrão");
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) { setStart(calendar.cycle_start); setEnd(calendar.cycle_end); }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition",
            adjusted ? "bg-primary/15 text-primary hover:bg-primary/25" : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          title={adjusted ? "Período ajustado — clique para alterar" : "Período do calendário — clique para ajustar"}
        >
          <CalendarRange className="h-3.5 w-3.5" />
          {fmt(calendar.cycle_start)} a {fmt(calendar.cycle_end)}
          {adjusted && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-medium">Período deste calendário</p>
          <p className="text-xs text-muted-foreground">Padrão: {fmt(stdStart)} a {fmt(stdEnd)}. Puxe o início para trás para levar o fim do mês anterior junto.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            Início
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Fim
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground" />
          </label>
        </div>
        {valid && changed && (
          <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
            {extraDays > 0 && `Inclui ${extraDays} dia${extraDays > 1 ? "s" : ""} a mais no começo · `}
            {preview.entram} {preview.entram === 1 ? "post entra" : "posts entram"}
            {preview.saem > 0 && ` · ${preview.saem} ${preview.saem === 1 ? "sai" : "saem"}`}
          </p>
        )}
        {!valid && <p className="text-xs text-destructive">O início precisa ser antes do fim.</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={!adjusted || resetPeriod.isPending} onClick={reset}>Voltar ao padrão</Button>
          <Button type="button" size="sm" className="ml-auto" disabled={!valid || !changed || setPeriod.isPending} onClick={apply}>Aplicar</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
