import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, Instagram, ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTodayScheduledPublications, useTaskAttachmentsMap } from "@/features/calendario/hooks/use-calendar-data";
import { CONTENT_TYPE_ICON, getContentTypeColor } from "@/features/calendario/components/PublicationCard";

const ROTATE_MS = 5000;
const VISIBLE = 3;
const GAP_PX = 8;
// Fraction of one card's own width a drag must cross before it counts as a swipe
// instead of snapping back.
const SWIPE_THRESHOLD = 0.3;

export function TodayInstagramLoopWidget() {
  const todayKey = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const pubsQ = useTodayScheduledPublications(todayKey);
  const publications = pubsQ.data ?? [];
  const taskIds = useMemo(() => publications.map((p) => p.taskId), [publications]);
  const attachmentsQ = useTaskAttachmentsMap(taskIds);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [instant, setInstant] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; width: number } | null>(null);

  useEffect(() => {
    if (index >= publications.length) setIndex(0);
  }, [publications.length, index]);

  useEffect(() => {
    if (publications.length <= 1 || paused) return;
    const id = setInterval(() => step(1), ROTATE_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publications.length, paused, index]);

  // Advancing forward off the last item (or backward off the first) would otherwise
  // animate a long slide across the whole strip back to the opposite end — instead the
  // wrap is done as an un-animated snap, so the loop reads as continuous.
  const step = (dir: 1 | -1) => {
    if (publications.length === 0) return;
    setIndex((i) => {
      const next = i + dir;
      if (next < 0 || next >= publications.length) {
        setInstant(true);
        requestAnimationFrame(() => requestAnimationFrame(() => setInstant(false)));
        return dir === 1 ? 0 : publications.length - 1;
      }
      return next;
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (publications.length <= 1) return;
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Instagram className="h-4 w-4 text-primary" />
          Hoje no Instagram
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {publications.length === 0 ? (
          <div className="px-4 pb-4 text-center text-sm text-muted-foreground">
            Nenhuma publicação prevista pra hoje
          </div>
        ) : (
          <div className="relative mx-3 mb-3 flex items-center gap-1">
            {publications.length > VISIBLE && (
              <button
                type="button"
                onClick={() => step(-1)}
                className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70 transition hover:bg-accent hover:text-foreground"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
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
                style={{
                  gap: GAP_PX,
                  transform: `translateX(calc(-${index * cardWidthPct}% - ${index * GAP_PX}px + ${dragX}px))`,
                }}
              >
                {publications.map((p) => {
                  const cover = attachmentsQ.data?.get(p.taskId)?.[0];
                  const ContentIcon = CONTENT_TYPE_ICON[p.contentType];
                  const contentColor = getContentTypeColor(p.contentType);
                  return (
                    <div
                      key={p.id}
                      className="relative aspect-[4/5] shrink-0 overflow-hidden rounded-lg bg-black"
                      style={{ width: `calc(${cardWidthPct}% - ${(GAP_PX * (VISIBLE - 1)) / VISIBLE}px)` }}
                    >
                      {cover ? (
                        <img src={cover.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" draggable={false} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-muted">
                          <Instagram className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 top-0 flex items-center gap-1 bg-gradient-to-b from-black/70 to-transparent p-1">
                        <span className="h-4 w-4 shrink-0 overflow-hidden rounded-full bg-muted">
                          {p.clientLogoUrl && <img src={p.clientLogoUrl} alt="" className="h-full w-full object-cover" draggable={false} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[9px] font-semibold text-white">{p.clientName}</span>
                      </div>
                      <span className={cn("absolute right-1 top-6 flex h-4 w-4 items-center justify-center rounded-full", contentColor.bg, contentColor.text)} title={p.contentType}>
                        <ContentIcon className="h-2.5 w-2.5" />
                      </span>
                      <div className="absolute inset-x-0 bottom-0 flex items-center gap-0.5 bg-gradient-to-t from-black/80 to-transparent p-1">
                        <Clock className="h-2.5 w-2.5 text-white/80" />
                        <span className="text-[9px] text-white/80">{p.publishTime ? p.publishTime.slice(0, 5) : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {publications.length > VISIBLE && (
              <button
                type="button"
                onClick={() => step(1)}
                className="z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/70 transition hover:bg-accent hover:text-foreground"
                aria-label="Próximo"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
