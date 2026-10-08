import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, RotateCcw } from "lucide-react";
import { addDays, format, startOfWeek } from "date-fns";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useCascades, type Cascade } from "../hooks/use-cascades";
import { orderSteps } from "../lib/cascade";
import { CascadePreview } from "./CascadePreview";

const sb = supabase as any;

function CascadeCard({ cascade }: { cascade: Cascade }) {
  const qc = useQueryClient();
  const [name, setName] = useState(cascade.name);
  const [businessDays, setBusinessDays] = useState(cascade.business_days);
  const [push, setPush] = useState(cascade.push_on_delay);
  const [days, setDays] = useState<Record<string, number>>(() => Object.fromEntries(cascade.steps.map((s) => [s.key, s.days])));
  const [saving, setSaving] = useState(false);

  // Keep the form in sync when the saved template changes (after saving, or edited elsewhere).
  const sig = JSON.stringify(cascade);
  useEffect(() => {
    setName(cascade.name);
    setBusinessDays(cascade.business_days);
    setPush(cascade.push_on_delay);
    setDays(Object.fromEntries(cascade.steps.map((s) => [s.key, s.days])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const draftSteps = useMemo(() => cascade.steps.map((s) => ({ ...s, days: days[s.key] ?? s.days })), [cascade.steps, days]);
  const dirty = name.trim() !== cascade.name || businessDays !== cascade.business_days || push !== cascade.push_on_delay || draftSteps.some((s, i) => s.days !== cascade.steps[i].days);
  const labelOf = (key: string) => cascade.steps.find((s) => s.key === key)?.label ?? key;
  // A Monday to preview on (next Monday), so the example never starts on a weekend.
  const sampleStart = format(startOfWeek(addDays(new Date(), 7), { weekStartsOn: 1 }), "yyyy-MM-dd");

  const save = async () => {
    if (!name.trim()) { toast.error("Dê um nome à cascata"); return; }
    setSaving(true);
    const { error } = await sb.from("flow_cascades").update({
      name: name.trim(), steps: draftSteps, business_days: businessDays, push_on_delay: push, updated_at: new Date().toISOString(),
    }).eq("id", cascade.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cascata salva. Vale para as próximas tarefas criadas.");
    qc.invalidateQueries({ queryKey: ["flow_cascades"] });
  };

  return (
    <div className="grid grid-cols-1 gap-8 rounded-3xl border border-border/40 bg-card/40 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-10 max-w-sm" />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dias de cada etapa</label>
          <p className="text-xs text-muted-foreground">Quantos dias depois da etapa anterior cada uma deve estar pronta. Design e Vídeo partem juntos da revisão e se reencontram no PDF.</p>
          <div className="divide-y divide-border/30 overflow-hidden rounded-2xl border border-border/30">
            {orderSteps(draftSteps).map((s) => (
              <div key={s.key} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{s.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {s.after.length === 0 ? "Começa na data escolhida" : `depois de ${s.after.map(labelOf).join(" e ")}`}
                  </span>
                </span>
                {s.after.length === 0 ? (
                  <span className="w-24 text-right text-xs text-muted-foreground">início</span>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number" min={0} max={60} value={days[s.key] ?? s.days}
                      onChange={(e) => setDays((d) => ({ ...d, [s.key]: Math.max(0, Math.min(60, Math.round(Number(e.target.value) || 0))) }))}
                      className="h-8 w-16 text-center text-sm"
                    />
                    <span className="w-14 text-xs text-muted-foreground">{businessDays ? "dia(s) útil" : "dia(s)"}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3">
            <Switch checked={businessDays} onCheckedChange={setBusinessDays} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Contar só dias úteis</span>
              <span className="block text-xs text-muted-foreground">Sábado e domingo não entram na conta. (Feriados ainda não são considerados.)</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <Switch checked={push} onCheckedChange={setPush} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Atraso empurra as próximas datas</span>
              <span className="block text-xs text-muted-foreground">Se uma etapa for concluída depois do previsto, as seguintes se ajustam. Concluir antes não adianta as datas.</span>
            </span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button className="rounded-full" disabled={!dirty || saving} onClick={save}>{saving ? "Salvando…" : "Salvar cascata"}</Button>
          {dirty && (
            <Button variant="ghost" className="gap-1.5 rounded-full text-muted-foreground" onClick={() => {
              setName(cascade.name); setBusinessDays(cascade.business_days); setPush(cascade.push_on_delay);
              setDays(Object.fromEntries(cascade.steps.map((s) => [s.key, s.days])));
            }}>
              <RotateCcw className="h-3.5 w-3.5" /> Descartar
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Exemplo começando em {format(new Date(`${sampleStart}T12:00:00`), "dd/MM")}</p>
        <div className="rounded-2xl bg-muted/30 p-3">
          <CascadePreview steps={draftSteps} startDate={sampleStart} businessDays={businessDays} />
        </div>
      </div>
    </div>
  );
}

export function CascadeStudio() {
  const q = useCascades();
  const cascades = q.data ?? [];
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><CalendarClock className="h-5 w-5 text-muted-foreground" /> Cascata de datas</h3>
        <p className="text-sm text-muted-foreground">
          Ao criar um planejamento você escolhe o dia de início e o sistema já planeja a data de todas as etapas seguintes. Aqui você ajusta quantos dias cada etapa leva.
        </p>
      </div>
      {q.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : cascades.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma cascata cadastrada.</p>
      ) : (
        cascades.map((c) => <CascadeCard key={c.id} cascade={c} />)
      )}
    </div>
  );
}
