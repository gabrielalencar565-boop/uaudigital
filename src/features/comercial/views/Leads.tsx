import { useMemo } from "react";
import { useComercial } from "../ComercialContext";
import { brl, leadStatus, nextActivity, shortDate } from "../lib/rules";
import { DueBadge, Empty, PageHead } from "../components/ui-bits";
import { filterLeads, LeadFilterBar, useLeadFilters } from "../components/LeadFilters";

export function Leads() {
  const { leads, stages, acts, team, today, stageOf, memberOf, openLead } = useComercial();
  const { f, set } = useLeadFilters();
  const rows = useMemo(
    () => filterLeads(leads, f, stages, acts, today).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [leads, f, stages, acts, today],
  );

  return (
    <div className="space-y-3">
      <PageHead title="Leads e contatos" right={<span className="text-xs text-muted-foreground">{rows.length} de {leads.length}</span>} />
      <LeadFilterBar f={f} set={set} leads={leads} team={team} stages={stages} withStage />
      <div className="overflow-x-auto rounded-2xl border border-border/50 bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Contato</th>
              <th className="px-3 py-2.5 font-medium">Etapa</th>
              <th className="px-3 py-2.5 font-medium">Origem</th>
              <th className="px-3 py-2.5 font-medium">Responsável</th>
              <th className="px-3 py-2.5 text-right font-medium">Valor/mês</th>
              <th className="px-3 py-2.5 font-medium">Próxima ação</th>
              <th className="px-3 py-2.5 font-medium">Cidade</th>
              <th className="px-3 py-2.5 font-medium">Cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="p-4"><Empty>{leads.length === 0 ? "Nenhum lead ainda. Clique em “Novo lead” para começar." : "Nenhum lead com esses filtros"}</Empty></td></tr>
            ) : rows.map((l) => {
              const stage = stageOf(l.stage_id);
              return (
                <tr key={l.id} onClick={() => openLead(l.id)} className="cursor-pointer transition hover:bg-muted/30">
                  <td className="px-3 py-2.5">
                    <div className="font-semibold">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{[l.company, l.tags.join(", ")].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-3 py-2.5">{stage?.name}</td>
                  <td className="px-3 py-2.5">{l.source}</td>
                  <td className="px-3 py-2.5">{memberOf(l.owner_id)?.display_name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{l.value ? brl(l.value) : "—"}</td>
                  <td className="px-3 py-2.5"><DueBadge status={leadStatus(stage, l.id, acts, today)} next={nextActivity(l.id, acts)} today={today} /></td>
                  <td className="px-3 py-2.5">{l.city || "—"}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-muted-foreground">{shortDate(l.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
