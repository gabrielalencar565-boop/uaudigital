import { useEffect, useMemo, useState } from "react";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, CalendarCheck, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Link2, MapPin, MessageCircle, RefreshCw, Settings2, Clock, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useClients, useTeamMembers } from "@/features/data/queries";
import { useAddTaskAssignees } from "@/features/data/task-assignees-queries";
import { useStageFlows } from "@/features/gestao/components/PmStageFlowConfig";
import {
  CAPTURE_DEFAULTS, captureLink, hhmm, hoursOfWeekday, timeRange, useCaptureBlocks, useCaptureBookings, useCaptureSettings, useSaveCaptureSettings, useToggleCaptureBlock, useUpdateCaptureBooking,
  type CaptureBooking, type CaptureSettings,
} from "../hooks/use-capture";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const WEEKDAY_HEAD = ["D", "S", "T", "Q", "Q", "S", "S"];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
const fmtLong = (ymd: string) => format(new Date(`${ymd}T12:00:00`), "EEEE, dd 'de' MMMM", { locale: ptBR });
const fmtShort = (ymd: string) => format(new Date(`${ymd}T12:00:00`), "dd/MM (EEE)", { locale: ptBR });
const todayKey = () => format(new Date(), "yyyy-MM-dd");

function whatsappUrl(number: string, text: string) {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}?text=${encodeURIComponent(text)}`;
}

/** Number of requests waiting for an answer (for the badge on the sub-tab). */
export function usePendingCaptureCount() {
  const q = useCaptureBookings();
  return (q.data ?? []).filter((b) => b.status === "pending").length;
}

// ───────────────────────── Rules and link (admins) ─────────────────────────

function RulesCard({ settings }: { settings: CaptureSettings | null }) {
  const save = useSaveCaptureSettings();
  const [open, setOpen] = useState(!settings?.enabled);
  const [draft, setDraft] = useState({ ...CAPTURE_DEFAULTS, ...(settings ?? {}) });
  const [confirmRegen, setConfirmRegen] = useState(false);
  useEffect(() => { setDraft({ ...CAPTURE_DEFAULTS, ...(settings ?? {}) }); }, [settings]);

  // The hours of every chosen weekday, as one comparable string
  const hoursKey = (x: typeof draft) => [...x.weekdays].sort().map((d) => `${d}:${hoursOfWeekday(x, d).start}-${hoursOfWeekday(x, d).end}`).join("|");
  const setDayHours = (d: number, patch: Partial<{ start: number; end: number }>) => {
    const cur = hoursOfWeekday(draft, d);
    const next = { ...cur, ...patch };
    if (next.end <= next.start) next.end = Math.min(24, next.start + 1);
    setDraft({ ...draft, weekday_hours: { ...draft.weekday_hours, [String(d)]: next } });
  };
  const dirty = useMemo(() => {
    const base = { ...CAPTURE_DEFAULTS, ...(settings ?? {}) };
    return (
      base.capacity_per_day !== draft.capacity_per_day ||
      base.min_lead_days !== draft.min_lead_days ||
      hoursKey(base) !== hoursKey(draft) ||
      base.duration_minutes !== draft.duration_minutes ||
      base.slot_step_minutes !== draft.slot_step_minutes ||
      [...base.weekdays].sort().join() !== [...draft.weekdays].sort().join() ||
      [...base.open_months].sort().join() !== [...draft.open_months].sort().join()
    );
  }, [settings, draft]);

  // What goes to the database: each chosen weekday with its hours; the first chosen day also gives the fallback hours
  const savedHours = () => {
    const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => draft.weekdays.includes(d));
    const map: Record<string, { start: number; end: number }> = {};
    for (const d of days) map[String(d)] = hoursOfWeekday(draft, d);
    const first = days.length ? map[String(days[0])] : { start: draft.day_start_hour, end: draft.day_end_hour };
    return { weekday_hours: map, day_start_hour: first.start, day_end_hour: first.end };
  };

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => addMonths(startOfMonth(new Date()), i)), []);
  const run = (patch: Parameters<typeof save.mutate>[0], okMessage: string) =>
    save.mutate(patch, { onSuccess: () => toast.success(okMessage), onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar") });

  return (
    <section className="overflow-hidden rounded-2xl border border-border/40 bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground"><Settings2 className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1 text-sm font-semibold">Link e regras</span>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", settings?.enabled ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>
          {settings?.enabled ? "Link ativo" : "Link desligado"}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="divide-y divide-border/30 border-t border-border/30">
          {/* 1 · Link */}
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Link para os clientes</p>
                <p className="text-xs text-muted-foreground">Desligado, o link mostra "indisponível" para quem abrir.</p>
              </div>
              <Switch checked={!!settings?.enabled} disabled={save.isPending} onCheckedChange={(v) => run({ enabled: v }, v ? "Link ativado" : "Link desligado")} />
            </div>
            {settings && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-sm">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{captureLink(settings.share_token)}</span>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={() => { void navigator.clipboard.writeText(captureLink(settings.share_token)); toast.success("Link copiado!"); }}>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" onClick={() => setConfirmRegen(true)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Gerar novo
                </Button>
              </div>
            )}
          </div>

          {/* 2 · Days and hours */}
          <div className="space-y-3 px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Dias e horários de atendimento</p>
              <p className="text-xs text-muted-foreground">Ligue os dias em que você grava e defina o horário de cada um. Por exemplo, sábado só até 12:00.</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-border/40">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                const on = draft.weekdays.includes(d);
                const h = hoursOfWeekday(draft, d);
                return (
                  <div key={d} className={cn("flex items-center gap-3 border-b border-border/30 px-3 py-2 last:border-b-0", !on && "bg-muted/20")}>
                    <Switch checked={on} onCheckedChange={(v) => setDraft({ ...draft, weekdays: v ? [...draft.weekdays, d] : draft.weekdays.filter((x) => x !== d) })} aria-label={`Atender ${WEEKDAY_LABELS[d]}`} />
                    <span className={cn("w-10 shrink-0 text-sm font-medium", !on && "text-muted-foreground")}>{WEEKDAY_LABELS[d]}</span>
                    {on ? (
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                        <Select value={String(h.start)} onValueChange={(v) => setDayHours(d, { start: Number(v) })}>
                          <SelectTrigger className="h-8 w-[5.5rem] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{Array.from({ length: 23 }, (_, i) => i).map((x) => <SelectItem key={x} value={String(x)}>{String(x).padStart(2, "0")}:00</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-xs text-muted-foreground">até</span>
                        <Select value={String(h.end)} onValueChange={(v) => setDayHours(d, { end: Number(v) })}>
                          <SelectTrigger className="h-8 w-[5.5rem] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{Array.from({ length: 24 }, (_, i) => i + 1).filter((x) => x > h.start).map((x) => <SelectItem key={x} value={String(x)}>{String(x).padStart(2, "0")}:00</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Fechado</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3 · Each recording */}
          <div className="space-y-3 px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Cada gravação</p>
              <p className="text-xs text-muted-foreground">O cliente escolhe o horário de início entre os que ainda estão livres. Duas gravações nunca ficam no mesmo horário.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Duração</Label>
                <Select value={String(draft.duration_minutes)} onValueChange={(v) => setDraft({ ...draft, duration_minutes: Number(v) })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{[60, 90, 120, 150, 180, 240, 300, 360].map((m) => <SelectItem key={m} value={String(m)}>{m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h30`}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horários de</Label>
                <Select value={String(draft.slot_step_minutes)} onValueChange={(v) => setDraft({ ...draft, slot_step_minutes: Number(v) })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{[30, 60, 120].map((m) => <SelectItem key={m} value={String(m)}>{m === 30 ? "30 em 30 min" : m === 60 ? "1 em 1 hora" : "2 em 2 horas"}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-capacity" className="text-xs">Máximo por dia</Label>
                <Input id="cap-capacity" className="h-9" type="number" min={1} max={20} value={draft.capacity_per_day} onChange={(e) => setDraft({ ...draft, capacity_per_day: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cap-lead" className="text-xs">Antecedência (dias)</Label>
                <Input id="cap-lead" className="h-9" type="number" min={0} max={60} value={draft.min_lead_days} onChange={(e) => setDraft({ ...draft, min_lead_days: Math.max(0, Math.min(60, Number(e.target.value) || 0)) })} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">Ao chegar no máximo por dia, o dia aparece lotado. Dias dentro da antecedência ficam fechados.</p>
          </div>

          {/* 4 · Open months */}
          <div className="space-y-3 px-5 py-4">
            <div>
              <p className="text-sm font-semibold">Meses abertos para agendamento</p>
              <p className="text-xs text-muted-foreground">O cliente só vê e agenda nos meses marcados.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {months.map((m) => {
                const key = format(m, "yyyy-MM");
                const on = draft.open_months.includes(key);
                return (
                  <button key={key} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, open_months: on ? draft.open_months.filter((x) => x !== key) : [...draft.open_months, key] })}
                    className={cn("rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition", on ? "border-primary/60 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-accent/40")}>
                    {format(m, "MMM/yy", { locale: ptBR })}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-2 bg-muted/10 px-5 py-3">
            <Button size="sm" className="rounded-full" disabled={!dirty || save.isPending} onClick={() => run({ capacity_per_day: draft.capacity_per_day, min_lead_days: draft.min_lead_days, weekdays: draft.weekdays, open_months: draft.open_months, ...savedHours(), duration_minutes: draft.duration_minutes, slot_step_minutes: draft.slot_step_minutes }, "Regras salvas")}>
              {save.isPending ? "Salvando…" : "Salvar regras"}
            </Button>
            {dirty && !save.isPending && <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => setDraft({ ...CAPTURE_DEFAULTS, ...(settings ?? {}) })}>Descartar</Button>}
            {dirty && <span className="text-xs text-amber-500">Alterações não salvas</span>}
          </div>
        </div>
      )}

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar um novo link?</AlertDialogTitle>
            <AlertDialogDescription>O link atual deixa de funcionar. Quem já agendou continua com o pedido, mas você precisa enviar o novo link para quem ainda vai agendar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => run({ regenerate_token: true }, "Novo link gerado")}>Gerar novo link</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

// ───────────────────────── Month overview ─────────────────────────

function MonthOverview({ settings, bookings, isAdmin }: { settings: CaptureSettings | null; bookings: CaptureBooking[]; isAdmin: boolean }) {
  const blocksQ = useCaptureBlocks();
  const toggleBlock = useToggleCaptureBlock();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [blocking, setBlocking] = useState(false);
  const capacity = settings?.capacity_per_day ?? CAPTURE_DEFAULTS.capacity_per_day;
  const weekdays = settings?.weekdays ?? CAPTURE_DEFAULTS.weekdays;
  const open = new Set(settings?.open_months ?? []);

  const blockByDate = useMemo(() => new Map((blocksQ.data ?? []).map((b) => [b.block_date, b.id])), [blocksQ.data]);
  const loadByDate = useMemo(() => {
    const map = new Map<string, { pending: number; confirmed: number }>();
    for (const b of bookings) {
      if (b.status !== "pending" && b.status !== "confirmed") continue;
      const cur = map.get(b.booking_date) ?? { pending: 0, confirmed: 0 };
      cur[b.status] += 1;
      map.set(b.booking_date, cur);
    }
    return map;
  }, [bookings]);

  const monthKey = format(cursor, "yyyy-MM");
  const first = cursor.getDay();
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const today = todayKey();

  return (
    <section className="rounded-2xl border border-border/40 bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCursor(addMonths(cursor, -1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <p className="min-w-[9rem] text-center text-sm font-semibold first-letter:uppercase">{format(cursor, "MMMM 'de' yyyy", { locale: ptBR })}</p>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setCursor(addMonths(cursor, 1))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button>
          {!open.has(monthKey) && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Fechado para clientes</span>}
        </div>
        {isAdmin && (
          <Button variant={blocking ? "default" : "outline"} size="sm" className="gap-1.5 rounded-full" onClick={() => setBlocking((v) => !v)}>
            <Ban className="h-3.5 w-3.5" /> {blocking ? "Pronto" : "Bloquear dias"}
          </Button>
        )}
      </div>
      {blocking && <p className="mb-3 rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Clique nos dias que você não quer receber captação (folga, evento, feriado). Clique de novo para liberar.</p>}

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_HEAD.map((w, i) => <span key={i} className="pb-1 text-center text-[11px] font-semibold text-muted-foreground">{w}</span>)}
        {Array.from({ length: first }).map((_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const ymd = `${monthKey}-${String(day).padStart(2, "0")}`;
          const wd = new Date(`${ymd}T12:00:00`).getDay();
          const blockId = blockByDate.get(ymd);
          const load = loadByDate.get(ymd);
          const total = (load?.pending ?? 0) + (load?.confirmed ?? 0);
          const worksThatDay = weekdays.includes(wd);
          const full = total >= capacity;
          const clickable = blocking && isAdmin && ymd >= today;
          return (
            <button
              key={ymd}
              type="button"
              disabled={!clickable}
              onClick={() => toggleBlock.mutate({ date: ymd, existingId: blockId }, { onError: (e: any) => toast.error(e?.message ?? "Não foi possível alterar") })}
              className={cn(
                "relative flex min-h-[3.25rem] flex-col items-center justify-start gap-0.5 rounded-xl border px-1 py-1.5 text-xs transition",
                blockId ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : full ? "border-amber-500/40 bg-amber-500/10"
                  : total > 0 ? "border-primary/30 bg-primary/5"
                  : "border-border/30",
                !worksThatDay && !blockId && "opacity-40",
                ymd === today && "ring-1 ring-primary/60",
                clickable ? "cursor-pointer hover:border-destructive/60" : "cursor-default",
              )}
            >
              <span className="font-medium">{day}</span>
              {blockId ? <Ban className="h-3 w-3" /> : total > 0 ? (
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: Math.min(total, 6) }).map((_, k) => (
                    <span key={k} className={cn("h-1.5 w-1.5 rounded-full", k < (load?.confirmed ?? 0) ? "bg-emerald-500" : "bg-amber-500")} />
                  ))}
                </span>
              ) : null}
              {!blockId && total > 0 && <span className="text-[9px] text-muted-foreground">{total}/{capacity}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Confirmada</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> Aguardando</span>
        <span className="flex items-center gap-1.5"><Ban className="h-3 w-3 text-destructive" /> Bloqueado</span>
      </div>
    </section>
  );
}

// ───────────────────────── Booking cards ─────────────────────────

function BookingCard({ b, onConfirm, onRefuse, onCancel }: { b: CaptureBooking; onConfirm?: () => void; onRefuse?: () => void; onCancel?: () => void }) {
  return (
    <article className="space-y-3 rounded-2xl border border-border/40 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{b.company_name}</p>
          <p className="text-xs text-muted-foreground first-letter:uppercase">{fmtLong(b.booking_date)}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <Clock className="h-3 w-3" /> {timeRange(b.start_time, b.duration_minutes)}
        </span>
      </div>
      <div className="space-y-1 text-sm text-muted-foreground">
        {b.contact_name && <p>{b.contact_name}</p>}
        <a href={whatsappUrl(b.whatsapp, `Olá! Aqui é da agência, sobre a captação de ${format(new Date(`${b.booking_date}T12:00:00`), "dd/MM")}.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-foreground/80 hover:text-foreground hover:underline">
          <MessageCircle className="h-3.5 w-3.5" /> {b.whatsapp}
        </a>
        {b.location && <p className="flex items-start gap-1.5"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {b.location}</p>}
        {b.notes && <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs">{b.notes}</p>}
      </div>
      {(onConfirm || onRefuse || onCancel) && (
        <div className="flex flex-wrap items-center gap-2">
          {onConfirm && <Button size="sm" className="gap-1.5 rounded-full" onClick={onConfirm}><Check className="h-3.5 w-3.5" /> Confirmar</Button>}
          {onRefuse && <Button size="sm" variant="outline" className="gap-1.5 rounded-full" onClick={onRefuse}><X className="h-3.5 w-3.5" /> Recusar</Button>}
          {onCancel && <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground" onClick={onCancel}>Cancelar captação</Button>}
        </div>
      )}
    </article>
  );
}

// ───────────────────────── Panel ─────────────────────────

export function CapturasPanel() {
  const qc = useQueryClient();
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  const settingsQ = useCaptureSettings();
  const bookingsQ = useCaptureBookings();
  const update = useUpdateCaptureBooking();
  const clientsQ = useClients();
  const teamQ = useTeamMembers();
  const flowsQ = useStageFlows();
  const addAssignees = useAddTaskAssignees();

  const bookings = bookingsQ.data ?? [];
  const today = todayKey();
  const pending = bookings.filter((b) => b.status === "pending");
  const confirmed = bookings.filter((b) => b.status === "confirmed" && b.booking_date >= today);
  const history = bookings.filter((b) => b.status === "refused" || b.status === "cancelled" || (b.status === "confirmed" && b.booking_date < today)).sort((a, b) => b.booking_date.localeCompare(a.booking_date));
  const [historyOpen, setHistoryOpen] = useState(false);

  // Confirm dialog
  const [confirming, setConfirming] = useState<CaptureBooking | null>(null);
  const [clientId, setClientId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [refusing, setRefusing] = useState<CaptureBooking | null>(null);
  const [cancelling, setCancelling] = useState<CaptureBooking | null>(null);

  const clients = clientsQ.data ?? [];
  const team = (teamQ.data ?? []).filter((m) => m.is_active !== false);
  const defaultFlow = useMemo(() => (flowsQ.data ?? []).find((f) => f.is_default) ?? (flowsQ.data ?? [])[0], [flowsQ.data]);

  // The responsible for Captação in the client's team (squad / table of responsibles), when there is one
  const defaultAssigneeFor = (cid: string) => {
    const raw = (defaultFlow?.stage_assignees as Record<string, Record<string, unknown>> | undefined)?.captacao?.[cid];
    const id = Array.isArray(raw) ? raw[0] : raw;
    return typeof id === "string" ? id : "";
  };

  const openConfirm = (b: CaptureBooking) => {
    const wanted = norm(b.company_name);
    const match = clients.find((c) => norm(c.name) === wanted) ?? clients.find((c) => norm(c.name).includes(wanted) || wanted.includes(norm(c.name)));
    setConfirming(b);
    setClientId(match?.id ?? "");
    setAssigneeId(match ? defaultAssigneeFor(match.id) : "");
  };

  const notifyWhatsapp = (b: CaptureBooking, text: string) => ({ label: "Avisar no WhatsApp", onClick: () => window.open(whatsappUrl(b.whatsapp, text), "_blank", "noopener") });

  const confirm = async () => {
    if (!confirming || !user || !clientId || !assigneeId) return;
    setSaving(true);
    try {
      const b = confirming;
      const lines = [
        `Pedido feito pelo link de agendamento.`,
        `Horário: ${timeRange(b.start_time, b.duration_minutes)}`,
        b.contact_name ? `Contato: ${b.contact_name}` : null,
        `WhatsApp: ${b.whatsapp}`,
        b.location ? `Local: ${b.location}` : null,
        b.notes ? `Observações: ${b.notes}` : null,
      ].filter(Boolean);
      const { data: task, error } = await supabase
        .from("tasks")
        .insert({
          client_id: clientId,
          stage: "captacao",
          assigned_user_id: assigneeId,
          due_date: b.booking_date,
          due_at: `${b.booking_date}T${hhmm(b.start_time)}:00-03:00`,
          title: `Captação (${hhmm(b.start_time)}) — ${b.company_name}`,
          description: lines.join("\n"),
          created_by: user.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      await addAssignees.mutateAsync({ taskId: task.id, userIds: [assigneeId], addedBy: user.id });
      await update.mutateAsync({ id: b.id, patch: { status: "confirmed", client_id: clientId, task_id: task.id, decided_at: new Date().toISOString(), decided_by: user.id } });
      await qc.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Captação confirmada e criada na Agenda.", {
        action: notifyWhatsapp(b, `Olá! Sua captação está confirmada para ${format(new Date(`${b.booking_date}T12:00:00`), "dd/MM")} às ${hhmm(b.start_time)}. Qualquer ajuste, é só falar com a gente!`),
        duration: 12000,
      });
      setConfirming(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível confirmar");
    } finally {
      setSaving(false);
    }
  };

  const refuse = async (b: CaptureBooking) => {
    try {
      await update.mutateAsync({ id: b.id, patch: { status: "refused", decided_at: new Date().toISOString(), decided_by: user?.id ?? null } });
      toast.success("Pedido recusado. O dia voltou a ficar livre.", {
        action: notifyWhatsapp(b, `Olá! Sobre o pedido de captação para ${format(new Date(`${b.booking_date}T12:00:00`), "dd/MM")}: não conseguimos atender nesse dia. Pode escolher outra data pelo link?`),
        duration: 12000,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível recusar");
    }
  };

  const cancel = async (b: CaptureBooking) => {
    try {
      await update.mutateAsync({ id: b.id, patch: { status: "cancelled", decided_at: new Date().toISOString(), decided_by: user?.id ?? null } });
      toast.success(b.task_id ? "Captação cancelada. A tarefa continua na Agenda; exclua lá se quiser." : "Captação cancelada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível cancelar");
    }
  };

  return (
    <div className="space-y-5">
      {isAdmin && <RulesCard settings={settingsQ.data ?? null} />}

      <MonthOverview settings={settingsQ.data ?? null} bookings={bookings} isAdmin={isAdmin} />

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          Aguardando confirmação
          {pending.length > 0 && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-500">{pending.length}</span>}
        </h3>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/40 px-4 py-8 text-center text-sm text-muted-foreground">
            {settingsQ.data?.enabled ? "Nenhum pedido novo. Quando um cliente agendar pelo link, ele aparece aqui." : isAdmin ? "Ative o link em \"Link e regras\" para começar a receber pedidos." : "Nenhum pedido no momento."}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {pending.map((b) => <BookingCard key={b.id} b={b} onConfirm={() => openConfirm(b)} onRefuse={() => setRefusing(b)} />)}
          </div>
        )}
      </section>

      {confirmed.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck className="h-4 w-4 text-emerald-500" /> Captações confirmadas</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {confirmed.map((b) => <BookingCard key={b.id} b={b} onCancel={() => setCancelling(b)} />)}
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <button type="button" onClick={() => setHistoryOpen((v) => !v)} aria-expanded={historyOpen} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/40 px-4 py-3 text-left transition-colors hover:bg-accent/30">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Histórico ({history.length})</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", historyOpen && "rotate-180")} />
          </button>
          {historyOpen && (
            <ul className="divide-y divide-border/30 rounded-2xl border border-border/40">
              {history.map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{b.company_name}</span>
                  <span className="text-xs text-muted-foreground">{fmtShort(b.booking_date)} · {hhmm(b.start_time)}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", b.status === "confirmed" ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>
                    {b.status === "confirmed" ? "Realizada" : b.status === "refused" ? "Recusada" : "Cancelada"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Dialog open={!!confirming} onOpenChange={(o) => { if (!o && !saving) setConfirming(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar captação</DialogTitle>
            <DialogDescription>
              {confirming && <span>{fmtLong(confirming.booking_date)} · {timeRange(confirming.start_time, confirming.duration_minutes)}</span>}
              {" "}— vira uma tarefa de Captação na Agenda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setAssigneeId((cur) => defaultAssigneeFor(v) || cur); }}>
                <SelectTrigger><SelectValue placeholder="Escolha o cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {confirming && <p className="text-[11px] text-muted-foreground">Pedido feito por "{confirming.company_name}".</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Responsável pela gravação</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger><SelectValue placeholder="Escolha quem vai gravar" /></SelectTrigger>
                <SelectContent>
                  {team.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-5 w-5"><AvatarImage src={m.avatar_url ?? undefined} /><AvatarFallback className="text-[8px]">{initials(m.display_name)}</AvatarFallback></Avatar>
                        {m.display_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientId && defaultAssigneeFor(clientId) === assigneeId && assigneeId && <p className="text-[11px] text-muted-foreground">Sugerido pela equipe do cliente.</p>}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setConfirming(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={confirm} disabled={saving || !clientId || !assigneeId}>{saving ? "Confirmando…" : "Confirmar captação"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!refusing} onOpenChange={(o) => { if (!o) setRefusing(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recusar o pedido de {refusing?.company_name}?</AlertDialogTitle>
            <AlertDialogDescription>O dia volta a ficar livre para os outros clientes. Depois você pode avisar a pessoa no WhatsApp.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (refusing) void refuse(refusing); setRefusing(null); }}>Recusar pedido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!cancelling} onOpenChange={(o) => { if (!o) setCancelling(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar a captação de {cancelling?.company_name}?</AlertDialogTitle>
            <AlertDialogDescription>O dia volta a ficar livre. A tarefa criada na Agenda não é apagada: se não for mais necessária, exclua lá.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (cancelling) void cancel(cancelling); setCancelling(null); }}>Cancelar captação</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
