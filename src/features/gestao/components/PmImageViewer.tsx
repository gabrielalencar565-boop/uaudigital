import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Download, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  images: { url: string; name: string }[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

function useHeicUrl(url: string, name: string) {
  const [converted, setConverted] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isHeic = /\.heic$/i.test(name);

  useEffect(() => {
    if (!isHeic) { setConverted(null); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const heic2any = (await import("heic2any")).default;
        const result = await heic2any({ blob, toType: "image/jpeg", quality: 0.85 });
        if (cancelled) return;
        const out = Array.isArray(result) ? result[0] : result;
        setConverted(URL.createObjectURL(out));
      } catch {
        if (!cancelled) setConverted(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [url, isHeic]);

  return { src: isHeic ? converted : url, loading: isHeic && loading };
}

export function PmImageViewer({ images, initialIndex, open, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (!open) return;
    setIndex(Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0)));
  }, [open, initialIndex]);

  useEffect(() => {
    setIndex((currentIndex) => Math.min(currentIndex, Math.max(images.length - 1, 0)));
  }, [images.length]);

  const current = images[index];

  const handleDownload = async (url: string, fileName: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Erro ao baixar arquivo");
    }
  };

  if (!current) return null;

  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent hideClose className="z-[200] max-w-[100vw] w-[100vw] max-h-[100vh] h-[100vh] p-0 gap-0 bg-black/95 border-0 rounded-none flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <span className="text-sm text-white/80 font-medium truncate">{current.name}</span>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => handleDownload(current.url, current.name)}>
              <Download className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center relative min-h-0 px-16">
          {hasPrev && (
            <button
              onClick={() => setIndex((i) => i - 1)}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-12 w-12 sm:h-10 sm:w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          <ViewerImage url={current.url} name={current.name} />
          {hasNext && (
            <button
              onClick={() => setIndex((i) => i + 1)}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-12 w-12 sm:h-10 sm:w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ViewerImage({ url, name }: { url: string; name: string }) {
  const { src, loading } = useHeicUrl(url, name);

  if (loading) {
    return <Loader2 className="h-8 w-8 animate-spin text-white/50" />;
  }

  return <img src={src ?? url} alt={name} className="max-w-full max-h-full object-contain" />;
}
