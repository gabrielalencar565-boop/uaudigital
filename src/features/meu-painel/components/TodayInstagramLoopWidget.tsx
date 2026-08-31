import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Instagram, ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useTodayScheduledPublications,
  useTaskAttachmentsMap,
  useCoverAttachmentsById,
  useCalendarPublicationById,
  type TodayScheduledPublication,
} from "@/features/calendario/hooks/use-calendar-data";
import { CONTENT_TYPE_ICON, getContentTypeColor } from "@/features/calendario/components/PublicationCard";
import { CONTENT_TYPE_LABELS } from "@/features/calendario/calendar-types";
import { PublicationPreviewPanel } from "@/features/calendario/components/PublicationPreviewPanel";

interface Props {
  onOpenTask: (taskId: string) => void;
}

const ROTATE_MS = 5000;
const VISIBLE = 2;
// How many clone slides get padded onto each end of the strip so the last real post can
// still slide into view instead of leaving an empty gap where the "missing" second card
// would be — see the wrap-around comment on step() below.
const CLONES = VISIBLE - 1;
const GAP_PX = 8;
// Fraction of one card's own width a drag must cross before it counts as a swipe
// instead of snapping back.
const SWIPE_THRESHOLD = 0.3;

export function TodayInstagramLoopWidget({ onOpenTask }: Props) {
  const todayKey = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const pubsQ = useTodayScheduledPublications(todayKey);
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
    return attachmentsQ.data?.get(p.taskId)?.[0];
  };

  const N = publications.length;
  // Infinite loop: pad a clone of the tail before the real items and a clone of the head
  // after them, so the visible window always has enough cards to fill it — without this,
  // sliding to the actual last post left the second slot empty (nothing left to show).
  // Real items live at extended indices [CLONES, CLONES + N - 1]; index starts there.
  const extended = useMemo(() => {
    if (N === 0) return [];
    const head = publications.slice(0, CLONES);
    const tail = publications.slice(Math.max(0, N - CLONES));
    return [...tail, ...publications, ...head];
  }, [publications, N]);

  const [index, setIndex] = useState(CLONES);
  const [paused, setPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [instant, setInstant] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; width: number } | null>(null);

  useEffect(() => {
    setIndex(CLONES);
  }, [N]);

  useEffect(() => {
    if (N <= 1 || paused) return;
    const id = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, [N, paused]);

  // Once a slide finishes animating into a cloned slot, snap invisibly (no transition)
  // back to the equivalent real position — that clone shows exactly the same content, so
  // the jump is imperceptible and the loop reads as continuous in either direction.
  const handleTransitionEnd = (e: React.TransitionEvent) => {
    // Card buttons have their own hover-brightness transition, which bubbles up here too
    // — only react to the track's own transform transition finishing, not a child's.
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    if (index >= CLONES + N) {
      setInstant(true);
      setIndex(index - N);
    } else if (index < CLONES) {
      setInstant(true);
      setIndex(index + N);
    }
  };
  useEffect(() => {
    if (!instant) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
    return () => cancelAnimationFrame(id);
  }, [instant]);

  const step = (dir: 1 | -1) => setIndex((i) => i + dir);

  const onPointerDown = (e: React.PointerEvent) => {
    if (N <= 1) return;
    setPaused(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, width: (trackRef.current?.clientWidth ?? VISIBLE * 100) / VISIBLE };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    setDragX(e.clientX - dragState.current.startX);
  };
  const endDrag = () => {
    if (!dragState.current) return;
    const { width } = dragState.current;
    if (dragX < -width * SWIPE_THRESHOLD) step(1);
    else if (dragX > width * SWIPE_THRESHOLD) step(-1);
    dragState.current = null;
    setDragX(0);
    setPaused(false);
  };

  const cardWidthPct = 100 / VISIBLE;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Instagram className="h-4 w-4 text-primary" />
          Hoje no Instagram
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-0">
        {N === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 pb-4 text-center text-sm text-muted-foreground">
            Nenhuma publicação prevista pra hoje
          </div>
        ) : (
          // Card stretches to match the left column's height (Atribuídas a mim +
          // Menções stacked); the media strip itself stays at its own natural size and
          // is centered in whatever extra vertical room that leaves, instead of
          // distorting the posts' real Instagram aspect ratio to fill the gap.
          <div className="relative mx-2 mb-3 flex flex-1 items-center gap-1.5">
            {N > VISIBLE && (
              <button
                type="button"
                onClick={() => step(-1)}
                className="z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70 transition hover:bg-accent hover:text-foreground"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <div
              ref={trackRef}
              className="touch-none select-none overflow-hidden"
              style={{ gap: GAP_PX }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              <div
                className={cn("flex", !instant && !dragState.current && "transition-transform duration-400 ease-out")}
                onTransitionEnd={handleTransitionEnd}
                style={{
                  gap: GAP_PX,
                  transform: `translateX(calc(-${index * cardWidthPct}% - ${index * GAP_PX}px + ${dragX}px))`,
                }}
              >
                {extended.map((p, i) => {
                  const cover = thumbnailFor(p);
                  const ContentIcon = CONTENT_TYPE_ICON[p.contentType];
                  const contentColor = getContentTypeColor(p.contentType);
                  return (
                    <button
                      key={`${p.id}-${i}`}
                      type="button"
                      onClick={() => setOpenId(p.id)}
                      className="relative aspect-[4/5] shrink-0 overflow-hidden rounded-lg bg-black text-left transition hover:brightness-110"
                      style={{ width: `calc(${cardWidthPct}% - ${(GAP_PX * (VISIBLE - 1)) / VISIBLE}px)` }}
                    >
                      {cover ? (
                        <img src={cover.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" draggable={false} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <Instagram className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/70 to-transparent p-1.5">
                        <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted">
                          {p.clientLogoUrl && <img src={p.clientLogoUrl} alt="" className="h-full w-full object-cover" draggable={false} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white">{p.clientName}</span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                        <span className="flex items-center gap-1 text-[10px] text-white/80">
                          <Clock className="h-3 w-3" />
                          {p.publishTime ? p.publishTime.slice(0, 5) : "—"}
                        </span>
                        <span className={cn("inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold", contentColor.bg, contentColor.text)}>
                          <ContentIcon className="h-2.5 w-2.5" />
                          {CONTENT_TYPE_LABELS[p.contentType]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {N > VISIBLE && (
              <button
                type="button"
                onClick={() => step(1)}
                className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70 transition hover:bg-accent hover:text-foreground"
                aria-label="Próximo"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
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
