import { useState, useMemo, useCallback, useRef } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Cake, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { getIconById } from "@/features/agenda/components/IconPicker";
import { POST_TYPE_META, type CronogramaViewProps } from "./types";

function SpecialDatesBadges({ dates }: { dates: ReturnType<typeof import("@/features/agenda/hooks/use-agenda-dates").useAgendaSpecialDates> extends Map<string, infer V> ? V : never }) {
  return (
    <>
      {dates.map((sd, i) => {
        const isBirthday = sd.type === "birthday";
        const isHoliday = sd.type === "holiday";
        const IconComp = sd.icon ? getIconById(sd.icon) : isHoliday ? Star : null;
        return (
          <div key={i} className="flex items-center gap-1 rounded-md px-1 py-0.5" style={{ backgroundColor: isBirthday ? "hsl(var(--warning) / 0.15)" : isHoliday ? "hsl(var(--accent) / 0.3)" : (sd.color ?? "#7C5CFF") + "15" }}>
            {isBirthday ? <Cake className="h-2.5 w-2.5" style={{ color: "hsl(var(--warning))" }} /> : IconComp ? <IconComp className="h-2.5 w-2.5" style={{ color: sd.color ?? "hsl(var(--accent-foreground))" }} /> : null}
            <span className="text-[7px] font-medium truncate" style={{ color: isBirthday ? "hsl(var(--warning))" : sd.color ?? "hsl(var(--accent-foreground))" }}>
              {isBirthday ? sd.personName : sd.label}
            </span>
          </div>
        );
      })}
    </>
  );
}

export function MonthlyView({ posts, selectedPost, onSelectPost, onDateChange, specialDatesMap }: CronogramaViewProps) {
  const isMobile = useIsMobile();
  const [cursor, setCursor] = useState(() => {
    const first = posts.find(t => t.posting_date);
    return startOfMonth(first?.posting_date ? parseISO(first.posting_date) : new Date());
  });
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const dragPostId = useRef<string | null>(null);

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) }), [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, typeof posts>();
    posts.forEach(p => {
      if (!p.posting_date) return;
      map.set(p.posting_date, [...(map.get(p.posting_date) ?? []), p]);
    });
    return map;
  }, [posts]);

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

  // Mobile: list view grouped by day
  if (isMobile) {
    const daysWithPosts = days.filter(d => {
      const key = format(d, "yyyy-MM-dd");
      return (postsByDay.get(key) ?? []).length > 0;
    });

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => startOfMonth(subMonths(d, 1)))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-bold capitalize flex-1 text-center">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => startOfMonth(addMonths(d, 1)))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {daysWithPosts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma postagem neste mês.</p>
        )}

        {daysWithPosts.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const isToday = isSameDay(day, new Date());

          return (
            <div key={key} className={cn(
              "rounded-xl border p-3 space-y-2",
              isToday ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/20"
            )}>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-bold", isToday && "text-primary")}>
                  {format(day, "dd")}
                </span>
                <span className="text-xs text-muted-foreground capitalize">
                  {format(day, "EEEE", { locale: ptBR })}
                </span>
              </div>
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
                        <img src={imgUrl} alt="" className="h-10 w-10 rounded object-cover shrink-0" />
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
          );
        })}
      </div>
    );
  }

  // Desktop: grid calendar
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => startOfMonth(subMonths(d, 1)))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-bold capitalize min-w-[140px] text-center">
          {format(cursor, "MMMM yyyy", { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => startOfMonth(addMonths(d, 1)))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
          <div key={d} className="px-1 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider text-center">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`b-${i}`} className="min-h-24" />)}
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const isToday = isSameDay(day, new Date());
          const hasSelected = selectedPost?.posting_date === key;
          const isDragOver = dragOverDay === key;

          return (
            <div
              key={key}
              className={cn(
                "min-h-24 rounded-xl border p-1.5 transition-all cursor-pointer",
                dayPosts.length > 0 ? "border-primary/30 bg-primary/5 hover:border-primary/60" : "border-border/20 bg-card/20",
                isToday && "ring-2 ring-primary/20",
                hasSelected && "ring-2 ring-primary",
                isDragOver && "border-primary ring-2 ring-primary/30 bg-primary/10",
              )}
              onClick={() => dayPosts.length > 0 && onSelectPost(dayPosts[0])}
              onDragOver={(e) => { e.preventDefault(); setDragOverDay(key); }}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(key); }}
            >
              <div className={cn("text-[10px] font-bold mb-1", isToday ? "text-primary" : "text-muted-foreground/60")}>
                {format(day, "d")}
              </div>
              <div className="space-y-1">
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
                        "rounded-lg border p-1 cursor-grab active:cursor-grabbing transition-all hover:scale-[1.02]",
                        isSelected ? "ring-1 ring-primary border-primary/40" : "border-border/30",
                        meta.color.includes("pink") ? "bg-pink-500/5" :
                        meta.color.includes("blue") ? "bg-blue-500/5" :
                        meta.color.includes("emerald") ? "bg-emerald-500/5" : "bg-amber-500/5"
                      )}
                      onClick={(e) => { e.stopPropagation(); onSelectPost(post); }}
                    >
                      {imgUrl && (
                        <img src={imgUrl} alt="" className="w-full aspect-square rounded object-cover mb-0.5" />
                      )}
                      <div className="flex items-center gap-1">
                        <Icon className="h-2.5 w-2.5 shrink-0" />
                        <span className="text-[8px] font-medium truncate">{post.title}</span>
                      </div>
                      {post.posting_time && (
                        <div className="flex items-center gap-0.5 mt-0.5">
                          <Clock className="h-2 w-2 text-muted-foreground" />
                          <span className="text-[7px] text-muted-foreground">{post.posting_time}</span>
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
    </div>
  );
}
