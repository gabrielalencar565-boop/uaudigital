import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ArrowUpRight, Instagram, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { brandGradientCss } from "@/lib/brand-gradient";
import { cn } from "@/lib/utils";
import { useClients, useMagicNumberConfig, useTeamMembers } from "@/features/data/queries";
import { getFixedAssignee, useDefaultFlowWithDates } from "@/features/gestao/components/PmStageFlowConfig";
import { useInstagramConnections } from "@/features/calendario/hooks/use-instagram";
import { useCalendarsForCycle } from "@/features/calendario/hooks/use-calendar-data";
import { CLIENT_CARD_STATUS, anchorForDate, cycleStart, toGridThumbUrl } from "@/features/calendario/components/CalendarioPublicacaoPanel";

export function ClientesGrid({ onSelect }: { onSelect: (clientId: string) => void }) {
  const { day: magicDay } = useMagicNumberConfig();
  const clientsQ = useClients();
  const connectionsQ = useInstagramConnections();
  const [search, setSearch] = useState("");

  const cycleKey = format(cycleStart(anchorForDate(new Date(), magicDay), magicDay), "yyyy-MM-dd");
  const cycleCalendarsQ = useCalendarsForCycle(cycleKey);
  const statusByClient = useMemo(() => new Map((cycleCalendarsQ.data ?? []).map((c) => [c.client_id, c.status])), [cycleCalendarsQ.data]);
  const handleByClient = useMemo(
    () => new Map((connectionsQ.data ?? []).filter((c) => c.status === "active").map((c) => [c.client_id, c.instagram_username])),
    [connectionsQ.data],
  );

  const teamMembersQ = useTeamMembers();
  const { stageAssignees } = useDefaultFlowWithDates();
  const memberById = useMemo(() => new Map((teamMembersQ.data ?? []).map((m) => [m.user_id, m])), [teamMembersQ.data]);

  const clients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(clientsQ.data ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .filter((c) => !term || c.name.toLowerCase().includes(term));
  }, [clientsQ.data, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">Cronograma, resultados e tudo de cada cliente num só lugar.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" className="h-10 rounded-full pl-10" />
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">
          {clientsQ.isLoading ? "Carregando…" : "Nenhum cliente encontrado."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {clients.map((c) => {
            const status = statusByClient.get(c.id);
            const statusMeta = status ? CLIENT_CARD_STATUS[status] ?? CLIENT_CARD_STATUS.em_montagem : null;
            const handle = handleByClient.get(c.id);
            const responsibleId = getFixedAssignee(stageAssignees, "planejamento", c.id);
            const responsible = responsibleId ? memberById.get(responsibleId) : undefined;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className="group relative flex flex-col items-start gap-4 rounded-3xl border border-border/40 bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elevated"
              >
                <div className="flex w-full items-start justify-between">
                  <span className="rounded-full p-[2.5px]" style={{ background: brandGradientCss(135) }}>
                    <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-card text-base font-bold ring-2 ring-card">
                      {c.logo_url ? <img src={toGridThumbUrl(c.logo_url)} alt="" className="h-full w-full object-cover" /> : c.name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-all group-hover:border-violet-500/50 group-hover:bg-violet-500/10 group-hover:text-violet-500">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="flex min-w-0 max-w-full flex-col gap-0.5">
                  <span className="truncate text-base font-semibold leading-tight">{c.name}</span>
                  {handle ? (
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground"><Instagram className="h-3 w-3 shrink-0" /> @{handle}</span>
                  ) : (
                    <span className="truncate text-xs text-muted-foreground/70">{c.plan_name ?? "Instagram não conectado"}</span>
                  )}
                </div>
                <div className="flex w-full items-center justify-between gap-2">
                  {statusMeta ? (
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusMeta.className)}>{statusMeta.label}</span>
                  ) : (
                    <span className="rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Sem ciclo</span>
                  )}
                  {responsible && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2 ring-card" title={responsible.display_name}>
                      {responsible.avatar_url ? <img src={toGridThumbUrl(responsible.avatar_url)} alt={responsible.display_name} className="h-full w-full object-cover" /> : responsible.display_name.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
