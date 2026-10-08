import { useEffect, useMemo, useState } from "react";
import { Info, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BRAND_GRADIENT_STOPS } from "@/lib/brand-gradient";
import { isClientActiveAt } from "@/lib/client-status";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/hooks/use-session";
import { PM_ACTIVE_STAGES, stageLabel } from "@/features/gestao/pm-constants";
import {
  useFinAllExpenses, useFinClients, useFinClientWorkload, useFinClientWorkloadYear, useFinMarginSettings, useSaveFinMarginSettings,
  type FinMarginSettings,
} from "../hooks/use-financial-data";
import { buildEffectiveExpenses } from "../utils/build-effective-expenses";
import {
  computeClientMargins, DEFAULT_EXCLUDED_CATEGORIES, DEFAULT_STAGE_WEIGHTS, EXPENSE_CATEGORY_LABELS, stageWeight, sumIncludedExpenses,
  weightedWorkload, type MonthMarginInput, type StageCount,
} from "../utils/client-margin";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const LIGHT_PURPLE = "#a78bfa";

// Margin per client: revenue minus the client's share of the operational expenses. For one month, or (no month) the year
// so far with every month split on its own.
export function FinMargemPorCliente({ year, month }: { year: number; month?: number }) {
  const clientsQ = useFinClients();
  const allYearExpensesQ = useFinAllExpenses(year);
  const monthWorkloadQ = useFinClientWorkload(year, month ?? 1);
  const yearWorkloadQ = useFinClientWorkloadYear(year);
  const settingsQ = useFinMarginSettings();
  const wholeYear = month === undefined;

  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const weights = settingsQ.data?.stage_weights ?? {};
  const excluded = settingsQ.data?.excluded_categories ?? DEFAULT_EXCLUDED_CATEGORIES;

  const result = useMemo(() => {
    const now = new Date();
    const last = wholeYear ? (year === now.getFullYear() ? now.getMonth() + 1 : year < now.getFullYear() ? 12 : 0) : month!;
    const first = wholeYear ? 1 : month!;
    const allExpenses = allYearExpensesQ.data ?? [];
    const months: MonthMarginInput[] = [];
    for (let m = first; m <= last; m++) {
      const clients = (clientsQ.data ?? [])
        .filter((c) => isClientActiveAt(c, year, m))
        .map((c) => ({ id: c.id, name: c.name, revenue: Number(c.monthly_value) }));
      const effective = buildEffectiveExpenses(allExpenses.filter((e) => e.month === m), allExpenses, m, year);
      const counts: StageCount[] = (wholeYear ? yearWorkloadQ.data?.get(m) : monthWorkloadQ.data) ?? [];
      const stageCounts = new Map<string, number>();
      for (const r of counts) stageCounts.set(r.client_id, (stageCounts.get(r.client_id) ?? 0) + r.stages);
      months.push({ clients, workload: weightedWorkload(counts, weights), stageCounts, totalExpenses: sumIncludedExpenses(effective, excluded) });
    }
    return computeClientMargins(months);
  }, [clientsQ.data, allYearExpensesQ.data, monthWorkloadQ.data, yearWorkloadQ.data, weights, excluded, year, month, wholeYear]);

  const reliable = result.rows.filter((r) => !r.insufficient);
  const insufficientCount = result.rows.length - reliable.length;
  const maxAbs = Math.max(1, ...reliable.map((r) => Math.abs(r.marginPct ?? 0)));
  const totalRevenue = result.rows.reduce((s, r) => s + r.revenue, 0);
  const overallPct = totalRevenue > 0 ? ((totalRevenue - result.totalExpenses) / totalRevenue) * 100 : 0;

  return (
    <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.18s" }}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Margem por cliente</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {wholeYear ? "Acumulado do ano" : "Receita do cliente menos a parte das despesas operacionais do mês que ele consumiu"} · margem geral{" "}
              <span className={cn("font-semibold", overallPct >= 0 ? "text-success" : "text-destructive")}>{Math.round(overallPct) || 0}%</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isAdmin && (
              <button
                type="button"
                aria-label="Ajustar o cálculo"
                title="Ajustar o cálculo"
                onClick={() => setSettingsOpen(true)}
                className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Como é calculado" className="rounded-md p-1 text-muted-foreground/60 transition-colors hover:text-muted-foreground">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
                As despesas operacionais de cada mês são divididas pelo peso do trabalho de cada cliente (etapas concluídas, cada tipo de etapa com seu peso).
                Investimentos e despesas fora do rateio não entram. Cliente sem etapa concluída fica sem margem. É uma estimativa.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {result.rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nenhum cliente ativo neste período.</p>
        ) : (
          <>
            <div className="max-h-[440px] space-y-1 overflow-y-auto px-4 pb-3 pr-3">
              {result.rows.map((r) => {
                const pct = r.marginPct;
                const negative = (r.margin ?? 0) < 0;
                const width = pct === null ? 0 : Math.max(2, (Math.abs(pct) / maxAbs) * 100);
                const partial = !r.insufficient && r.monthsWithData < r.monthsActive;
                return (
                  <Tooltip key={r.id}>
                    <TooltipTrigger asChild>
                      <div className="grid cursor-default grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_3.25rem] items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/30 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_3.5rem]">
                        <span className="truncate text-xs font-medium">{r.name}</span>
                        {r.insufficient ? (
                          <span className="truncate text-[11px] text-muted-foreground/70">
                            {fmt(r.revenue)} · sem dados suficientes
                          </span>
                        ) : (
                          <span className="h-2 overflow-hidden rounded-full bg-muted/50">
                            <span
                              className="block h-full rounded-full transition-all duration-500"
                              style={{ width: `${width}%`, background: negative ? "hsl(var(--destructive))" : `linear-gradient(90deg, ${BRAND_GRADIENT_STOPS[0]}, ${LIGHT_PURPLE})` }}
                            />
                          </span>
                        )}
                        <span className={cn("text-right text-xs font-semibold tabular-nums", r.insufficient ? "text-muted-foreground/50" : negative ? "text-destructive" : "text-foreground")}>
                          {pct === null ? "—" : `${Math.round(pct) || 0}%${partial ? "*" : ""}`}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="space-y-0.5 text-xs">
                      <p className="font-semibold">{r.name}</p>
                      <p>Receita: {fmt(r.revenue)}</p>
                      {r.insufficient ? (
                        <p className="text-muted-foreground">Nenhuma etapa concluída {wholeYear ? "no ano" : "neste mês"}: não dá para estimar a margem.</p>
                      ) : (
                        <>
                          <p>Despesa estimada: {fmt(r.cost)} ({r.stages} {r.stages === 1 ? "etapa" : "etapas"})</p>
                          <p className={negative ? "text-destructive" : "text-success"}>Margem: {fmt(r.margin ?? 0)}</p>
                          {partial && <p className="text-muted-foreground">* calculada em {r.monthsWithData} de {r.monthsActive} meses (os meses sem etapas ficam de fora)</p>}
                        </>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            {(insufficientCount > 0 || result.unallocated > 0) && (
              <p className="border-t border-border/30 px-6 py-3 text-[11px] leading-relaxed text-muted-foreground">
                {insufficientCount > 0 && <>{insufficientCount} {insufficientCount === 1 ? "cliente sem etapas concluídas fica" : "clientes sem etapas concluídas ficam"} sem margem, só com a receita. </>}
                {result.unallocated > 0 && <>{fmt(result.unallocated)} de despesas ficaram sem rateio porque nenhum cliente teve etapa concluída nesse período.</>}
              </p>
            )}
          </>
        )}
      </CardContent>

      {isAdmin && settingsOpen && (
        <MarginSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settingsQ.data ?? null} extraStages={stageKeysInData(wholeYear, monthWorkloadQ.data, yearWorkloadQ.data)} />
      )}
    </Card>
  );
}

function stageKeysInData(wholeYear: boolean, month: StageCount[] | undefined, year: Map<number, StageCount[]> | undefined): string[] {
  const rows = wholeYear ? [...(year?.values() ?? [])].flat() : month ?? [];
  return [...new Set(rows.map((r) => r.stage))];
}

function MarginSettingsDialog({ open, onOpenChange, settings, extraStages }: { open: boolean; onOpenChange: (o: boolean) => void; settings: FinMarginSettings | null; extraStages: string[] }) {
  const save = useSaveFinMarginSettings();

  const stages = useMemo(() => {
    const keys = [...PM_ACTIVE_STAGES.map((s) => s.key), ...Object.keys(DEFAULT_STAGE_WEIGHTS), ...extraStages];
    return [...new Set(keys)].map((key) => ({ key, label: stageLabel(key) }));
  }, [extraStages]);

  const [weights, setWeights] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<string[]>(DEFAULT_EXCLUDED_CATEGORIES);

  useEffect(() => {
    if (!open) return;
    const w = settings?.stage_weights ?? {};
    setWeights(Object.fromEntries(stages.map((s) => [s.key, String(stageWeight(w, s.key))])));
    setExcluded(settings?.excluded_categories ?? DEFAULT_EXCLUDED_CATEGORIES);
  }, [open, settings, stages]);

  const reset = () => {
    setWeights(Object.fromEntries(stages.map((s) => [s.key, String(stageWeight({}, s.key))])));
    setExcluded(DEFAULT_EXCLUDED_CATEGORIES);
  };

  const submit = () => {
    const parsed: Record<string, number> = {};
    for (const s of stages) {
      const n = Number(String(weights[s.key]).replace(",", "."));
      parsed[s.key] = Number.isFinite(n) && n >= 0 ? n : stageWeight({}, s.key);
    }
    save.mutate(
      { existingAgencyId: settings?.agency_id ?? null, stage_weights: parsed, excluded_categories: excluded },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  const toggleCategory = (cat: string, included: boolean) =>
    setExcluded((prev) => (included ? prev.filter((c) => c !== cat) : [...new Set([...prev, cat])]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar o cálculo da margem</DialogTitle>
          <DialogDescription>Define quanto cada tipo de etapa pesa na divisão das despesas e quais despesas entram nela.</DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Peso de cada etapa</p>
          <div className="grid gap-1.5">
            {stages.map((s) => (
              <label key={s.key} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2">
                <span className="text-sm">{s.label}</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.5}
                  value={weights[s.key] ?? ""}
                  onChange={(e) => setWeights((w) => ({ ...w, [s.key]: e.target.value }))}
                  className="h-8 w-20 text-center"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Despesas que entram no rateio</p>
          <div className="grid gap-1.5">
            {Object.entries(EXPENSE_CATEGORY_LABELS).map(([cat, label]) => {
              const included = !excluded.includes(cat);
              return (
                <label key={cat} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2">
                  <span className="text-sm">{label}</span>
                  <Switch checked={included} onCheckedChange={(v) => toggleCategory(cat, v)} />
                </label>
              );
            })}
          </div>
        </section>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={reset}>Restaurar padrão</Button>
          <Button type="button" onClick={submit} disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
