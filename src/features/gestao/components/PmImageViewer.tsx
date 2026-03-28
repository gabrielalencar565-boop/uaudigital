import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Download, Share2, Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  images: { url: string; name: string }[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

export function PmImageViewer({ images, initialIndex, open, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const current = images[index];
  if (!current) return null;

  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent hideClose className="z-[200] max-w-[100vw] w-[100vw] max-h-[100vh] h-[100vh] p-0 gap-0 bg-black/95 border-0 rounded-none flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <span className="text-sm text-white/80 font-medium truncate">{current.name}</span>
          <div className="flex items-center gap-2">
            <a href={current.url} download={current.name} target="_blank" rel="noopener noreferrer">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10">
                <Download className="h-4 w-4" />
              </Button>
            </a>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image */}
        <div className="flex-1 flex items-center justify-center relative min-h-0 px-16">
          {hasPrev && (
            <button
              onClick={() => setIndex(i => i - 1)}
              className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <img
            src={current.url}
            alt={current.name}
            className="max-w-full max-h-full object-contain"
          />
          {hasNext && (
            <button
              onClick={() => setIndex(i => i + 1)}
              className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
