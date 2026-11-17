import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Film, Image as ImageIcon, Instagram } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useHeldPublications, useInstagramConnections, useResolveHeldPublications, type HeldDecision, type HeldPublication } from "@/features/calendario/hooks/use-instagram";

type Choice = "pub" | "re" | "cancel";
type State = { choice?: Choice; date: string; time: string };

const OPTIONS: { key: Choice; label: string }[] = [
  { key: "pub", label: "Publicar agora" },
  { key: "re", label: "Reagendar" },
  { key: "cancel", label: "Cancelar" },
];

const scheduledAt = (date: string, time: string) => new Date(`${date}T${time.length === 5 ? `${time}:00` : time}-03:00`);
const isVideo = (url: string | null) => !!url && /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);

function lateLabel(p: HeldPublication) {
  const days = differenceInCalendarDays(new Date(), scheduledAt(p.publish_date, p.publish_time));
  return days <= 0 ? "atrasado hoje" : days === 1 ? "atrasado 1 dia" : `atrasado ${days} dias`;
}

/**
 * Posts que ficaram agendados e atrasados enquanto o Instagram do cliente estava desconectado. Ao reconectar eles entram "em espera"
 * (o cron não publica) e esta janela deixa escolher, post a post, publicar agora, reagendar ou cancelar o agendamento.
 * "Decidir depois" fecha sem mexer em nada; ela volta a aparecer na próxima vez que o cliente for aberto.
 */
export function InstagramHeldPostsDialog({ clientId, clientName }: { clientId: string; clientName: string }) {
  const connQ = useInstagramConnections(clientId);
  const active = (connQ.data ?? []).some((c) => c.client_id === clientId && c.status === "active");
  const heldQ = useHeldPublications(active ? clientId : null);
  const resolve = useResolveHeldPublications(clientId);
  const held = heldQ.data ?? [];
  const [dismissed, setDismissed] = useState(false);
  const [state, setState] = useState<Record<string, State>>({});
  const [erro, setErro] = useState("");

  useEffect(() => { setDismissed(false); }, [clientId]);
  useEffect(() => {
    setState((prev) => {
      const next: Record<string, State> = {};
      held.forEach((p) => { next[p.id] = prev[p.id] ?? { date: "", time: p.publish_time.slice(0, 5) }; });
      const same = Object.keys(next).length === Object.keys(prev).length && Object.keys(next).every((k) => prev[k] === next[k]);
      return same ? prev : next;
    });
  }, [heldQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = active && held.length > 0 && !dismissed;
  const counts = useMemo(() => {
    const c = { pub: 0, re: 0, cancel: 0, none: 0 };
    held.forEach((p) => { const ch = state[p.id]?.choice; if (ch) c[ch]++; else c.none++; });
    return c;
  }, [held, state]);

  const setChoice = (id: string, choice: Choice) => { setErro(""); setState((s) => ({ ...s, [id]: { ...s[id], choice } })); };
  const setAll = (choice: Choice) => { setErro(""); setState((s) => Object.fromEntries(held.map((p) => [p.id, { ...s[p.id], choice }]))); };

  const apply = () => {
    const decisions: HeldDecision[] = [];
    for (const p of held) {
      const st = state[p.id];
      if (!st?.choice) continue;
      if (st.choice === "re") {
        if (!st.date || !st.time) return setErro(`Escolha a nova data e hora de "${p.title}".`);
        if (scheduledAt(st.date, st.time).getTime() <= Date.now()) return setErro(`A nova data de "${p.title}" precisa ser no futuro.`);
        decisions.push({ id: p.id, action: "re", date: st.date, time: st.time });
      } else decisions.push({ id: p.id, action: st.choice });
    }
    if (decisions.length === 0) return setErro("Escolha o que fazer com pelo menos um post.");
    resolve.mutate(decisions);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setDismissed(true); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Instagram className="h-5 w-5" /> Instagram reconectado: {clientName}</DialogTitle>
          <DialogDescription>
            {held.length === 1 ? "1 post ficou agendado" : `${held.length} posts ficaram agendados`} enquanto a conta estava desconectada. Nada será publicado até você escolher.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setAll("pub")}>Publicar todos</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setAll("cancel")}>Cancelar todos</Button>
        </div>

        <div className="divide-y divide-border/50">
          {held.map((p) => {
            const st = state[p.id];
            return (
              <div key={p.id} className="flex items-start gap-3 py-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
                  {p.cover_url && !isVideo(p.cover_url)
                    ? <img src={p.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    : isVideo(p.cover_url) || p.content_type === "reel" || p.content_type === "video" ? <Film className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{p.title || "Sem título"}</span>
                    <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">{lateLabel(p)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Era para {format(scheduledAt(p.publish_date, p.publish_time), "EEE dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                  <div className="inline-flex overflow-hidden rounded-lg border border-border">
                    {OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => setChoice(p.id, o.key)}
                        className={cn(
                          "border-r border-border px-3 py-1.5 text-xs last:border-r-0 transition-colors",
                          st?.choice === o.key
                            ? o.key === "cancel" ? "bg-destructive/15 font-medium text-destructive" : "bg-primary/15 font-medium text-primary"
                            : "text-muted-foreground hover:bg-muted/50",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {st?.choice === "re" && (
                    <div className="flex items-center gap-2 pt-1">
                      <Input type="date" className="h-8 w-40" value={st.date} onChange={(e) => { setErro(""); setState((s) => ({ ...s, [p.id]: { ...s[p.id], date: e.target.value } })); }} />
                      <Input type="time" className="h-8 w-28" value={st.time} onChange={(e) => { setErro(""); setState((s) => ({ ...s, [p.id]: { ...s[p.id], time: e.target.value } })); }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {erro && <p className="text-sm text-destructive">{erro}</p>}
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {counts.pub} publicar, {counts.re} reagendar, {counts.cancel} cancelar{counts.none > 0 ? `, ${counts.none} sem escolha (continuam em espera)` : ""}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setDismissed(true)}>Decidir depois</Button>
            <Button type="button" onClick={apply} disabled={resolve.isPending}>Aplicar escolhas</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
