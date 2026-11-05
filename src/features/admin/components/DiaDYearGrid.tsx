import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useMagicNumberConfig } from "@/features/data/queries";
import { cycleEnd, cycleMonthYear, cycleStart, useSetDiaDOverride } from "@/features/data/dia-d";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Dia D mês a mês: o dia padrão vale para todos, e cada mês pode ter o seu (ex.: dezembro fechando dia 18). */
export function DiaDYearGrid() {
  const { day: base, dayFor, overrides, label } = useMagicNumberConfig();
  const setOverride = useSetDiaDOverride();
  const now = new Date();
  const [year, setYear] = useState(() => cycleMonthYear(now, dayFor).year);
  const [sel, setSel] = useState(() => cycleMonthYear(now, dayFor).month); // 1-12
  const [dayText, setDayText] = useState("");
  const [reason, setReason] = useState("");

  const current = cycleMonthYear(now, dayFor);
  const isClosed = year < current.year || (year === current.year && sel < current.month);
  const saved = overrides.find((o) => o.year === year && o.month === sel) ?? null;

  // ao trocar de mês/ano (ou quando a exceção salva muda), o rascunho volta ao que está salvo
  useEffect(() => {
    setDayText(String(dayFor(year, sel)));
    setReason(saved?.reason ?? "");
  }, [year, sel, saved?.day, saved?.reason, dayFor]);

  const draftDay = Number(dayText);
  const draftValid = Number.isInteger(draftDay) && draftDay >= 1 && draftDay <= 28;
  const savedDay = dayFor(year, sel);
  const dirty = draftValid && (draftDay !== savedDay || (saved ? (saved.reason ?? "") !== reason.trim() : false));

  // períodos do ciclo do mês selecionado e do seguinte, com o dia do rascunho
  const preview = useMemo(() => {
    const d = draftValid ? draftDay : savedDay;
    const dayWithDraft = (y: number, m: number) => (y === year && m === sel ? d : dayFor(y, m));
    const a = new Date(year, sel - 1, 1);
    const next = new Date(year, sel, 1);
    return {
      mine: { from: cycleStart(a, dayWithDraft), to: cycleEnd(a, dayWithDraft) },
      next: { from: cycleStart(next, dayWithDraft), to: cycleEnd(next, dayWithDraft), month: next.getMonth() },
    };
  }, [year, sel, draftDay, draftValid, savedDay, dayFor]);

  const save = (day: number | null) => {
    setOverride.mutate(
      { year, month: sel, day, reason: reason.trim() },
      {
        onSuccess: (r) => {
          toast.success(day === null ? `${MONTHS_LONG[sel - 1]} voltou ao dia ${base}` : `Dia D de ${MONTHS_LONG[sel - 1]} ajustado para ${day}`);
          if (r.failed > 0) toast.warning(`${r.failed} calendário${r.failed > 1 ? "s" : ""} não ${r.failed > 1 ? "puderam" : "pôde"} ser ${r.failed > 1 ? "ajustados" : "ajustado"} sozinho${r.failed > 1 ? "s" : ""}. Ajuste o período dele${r.failed > 1 ? "s" : ""} no Cronograma.`);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
      },
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{label} mês a mês</div>
          <p className="text-xs text-muted-foreground">Dia padrão: {base}. Clique num mês para dar a ele um dia diferente (festas de fim de ano, por exemplo).</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Ano anterior" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="w-12 text-center text-sm font-semibold tabular-nums">{year}</span>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Próximo ano" onClick={() => setYear((y) => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {MONTHS.map((name, i) => {
          const m = i + 1;
          const ex = overrides.some((o) => o.year === year && o.month === m);
          const active = m === sel;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => setSel(m)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition",
                ex ? "border-amber-500/40 bg-amber-500/10" : "border-border/50 bg-background hover:border-primary/40",
                active && "ring-2 ring-primary/60",
              )}
            >
              <span className={cn("text-xs", ex ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>{name}</span>
              <span className={cn("text-xl font-semibold tabular-nums leading-none", ex && "text-amber-600 dark:text-amber-400")}>{dayFor(year, m)}</span>
              <span className={cn("text-[11px]", ex ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/70")}>{ex ? "exceção" : "padrão"}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-border/50 pt-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[5.5rem] text-sm font-semibold capitalize">{MONTHS_LONG[sel - 1]}/{String(year).slice(2)}</div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="dia-d-mes">Dia D</label>
            <Input id="dia-d-mes" type="number" min={1} max={28} value={dayText} disabled={isClosed || setOverride.isPending} onChange={(e) => setDayText(e.target.value)} className="h-9 w-20" />
          </div>
          <div className="min-w-[10rem] flex-1 space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="dia-d-motivo">Motivo</label>
            <Input id="dia-d-motivo" value={reason} maxLength={120} placeholder="Ex.: festas de fim de ano" disabled={isClosed || setOverride.isPending} onChange={(e) => setReason(e.target.value)} className="h-9" />
          </div>
          <Button type="button" size="sm" className="rounded-full" disabled={isClosed || !dirty || setOverride.isPending} onClick={() => save(draftDay)}>Salvar ajuste</Button>
          {saved && (
            <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={isClosed || setOverride.isPending} onClick={() => save(null)}>Voltar ao padrão</Button>
          )}
        </div>
        {!draftValid && dayText !== "" && <p className="text-xs text-destructive">O dia deve ser um número entre 1 e 28.</p>}
        {isClosed ? (
          <p className="text-xs text-muted-foreground">Esse mês já fechou, então o Dia D dele não pode mais ser mudado.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Ciclo de {MONTHS_LONG[sel - 1]}: {format(preview.mine.from, "dd/MM")} a {format(preview.mine.to, "dd/MM")}
            {" · "}
            {MONTHS_LONG[preview.next.month]} passa a ir de {format(preview.next.from, "dd/MM")} a {format(preview.next.to, "dd/MM")}.
            {" "}Cronogramas e ciclos já criados para o mês são acertados ao salvar; calendários que alguém ajustou à mão ficam como estão.
          </p>
        )}
      </div>
    </div>
  );
}
