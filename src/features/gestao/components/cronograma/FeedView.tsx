import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Instagram } from "lucide-react";
import { cn } from "@/lib/utils";
import { POST_TYPE_META, type CronogramaViewProps } from "./types";
import { Badge } from "@/components/ui/badge";

export function FeedView({ posts, selectedPost, onSelectPost }: CronogramaViewProps) {
  if (posts.length === 0) return null;

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Instagram-style header */}
      <div className="flex items-center gap-2 px-1">
        <Instagram className="h-5 w-5 text-pink-500" />
        <span className="text-sm font-bold">Prévia do Feed</span>
      </div>

      {/* Grid view (3 columns like IG) */}
      <div className="grid grid-cols-3 gap-0.5 rounded-xl overflow-hidden border border-border/30">
        {posts.map(post => {
          const imgUrl = post.attachment_url || post.cover_url;
          const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
          const Icon = meta.icon;
          const isSelected = selectedPost?.id === post.id;

          return (
            <div
              key={post.id}
              className={cn(
                "relative aspect-square cursor-pointer group overflow-hidden",
                isSelected && "ring-2 ring-primary ring-inset"
              )}
              onClick={() => onSelectPost(post)}
            >
              {imgUrl ? (
                <img src={imgUrl} alt="" className="w-full h-full object-cover transition group-hover:scale-105" />
              ) : (
                <div className={cn("w-full h-full flex flex-col items-center justify-center gap-1", meta.color.split(" ")[0])}>
                  <Icon className="h-6 w-6 opacity-60" />
                  <span className="text-[8px] font-medium opacity-60">{meta.label}</span>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="text-white text-center">
                  <Icon className="h-4 w-4 mx-auto mb-0.5" />
                  <span className="text-[9px] font-medium">{meta.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full feed view (scrollable post cards) */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Feed Detalhado</h4>
        {posts.map(post => {
          const imgUrl = post.attachment_url || post.cover_url;
          const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
          const isSelected = selectedPost?.id === post.id;

          return (
            <div
              key={post.id}
              className={cn(
                "rounded-2xl border overflow-hidden cursor-pointer transition-all hover:shadow-lg",
                isSelected ? "ring-2 ring-primary border-primary/40" : "border-border/30"
              )}
              onClick={() => onSelectPost(post)}
            >
              {/* Post header */}
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-amber-500 p-[2px]">
                  <div className="h-full w-full rounded-full bg-background flex items-center justify-center">
                    <Instagram className="h-3 w-3" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">{post.title}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {post.posting_date ? format(parseISO(post.posting_date), "dd MMM", { locale: ptBR }) : ""}
                    {post.posting_time ? ` • ${post.posting_time}` : ""}
                  </p>
                </div>
                <Badge className={cn("text-[8px] h-4 border-0 shrink-0", meta.color)}>{meta.label}</Badge>
                <MoreHorizontal className="h-4 w-4 text-muted-foreground/40" />
              </div>

              {/* Image */}
              {imgUrl ? (
                <img src={imgUrl} alt="" className="w-full aspect-square object-cover" />
              ) : (
                <div className={cn("w-full aspect-square flex items-center justify-center", meta.color.split(" ")[0])}>
                  <meta.icon className="h-12 w-12 opacity-30" />
                </div>
              )}

              {/* Action bar */}
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex items-center gap-3">
                  <Heart className="h-5 w-5 text-muted-foreground/50" />
                  <MessageCircle className="h-5 w-5 text-muted-foreground/50" />
                  <Send className="h-5 w-5 text-muted-foreground/50" />
                  <Bookmark className="h-5 w-5 text-muted-foreground/50 ml-auto" />
                </div>

                {/* Caption preview */}
                {post.caption && (
                  <p className="text-xs leading-relaxed">
                    <span className="font-semibold mr-1">legenda</span>
                    <span className="text-muted-foreground">{post.caption.length > 120 ? post.caption.slice(0, 120) + "..." : post.caption}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
