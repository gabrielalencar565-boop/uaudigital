import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, Clock, Instagram } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTodayScheduledPublications, useTaskAttachmentsMap } from "@/features/calendario/hooks/use-calendar-data";

const ROTATE_MS = 4500;
// Fraction of the track's own height a drag must cross before it counts as a swipe
// instead of snapping back — matches the "flick" feel of TikTok's vertical feed.
const SWIPE_THRESHOLD = 0.18;

export function TodayInstagramLoopWidget() {
  const todayKey = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const pubsQ = useTodayScheduledPublications(todayKey);
  const publications = pubsQ.data ?? [];
  const taskIds = useMemo(() => publications.map((p) => p.taskId), [publications]);
  const attachmentsQ = useTaskAttachmentsMap(taskIds);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dragY, setDragY] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; height: number } | null>(null);

  useEffect(() => {
    // A post added/removed can shift what index `index` points at — snap back to a
    // valid slide instead of rendering nothing or crashing on an out-of-range item.
    if (index >= publications.length) setIndex(0);
  }, [publications.length, index]);

  useEffect(() => {
    if (publications.length <= 1 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % publications.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [publications.length, paused]);

  const goTo = (next: number) => {
    if (publications.length === 0) return;
    setIndex(((next % publications.length) + publications.length) % publications.length);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (publications.length <= 1) return;
    setPaused(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragState.current = { startY: e.clientY, height: trackRef.current?.clientHeight ?? 1 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    setDragY(e.clientY - dragState.current.startY);
  };
  const endDrag = () => {
    if (!dragState.current) return;
    const { height } = dragState.current;
    if (dragY < -height * SWIPE_THRESHOLD) goTo(index + 1); // swiped up -> next
    else if (dragY > height * SWIPE_THRESHOLD) goTo(index - 1); // swiped down -> previous
    dragState.current = null;
    setDragY(0);
    setPaused(false);
  };

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
          <div className="mx-3 mb-3 flex gap-1.5">
            <div
              ref={trackRef}
              className="relative h-64 flex-1 touch-none select-none overflow-hidden rounded-lg bg-black"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
            >
              {publications.map((p, i) => {
                const cover = attachmentsQ.data?.get(p.taskId)?.[0];
                // TikTok-style vertical stack: every slide sits at its own 100%-height
                // offset, translated as one unit so swiping up brings the next slide in
                // from below instead of just cross-fading the content.
                const offset = (i - index) * 100;
                const dragPct = dragState.current ? (dragY / dragState.current.height) * 100 : 0;
                return (
                  <div
                    key={p.id}
                    className={cn("absolute inset-0", dragState.current ? "" : "transition-transform duration-400 ease-out")}
                    style={{ transform: `translateY(${offset + dragPct}%)` }}
                  >
                    {cover ? (
                      <img src={cover.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <Instagram className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-2.5 py-2">
                      <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full bg-muted">
                        {p.clientLogoUrl && <img src={p.clientLogoUrl} alt="" className="h-full w-full object-cover" />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">{p.clientName}</span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 space-y-1 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-4">
                      {p.caption && <p className="line-clamp-2 text-[11px] text-white/90">{p.caption}</p>}
                      <p className="flex items-center gap-1 text-[10px] text-white/70">
                        <Clock className="h-2.5 w-2.5" />
                        Hoje{p.publishTime ? ` às ${p.publishTime.slice(0, 5)}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex w-6 shrink-0 flex-col items-center justify-end gap-3 pb-2 text-foreground/70">
              <Heart className="h-4 w-4" />
              <MessageCircle className="h-4 w-4" />
              <Send className="h-4 w-4" />
              <Bookmark className="h-4 w-4" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
