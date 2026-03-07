import { useState, useMemo } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { POST_TYPE_META, type CronogramaViewProps } from "./types";

export function WeeklyView({ posts, selectedPost, onSelectPost }: CronogramaViewProps) {
  const [cursor, setCursor] = useState(() => {
    const first = posts.find(t => t.posting_date);
    return startOfWeek(first?.posting_date ? parseISO(first.posting_date) : new Date(), { weekStartsOn: 0 });
  });

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

  return (
    <div className="space-y-3">
      {/* Week nav */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => subWeeks(d, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-bold capitalize min-w-[200px] text-center">{weekLabel}</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setCursor(d => addWeeks(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Week columns */}
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const isToday = isSameDay(day, new Date());

          return (
            <div key={key} className={cn(
              "rounded-xl border p-2 min-h-[160px] transition-all",
              isToday ? "border-primary/40 bg-primary/5" : "border-border/20 bg-card/20",
            )}>
              {/* Day header */}
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

              {/* Posts */}
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
                        "rounded-lg border p-1.5 cursor-pointer transition-all hover:scale-[1.02]",
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
    </div>
  );
}
