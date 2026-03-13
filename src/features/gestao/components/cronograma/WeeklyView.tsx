import { useState, useMemo, useCallback, useRef } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Cake, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { getIconById } from "@/features/agenda/components/IconPicker";
import { POST_TYPE_META, type CronogramaViewProps } from "./types";

function SpecialDatesBadges({ dates }: { dates: import("@/features/agenda/hooks/use-agenda-dates").SpecialDate[] }) {
  return (
    <>
      {dates.map((sd, i) => {
        const isBirthday = sd.type === "birthday";
        const isHoliday = sd.type === "holiday";
        const IconComp = sd.icon ? getIconById(sd.icon) : isHoliday ? Star : null;
        return (
          <div key={i} className="flex items-center gap-1 rounded-md px-1.5 py-0.5" style={{ backgroundColor: isBirthday ? "hsl(var(--warning) / 0.15)" : isHoliday ? "hsl(var(--accent) / 0.3)" : (sd.color ?? "#7C5CFF") + "15" }}>
            {isBirthday ? <Cake className="h-2.5 w-2.5" style={{ color: "hsl(var(--warning))" }} /> : IconComp ? <IconComp className="h-2.5 w-2.5" style={{ color: sd.color ?? "hsl(var(--accent-foreground))" }} /> : null}
            <span className="text-[8px] font-medium truncate" style={{ color: isBirthday ? "hsl(var(--warning))" : sd.color ?? "hsl(var(--accent-foreground))" }}>
              {isBirthday ? sd.personName : sd.label}
            </span>
          </div>
        );
      })}
    </>
  );
}

export function WeeklyView({ posts, selectedPost, onSelectPost, onDateChange, specialDatesMap }: CronogramaViewProps) {
  const isMobile = useIsMobile();
  const [cursor, setCursor] = useState(() => {
    const first = posts.find(t => t.posting_date);
    return startOfWeek(first?.posting_date ? parseISO(first.posting_date) : new Date(), { weekStartsOn: 0 });
  });
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const dragPostId = useRef<string | null>(null);

  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(cursor, { weekStartsOn: 0 }),
    end: endOfWeek(cursor, { weekStartsOn: 0 }),
  }), [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, typeof posts>();
    posts.forEach(p => {
      if (!p.posting_date) return;
      map.set(p.posting_date, [...(map.get(p.posting_date) ?? []), p]);
    });
    return map;
  }, [posts]);

  const weekLabel = `${format(days[0], "dd MMM", { locale: ptBR })} — ${format(days[6], "dd MMM yyyy", { locale: ptBR })}`;

  const handleDragStart = useCallback((postId: string) => {
    dragPostId.current = postId;
  }, []);

  const handleDrop = useCallback((dayKey: string) => {
    if (dragPostId.current && onDateChange) {
      onDateChange(dragPostId.current, dayKey);
    }
    dragPostId.current = null;
    setDragOverDay(null);
  }, [onDateChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => subWeeks(d, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-bold capitalize flex-1 text-center">{weekLabel}</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => addWeeks(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {isMobile ? (
        /* Mobile: vertical stack of days */
        <div className="space-y-2">
          {days.map(day => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay.get(key) ?? [];
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={key}
                className={cn(
                  "rounded-xl border p-3 transition-all",
                  isToday ? "border-primary/40 bg-primary/5" : "border-border/20 bg-card/20",
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn(
                    "text-xs uppercase font-semibold",
                    isToday ? "text-primary" : "text-muted-foreground/60"
                  )}>
                    {format(day, "EEE", { locale: ptBR })}
                  </div>
                  <div className={cn(
                    "text-base font-bold",
                    isToday ? "text-primary" : ""
                  )}>
                    {format(day, "d")}
                  </div>
                </div>

                {(specialDatesMap?.get(key) ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    <SpecialDatesBadges dates={specialDatesMap!.get(key)!} />
                  </div>
                )}

                {dayPosts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">Sem postagens</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayPosts.map(post => {
                      const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
                      const Icon = meta.icon;
                      const imgUrl = post.attachment_url || post.cover_url;
                      const isSelected = selectedPost?.id === post.id;

                      return (
                        <div
                          key={post.id}
                          className={cn(
                            "rounded-lg border p-2 transition-all",
                            isSelected ? "ring-2 ring-primary border-primary/40" : "border-border/30",
                          )}
                          onClick={() => onSelectPost(post)}
                        >
                          <div className="flex items-center gap-2">
                            {imgUrl && (
                              <img src={imgUrl} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Icon className="h-3 w-3 shrink-0" />
                                <span className="text-xs font-medium truncate">{post.title}</span>
                              </div>
                              {post.posting_time && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                                  <span className="text-[10px] text-muted-foreground">{post.posting_time}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop: 7-column grid */
        <div className="grid grid-cols-7 gap-2">
          {days.map(day => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = postsByDay.get(key) ?? [];
            const isToday = isSameDay(day, new Date());
            const isDragOver = dragOverDay === key;

            return (
              <div
                key={key}
                className={cn(
                  "rounded-xl border p-2 min-h-[160px] transition-all",
                  isToday ? "border-primary/40 bg-primary/5" : "border-border/20 bg-card/20",
                  isDragOver && "border-primary ring-2 ring-primary/30 bg-primary/10",
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOverDay(key); }}
                onDragLeave={() => setDragOverDay(null)}
                onDrop={(e) => { e.preventDefault(); handleDrop(key); }}
              >
                <div className="text-center mb-2">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground/60">
                    {format(day, "EEE", { locale: ptBR })}
                  </div>
                  <div className={cn(
                    "text-lg font-bold mx-auto w-8 h-8 flex items-center justify-center rounded-full",
                    isToday ? "bg-primary text-primary-foreground" : ""
                  )}>
                    {format(day, "d")}
                  </div>
                </div>

                {(specialDatesMap?.get(key) ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mb-1">
                    <SpecialDatesBadges dates={specialDatesMap!.get(key)!} />
                  </div>
                )}

                <div className="space-y-1.5">
                  {dayPosts.map(post => {
                    const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
                    const Icon = meta.icon;
                    const imgUrl = post.attachment_url || post.cover_url;
                    const isSelected = selectedPost?.id === post.id;

                    return (
                      <div
                        key={post.id}
                        draggable
                        onDragStart={() => handleDragStart(post.id)}
                        className={cn(
                          "rounded-lg border p-1.5 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]",
                          isSelected ? "ring-2 ring-primary border-primary/40" : "border-border/30",
                          meta.color.replace("text-", "").includes("pink") ? "bg-pink-500/5" :
                          meta.color.includes("blue") ? "bg-blue-500/5" :
                          meta.color.includes("emerald") ? "bg-emerald-500/5" : "bg-amber-500/5"
                        )}
                        onClick={() => onSelectPost(post)}
                      >
                        {imgUrl && (
                          <img src={imgUrl} alt="" className="w-full aspect-square rounded-md object-cover mb-1" />
                        )}
                        <div className="flex items-center gap-1">
                          <Icon className="h-2.5 w-2.5 shrink-0" />
                          <span className="text-[9px] font-medium truncate">{post.title}</span>
                        </div>
                        {post.posting_time && (
                          <div className="flex items-center gap-0.5 mt-0.5">
                            <Clock className="h-2 w-2 text-muted-foreground" />
                            <span className="text-[8px] text-muted-foreground">{post.posting_time}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
