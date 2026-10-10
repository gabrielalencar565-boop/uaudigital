import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarCheck, CalendarPlus, CalendarX, ChevronLeft, Download, ChevronRight, Clock, Loader2, MousePointerClick, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { downloadIcs, googleCalendarUrl, type CalendarEvent } from "@/lib/calendar-links";

const FN_URL = "https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/public-agendamento";

type DayStatus = "free" | "full" | "closed";
type MonthData = { agency_name: string; open_months: string[]; days: Record<string, DayStatus> };
type Booking = { id: string; booking_date: string; start_time: string; duration_minutes: number; company_name: string; location?: string | null; status: "pending" | "confirmed" | "refused" | "cancelled" };

const hhmm = (t: string) => t.slice(0, 5);
const durationLabel = (min: number) => (min % 60 === 0 ? `${min / 60}h` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`);
const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

const ERRORS: Record<string, string> = {
  day_full: "Esse dia acabou de lotar. Escolha outra data.",
  day_closed: "Esse dia não está mais disponível. Escolha outra data.",
  slot_taken: "Esse horário acabou de ser reservado. Escolha outro.",
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

// Client-facing page to book a recording day, in the Fluxo identity (dark, violet gradient, Bricolage). It only knows
// whether a day is free, full or closed.
export default function AgendarPublic() {
  const { token } = useParams<{ token: string }>();
  const [month, setMonth] = useState(() => monthKeyOf(new Date()));
  const [data, setData] = useState<MonthData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[] | null>(null); // null = loading the times of the chosen day
  const [duration, setDuration] = useState(120);
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
    const apply = () => { root.classList.remove("light", "dark"); root.classList.add("dark"); };
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
    if ((payload as any).duration_minutes) setDuration((payload as any).duration_minutes);
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

  // The booking as an event for the client's own calendar (Google link and .ics file)
  const calendarEvent: CalendarEvent | null = mine
    ? {
        date: mine.booking_date,
        startTime: hhmm(mine.start_time),
        durationMinutes: mine.duration_minutes,
        uid: mine.id,
        title: `Gravação — ${data?.agency_name || "Agência"}`,
        location: mine.location ?? null,
        description: [
          `Captação de conteúdo com ${data?.agency_name || "a agência"}, às ${hhmm(mine.start_time)} (duração aproximada de ${durationLabel(mine.duration_minutes)}).`,
                    mine.status === "pending" ? "Pedido enviado: aguardando a confirmação da agência." : "Confirmada pela agência.",
        ].join("\n"),
      }
    : null;

  const openMonths = useMemo(() => [...(data?.open_months ?? [])].sort(), [data]);
  const idx = openMonths.indexOf(month);
  const [yy, mm] = month.split("-").map(Number);
  const firstWeekday = new Date(yy, mm - 1, 1).getDay();
  const daysInMonth = new Date(yy, mm, 0).getDate();

  // Choosing a day loads the start times still free on it
  const pickDate = async (ymd: string) => {
    if (!token) return;
    setDate(ymd);
    setTime(null);
    setSlots(null);
    setError(null);
    const { ok, data: body } = await call({ action: "slots", token, date: ymd });
    setSlots(ok ? ((body as any).slots as string[]) : []);
    if (ok && (body as any).duration_minutes) setDuration((body as any).duration_minutes);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !date || !time) return;
    setSubmitting(true);
    setError(null);
    const { ok, data: body } = await call({ action: "book", token, date, start_time: time, ...form });
    setSubmitting(false);
    if (!ok) {
      setError(ERRORS[(body as any).error] ?? "Não foi possível enviar agora. Tente de novo em instantes.");
      if ((body as any).error === "day_full" || (body as any).error === "day_closed") { setDate(null); setTime(null); void load(month); }
      if ((body as any).error === "slot_taken") { setTime(null); void pickDate(date); void load(month); }
      return;
    }
    const cancelToken = (body as any).cancel_token as string | undefined;
    if (cancelToken) {
      try { localStorage.setItem(storageKey, cancelToken); } catch { /* private mode */ }
      const got = await call({ action: "get", token, cancel_token: cancelToken });
      if (got.ok) setMine((got.data as any).booking);
    }
    setDate(null);
    setTime(null);
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

  const shell = (children: React.ReactNode) => (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0B0B0B] px-4 py-8 text-white sm:py-12">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 45% at 50% -5%, rgba(124,58,237,0.28), transparent 70%), radial-gradient(ellipse 40% 30% at 90% 15%, rgba(200,107,230,0.10), transparent 70%)" }} />
      <div className="relative mx-auto w-full max-w-4xl">{children}</div>
    </div>
  );

  if (state === "loading") return shell(<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>);
  if (state === "missing") {
    return shell(
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 text-center">
        <img src="/branding/fluxo-logo-white.svg" alt="Fluxo" className="mb-4 h-9 w-auto opacity-90" />
        <SearchX className="h-10 w-10 text-white/40" />
        <p className="text-lg font-semibold">Link indisponível</p>
        <p className="max-w-xs text-sm text-white/50">Esse link de agendamento não existe ou foi desativado. Peça um novo para a agência.</p>
      </div>,
    );
  }

  const noOpenMonths = openMonths.length === 0;
  const inputCls = "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus-visible:border-violet-400/60 focus-visible:ring-violet-500/30";
  const card = "rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-6";

  return shell(
    <>
      <header className="mb-8 flex flex-col items-center gap-5 text-center">
        <img src="/branding/fluxo-logo-white.svg" alt="Fluxo" className="h-9 w-auto" />
        <div className="space-y-2">
          {data?.agency_name && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" /> {data.agency_name}
            </span>
          )}
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Agende sua{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, #a78bfa 0%, #c86be6 55%, #f5b27a 100%)" }}>captação</span>
          </h1>
          <p className="mx-auto max-w-md text-sm text-white/55">Escolha um dia livre para a gravação. A gente confirma com você pelo WhatsApp.</p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr] lg:items-start">
        <section className={card}>
          {noOpenMonths ? (
            <p className="py-10 text-center text-sm text-white/50">Ainda não há datas abertas para agendamento. Fale com a agência.</p>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-25" disabled={idx <= 0} onClick={() => { setMonth(openMonths[idx - 1]); setDate(null); setTime(null); }} aria-label="Mês anterior">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-base font-semibold first-letter:uppercase">{MONTH_NAMES[mm - 1]} de {yy}</p>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-25" disabled={idx < 0 || idx >= openMonths.length - 1} onClick={() => { setMonth(openMonths[idx + 1]); setDate(null); setTime(null); }} aria-label="Próximo mês">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className={cn("grid grid-cols-7 gap-1.5 transition-opacity sm:gap-2", loadingMonth && "opacity-50")}>
                {WEEKDAYS.map((w, i) => <span key={i} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-white/35">{w}</span>)}
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
                      onClick={() => void pickDate(ymd)}
                      title={status === "full" ? "Dia lotado" : status === "closed" ? "Indisponível" : "Disponível"}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-2xl text-sm font-semibold transition-all",
                        status === "free" && !selected && "border border-violet-400/25 bg-violet-500/10 text-violet-100 hover:-translate-y-0.5 hover:border-violet-300/60 hover:bg-violet-500/25",
                        status === "free" && selected && "border border-transparent text-white shadow-lg shadow-violet-600/40",
                        status === "full" && "cursor-not-allowed bg-white/[0.04] text-white/30 line-through",
                        status === "closed" && "cursor-not-allowed text-white/15",
                      )}
                      style={status === "free" && selected ? { background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 55%, #c86be6 100%)" } : undefined}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-white/45">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-md border border-violet-400/40 bg-violet-500/30" /> Livre</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-md bg-white/15" /> Lotado</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-md bg-white/5" /> Indisponível</span>
              </div>
            </>
          )}
        </section>

        <div className="space-y-5">
          {mine && (
            <div className="space-y-3 rounded-3xl border border-emerald-400/25 bg-emerald-400/10 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-400/20 text-emerald-300"><CalendarCheck className="h-5 w-5" /></span>
                <div className="min-w-0 text-sm">
                  <p className="text-base font-semibold">{mine.status === "confirmed" ? "Captação confirmada" : "Pedido enviado"}</p>
                  <p className="text-white/70 first-letter:uppercase">{fmtDate(mine.booking_date)} às {hhmm(mine.start_time)}</p>
                  {mine.status === "pending" && <p className="mt-1 text-xs text-white/50">Aguardando a confirmação da agência. Vamos te chamar no WhatsApp.</p>}
                </div>
              </div>
              {calendarEvent && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Colocar na minha agenda</p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" className="rounded-full bg-white text-black hover:bg-white/90">
                      <a href={googleCalendarUrl(calendarEvent)} target="_blank" rel="noreferrer"><CalendarPlus className="mr-1.5 h-3.5 w-3.5" /> Google Agenda</a>
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => downloadIcs(calendarEvent)}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Apple / Outlook (.ics)
                    </Button>
                  </div>
                </div>
              )}
              <Button variant="outline" size="sm" className="rounded-full border-white/15 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={cancel} disabled={cancelling}>
                <CalendarX className="mr-1.5 h-3.5 w-3.5" /> {cancelling ? "Cancelando…" : "Cancelar este pedido"}
              </Button>
            </div>
          )}

          {date ? (
            <form onSubmit={submit} className={cn(card, "space-y-5")}>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Dia escolhido</p>
                <p className="text-lg font-semibold first-letter:uppercase">{fmtDate(date)}</p>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  <Clock className="h-3.5 w-3.5" /> Escolha o horário <span className="font-normal normal-case tracking-normal text-white/35">· duração de cerca de {durationLabel(duration)}</span>
                </p>
                {slots === null ? (
                  <p className="flex items-center gap-2 py-3 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" /> Buscando horários…</p>
                ) : slots.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-white/55">Não há mais horários nesse dia. Escolha outra data.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {slots.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTime(t)}
                        aria-pressed={time === t}
                        className={cn("rounded-xl border px-2 py-2.5 text-sm font-semibold tabular-nums transition", time === t ? "border-violet-400/70 bg-violet-500/25 text-white shadow-lg shadow-violet-600/20" : "border-white/10 bg-white/[0.03] text-white/75 hover:bg-white/[0.08]")}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="company" className="text-white/70">Empresa *</Label>
                  <Input id="company" required maxLength={120} value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Nome da sua empresa" className={inputCls} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact" className="text-white/70">Seu nome</Label>
                    <Input id="contact" maxLength={120} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="whats" className="text-white/70">WhatsApp *</Label>
                    <Input id="whats" required inputMode="tel" maxLength={20} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="(62) 99999-9999" className={inputCls} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="loc" className="text-white/70">Onde vai ser a gravação</Label>
                  <Input id="loc" maxLength={300} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Endereço ou local" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="notes" className="text-white/70">Observações</Label>
                  <Textarea id="notes" rows={3} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="O que você quer gravar, horário preferido…" className={inputCls} />
                </div>
                {/* Honeypot: invisible to people, bots fill it */}
                <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="absolute left-[-9999px] h-0 w-0 opacity-0" />
              </div>

              {error && <p className="rounded-2xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>}

              <Button
                type="submit"
                className="h-12 w-full rounded-2xl text-base font-semibold text-white shadow-lg shadow-violet-700/30 hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #7C3AED 0%, #9333EA 50%, #7C3AED 100%)" }}
                disabled={!time || submitting}
              >
                {submitting ? "Enviando…" : time ? `Pedir ${time}` : "Escolha um horário"}
              </Button>
            </form>
          ) : (
            !mine && (
              <div className={cn(card, "space-y-5")}>
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-violet-500/15 text-violet-300"><MousePointerClick className="h-5 w-5" /></span>
                  <p className="text-base font-semibold">Como funciona</p>
                </div>
                <ol className="space-y-3 text-sm text-white/60">
                  {["Escolha um dia livre no calendário.", "Diga se prefere manhã ou tarde e deixe seus dados.", "A agência confirma com você pelo WhatsApp."].map((t, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.07] text-xs font-bold text-violet-300">{i + 1}</span>
                      <span className="pt-0.5">{t}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )
          )}

          {!date && error && <p className="rounded-2xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-center text-sm text-red-200">{error}</p>}
        </div>
      </div>

      <footer className="mt-10 flex items-center justify-center gap-2 text-[11px] text-white/30">
        <span>Agendamento por</span>
        <img src="/branding/fluxo-logo-white.svg" alt="Fluxo" className="h-4 w-auto opacity-50" />
      </footer>
    </>,
  );
}
