import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, X, Clock, Instagram, Pencil, ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePickerInline } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { POST_TYPE_META, type CronogramaPost } from "./types";
import { SmartCaptionEditor } from "../SmartCaptionEditor";
import { PmImageViewer } from "../PmImageViewer";

interface Props {
  post: CronogramaPost & { all_attachment_urls?: string[] };
  onClose: () => void;
  onUpdate: (field: string, value: string | null) => void;
  onRename?: (newTitle: string) => void;
}

export function PostDetailSidebar({ post, onClose, onUpdate, onRename }: Props) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
  const allImages = post.all_attachment_urls ?? [];
  const isCarousel = post.post_type === "carrossel" && allImages.length > 1;
  const singleImg = post.attachment_url || post.cover_url;
  const displayImages = isCarousel ? allImages : singleImg ? [singleImg] : [];

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

  const openViewer = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const viewerImages = isCarousel
    ? allImages.map((url, i) => ({ url, name: `Página ${i + 1}` }))
    : singleImg
      ? [{ url: singleImg, name: post.title }]
      : [];

  const postingDateFormatted = post.posting_date
    ? format(parseISO(post.posting_date), "dd 'DE' MMMM", { locale: ptBR }).toUpperCase()
    : null;

  const timeFormatted = post.posting_time
    ? `ÀS ${post.posting_time.replace(":", ":")}`
    : null;

  return (
    <>
      <div className="w-full max-w-sm shrink-0 border border-border/30 rounded-2xl bg-card overflow-hidden animate-in slide-in-from-right-5 duration-200 max-h-[70vh] overflow-y-auto">
        {/* Instagram-style header */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
              <span className="text-white text-xs font-bold">{post.title?.charAt(0)?.toUpperCase() || "P"}</span>
            </div>
            <div className="flex flex-col">
              {editingField === "title" ? (
                <Input
                  autoFocus
                  value={tempValue}
                  onChange={(e) => setTempValue(e.target.value)}
                  onBlur={() => saveField("title")}
                  onKeyDown={(e) => e.key === "Enter" && saveField("title")}
                  className="h-6 text-sm font-semibold p-0 border-none shadow-none"
                />
              ) : (
                <span
                  className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors leading-tight"
                  onClick={() => startEditing("title", post.title)}
                >
                  {post.title}
                </span>
              )}
              {post.post_type && (
                <span className="text-[10px] text-muted-foreground">{meta.label}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image area with carousel arrows */}
        {displayImages.length > 0 && (
          <div className="relative w-full aspect-square bg-black/5 group">
            <img
              src={displayImages[carouselIndex] || displayImages[0]}
              alt=""
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => openViewer(carouselIndex)}
            />

            {/* Carousel counter badge */}
            {isCarousel && (
              <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                {carouselIndex + 1}/{displayImages.length}
              </div>
            )}

            {/* Prev arrow */}
            {isCarousel && carouselIndex > 0 && (
              <button
                onClick={() => setCarouselIndex(i => i - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-foreground/80 hover:bg-white transition opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Next arrow */}
            {isCarousel && carouselIndex < displayImages.length - 1 && (
              <button
                onClick={() => setCarouselIndex(i => i + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white/90 shadow-sm flex items-center justify-center text-foreground/80 hover:bg-white transition opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}

            {/* Dots indicator */}
            {isCarousel && displayImages.length <= 10 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1">
                {displayImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCarouselIndex(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === carouselIndex ? "w-1.5 bg-primary" : "w-1.5 bg-white/60"
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instagram-style action bar */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-foreground/70" />
            <MessageCircle className="h-5 w-5 text-foreground/70" />
            <Send className="h-5 w-5 text-foreground/70" />
          </div>
          <Bookmark className="h-5 w-5 text-foreground/70" />
        </div>

        {/* Caption + date/time area */}
        <div className="px-3 pb-3 space-y-1.5">
          {/* Caption preview */}
          <div>
            <span className="text-sm font-semibold mr-1">{post.title}</span>
            {post.caption ? (
              <span className="text-sm text-foreground/80">{post.caption.replace(/<[^>]+>/g, '').substring(0, 80)}{post.caption.length > 80 ? '...' : ''}</span>
            ) : (
              <span className="text-sm text-muted-foreground italic">sem legenda</span>
            )}
          </div>

          {/* Date and time */}
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase">
            {editingField === "posting_date" ? (
              <DatePickerInline
                value={tempValue}
                onChange={(v) => { onUpdate("posting_date", v || null); setEditingField(null); }}
              />
            ) : (
              <span
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => startEditing("posting_date", post.posting_date ?? "")}
              >
                {postingDateFormatted || "Sem data"}
              </span>
            )}
            {timeFormatted && (
              <>
                {editingField === "posting_time" ? (
                  <Input
                    type="time"
                    autoFocus
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={() => saveField("posting_time")}
                    onKeyDown={(e) => e.key === "Enter" && saveField("posting_time")}
                    className="h-6 text-[11px] w-20 border-none shadow-none p-0"
                  />
                ) : (
                  <span
                    className="cursor-pointer hover:text-primary transition-colors"
                    onClick={() => startEditing("posting_time", post.posting_time ?? "")}
                  >
                    {timeFormatted}
                  </span>
                )}
              </>
            )}
            {!timeFormatted && editingField !== "posting_time" && (
              <span
                className="cursor-pointer hover:text-primary transition-colors"
                onClick={() => startEditing("posting_time", post.posting_time ?? "")}
              >
                 
              </span>
            )}
          </div>

          {/* Full caption editor */}
          <div className="pt-2 border-t border-border/30">
            <h4 className="text-xs font-bold mb-1 text-muted-foreground">Legenda:</h4>
            <SmartCaptionEditor
              value={post.caption ?? ""}
              onChange={(val) => onUpdate("caption", val || null)}
              placeholder="Escreva a legenda..."
              className="text-xs"
              minHeight="80px"
            />
          </div>
        </div>
      </div>

      {viewerImages.length > 0 && (
        <PmImageViewer
          images={viewerImages}
          initialIndex={viewerIndex}
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
