import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { POST_TYPE_META, type CronogramaViewProps } from "./types";

export function MonthlyView({ posts, selectedPost, onSelectPost }: CronogramaViewProps) {
  const [cursor, setCursor] = useState(() => {
    const first = posts.find(t => t.posting_date);
    return startOfMonth(first?.posting_date ? parseISO(first.posting_date) : new Date());
  });

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) }), [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, typeof posts>();
    posts.forEach(p => {
      if (!p.posting_date) return;
      map.set(p.posting_date, [...(map.get(p.posting_date) ?? []), p]);
    });
    return map;
  }, [posts]);

  return (
    <div className="space-y-3">
      {/* Month nav */}
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

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
          <div key={d} className="px-1 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider text-center">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`b-${i}`} className="min-h-20" />)}
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const isToday = isSameDay(day, new Date());
          const hasSelected = selectedPost?.posting_date === key;

          return (
            <div
              key={key}
              className={cn(
                "min-h-20 rounded-xl border p-1.5 transition-all cursor-pointer",
                dayPosts.length > 0 ? "border-primary/30 bg-primary/5 hover:border-primary/60" : "border-border/20 bg-card/20",
                isToday && "ring-2 ring-primary/20",
                hasSelected && "ring-2 ring-primary"
              )}
              onClick={() => dayPosts.length > 0 && onSelectPost(dayPosts[0])}
            >
              <div className={cn("text-[10px] font-bold mb-1", isToday ? "text-primary" : "text-muted-foreground/60")}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayPosts.map(post => {
                  const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
                  const Icon = meta.icon;
                  return (
                    <div
                      key={post.id}
                      className={cn("flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate cursor-pointer transition-all hover:scale-[1.02]", meta.color)}
                      onClick={(e) => { e.stopPropagation(); onSelectPost(post); }}
                    >
                      <Icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{post.title}</span>
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
