import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarCheck, CalendarX, ChevronLeft, ChevronRight, Loader2, SearchX, Sun, Sunset } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const FN_URL = "https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/public-agendamento";

type DayStatus = "free" | "full" | "closed";
type MonthData = { agency_name: string; open_months: string[]; days: Record<string, DayStatus> };
type Booking = { id: string; booking_date: string; period: "manha" | "tarde"; company_name: string; status: "pending" | "confirmed" | "refused" | "cancelled" };

const PERIOD_LABEL = { manha: "Manhã", tarde: "Tarde" } as const;
const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const ERRORS: Record<string, string> = {
  day_full: "Esse dia acabou de lotar. Escolha outra data.",
  day_closed: "Esse dia não está mais disponível. Escolha outra data.",
  too_many_requests: "Você já tem pedidos em aberto. Fale com a gente para ajustar.",
  invalid_whatsapp: "Confira o WhatsApp: use o DDD e o número.",
  company_required: "Informe o nome da empresa.",
};

async function call(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

const fmtDate = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// Client-facing page to book a recording day. Always light, like the other public pages; it only knows whether a day is
// free, full or closed.
export default function AgendarPublic() {
  const { token } = useParams<{ token: string }>();
  const [month, setMonth] = useState(() => monthKeyOf(new Date()));
  const [data, setData] = useState<MonthData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [period, setPeriod] = useState<"manha" | "tarde" | null>(null);
  const [form, setForm] = useState({ company_name: "", contact_name: "", whatsapp: "", location: "", notes: "", website: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mine, setMine] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const originalTheme = useRef<"light" | "dark" | null>(null);
  const storageKey = `fluxo-capture-${token}`;

  useEffect(() => {
    const root = document.documentElement;
    if (originalTheme.current === null) originalTheme.current = root.classList.contains("dark") ? "dark" : "light";
    const apply = () => { root.classList.remove("light", "dark"); root.classList.add("light"); };
    apply();
    const timer = setTimeout(apply, 0);
    return () => {
      clearTimeout(timer);
      root.classList.remove("light", "dark");
      root.classList.add(originalTheme.current ?? "light");
    };
  }, []);

  const load = useCallback(async (m: string, first = false) => {
    if (!token) return;
    setLoadingMonth(true);
    const { ok, data: body } = await call({ action: "load", token, month: m });
    setLoadingMonth(false);
    if (!ok) { if (first) setState("missing"); return; }
    const payload = body as MonthData;
    // Opened on a month that is not open: jump to the first open one
    if (first && payload.open_months.length > 0 && !payload.open_months.includes(m)) {
      const next = [...payload.open_months].sort().find((x) => x >= m) ?? [...payload.open_months].sort().slice(-1)[0];
      if (next && next !== m) { setMonth(next); return; }
    }
    setData(payload);
    setState("ready");
  }, [token]);

  useEffect(() => { void load(month, state === "loading"); }, [month, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // The booking this browser made earlier, if any
  useEffect(() => {
    if (!token) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); } catch { /* private mode */ }
    if (!saved) return;
    void call({ action: "get", token, cancel_token: saved }).then(({ ok, data: body }) => {
      if (ok && (body as any).booking && ["pending", "confirmed"].includes((body as any).booking.status)) setMine((body as any).booking);
    });
  }, [token, storageKey]);

  const openMonths = useMemo(() => [...(data?.open_months ?? [])].sort(), [data]);
  const idx = openMonths.indexOf(month);
  const [yy, mm] = month.split("-").map(Number);
  const firstWeekday = new Date(yy, mm - 1, 1).getDay();
  const daysInMonth = new Date(yy, mm, 0).getDate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !date || !period) return;
    setSubmitting(true);
    setError(null);
    const { ok, data: body } = await call({ action: "book", token, date, period, ...form });
    setSubmitting(false);
    if (!ok) {
      setError(ERRORS[(body as any).error] ?? "Não foi possível enviar agora. Tente de novo em instantes.");
      if ((body as any).error === "day_full" || (body as any).error === "day_closed") { setDate(null); setPeriod(null); void load(month); }
      return;
    }
    const cancelToken = (body as any).cancel_token as string | undefined;
    if (cancelToken) {
      try { localStorage.setItem(storageKey, cancelToken); } catch { /* private mode */ }
      const got = await call({ action: "get", token, cancel_token: cancelToken });
      if (got.ok) setMine((got.data as any).booking);
    }
    setDate(null);
    setPeriod(null);
    setForm({ company_name: "", contact_name: "", whatsapp: "", location: "", notes: "", website: "" });
    void load(month);
  };

  const cancel = async () => {
    if (!token) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(storageKey); } catch { /* private mode */ }
    if (!saved) return;
    setCancelling(true);
    const { ok, data: body } = await call({ action: "cancel", token, cancel_token: saved });
    setCancelling(false);
    if (!ok) { setError(((body as any).error === "too_late") ? "Faltam menos de 24h: fale com a gente para cancelar." : "Não foi possível cancelar agora."); return; }
    try { localStorage.removeItem(storageKey); } catch { /* private mode */ }
    setMine(null);
    void load(month);
  };

  if (state === "loading") return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (state === "missing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-semibold">Link indisponível</p>
        <p className="max-w-xs text-sm text-muted-foreground">Esse link de agendamento não existe ou foi desativado. Peça um novo para a agência.</p>
      </div>
    );
  }

  const noOpenMonths = openMonths.length === 0;

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">
        <header className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{data?.agency_name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Agende sua captação</h1>
          <p className="text-sm text-muted-foreground">Escolha um dia livre para a gravação. A gente confirma com você pelo WhatsApp.</p>
        </header>

        {mine && (
          <div className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{mine.status === "confirmed" ? "Captação confirmada" : "Pedido enviado"}</p>
                <p className="text-muted-foreground first-letter:uppercase">{fmtDate(mine.booking_date)} · {PERIOD_LABEL[mine.period]}</p>
                {mine.status === "pending" && <p className="mt-1 text-xs text-muted-foreground">Aguardando a confirmação da agência.</p>}
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-full" onClick={cancel} disabled={cancelling}>
              <CalendarX className="mr-1.5 h-3.5 w-3.5" /> {cancelling ? "Cancelando…" : "Cancelar este pedido"}
            </Button>
          </div>
        )}

        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
          {noOpenMonths ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Ainda não há datas abertas para agendamento. Fale com a agência.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={idx <= 0} onClick={() => { setMonth(openMonths[idx - 1]); setDate(null); setPeriod(null); }} aria-label="Mês anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-semibold first-letter:uppercase">{MONTH_NAMES[mm - 1]} de {yy}</p>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={idx < 0 || idx >= openMonths.length - 1} onClick={() => { setMonth(openMonths[idx + 1]); setDate(null); setPeriod(null); }} aria-label="Próximo mês">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className={cn("grid grid-cols-7 gap-1 transition-opacity", loadingMonth && "opacity-50")}>
                {WEEKDAYS.map((w, i) => <span key={i} className="pb-1 text-center text-[11px] font-semibold text-muted-foreground">{w}</span>)}
                {Array.from({ length: firstWeekday }).map((_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const ymd = `${month}-${String(day).padStart(2, "0")}`;
                  const status = data?.days[ymd] ?? "closed";
                  const selected = date === ymd;
                  return (
                    <button
                      key={ymd}
                      type="button"
                      disabled={status !== "free"}
                      onClick={() => { setDate(ymd); setPeriod(null); setError(null); }}
                      title={status === "full" ? "Dia lotado" : status === "closed" ? "Indisponível" : "Disponível"}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-xl text-sm font-medium transition",
                        status === "free" && !selected && "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20",
                        status === "free" && selected && "bg-primary text-primary-foreground shadow",
                        status === "full" && "cursor-not-allowed bg-muted text-muted-foreground/60 line-through",
                        status === "closed" && "cursor-not-allowed text-muted-foreground/30",
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500/40" /> Livre</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" /> Lotado</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/10" /> Indisponível</span>
              </div>
            </>
          )}
        </section>

        {date && (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dia escolhido</p>
              <p className="text-base font-semibold first-letter:uppercase">{fmtDate(date)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["manha", "tarde"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  aria-pressed={period === p}
                  className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition", period === p ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent/40")}
                >
                  {p === "manha" ? <Sun className="h-4 w-4" /> : <Sunset className="h-4 w-4" />} {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="company">Empresa *</Label>
                <Input id="company" required maxLength={120} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Nome da sua empresa" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contact">Seu nome</Label>
                  <Input id="contact" maxLength={120} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="whats">WhatsApp *</Label>
                  <Input id="whats" required inputMode="tel" maxLength={20} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(62) 99999-9999" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc">Onde vai ser a gravação</Label>
                <Input id="loc" maxLength={300} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Endereço ou local" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Observações</Label>
                <Textarea id="notes" rows={3} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="O que você quer gravar, horário preferido…" />
              </div>
              {/* Honeypot: invisible to people, bots fill it */}
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="absolute left-[-9999px] h-0 w-0 opacity-0" />
            </div>

            {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full rounded-full" disabled={!period || submitting}>
              {submitting ? "Enviando…" : period ? "Pedir este dia" : "Escolha manhã ou tarde"}
            </Button>
          </form>
        )}

        {!date && error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
}
