import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROPOSAL_STATUS, fmtCurrency, fmtDateTime } from "../crm-constants";
import { useCrmProposals } from "../hooks/use-crm-proposals";
import { useCrmLeads } from "../hooks/use-crm-leads";

export function ComercialProposalsTab({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const { data: items = [] } = useCrmProposals();
  const { data: leads = [] } = useCrmLeads();
  const leadMap = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);

  if (items.length === 0) return <div className="text-center text-sm text-muted-foreground py-12">Sem propostas registradas</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((p) => {
        const lead = leadMap[p.lead_id];
        const st = PROPOSAL_STATUS.find((s) => s.value === p.status);
        return (
          <Card key={p.id} className="p-3 cursor-pointer hover:shadow-md transition" onClick={() => onOpenLead(p.lead_id)}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-semibold">{lead?.nome ?? "—"}</div>
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", st?.color)}>{st?.label}</span>
            </div>
            <div className="text-lg font-bold">{fmtCurrency(Number(p.valor) || 0)}</div>
            <div className="text-[11px] text-muted-foreground">
              {p.enviada_em ? `Enviada em ${fmtDateTime(p.enviada_em)}` : `Criada em ${fmtDateTime(p.created_at)}`}
            </div>
            {p.arquivo_url && (
              <a href={p.arquivo_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
                className="mt-2 inline-flex items-center text-xs text-primary hover:underline">
                <ExternalLink className="h-3 w-3 mr-1" />{p.arquivo_nome ?? "anexo"}
              </a>
            )}
          </Card>
        );
      })}
    </div>
  );
}
