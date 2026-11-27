import { Clapperboard, Film, Grid3x3, Image as ImageIcon, LayoutGrid, Menu, Pin, SquareUserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { profileGrid, type ProfileDraft } from "../lib/profile-month";

export type ProfileTile = { id: string; thumb: string | null; date: string | null; isCarousel: boolean; isVideo: boolean };

const Bar = ({ className }: { className?: string }) => <span className={cn("block rounded-full bg-muted-foreground/30", className)} />;

/** O perfil do mês como aparece no Instagram. Seguidores e números viram barrinhas de propósito. */
export function ProfilePreview({ profile, username, tiles }: { profile: ProfileDraft; username: string; tiles: ProfileTile[] }) {
  const grid = profileGrid(tiles, profile.pinned_publication_ids);
  return (
    <div aria-label="Prévia do perfil" role="region" className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[34px] border-[6px] border-muted bg-background shadow-xl shadow-black/20">
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold">{username}</p>
          <Menu className="h-4 w-4 shrink-0" />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border-2 border-foreground/25">
            {profile.photo_url ? (
              <img src={profile.photo_url} alt="Foto do perfil" className="h-[66px] w-[66px] shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-[66px] w-[66px] place-items-center rounded-full bg-muted text-lg font-semibold">{(profile.display_name || username).slice(0, 2).toUpperCase()}</span>
            )}
          </span>
          <div aria-hidden className="flex min-w-0 flex-1 justify-around gap-1">
            {["posts", "seguidores", "seguindo"].map((label) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <Bar className="h-2.5 w-7" />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {profile.display_name.trim() && <p className="mt-2 truncate text-xs font-semibold">{profile.display_name}</p>}
        <div aria-hidden className="mt-2 space-y-1.5">
          <Bar className="h-2 w-3/5" />
          <Bar className="h-2 w-2/5" />
        </div>
        <div aria-hidden className="mt-3 flex gap-2">
          {[0, 1].map((i) => <span key={i} className="flex h-7 flex-1 items-center justify-center rounded-lg bg-muted"><Bar className="h-2 w-12" /></span>)}
        </div>

        {profile.highlights.length > 0 && (
          <ul className="no-scrollbar mt-4 flex gap-3 overflow-x-auto">
            {profile.highlights.map((h) => (
              <li key={h.id} className="w-14 shrink-0 text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-foreground/20">
                  {h.cover_url ? (
                    <img src={h.cover_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-sm font-semibold">{h.title.slice(0, 1).toUpperCase()}</span>
                  )}
                </span>
                <span className="mt-1 block truncate text-[11px]">{h.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div aria-hidden className="flex border-t border-border/60">
        <span className="flex flex-1 justify-center border-b-2 border-foreground py-2"><Grid3x3 className="h-4 w-4" /></span>
        <span className="flex flex-1 justify-center py-2 text-muted-foreground"><Clapperboard className="h-4 w-4" /></span>
        <span className="flex flex-1 justify-center py-2 text-muted-foreground"><SquareUserRound className="h-4 w-4" /></span>
      </div>

      {grid.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">Nenhuma publicação com arquivo final ainda.</p>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {grid.map(({ post, pinned }) => (
            <div key={post.id} data-pinned={pinned || undefined} className="relative aspect-[4/5] bg-muted">
              {post.thumb ? (
                <img src={post.thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground/40" /></span>
              )}
              <span className="absolute right-1 top-1 flex items-center gap-1">
                {pinned ? <span className="grid h-5 w-5 place-items-center rounded-full bg-black/55"><Pin className="h-3 w-3 rotate-45 fill-white text-white" /></span> : (
                  <>
                    {post.isCarousel && <LayoutGrid className="h-3.5 w-3.5 text-white drop-shadow" />}
                    {post.isVideo && <Film className="h-3.5 w-3.5 text-white drop-shadow" />}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
