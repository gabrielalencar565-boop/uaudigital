import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, X, Clock, Instagram, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { POST_TYPE_META, type CronogramaPost } from "./types";
import { SmartCaptionEditor } from "../SmartCaptionEditor";

interface Props {
  post: CronogramaPost & { all_attachment_urls?: string[] };
  onClose: () => void;
  onUpdate: (field: string, value: string | null) => void;
  onRename?: (newTitle: string) => void;
}

export function PostDetailSidebar({ post, onClose, onUpdate, onRename }: Props) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");

  const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
  const allImages = post.all_attachment_urls ?? [];
  const isCarousel = post.post_type === "carrossel" && allImages.length > 1;
  const singleImg = post.attachment_url || post.cover_url;

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  const saveField = (field: string) => {
    if (field === "title" && onRename) {
      onRename(tempValue);
    } else {
      onUpdate(field, tempValue || null);
    }
    setEditingField(null);
  };

  return (
    <div className="w-full max-w-sm shrink-0 border border-border/30 rounded-2xl bg-card/60 backdrop-blur-sm p-4 space-y-4 animate-in slide-in-from-right-5 duration-200 overflow-y-auto max-h-[70vh]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-pink-500" />
          <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded">Feed</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Title — click to rename */}
      <div>
        {editingField === "title" ? (
          <Input
            autoFocus
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => saveField("title")}
            onKeyDown={(e) => e.key === "Enter" && saveField("title")}
            className="text-lg font-bold h-9"
          />
        ) : (
          <div
            className="cursor-pointer group flex items-center gap-1 hover:text-primary transition-colors"
            onClick={() => startEditing("title", post.title)}
          >
            <h3 className="text-lg font-bold">{post.title}</h3>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
          </div>
        )}
        {post.post_type && (
          <Badge className={cn("text-[10px] mt-1", meta.color)}>
            {meta.label}
          </Badge>
        )}
      </div>

      {/* Images — carousel shows in 3-col grid */}
      {isCarousel ? (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground font-medium">{allImages.length} páginas</p>
          <div className="grid grid-cols-3 gap-1 max-h-[320px] overflow-y-auto pr-1">
            {allImages.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Página ${i + 1}`} className="w-full aspect-square rounded-lg object-cover" />
            ))}
          </div>
        </div>
      ) : singleImg ? (
        <img src={singleImg} alt="" className="w-full rounded-xl object-cover aspect-square" />
      ) : null}

      {/* Date — click to edit */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
          {editingField === "posting_date" ? (
            <Input
              type="date"
              autoFocus
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => saveField("posting_date")}
              onKeyDown={(e) => e.key === "Enter" && saveField("posting_date")}
              className="h-7 text-xs flex-1"
            />
          ) : (
            <div
              className="flex-1 text-sm cursor-pointer group flex items-center gap-1 hover:text-primary transition-colors"
              onClick={() => startEditing("posting_date", post.posting_date ?? "")}
            >
              <span>{post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yyyy", { locale: ptBR }) : "Sem data"}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
          {editingField === "posting_time" ? (
            <Input
              type="time"
              autoFocus
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => saveField("posting_time")}
              onKeyDown={(e) => e.key === "Enter" && saveField("posting_time")}
              className="h-7 text-xs flex-1"
            />
          ) : (
            <div
              className="flex-1 text-sm cursor-pointer group flex items-center gap-1 hover:text-primary transition-colors"
              onClick={() => startEditing("posting_time", post.posting_time ?? "")}
            >
              <span>{post.posting_time || "Sem horário"}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
          )}
        </div>
      </div>

      {/* Caption — click to edit */}
      <div>
        <h4 className="text-xs font-bold mb-1">Legenda:</h4>
        {editingField === "caption" ? (
          <Textarea
            autoFocus
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => saveField("caption")}
            placeholder="Escreva a legenda..."
            className="text-xs min-h-[80px] rounded-lg resize-none"
          />
        ) : (
          <div
            className="text-sm text-muted-foreground whitespace-pre-wrap cursor-pointer group rounded-lg p-2 hover:bg-muted/50 transition-colors min-h-[40px]"
            onClick={() => startEditing("caption", post.caption ?? "")}
          >
            {post.caption || <span className="italic text-muted-foreground/50">Clique para adicionar legenda...</span>}
            <Pencil className="h-3 w-3 inline-block ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />
          </div>
        )}
      </div>
    </div>
  );
}
