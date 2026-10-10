import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, ChevronDown, Instagram, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { describeUnscheduled, useUnscheduledPosts } from "./hooks/use-unscheduled-posts";
import { brandGradientCss } from "@/lib/brand-gradient";
import { useClientsIncludingEnded, type ClientRow } from "@/features/data/queries";
import { useInstagramConnections } from "@/features/calendario/hooks/use-instagram";
import { toGridThumbUrl } from "@/features/calendario/components/CalendarioPublicacaoPanel";

export function ClientesGrid({ onSelect }: { onSelect: (clientId: string) => void }) {
  const clientsQ = useClientsIncludingEnded();
  const connectionsQ = useInstagramConnections();
  const [search, setSearch] = useState("");
  const unscheduledQ = useUnscheduledPosts();
  const unscheduled = unscheduledQ.data ?? new Map();
  const [onlyPending, setOnlyPending] = useState(false);
  // always starts minimized; a search opens it so a match among the ended clients is never hidden
  const [endedOpen, setEndedOpen] = useState(false);

  const handleByClient = useMemo(
    () => new Map((connectionsQ.data ?? []).filter((c) => c.status === "active").map((c) => [c.client_id, c.instagram_username])),
    [connectionsQ.data],
  );

  const { clients, ended } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matching = [...(clientsQ.data ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .filter((c) => !onlyPending || unscheduled.has(c.id));
    return { clients: matching.filter((c) => c.is_active), ended: matching.filter((c) => !c.is_active) };
  }, [clientsQ.data, search, onlyPending, unscheduled]);

  const showEnded = endedOpen || search.trim().length > 0;

  const renderCard = (c: ClientRow) => {
            const handle = handleByClient.get(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={`group relative flex flex-col items-start gap-4 rounded-3xl border border-border/40 bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elevated ${c.is_active ? "" : "opacity-70 hover:opacity-100"}`}
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
                  {unscheduled.get(c.id) && (() => {
                    const u = unscheduled.get(c.id)!;
                    return (
                      <span
                        title={describeUnscheduled(u)}
                        className={cn(
                          "mt-1.5 flex w-fit max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          u.overdue > 0 ? "bg-rose-500/15 text-rose-400" : "bg-amber-500/15 text-amber-500",
                        )}
                      >
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        <span className="truncate">{u.total} sem agendar</span>
                      </span>
                    );
                  })()}
                  {!c.is_active && (
                    <span className="mt-1 w-fit rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Encerrado{c.ended_at ? ` em ${new Date(c.ended_at.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}` : ""}
                    </span>
                  )}
                </div>
              </button>
            );
  };

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

      {unscheduled.size > 0 && (
        <button
          type="button"
          onClick={() => setOnlyPending((v) => !v)}
          aria-pressed={onlyPending}
          className={cn(
            "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
            onlyPending ? "border-rose-500/50 bg-rose-500/15" : "border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/15",
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose-500/20 text-rose-400"><AlertTriangle className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1 text-sm">
            <b className="font-semibold">{unscheduled.size} {unscheduled.size > 1 ? "clientes" : "cliente"} com posts sem agendar no Instagram.</b>{" "}
            <span className="text-muted-foreground">{onlyPending ? "Mostrando só esses. Clique para ver todos." : "Clique para ver só esses."}</span>
          </span>
        </button>
      )}

      {clients.length === 0 && ended.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">
          {clientsQ.isLoading ? "Carregando…" : "Nenhum cliente encontrado."}
        </div>
      ) : (
        <>
          {clients.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {clients.map(renderCard)}
            </div>
          )}
          {ended.length > 0 && (
            <section className="space-y-3">
              <button
                type="button"
                onClick={() => setEndedOpen((v) => !v)}
                aria-expanded={showEnded}
                className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-border/40 px-4 py-3 text-left transition-colors hover:bg-accent/30"
              >
                <span className="block text-sm font-semibold uppercase tracking-wider text-muted-foreground">Encerrados ({ended.length})</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${showEnded ? "rotate-180" : ""}`} />
              </button>
              {showEnded && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {ended.map(renderCard)}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
