import { cn } from "@/lib/utils";
import { Instagram } from "lucide-react";
import { POST_TYPE_META, type CronogramaViewProps } from "./types";

export function FeedView({ posts, selectedPost, onSelectPost }: CronogramaViewProps) {
  if (posts.length === 0) return null;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Instagram className="h-5 w-5 text-pink-500" />
        <span className="text-sm font-bold">Prévia do Feed</span>
      </div>

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
    </div>
  );
}
