import { useMemo } from "react";
import { useContentMonthOffset } from "@/features/data/queries";
import { automaticMonthDate, monthKey, monthLabel, monthOptions } from "../lib/content-month";

/** Seletor do mês do conteúdo. Vazio = segue o mês do prazo. */
export function ContentMonthPicker({ referenceMonth, dueDate, onChange }: {
  referenceMonth: string | null | undefined; dueDate: string | null | undefined; onChange: (value: string | null) => void;
}) {
  const options = useMemo(() => monthOptions(new Date(), 12, referenceMonth ?? undefined), [referenceMonth]);
  const offset = useContentMonthOffset();
  const auto = automaticMonthDate(dueDate, offset);
  const autoLabel = monthLabel(monthKey(auto.getFullYear(), auto.getMonth()));
  return (
    <select
      aria-label="Mês do conteúdo"
      title="O Magic Number e a pontuação desta tarefa contam neste mês"
      value={referenceMonth ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="min-h-[28px] rounded-md border border-border/50 bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
    >
      <option value="">{offset > 0 ? `Automático (${autoLabel})` : `Igual ao prazo (${autoLabel})`}</option>
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}
