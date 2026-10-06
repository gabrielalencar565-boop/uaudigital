import { useState } from "react";
import { CalendarClock } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCascades, type Cascade } from "../hooks/use-cascades";
import { CascadePreview } from "./CascadePreview";

const anchorKey = (c: Cascade) => c.steps.find((s) => s.after.length === 0)?.key;

// "Usar cascata" choice for the task-creation dialog: only offered when the stage being created is the first step
// of some cascade template (e.g. "Planejamento" for "Planejamento Mensal").
export function useCascadeChoice(stage: string, allowed: boolean) {
  const q = useCascades();
  const options = (q.data ?? []).filter((c) => anchorKey(c) === stage);
  const [use, setUse] = useState(false);
  const [id, setId] = useState("");
  const cascade = options.find((c) => c.id === id) ?? options.find((c) => c.is_default) ?? options[0] ?? null;
  return { available: allowed && !!cascade, use, setUse, options, setId, cascade, active: allowed && use && !!cascade };
}

export function CascadeOption({ choice, startDate }: { choice: ReturnType<typeof useCascadeChoice>; startDate: string }) {
  if (!choice.available || !choice.cascade) return null;
  return (
    <div className="space-y-2.5 rounded-xl border border-border/40 bg-muted/20 p-3">
      <div className="flex items-center gap-2">
        <Checkbox id="use_cascade" checked={choice.use} onCheckedChange={(v) => choice.setUse(!!v)} />
        <Label htmlFor="use_cascade" className="flex cursor-pointer items-center gap-1.5 text-sm">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" /> Usar cascata de datas
        </Label>
        {choice.options.length > 1 && choice.use && (
          <Select value={choice.cascade.id} onValueChange={choice.setId}>
            <SelectTrigger className="ml-auto h-7 w-44 rounded-lg text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{choice.options.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      {choice.use ? (
        <>
          <CascadePreview steps={choice.cascade.steps} startDate={startDate} businessDays={choice.cascade.business_days} />
          <p className="text-[11px] text-muted-foreground">
            {choice.cascade.name}: cada etapa já nasce com a data prevista{choice.cascade.push_on_delay ? "; se uma atrasar, as seguintes se ajustam" : ""}.
            {choice.cascade.business_days ? " Só dias úteis." : ""}
          </p>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">As datas seguem a regra de dias de cada etapa, como antes.</p>
      )}
    </div>
  );
}
