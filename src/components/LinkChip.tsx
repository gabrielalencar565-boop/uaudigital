import { useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectPlatform, fetchLinkPreview, shortenUrl, type LinkPreviewData } from "@/lib/link-preview";

/** The rich hover-preview body — shared between the floating popover here and any other
 * place that wants to render fetched OG metadata (avatar/title + big image), Instagram-card style. */
export function LinkPreviewBody({ url, data }: { url: string; data: LinkPreviewData }) {
  const platform = detectPlatform(url);
  const initials = (data.site_name || platform.label || "?").slice(0, 2).toUpperCase();

  return (
    <div className="w-72 overflow-hidden rounded-xl border border-white/10 bg-[#111214] text-white shadow-2xl">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight">{data.site_name || platform.label}</p>
          <p className="truncate text-[11px] leading-tight text-white/50">{shortenUrl(url)}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/25 transition-colors"
        >
          Abrir <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {data.image && (
        <div className="aspect-square w-full bg-white/5">
          <img src={data.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      {data.title && (
        <div className="px-3 py-2.5 border-t border-white/10">
          <p className="line-clamp-2 text-[12px] leading-relaxed text-white/70">{data.title}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline "chip" for a URL: icon + platform name + shortened URL, matching the
 * dark pill style used across the app. Hovering fetches (and caches) the OG preview and
 * shows it as a floating card, Instagram-share-sheet style.
 */
export function LinkChip({ url, className }: { url: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<LinkPreviewData | null | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const platform = detectPlatform(url);

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(async () => {
      setOpen(true);
      if (data === undefined) {
        const fetched = await fetchLinkPreview(url);
        setData(fetched);
      }
    }, 200);
  };

  const handleLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(false);
  };

  return (
    <span className="relative inline-block max-w-full align-middle" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-lg bg-[#1a1a1a] px-2.5 py-1 text-[12.5px] leading-tight text-white no-underline",
          className,
        )}
      >
        <span className="shrink-0">{platform.emoji}</span>
        <span className="shrink-0 font-semibold">{platform.label}</span>
        <span className="min-w-0 truncate text-white/50">{shortenUrl(url)}</span>
      </a>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5">
          {data === undefined ? (
            <div className="w-72 rounded-xl border border-white/10 bg-[#111214] p-3 text-[12px] text-white/60 shadow-2xl">
              Carregando prévia…
            </div>
          ) : data ? (
            <LinkPreviewBody url={url} data={data} />
          ) : (
            <div className="w-72 rounded-xl border border-white/10 bg-[#111214] p-3 text-[12px] text-white/60 shadow-2xl">
              Sem prévia disponível
            </div>
          )}
        </div>
      )}
    </span>
  );
}
