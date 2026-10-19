import { useEffect, useMemo, useState } from "react";
import { addDays, format, isToday as isSameDayAsToday } from "date-fns";
import { AlertCircle, CalendarClock, CheckCircle2, Clock, Instagram, ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toStorageRenderUrl } from "@/lib/storage-image-url";
import {
  useTodayScheduledPublications,
  useTaskAttachmentsMap,
  useCoverAttachmentsById,
  useCalendarPublicationById,
  type TodayScheduledPublication,
} from "@/features/calendario/hooks/use-calendar-data";
import { CONTENT_TYPE_LABELS } from "@/features/calendario/calendar-types";
import { PublicationPreviewPanel } from "@/features/calendario/components/PublicationPreviewPanel";

interface Props {
  onOpenTask: (taskId: string) => void;
}

const ROTATE_MS = 2800;

// Where the post stands on Instagram, shown at the right of the caption. Not-yet-published posts only get a
// label when there is something to say (queued for auto-publish, publishing now, or the attempt failed).
function PublicationStatusLabel({ pub }: { pub: TodayScheduledPublication }) {
  if (pub.instagramStatus === "published") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {pub.instagramPermalink ? (
          <a href={pub.instagramPermalink} target="_blank" rel="noopener noreferrer" className="hover:underline">
            Publicado
          </a>
        ) : (
          "Publicado"
        )}
      </span>
    );
  }
  if (pub.instagramStatus === "failed") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        Falhou
      </span>
    );
  }
  if (pub.instagramStatus === "publishing" || pub.instagramStatus === "pending") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-amber-400">
        <Clock className="h-3.5 w-3.5" />
        Publicando
      </span>
    );
  }
  if (pub.instagramScheduled) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-primary">
        <CalendarClock className="h-3.5 w-3.5" />
        Agendado
      </span>
    );
  }
  return null;
}

export function TodayInstagramLoopWidget({ onOpenTask }: Props) {
  // Defaults to today but is fully browsable — the hook just queries whatever
  // publish_date it's given, "today" was never a hard requirement.
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dateKey = useMemo(() => format(selectedDate, "yyyy-MM-dd"), [selectedDate]);
  const isToday = useMemo(() => isSameDayAsToday(selectedDate), [selectedDate]);
  const goToPrevDay = () => setSelectedDate((d) => addDays(d, -1));
  const goToNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const goToToday = () => setSelectedDate(new Date());
  const pubsQ = useTodayScheduledPublications(dateKey);
  const publications = pubsQ.data ?? [];
  const taskIds = useMemo(() => publications.map((p) => p.taskId), [publications]);
  const attachmentsQ = useTaskAttachmentsMap(taskIds);

  // Clicking a card opens the same caption/date/status panel Cronograma uses, right here
  // over Meu Painel — no navigation to the Cronograma section needed just to peek at one
  // post's details.
  const [openId, setOpenId] = useState<string | null>(null);
  const openPub = publications.find((p) => p.id === openId) ?? null;
  const openPubFullQ = useCalendarPublicationById(openId);
  const coverIds = useMemo(
    () => [...new Set(publications.map((p) => p.coverAttachmentId).filter((id): id is string => !!id))],
    [publications],
  );
  const coverAttachmentsQ = useCoverAttachmentsById(coverIds);

  // Reels/vídeos têm o arquivo de vídeo como próprio anexo — mostrar isso como <img>
  // resulta numa imagem quebrada. A capa escolhida (cover_attachment_id) é sempre uma
  // imagem de verdade, então ela tem prioridade sobre o primeiro anexo "final" bruto.
  const thumbnailFor = (p: TodayScheduledPublication) => {
    if (p.coverAttachmentId) {
      const own = attachmentsQ.data?.get(p.taskId)?.find((a) => a.id === p.coverAttachmentId);
      if (own) return own;
      const external = coverAttachmentsQ.data?.get(p.coverAttachmentId);
      if (external) return external;
    }
    // No cover chosen — fall back to the task's own attachments, but skip past any video
    // file to the first real image (a video and its captured-frame image can share the
    // same order_index, in which case whichever uploaded first — often the video — would
    // otherwise win the tie and get rendered as a broken <img>).
    const list = attachmentsQ.data?.get(p.taskId) ?? [];
    return list.find((a) => !a.type?.startsWith("video/")) ?? list[0];
  };

  const N = publications.length;

  // Cover flow: the current cover sits in the middle at full size, its neighbours peek in on both
  // sides smaller and dimmed. It advances on its own and pauses while the pointer is over it.
  const [cur, setCur] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    setCur(0);
  }, [dateKey, N]);
  useEffect(() => {
    if (N <= 1 || paused) return;
    const id = setInterval(() => setCur((i) => (i + 1) % N), ROTATE_MS);
    return () => clearInterval(id);
  }, [N, paused]);
  const current = publications[cur] ?? null;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Instagram className="h-4 w-4" />
          </div>
          <CardTitle className="flex-1 text-sm">Publicações no Instagram</CardTitle>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{N}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold transition",
              isToday ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={goToPrevDay}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70 transition hover:bg-accent hover:text-foreground"
            aria-label="Dia anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground transition hover:bg-accent"
            title="Voltar para hoje"
          >
            {format(selectedDate, "dd/MM/yyyy")}
          </button>
          <button
            type="button"
            onClick={goToNextDay}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70 transition hover:bg-accent hover:text-foreground"
            aria-label="Próximo dia"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        {N === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 pb-4 text-center text-sm text-muted-foreground">
            {isToday ? "Nenhuma publicação prevista pra hoje" : "Nenhuma publicação prevista para este dia"}
          </div>
        ) : (
          <div className="flex flex-1 flex-col justify-start px-3 pb-3 pt-1" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            <div className="relative aspect-[3/2] w-full">
              {publications.map((p, k) => {
                // Circular offset from the current cover, kept in [-half, N - half - 1].
                const half = Math.floor(N / 2);
                const o = ((((k - cur) % N) + N + half) % N) - half;
                const visible = Math.abs(o) <= 1;
                const cover = thumbnailFor(p);
                return (
                  <button
                    key={p.id}
                    type="button"
                    tabIndex={visible ? 0 : -1}
                    onClick={() => (o === 0 ? setOpenId(p.id) : setCur(k))}
                    className="absolute left-1/2 top-1/2 aspect-[4/5] w-[44%] overflow-hidden rounded-2xl bg-muted text-left transition-[transform,opacity] duration-700 ease-in-out"
                    style={{
                      transform: `translate(calc(-50% + ${o * 72}%), -50%) scale(${o === 0 ? 1 : 0.78})`,
                      opacity: !visible ? 0 : o === 0 ? 1 : 0.45,
                      zIndex: 10 - Math.abs(o),
                      pointerEvents: visible ? "auto" : "none",
                    }}
                  >
                    {cover ? (
                      <img
                        src={cover.type?.startsWith("video/") ? cover.thumbUrl : toStorageRenderUrl(cover.thumbUrl)}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Instagram className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
              {N > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setCur((i) => (i - 1 + N) % N)}
                    className="absolute left-0 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
                    aria-label="Anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCur((i) => (i + 1) % N)}
                    className="absolute right-0 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background"
                    aria-label="Próximo"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
            {current && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
                  {current.clientLogoUrl && <img src={toStorageRenderUrl(current.clientLogoUrl)} alt="" className="h-full w-full object-cover" draggable={false} />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">
                    {current.clientName}
                    {current.clientEnded && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">encerrado</span>}
                  </div>
                  <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    {current.publishTime ? current.publishTime.slice(0, 5) : "—"} · {CONTENT_TYPE_LABELS[current.contentType]}
                  </div>
                </div>
                <PublicationStatusLabel pub={current} />
              </div>
            )}
          </div>
        )}
      </CardContent>

      {openPub && openPubFullQ.data && (
        <PublicationPreviewPanel
          publication={openPubFullQ.data}
          media={(attachmentsQ.data?.get(openPub.taskId) ?? []).map((a) => ({ id: a.id, url: a.url, type: a.type }))}
          clientId={openPub.clientId}
          clientName={openPub.clientName}
          clientLogoUrl={openPub.clientLogoUrl}
          onClose={() => setOpenId(null)}
          onOpenTask={onOpenTask}
        />
      )}
    </Card>
  );
}
