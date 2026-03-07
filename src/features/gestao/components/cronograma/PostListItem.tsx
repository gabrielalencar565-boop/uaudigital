import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { POST_TYPE_META, type CronogramaPost } from "./types";

interface Props {
  post: CronogramaPost;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
}

export function PostListItem({ post, isSelected, onSelect, onRename }: Props) {
  const [editing, setEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState("");

  const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
  const Icon = meta.icon;
  const imgUrl = post.attachment_url || post.cover_url;

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
    setTempTitle(post.title);
  };

  const saveRename = () => {
    if (tempTitle.trim() && tempTitle !== post.title) {
      onRename(tempTitle.trim());
    }
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-xl border border-border/20 cursor-pointer transition hover:bg-card/60",
        isSelected && "ring-2 ring-primary bg-primary/5"
      )}
      onClick={onSelect}
    >
      {/* Thumbnail */}
      {imgUrl ? (
        <img src={imgUrl} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" />
      ) : (
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", meta.color)}>
          <Icon className="h-4 w-4" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {editing ? (
          <Input
            autoFocus
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(); e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
            className="h-6 text-sm font-medium px-1"
          />
        ) : (
          <div className="flex items-center gap-1 group">
            <p className="text-sm font-medium truncate">{post.title}</p>
            <button
              onClick={startRename}
              className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground">
          {post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yy", { locale: ptBR }) : "—"}
          {post.posting_time ? ` às ${post.posting_time}` : ""}
        </p>
      </div>
      <Badge className={cn("text-[9px] shrink-0", meta.color)}>{meta.label}</Badge>
    </div>
  );
}
