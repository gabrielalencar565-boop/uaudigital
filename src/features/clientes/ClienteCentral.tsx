import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BarChart3, CalendarDays, ChevronLeft, FileText, Instagram, Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { useClientsIncludingEnded } from "@/features/data/queries";
import { useInstagramConnections } from "@/features/calendario/hooks/use-instagram";
import { CalendarioPublicacaoPanel, toGridThumbUrl } from "@/features/calendario/components/CalendarioPublicacaoPanel";
import { ClientResults } from "@/features/resultados/components/ClientResults";
import { ClienteDocumentos } from "./components/ClienteDocumentos";
import { ClienteConfiguracoes } from "./components/ClienteConfiguracoes";
import { getPendingCalendarioFocus, setPendingCalendarioFocus, subscribePendingCalendarioFocus, type CalendarioFocusRequest } from "@/lib/pending-calendario-focus-store";

const SECTIONS = [
  { key: "cronograma", label: "Cronograma", icon: CalendarDays },
  { key: "resultados", label: "Resultados", icon: BarChart3 },
  { key: "documentos", label: "Documentos", icon: FileText },
  { key: "configuracoes", label: "Configurações", icon: Settings },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];

const BANNER_SHADOW = "0 8px 32px -8px hsl(var(--brand-glow-3) / 0.18), 0 0 0 1px hsl(var(--brand-glow-5) / 0.12), inset 0 0 0 1px rgba(255,255,255,0.06)";
const BANNER_SHADOW_HOVER = "0 16px 48px -8px hsl(var(--brand-glow-3) / 0.32), 0 0 24px 2px hsl(var(--brand-glow-5) / 0.18), 0 0 0 1px hsl(var(--brand-glow-5) / 0.25), inset 0 0 0 1px rgba(255,255,255,0.10)";

// Same task dialog the rest of the app opens from notifications — no navigation away from the client.
const openTask = (taskId: string) => window.dispatchEvent(new CustomEvent("uau:open-task", { detail: { taskId } }));

export function ClienteCentral({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const [params, setParams] = useSearchParams();
  const section = (SECTIONS.find((s) => s.key === params.get("secao"))?.key ?? "cronograma") as SectionKey;
  const setSection = (key: SectionKey) => setParams({ secao: key }, { replace: true });

  // "Abrir no Cronograma" a partir de uma tarefa deixa um pedido pendente (cliente + ciclo + publicação);
  // o painel embutido o consome ao montar.
  const [focusRequest, setFocusRequest] = useState<CalendarioFocusRequest | null>(() => {
    const pending = getPendingCalendarioFocus();
    return pending?.clientId === clientId ? pending : null;
  });
  useEffect(() => {
    const pending = getPendingCalendarioFocus();
    if (pending?.clientId === clientId) setFocusRequest(pending);
    return subscribePendingCalendarioFocus((v) => { if (v?.clientId === clientId) setFocusRequest(v); });
  }, [clientId]);

  const clientsQ = useClientsIncludingEnded();
  const client = (clientsQ.data ?? []).find((c) => c.id === clientId) ?? null;
  const connectionsQ = useInstagramConnections();
  const username = (connectionsQ.data ?? []).find((c) => c.client_id === clientId && c.status === "active")?.instagram_username ?? null;

  if (!client) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Clientes
        </button>
        <p className="rounded-2xl border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">
          {clientsQ.isLoading ? "Carregando…" : "Cliente não encontrado."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Same banner pattern as the Meu Painel hero: layered brand glow, spinning avatar ring, glass chips. */}
      <div className="opacity-0" style={{ animation: "fadeUp 0.6s ease-out forwards" }}>
        <header
          className="relative group overflow-hidden transition-all duration-500 ease-out hover:-translate-y-1 hover:scale-[1.003]"
          style={{ borderRadius: 28, boxShadow: BANNER_SHADOW }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = BANNER_SHADOW_HOVER; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = BANNER_SHADOW; }}
        >
          <div className="absolute -inset-8 opacity-90" style={{ background: "linear-gradient(135deg, hsl(var(--brand-glow-1)) 0%, hsl(var(--brand-glow-2)) 25%, hsl(var(--brand-glow-3)) 50%, hsl(var(--brand-glow-4)) 75%, hsl(var(--brand-glow-1)) 100%)", backgroundSize: "300% 300%", animation: "gradientFlow 14s ease-in-out infinite" }} />
          <div className="absolute -inset-12 opacity-60" style={{ background: "radial-gradient(ellipse 70% 60% at 25% 35%, hsl(var(--brand-glow-5)) 0%, transparent 70%), radial-gradient(ellipse 55% 65% at 75% 65%, hsl(var(--brand-glow-4)) 0%, transparent 65%)", animation: "parallaxLayer2 12s ease-in-out infinite" }} />
          <div className="absolute -inset-16 opacity-50" style={{ background: "radial-gradient(circle 280px at 20% 70%, hsl(var(--brand-glow-3)) 0%, transparent 60%), radial-gradient(circle 220px at 80% 25%, hsl(var(--brand-glow-2)) 0%, transparent 55%)", filter: "blur(30px)", animation: "parallaxLayer3 9s ease-in-out infinite" }} />
          <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "44px 44px", animation: "gridDrift 22s linear infinite" }} />
          <div className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-500 group-hover:opacity-80" style={{ borderRadius: 28, boxShadow: "inset 0 0 0 1.5px hsl(var(--brand-glow-6) / 0.3), 0 0 20px 0 hsl(var(--brand-glow-3) / 0.08)" }} />

          <div className="relative z-10 flex flex-col gap-4 p-5 sm:p-6">
            <button type="button" onClick={onBack} className="flex w-fit items-center gap-1 text-xs font-medium text-white/70 transition-colors hover:text-white">
              <ChevronLeft className="h-3.5 w-3.5" /> Todos os clientes
            </button>

            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
              <div className="flex min-w-[16rem] items-center gap-3">
                <div className="relative shrink-0">
                  <div className="absolute -inset-[3px] rounded-full" style={{ background: "linear-gradient(135deg, hsl(var(--brand-glow-6)), hsl(var(--brand-glow-7)), hsl(var(--brand-glow-5)))", opacity: 0.9, animation: "spin 6s linear infinite" }} />
                  <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white/15 text-base font-bold text-white ring-2 ring-white/20">
                    {client.logo_url ? <img src={toGridThumbUrl(client.logo_url)} alt="" className="h-full w-full object-cover" /> : client.name.trim().charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold tracking-tight text-white drop-shadow-sm">{client.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
                    <span className="flex items-center gap-1.5 truncate">
                      <Instagram className="h-3.5 w-3.5 shrink-0" /> {username ? `@${username}` : "Instagram não conectado"}
                    </span>
                    {client.plan_name && <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] text-white/85">{client.plan_name}</span>}
                  </div>
                </div>
              </div>

              <nav className="flex max-w-full gap-1 overflow-x-auto rounded-full bg-white/15 p-1 backdrop-blur">
                {SECTIONS.map((s) => {
                  const active = s.key === section;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSection(s.key)}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        active ? "bg-white text-violet-700 shadow-sm" : "text-white/80 hover:text-white",
                      )}
                    >
                      <s.icon className="h-4 w-4" />
                      {s.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </header>
      </div>

      {!client.is_active && (
        <p className="rounded-2xl border border-border/40 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Contrato encerrado{client.ended_at ? ` em ${new Date(client.ended_at.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}` : ""}. Os posts já agendados continuam no Cronograma; se algum não deve mais sair, desmarque o agendamento nele.
        </p>
      )}

      <main className="min-w-0">
        {section === "cronograma" && <CalendarioPublicacaoPanel
            fixedClientId={clientId}
            onOpenTask={openTask}
            focusRequest={focusRequest}
            onFocusHandled={() => { setFocusRequest(null); setPendingCalendarioFocus(null); }}
          />}
        {section === "resultados" && <ClientResults clientId={clientId} clientName={client.name} logoUrl={client.logo_url ?? null} username={username} />}
        {section === "documentos" && <ClienteDocumentos clientId={clientId} />}
        {section === "configuracoes" && <ClienteConfiguracoes clientId={clientId} />}
      </main>
    </div>
  );
}
