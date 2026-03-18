import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, List, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { POST_TYPE_META, type CronogramaViewProps } from "./types";

export function ListView({ posts, selectedPost, onSelectPost }: CronogramaViewProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof posts>();
    posts.forEach(p => {
      const key = p.posting_date ?? "sem-data";
      map.set(key, [...(map.get(key) ?? []), p]);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [posts]);

  if (posts.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <List className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-bold">Lista de Postagens</span>
        <span className="text-[11px] text-muted-foreground ml-auto">{posts.length} postagens</span>
      </div>

      <div className="rounded-xl border border-border/30 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_100px_80px] gap-2 px-4 py-2.5 bg-muted/10 border-b border-border/20">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Postagem</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Data</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Horário</span>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tipo</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/10">
          {grouped.map(([dateKey, datePosts]) => (
            <div key={dateKey}>
              {/* Date group header */}
              <div className="px-4 py-1.5 bg-muted/5">
                <span className="text-[10px] font-semibold text-muted-foreground capitalize">
                  {dateKey === "sem-data"
                    ? "Sem data definida"
                    : format(parseISO(dateKey), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </span>
              </div>

              {datePosts.map(post => {
                const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
                const Icon = meta.icon;
                const imgUrl = post.attachment_url || post.cover_url;
                const isSelected = selectedPost?.id === post.id;

                return (
                  <div
                    key={post.id}
                    className={cn(
                      "grid grid-cols-[1fr_120px_100px_80px] gap-2 px-4 py-2.5 cursor-pointer transition-all hover:bg-muted/10",
                      isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                    )}
                    onClick={() => onSelectPost(post)}
                  >
                    {/* Title + thumbnail */}
                    <div className="flex items-center gap-3 min-w-0">
                      {imgUrl ? (
                        <img src={imgUrl} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", meta.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{post.title}</p>
                        {post.caption && (
                          <p className="text-[10px] text-muted-foreground truncate max-w-[280px]">
                            {post.caption.replace(/<[^>]+>/g, "").slice(0, 60)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-center">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yyyy") : "—"}
                      </span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-1.5">
                      {post.posting_time ? (
                        <>
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{post.posting_time}</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Type badge */}
                    <div className="flex items-center">
                      <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium", meta.color)}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
