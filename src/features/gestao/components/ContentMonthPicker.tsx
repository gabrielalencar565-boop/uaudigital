import { useMemo } from "react";
import { useContentMonthOffset } from "@/features/data/queries";
import { automaticMonthDate, monthKey, monthLabel, monthOptions } from "../lib/content-month";

/**
 * Seletor de mês da tarefa. Vazio = o padrão:
 *  - "content": mês do conteúdo (só nome e organização); o padrão é o mês do prazo + antecedência da agência.
 *  - "count": mês em que o Magic Number e a pontuação contam; o padrão é o mês do prazo.
 */
export function ContentMonthPicker({ kind = "content", referenceMonth, dueDate, onChange }: {
  kind?: "content" | "count"; referenceMonth: string | null | undefined; dueDate: string | null | undefined; onChange: (value: string | null) => void;
}) {
  const options = useMemo(() => monthOptions(new Date(), 12, referenceMonth ?? undefined), [referenceMonth]);
  const agencyOffset = useContentMonthOffset();
  const offset = kind === "count" ? 0 : agencyOffset;
  const auto = automaticMonthDate(dueDate, offset);
  const autoLabel = monthLabel(monthKey(auto.getFullYear(), auto.getMonth()));
  return (
    <select
      aria-label={kind === "count" ? "Conta no Magic Number em" : "Mês do conteúdo"}
      title={kind === "count" ? "O Magic Number e a pontuação desta tarefa contam neste mês" : "Mês a que o conteúdo pertence (só nome e organização, não muda o Magic Number)"}
      value={referenceMonth ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="min-h-[28px] rounded-md border border-border/50 bg-transparent px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
    >
      <option value="">{offset > 0 ? `Automático (${autoLabel})` : `Igual ao prazo (${autoLabel})`}</option>
      {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
    </select>
  );
}
