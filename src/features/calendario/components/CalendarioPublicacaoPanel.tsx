import { useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Film, LayoutGrid, List, Grid3x3, Image as ImageIcon, Link2, Copy, RefreshCw } from "lucide-react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useClients } from "@/features/data/queries";
import {
  useCalendarPublications, useCalendarsForClient, useCalendarsForCycle, useTaskAttachmentsMap, useUpdateCalendarPublication, useUpdateCalendarShare, useUpdateCalendarStatus,
} from "../hooks/use-calendar-data";
import { CALENDAR_STATUS_LABELS, CONTENT_TYPE_LABELS, type CalendarPublication, type CalendarStatus } from "../calendar-types";
import { PublicationCard } from "./PublicationCard";
import { PublicationPreviewPanel } from "./PublicationPreviewPanel";

interface Props {
  onOpenTask: (taskId: string) => void;
}

function anchorForDate(d: Date) {
  return d.getDate() >= 28 ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : new Date(d.getFullYear(), d.getMonth(), 1);
}
function cycleEnd(anchor: Date) {
  return new Date(anchor.getFullYear(), anchor.getMonth(), 27);
}
function cycleStart(anchor: Date) {
  const end = cycleEnd(anchor);
  return new Date(end.getFullYear(), end.getMonth() - 1, 28);
}
function cycleNumber(anchor: Date) {
  return anchor.getMonth() + 1;
}

const UNSCHEDULED_ID = "unscheduled";

// Collapses the 7 calendar_status values into the 4 buckets shown on the
// client card in the sidebar, each with its own color.
const CLIENT_CARD_STATUS: Record<string, { label: string; className: string }> = {
  em_montagem: { label: "Incompleto", className: "bg-slate-200 text-slate-600" },
  em_revisao_interna: { label: "Incompleto", className: "bg-slate-200 text-slate-600" },
  pronto_para_envio: { label: "Aguardando aprovação", className: "bg-amber-500/15 text-amber-600" },
  enviado_ao_cliente: { label: "Aguardando aprovação", className: "bg-amber-500/15 text-amber-600" },
  alteracoes_solicitadas: { label: "Com alteração", className: "bg-destructive/15 text-destructive" },
  aprovado: { label: "Aprovado", className: "bg-success/15 text-success" },
  arquivado: { label: "Incompleto", className: "bg-slate-200 text-slate-600" },
};

function DraggablePublication({ publication, thumbnailUrl, onClick }: { publication: CalendarPublication; thumbnailUrl?: string | null; onClick: () => void }) {
  const { setNodeRef, listeners, attributes, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: publication.id,
    data: { publication },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div ref={setNodeRef} style={style}>
      <PublicationCard
        publication={publication}
        thumbnailUrl={thumbnailUrl}
        onClick={onClick}
        dragHandleProps={{ listeners, attributes, setActivatorNodeRef }}
        isDragging={isDragging}
      />
    </div>
  );
}

function DropZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "bg-primary/5 ring-1 ring-inset ring-primary/30")}>
      {children}
    </div>
  );
}

export function CalendarioPublicacaoPanel({ onOpenTask }: Props) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => anchorForDate(new Date()));
  const [view, setView] = useState<"calendario" | "lista" | "feed">("calendario");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const clientsQ = useClients();
  const selectedClient = clientsQ.data?.find((c) => c.id === clientId);
  const clientName = selectedClient?.name ?? "Cliente";
  const clientLogoUrl = selectedClient?.logo_url ?? null;
  const calendarsQ = useCalendarsForClient(clientId);
  const cycleStartKey = format(cycleStart(cursor), "yyyy-MM-dd");
  const calendar = useMemo(() => (calendarsQ.data ?? []).find((c) => c.cycle_start === cycleStartKey) ?? null, [calendarsQ.data, cycleStartKey]);

  // Which clients have a calendar in the current ciclo, for the sidebar dots.
  const cycleCalendarsQ = useCalendarsForCycle(cycleStartKey);
  const calendarByClientId = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    for (const c of cycleCalendarsQ.data ?? []) map.set(c.client_id, c);
    return map;
  }, [cycleCalendarsQ.data]);

  const publicationsQ = useCalendarPublications(calendar?.id ?? null);
  const publications = publicationsQ.data ?? [];
  const taskIds = useMemo(() => publications.map((p) => p.task_id), [publications]);
  const attachmentsQ = useTaskAttachmentsMap(taskIds);

  const updatePublication = useUpdateCalendarPublication();
  const updateCalendarStatus = useUpdateCalendarStatus();
  const updateCalendarShare = useUpdateCalendarShare();

  const mediaFor = (taskId: string) => attachmentsQ.data?.get(taskId) ?? [];
  const thumbnailFor = (taskId: string) => mediaFor(taskId).find((m) => m.type?.startsWith("image/"))?.url ?? null;

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarPublication[]>();
    for (const p of publications) {
      const key = p.publish_date ?? UNSCHEDULED_ID;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [publications]);

  const weeks = useMemo(() => {
    const start = cycleStart(cursor);
    const end = cycleEnd(cursor);
    const out: Date[][] = [];
    let weekStart = startOfWeek(start, { weekStartsOn: 0 });
    while (weekStart <= end) {
      out.push(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
      weekStart = addDays(weekStart, 7);
    }
    return out;
  }, [cursor]);

  const counts = useMemo(() => ({
    total: publications.length,
    aguardando: publications.filter((p) => p.status === "aguardando_aprovacao").length,
    aprovada: publications.filter((p) => p.status === "aprovada").length,
    alteracao: publications.filter((p) => p.status === "alteracao_solicitada").length,
  }), [publications]);

  // Feed: chronological reading order (most recent first), excluding stories
  // and anything missing what it needs to actually appear in a real feed.
  const { feedItems, outsideFeed } = useMemo(() => {
    const feed: CalendarPublication[] = [];
    const outside: { publication: CalendarPublication; reason: string }[] = [];
    for (const p of publications) {
      if (p.content_type === "story") {
        outside.push({ publication: p, reason: "Stories não entram na grade do feed" });
        continue;
      }
      if (!p.publish_date) {
        outside.push({ publication: p, reason: "Data não definida" });
        continue;
      }
      if (!p.publish_time) {
        outside.push({ publication: p, reason: "Horário não definido" });
        continue;
      }
      if (mediaFor(p.task_id).length === 0) {
        outside.push({ publication: p, reason: "Arquivo final não selecionado" });
        continue;
      }
      feed.push(p);
    }
    feed.sort((a, b) => `${b.publish_date}T${b.publish_time}`.localeCompare(`${a.publish_date}T${a.publish_time}`));
    return { feedItems: feed, outsideFeed: outside };
  }, [publications, attachmentsQ.data]);

  const listOrder = useMemo(
    () => [...publications].sort((a, b) => (a.publish_date ?? "9999") > (b.publish_date ?? "9999") ? 1 : -1),
    [publications],
  );

  const navList = view === "feed" ? feedItems : listOrder;
  const navIndex = navList.findIndex((p) => p.id === selectedId);
  const selected = navIndex >= 0 ? navList[navIndex] : null;

  const handleNavigate = (direction: "prev" | "next") => {
    if (navIndex < 0) return;
    const nextIndex = direction === "prev" ? navIndex - 1 : navIndex + 1;
    if (nextIndex < 0 || nextIndex >= navList.length) return;
    setSelectedId(navList[nextIndex].id);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const publication = (active.data.current as { publication?: CalendarPublication } | undefined)?.publication;
    if (!publication) return;
    const targetDayKey = String(over.id);
    const newDate = targetDayKey === UNSCHEDULED_ID ? null : targetDayKey;
    if (publication.publish_date === newDate) return;
    updatePublication.mutate({ id: publication.id, publish_date: newDate });
  };

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const cycleMonthLabel = format(cycleEnd(cursor), "MMMM", { locale: ptBR });

  return (
    <div className="flex gap-4">
      {/* Left: cycle nav + vertical client list */}
      <div className="w-60 shrink-0 space-y-2">
        <div className="flex items-center gap-1 rounded-2xl border border-border/30 bg-muted/20 p-2">
          <button type="button" onClick={() => setCursor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-muted">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="flex-1 truncate text-center text-xs font-medium capitalize">
            Ciclo {cycleNumber(cursor)} · {cycleMonthLabel}
          </span>
          <button type="button" onClick={() => setCursor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-muted">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-0.5">
          {(clientsQ.data ?? []).map((c) => {
            const cal = calendarByClientId.get(c.id);
            const statusMeta = cal ? CLIENT_CARD_STATUS[cal.status] ?? CLIENT_CARD_STATUS.em_montagem : null;
            const initial = c.name.trim().charAt(0).toUpperCase() || "?";
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setClientId(c.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-2xl border border-border/30 bg-card p-3 text-left shadow-sm transition-all hover:shadow-md",
                  clientId === c.id && "border-primary/50 ring-1 ring-primary/30",
                )}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 text-sm font-bold text-white">
                  {c.logo_url ? (
                    <img src={c.logo_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initial
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm font-semibold">{c.name}</span>
                  {statusMeta && (
                    <span
                      className={cn(
                        "w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold",
                        statusMeta.className,
                      )}
                    >
                      {statusMeta.label}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: selected client's calendar */}
      <div className="min-w-0 flex-1 space-y-4">
      {calendar && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/30 bg-muted/20 p-3">
          <Select value={calendar.status} onValueChange={(v: CalendarStatus) => updateCalendarStatus.mutate({ id: calendar.id, status: v, clientId: clientId! })}>
            <SelectTrigger className="h-9 w-auto rounded-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CALENDAR_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full">
                <Link2 className="h-3.5 w-3.5" /> Compartilhar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="share-toggle">Link ativo pro cliente</Label>
                <Switch
                  id="share-toggle"
                  checked={calendar.share_enabled}
                  onCheckedChange={(checked) => updateCalendarShare.mutate({ id: calendar.id, clientId: clientId!, share_enabled: checked })}
                />
              </div>
              {calendar.share_enabled && (
                <>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={`${window.location.origin}/aprovacao/${calendar.share_token}`} className="h-8 text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/aprovacao/${calendar.share_token}`);
                        toast.success("Link copiado!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground"
                    onClick={() => updateCalendarShare.mutate({ id: calendar.id, clientId: clientId!, share_token: crypto.randomUUID() })}
                  >
                    <RefreshCw className="h-3 w-3" /> Gerar novo link (invalida o anterior)
                  </Button>
                </>
              )}
            </PopoverContent>
          </Popover>

          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="ml-auto">
            <TabsList className="h-9 rounded-full">
              <TabsTrigger value="calendario" className="gap-1.5 rounded-full text-xs"><LayoutGrid className="h-3.5 w-3.5" /> Calendário</TabsTrigger>
              <TabsTrigger value="lista" className="gap-1.5 rounded-full text-xs"><List className="h-3.5 w-3.5" /> Lista</TabsTrigger>
              <TabsTrigger value="feed" className="gap-1.5 rounded-full text-xs"><Grid3x3 className="h-3.5 w-3.5" /> Feed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {!clientId && (
        <div className="rounded-2xl border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">
          Selecione um cliente na lista ao lado para ver o calendário de publicação.
        </div>
      )}

      {clientId && !calendar && (
        <div className="rounded-2xl border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">
          Nenhum calendário para esse cliente neste ciclo ainda — ele é criado automaticamente assim que uma tarefa chegar na etapa "PDF".
        </div>
      )}

      {calendar && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">{counts.total} publicações</Badge>
            <Badge variant="secondary" className="gap-1 rounded-full bg-amber-500/15 text-amber-600 hover:bg-amber-500/15">{counts.aguardando} aguardando</Badge>
            <Badge variant="secondary" className="gap-1 rounded-full bg-success/15 text-success hover:bg-success/15">{counts.aprovada} aprovadas</Badge>
            <Badge variant="secondary" className="gap-1 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/15">{counts.alteracao} com alteração</Badge>
          </div>

          {view !== "feed" && (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <DropZone id={UNSCHEDULED_ID} className="space-y-2 rounded-2xl border border-dashed border-border/40 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Publicações sem data</p>
                <div className="flex flex-wrap gap-2">
                  {(byDay.get(UNSCHEDULED_ID) ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground/60">Nenhuma — arraste uma publicação aqui para tirar a data.</p>
                  )}
                  {(byDay.get(UNSCHEDULED_ID) ?? []).map((p) => (
                    <div key={p.id} className="w-56">
                      <DraggablePublication publication={p} thumbnailUrl={thumbnailFor(p.task_id)} onClick={() => setSelectedId(p.id)} />
                    </div>
                  ))}
                </div>
              </DropZone>

              {view === "calendario" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                      <div key={d} className="px-1 py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {weeks.flat().map((d) => {
                      const key = format(d, "yyyy-MM-dd");
                      const isToday = key === todayKey;
                      const inCycle = d >= cycleStart(cursor) && d <= cycleEnd(cursor);
                      const dayPubs = byDay.get(key) ?? [];
                      return (
                        <DropZone
                          key={key}
                          id={key}
                          className={cn(
                            "calendar-card-hover relative min-h-[110px] space-y-1.5 rounded-xl border border-border/40 bg-card/20 p-1.5 transition",
                            isToday && "border-primary/40",
                            !inCycle && "opacity-50",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/60 text-[11px]",
                              isToday ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            {format(d, "d")}
                          </div>
                          {dayPubs.map((p) => (
                            <DraggablePublication key={p.id} publication={p} thumbnailUrl={thumbnailFor(p.task_id)} onClick={() => setSelectedId(p.id)} />
                          ))}
                        </DropZone>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {publications.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhuma publicação neste ciclo ainda.</p>
                  )}
                  {listOrder.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border/30 bg-card px-3 py-2 text-left hover:bg-muted/40"
                    >
                      {thumbnailFor(p.task_id) ? (
                        <img src={thumbnailFor(p.task_id)!} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="h-10 w-10 shrink-0 rounded-lg bg-muted" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{CONTENT_TYPE_LABELS[p.content_type]}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.publish_date ? format(new Date(`${p.publish_date}T00:00:00`), "dd/MM") : "sem data"}
                          {p.publish_time ? ` às ${p.publish_time.slice(0, 5)}` : ""}
                        </span>
                      </span>
                      <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">{p.status.replace(/_/g, " ")}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </DndContext>
          )}

          {view === "feed" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-xl border border-border/30">
                {feedItems.length === 0 && (
                  <p className="col-span-3 p-6 text-center text-sm text-muted-foreground">Nenhuma publicação pronta para o feed ainda.</p>
                )}
                {feedItems.map((p) => {
                  const media = mediaFor(p.task_id);
                  const images = media.filter((m) => m.type?.startsWith("image/"));
                  const thumb = images[0]?.url ?? null;
                  const isCarousel = p.content_type === "carrossel" && images.length > 1;
                  const isVideoish = p.content_type === "reel" || p.content_type === "video";
                  return (
                    <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} className="group relative aspect-square bg-muted">
                      {thumb ? (
                        <img src={thumb} alt="" className="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground/40" /></span>
                      )}
                      <span className="absolute right-1.5 top-1.5 flex items-center gap-1">
                        {isCarousel && <LayoutGrid className="h-3.5 w-3.5 text-white drop-shadow" />}
                        {isVideoish && <Film className="h-3.5 w-3.5 text-white drop-shadow" />}
                      </span>
                      {isCarousel && (
                        <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1 text-[9px] font-medium text-white">{images.length}p</span>
                      )}
                      <span className={cn(
                        "absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full",
                        p.status === "aprovada" ? "bg-success" : p.status === "alteracao_solicitada" ? "bg-destructive" : "bg-amber-400",
                      )} />
                    </button>
                  );
                })}
              </div>

              {outsideFeed.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-dashed border-border/40 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Conteúdos fora do feed</p>
                  <div className="flex flex-wrap gap-2">
                    {outsideFeed.map(({ publication: p, reason }) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className="flex w-56 items-center gap-2 rounded-lg border border-border/30 bg-card px-2 py-1.5 text-left hover:bg-muted/40"
                      >
                        {thumbnailFor(p.task_id) ? (
                          <img src={thumbnailFor(p.task_id)!} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span className="h-8 w-8 shrink-0 rounded-md bg-muted" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-medium">{CONTENT_TYPE_LABELS[p.content_type]}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">{reason}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </div>

      <PublicationPreviewPanel
        publication={selected}
        media={selected ? mediaFor(selected.task_id) : []}
        clientName={clientName}
        clientLogoUrl={clientLogoUrl}
        onClose={() => setSelectedId(null)}
        onOpenTask={onOpenTask}
        onNavigate={handleNavigate}
        hasPrev={navIndex > 0}
        hasNext={navIndex >= 0 && navIndex < navList.length - 1}
      />
    </div>
  );
}
