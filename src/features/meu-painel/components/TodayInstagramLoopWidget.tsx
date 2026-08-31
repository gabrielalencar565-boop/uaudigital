import { useEffect, useMemo, useState } from "react";
import { Heart, MessageCircle, Send, Bookmark, Clock, Instagram } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTodayScheduledPublications, useTaskAttachmentsMap } from "@/features/calendario/hooks/use-calendar-data";

const ROTATE_MS = 4500;

export function TodayInstagramLoopWidget() {
  const todayKey = useMemo(() => new Date().toLocaleDateString("en-CA"), []);
  const pubsQ = useTodayScheduledPublications(todayKey);
  const publications = pubsQ.data ?? [];
  const taskIds = useMemo(() => publications.map((p) => p.taskId), [publications]);
  const attachmentsQ = useTaskAttachmentsMap(taskIds);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

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

  const current = publications[index];
  const cover = current ? attachmentsQ.data?.get(current.taskId)?.[0] : undefined;

  return (
    <Card>
      <CardHeader className="pb-3">
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
          <div
            className="mx-3 mb-3 overflow-hidden rounded-lg border border-border/60 bg-background"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
                {current.clientLogoUrl ? (
                  <img src={current.clientLogoUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{current.clientName}</span>
              {publications.length > 1 && (
                <span className="shrink-0 text-[10px] text-muted-foreground">{index + 1}/{publications.length}</span>
              )}
            </div>

            <div className="aspect-square w-full bg-muted">
              {cover ? (
                <img src={cover.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Instagram className="h-8 w-8" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-3 pt-2">
              <div className="flex items-center gap-2.5 text-foreground/70">
                <Heart className="h-4 w-4" />
                <MessageCircle className="h-4 w-4" />
                <Send className="h-4 w-4" />
              </div>
              <Bookmark className="h-4 w-4 text-foreground/70" />
            </div>

            <div className="space-y-1 px-3 pb-3 pt-1">
              {current.caption && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  <span className="mr-1 font-semibold text-foreground">{current.clientName}</span>
                  {current.caption}
                </p>
              )}
              <p className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                <Clock className="h-3 w-3" />
                Hoje{current.publishTime ? ` às ${current.publishTime.slice(0, 5)}` : ""}
              </p>
            </div>

            {publications.length > 1 && (
              <div className="flex items-center justify-center gap-1 pb-2">
                {publications.map((p, i) => (
                  <span
                    key={p.id}
                    className={cn("h-1.5 rounded-full transition-all", i === index ? "w-3 bg-primary" : "w-1.5 bg-muted-foreground/30")}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
