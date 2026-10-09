import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, MessageSquareWarning } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { useMagicNumberConfig } from "@/features/data/queries";
import { getFixedAssignee, useDefaultFlowWithDates } from "@/features/gestao/components/PmStageFlowConfig";
import { anchorForDate, cycleEnd, cycleStart } from "@/features/calendario/components/CalendarioPublicacaoPanel";
import { openTaskInCalendario } from "@/features/calendario/open-in-calendario";

const sb = supabase as any;
const COLLAPSED_ROWS = 6;

type Pub = {
  id: string;
  task_id: string;
  status: "aprovada" | "alteracao_solicitada" | "aguardando_aprovacao" | "em_montagem";
  client_feedback: string | null;
  client_responded_at: string | null;
  publication_calendars: { client_id: string } | null;
  pm_tasks: { title: string } | null;
};

function timeAgo(ts: string) {
  const min = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

// What the clients answered on their Cronograma in the chosen month (cycle): change requests one by one, approvals folded into
// one row per client, plus how many publications are still waiting for an answer. Click a row to open it in the Cronograma.
export function ClientCronogramaWidget() {
  const { user } = useSession();
  const { day: magicDay } = useMagicNumberConfig();
  const { stageAssignees } = useDefaultFlowWithDates();
  const [cursor, setCursor] = useState(() => anchorForDate(new Date(), magicDay));
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [expanded, setExpanded] = useState(false);

  const start = cycleStart(cursor, magicDay);
  const end = cycleEnd(cursor, magicDay);
  const cycleKey = format(start, "yyyy-MM-dd");
  const monthRaw = format(end, "MMMM", { locale: ptBR });
  const monthLabel = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
  const isCurrent = format(anchorForDate(new Date(), magicDay), "yyyy-MM") === format(cursor, "yyyy-MM");

  const pubsQ = useQuery({
    queryKey: ["client_cronograma_widget", cycleKey],
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<Pub[]> => {
      const { data, error } = await sb
        .from("calendar_publications")
        .select("id, task_id, status, client_feedback, client_responded_at, publication_calendars!inner(client_id, cycle_start), pm_tasks!inner(title)")
        .eq("publication_calendars.cycle_start", cycleKey)
        .is("deleted_at", null)
        .in("status", ["aprovada", "alteracao_solicitada", "aguardando_aprovacao"])
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Pub[];
    },
  });

  const clientsQ = useQuery({
    queryKey: ["client_cronograma_widget_clients"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await sb.from("clients").select("id, name, logo_url").eq("is_active", true).eq("is_freelancer_sentinel", false);
      return new Map<string, { name: string; logo: string | null }>(
        ((data ?? []) as { id: string; name: string; logo_url: string | null }[]).map((c) => [c.id, { name: c.name, logo: c.logo_url }]),
      );
    },
  });

  const myClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const clientId of clientsQ.data?.keys() ?? []) {
      if (getFixedAssignee(stageAssignees, "planejamento", clientId) === user?.id) ids.add(clientId);
    }
    return ids;
  }, [clientsQ.data, stageAssignees, user?.id]);
  // someone with no clients of their own sees everyone's instead of an empty card
  const effectiveScope = scope === "mine" && myClientIds.size === 0 ? "all" : scope;

  const visible = useMemo(() => {
    const names = clientsQ.data ?? new Map<string, { name: string; logo: string | null }>();
    return (pubsQ.data ?? []).filter((p) => {
      const cid = p.publication_calendars?.client_id;
      return !!cid && names.has(cid) && (effectiveScope === "all" || myClientIds.has(cid));
    });
  }, [pubsQ.data, clientsQ.data, effectiveScope, myClientIds]);

  type Row =
    | { kind: "change"; key: string; pub: Pub; at: string }
    | { kind: "approved"; key: string; pubs: Pub[]; latest: Pub; at: string };
  const { rows, changes, approved, waiting } = useMemo(() => {
    const replied = visible.filter((p) => p.status !== "aguardando_aprovacao");
    const stamp = (p: Pub) => new Date(p.client_responded_at ?? 0).getTime();
    const changeRows: Row[] = replied
      .filter((p) => p.status === "alteracao_solicitada")
      .map((p) => ({ kind: "change", key: p.id, pub: p, at: p.client_responded_at ?? "" }));
    const byClient = new Map<string, Pub[]>();
    for (const p of replied.filter((p) => p.status === "aprovada")) {
      const cid = p.publication_calendars!.client_id;
      byClient.set(cid, [...(byClient.get(cid) ?? []), p]);
    }
    const approvedRows: Row[] = [...byClient.entries()].map(([cid, pubs]) => {
      const latest = [...pubs].sort((a, b) => stamp(b) - stamp(a))[0];
      return { kind: "approved", key: `ok-${cid}`, pubs, latest, at: latest.client_responded_at ?? "" };
    });
    const byRecent = (a: Row, b: Row) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime();
    return {
      // change requests block the work, so they come first
      rows: [...changeRows.sort(byRecent), ...approvedRows.sort(byRecent)],
      changes: changeRows.length,
      approved: replied.length - changeRows.length,
      waiting: visible.length - replied.length,
    };
  }, [visible]);

  const clientOf = (p: Pub) => clientsQ.data?.get(p.publication_calendars?.client_id ?? "") ?? { name: "Cliente", logo: null };
  const shown = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  const shiftMonth = (delta: number) => {
    setCursor((a) => new Date(a.getFullYear(), a.getMonth() + delta, 1));
    setExpanded(false);
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-0 px-5 pb-3 pt-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <CalendarRange className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm">Cronograma dos clientes</CardTitle>
          <div className="ml-auto flex shrink-0 rounded-full bg-muted p-0.5 text-[11px] font-semibold">
            {(["mine", "all"] as const).map((sc) => (
              <button
                key={sc}
                type="button"
                onClick={() => setScope(sc)}
                disabled={sc === "mine" && myClientIds.size === 0}
                className={cn(
                  "rounded-full px-2.5 py-0.5 transition disabled:cursor-not-allowed disabled:opacity-40",
                  effectiveScope === sc ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {sc === "mine" ? "Meus clientes" : "Todos"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="Mês anterior" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground/70 transition hover:bg-accent hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[8.5rem] text-center">
              <span className="block text-sm font-semibold leading-tight">{monthLabel}</span>
              <span className="block text-[10px] text-muted-foreground">{format(start, "dd/MM")} a {format(end, "dd/MM")}</span>
            </span>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Próximo mês" className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-foreground/70 transition hover:bg-accent hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {!isCurrent && (
            <button type="button" onClick={() => { setCursor(anchorForDate(new Date(), magicDay)); setExpanded(false); }} className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold text-primary transition hover:bg-primary/25">
              Mês atual
            </button>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <Dot color="bg-amber-500" value={changes} label={changes === 1 ? "alteração pedida" : "alterações pedidas"} />
            <Dot color="bg-emerald-500" value={approved} label={approved === 1 ? "aprovada" : "aprovadas"} />
            <Dot color="bg-muted-foreground/50" value={waiting} label="aguardando resposta" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-2 pb-3">
        {pubsQ.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma resposta dos clientes em {monthLabel}.</p>
        ) : (
          <div className="divide-y divide-border/40">
            {shown.map((r) => {
              const isChange = r.kind === "change";
              const pub = r.kind === "change" ? r.pub : r.latest;
              const client = clientOf(pub);
              const count = r.kind === "approved" ? r.pubs.length : 1;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => openTaskInCalendario(pub.task_id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-accent/30"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground ring-1 ring-border/60">
                    {client.logo ? <img src={client.logo} alt="" loading="lazy" className="h-full w-full object-cover" /> : client.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold leading-tight">{client.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {isChange
                        ? (pub.client_feedback?.trim() ? `“${pub.client_feedback.trim()}”` : pub.pm_tasks?.title)
                        : count > 1 ? `${count} publicações` : pub.pm_tasks?.title}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      isChange ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500",
                    )}>
                      {isChange ? <MessageSquareWarning className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                      {isChange ? "Alteração" : count > 1 ? `Aprovou ${count}` : "Aprovou"}
                    </span>
                    {r.at && <span className="text-[11px] text-muted-foreground/70">{timeAgo(r.at)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {rows.length > COLLAPSED_ROWS && (
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mx-auto mt-2 rounded-full px-3 py-1 text-[11px] font-semibold text-muted-foreground transition hover:bg-accent/40 hover:text-foreground">
            {expanded ? "Mostrar menos" : `Mostrar todas (${rows.length})`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function Dot({ color, value, label }: { color: string; value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
      {label}
    </span>
  );
}
