import { useState } from "react";
import { Bookmark, Clapperboard, GalleryHorizontal, Heart, Image as ImageIcon, MessageCircle, ExternalLink, CircleDot } from "lucide-react";

import { brandGradientCss } from "@/lib/brand-gradient";
import type { MediaInsight } from "../hooks/use-resultados";

const TOP_N = 5;

const FORMATS: Record<string, { label: string; icon: typeof ImageIcon }> = {
  reel: { label: "Reel", icon: Clapperboard },
  carrossel: { label: "Carrossel", icon: GalleryHorizontal },
  story: { label: "Story", icon: CircleDot },
  post: { label: "Post", icon: ImageIcon },
  foto: { label: "Foto", icon: ImageIcon },
};

const compactNumber = (n: number) => n.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function Thumb({ url, icon: Icon }: { url: string | null; icon: typeof ImageIcon }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div className="grid h-full w-full place-items-center" style={{ background: brandGradientCss(135) }}>
        <Icon className="h-8 w-8 text-white/80" />
      </div>
    );
  }
  // Instagram CDN links are signed and expire; fall back to the gradient tile instead of a broken image.
  return <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

export function TopContent({ media }: { media: MediaInsight[] }) {
  const top = [...media]
    .filter((m) => (m.reach ?? 0) > 0)
    .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
    .slice(0, TOP_N);

  if (top.length === 0) return <p className="text-sm text-muted-foreground">Nenhum post com métricas neste período.</p>;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {top.map((m, i) => {
        const format = FORMATS[m.content_type ?? "post"] ?? FORMATS.post;
        const tile = (
          <div className="group overflow-hidden rounded-2xl border border-border/40 bg-background/40 transition-all hover:-translate-y-0.5 hover:shadow-elevated">
            <div className="relative aspect-[4/5] overflow-hidden bg-muted">
              <Thumb url={m.thumbnail_url} icon={format.icon} />
              <span className="absolute left-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-black/60 px-1.5 text-xs font-bold text-white backdrop-blur">
                {i + 1}
              </span>
              <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                <format.icon className="h-3 w-3" /> {format.label}
              </span>
              {m.permalink && (
                <ExternalLink className="absolute bottom-2 right-2 h-4 w-4 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
              )}
            </div>
            <div className="space-y-1.5 p-3">
              <div>
                <p className="text-lg font-bold leading-none tabular-nums">{compactNumber(m.reach ?? 0)}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">alcance</p>
              </div>
              {m.caption && <p className="line-clamp-2 text-xs text-muted-foreground">{m.caption}</p>}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {compactNumber(m.likes ?? 0)}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {compactNumber(m.comments ?? 0)}</span>
                <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" /> {compactNumber(m.saves ?? 0)}</span>
              </div>
            </div>
          </div>
        );
        return m.permalink ? (
          <a key={m.ig_media_id} href={m.permalink} target="_blank" rel="noreferrer">{tile}</a>
        ) : (
          <div key={m.ig_media_id}>{tile}</div>
        );
      })}
    </div>
  );
}
