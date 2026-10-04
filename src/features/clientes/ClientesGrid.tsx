import { useMemo, useState } from "react";
import { ArrowUpRight, Instagram, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { brandGradientCss } from "@/lib/brand-gradient";
import { useClients } from "@/features/data/queries";
import { useInstagramConnections } from "@/features/calendario/hooks/use-instagram";
import { toGridThumbUrl } from "@/features/calendario/components/CalendarioPublicacaoPanel";

export function ClientesGrid({ onSelect }: { onSelect: (clientId: string) => void }) {
  const clientsQ = useClients();
  const connectionsQ = useInstagramConnections();
  const [search, setSearch] = useState("");

  const handleByClient = useMemo(
    () => new Map((connectionsQ.data ?? []).filter((c) => c.status === "active").map((c) => [c.client_id, c.instagram_username])),
    [connectionsQ.data],
  );

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
            const handle = handleByClient.get(c.id);
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
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
