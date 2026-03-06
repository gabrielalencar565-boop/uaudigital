import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar, Download, Share2, Film, Image, LayoutGrid, Camera, X, Clock, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";

const POST_TYPE_META: Record<string, { label: string; icon: typeof Film; color: string }> = {
  reels: { label: "Reels", icon: Film, color: "bg-pink-500/20 text-pink-500" },
  carrossel: { label: "Carrossel", icon: LayoutGrid, color: "bg-blue-500/20 text-blue-500" },
  post: { label: "Post", icon: Image, color: "bg-emerald-500/20 text-emerald-500" },
  foto: { label: "Foto", icon: Camera, color: "bg-amber-500/20 text-amber-500" },
};

interface Props {
  parentTask: PmTask;
  childTasks: PmTask[];
  clientName: string;
  membersMap: Record<string, { name: string; avatar?: string }>;
}

export function PmCronogramaTab({ parentTask, childTasks, clientName, membersMap }: Props) {
  const [cursor, setCursor] = useState(() => {
    // Start at the month of the first posting date, or current month
    const firstPosting = childTasks.find(t => t.posting_date);
    return startOfMonth(firstPosting?.posting_date ? parseISO(firstPosting.posting_date) : new Date());
  });
  const [selectedPost, setSelectedPost] = useState<PmTask | null>(null);

  // Only subtasks with posting_date
  const scheduledPosts = useMemo(() =>
    childTasks.filter(t => t.posting_date).sort((a, b) => (a.posting_date! > b.posting_date! ? 1 : -1)),
    [childTasks]
  );

  const days = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, PmTask[]>();
    scheduledPosts.forEach(p => {
      const key = p.posting_date!;
      map.set(key, [...(map.get(key) ?? []), p]);
    });
    return map;
  }, [scheduledPosts]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/cronograma/${parentTask.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado para a área de transferência!");
    } catch {
      toast.info(`Link: ${shareUrl}`);
    }
  };

  const handleDownloadPDF = () => {
    // Open the public cronograma page with print parameter
    const url = `${window.location.origin}/cronograma/${parentTask.id}?print=1`;
    window.open(url, "_blank");
  };

  if (scheduledPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-sm font-semibold mb-1">Nenhuma postagem agendada</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Preencha a data de postagem, tipo e legenda nas subtarefas para montar o cronograma.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5" /> Compartilhar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={handleDownloadPDF}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Calendar */}
        <div className="flex-1">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
              <div key={d} className="px-1 py-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider text-center">{d}</div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {/* Leading blank cells */}
            {Array.from({ length: days[0].getDay() }).map((_, i) => (
              <div key={`blank-${i}`} className="min-h-20" />
            ))}
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
                  onClick={() => dayPosts.length > 0 && setSelectedPost(dayPosts[0])}
                >
                  <div className={cn(
                    "text-[10px] font-bold mb-1",
                    isToday ? "text-primary" : "text-muted-foreground/60"
                  )}>
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
                          onClick={(e) => { e.stopPropagation(); setSelectedPost(post); }}
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

        {/* Right: Post detail preview */}
        {selectedPost && (
          <div className="w-80 shrink-0 border border-border/30 rounded-2xl bg-card/60 backdrop-blur-sm p-4 space-y-4 animate-in slide-in-from-right-5 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-pink-500" />
                <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded">Feed</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedPost(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div>
              <h3 className="text-lg font-bold">{selectedPost.title}</h3>
              {selectedPost.post_type && (
                <Badge className={cn("text-[10px] mt-1", POST_TYPE_META[selectedPost.post_type]?.color ?? "bg-muted")}>
                  {POST_TYPE_META[selectedPost.post_type]?.label ?? selectedPost.post_type}
                </Badge>
              )}
            </div>

            {/* Caption */}
            {selectedPost.caption && (
              <div>
                <h4 className="text-xs font-bold mb-1">Legenda:</h4>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{selectedPost.caption}</p>
              </div>
            )}

            {/* Date & Time */}
            <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">
                Data: {selectedPost.posting_date ? format(parseISO(selectedPost.posting_date), "dd/MM/yy") : "—"}
              </span>
              {selectedPost.posting_time && (
                <>
                  <Clock className="h-3.5 w-3.5 text-primary ml-2" />
                  <span className="text-xs font-semibold">Horário: {selectedPost.posting_time}</span>
                </>
              )}
            </div>

            {/* Attachments preview */}
            {selectedPost.cover_url && (
              <img src={selectedPost.cover_url} alt="" className="w-full rounded-xl object-cover aspect-square" />
            )}
          </div>
        )}
      </div>

      {/* Posts list below calendar */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Todas as postagens</h4>
        {scheduledPosts.map(post => {
          const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
          const Icon = meta.icon;
          return (
            <div
              key={post.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl border border-border/20 cursor-pointer transition hover:bg-card/60",
                selectedPost?.id === post.id && "ring-2 ring-primary bg-primary/5"
              )}
              onClick={() => setSelectedPost(post)}
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", meta.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{post.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yy", { locale: ptBR }) : "—"}
                  {post.posting_time ? ` às ${post.posting_time}` : ""}
                </p>
              </div>
              <Badge className={cn("text-[9px] shrink-0", meta.color)}>{meta.label}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
