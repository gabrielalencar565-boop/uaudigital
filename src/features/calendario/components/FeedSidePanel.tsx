import { useState } from "react";
import { DndContext, useDraggable, useDroppable, type DndContextProps, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Film, Grid3x3, Image as ImageIcon, LayoutGrid, Lock, Pin, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { CalendarPublication } from "../calendar-types";
import { blockedChanges, draftChanges, isFeedLocked, swapInDraft, type FeedDraft, type FeedSlot } from "../lib/feed-swap";
import { profileGrid, startingProfile } from "../lib/profile-month";
import { useProfileMonths } from "../hooks/use-profile-month";
import { publicationTypeLabel } from "./PublicationCard";

export type FeedTileMedia = { thumb: string | null; pages: number; isVideo: boolean };

const shortDate = (date: string | null) => (date ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : "sem data");
const slotLabel = (slot: FeedSlot) => (slot.time ? `${shortDate(slot.date)} às ${slot.time.slice(0, 5)}` : shortDate(slot.date));

function FeedTile({ publication: p, media, changed, pinned, onOpen }: { publication: CalendarPublication; media: FeedTileMedia; changed: boolean; pinned: boolean; onOpen: () => void }) {
  const locked = isFeedLocked(p);
  const still = locked || pinned; // fixado fica no topo pela escolha do Estúdio, não pela data: arrastar não mudaria o lugar dele
  const drag = useDraggable({ id: p.id, disabled: still });
  const drop = useDroppable({ id: p.id, disabled: still });
  const label = `${publicationTypeLabel(p)}, ${slotLabel({ date: p.publish_date, time: p.publish_time })}${locked ? " (publicado)" : ""}${pinned ? " (fixado)" : ""}`;
  return (
    <div ref={drop.setNodeRef} data-pinned={pinned || undefined} className={cn("relative aspect-[4/5]", drop.isOver && !drag.isDragging && "z-10 ring-2 ring-foreground")}>
      <button
        ref={drag.setNodeRef}
        type="button"
        {...drag.attributes}
        {...drag.listeners}
        aria-disabled={undefined}
        aria-label={label}
        title={label}
        onClick={onOpen}
        style={drag.transform ? { transform: CSS.Translate.toString(drag.transform) } : undefined}
        className={cn(
          "group relative block h-full w-full touch-manipulation overflow-hidden rounded-[3px] bg-muted",
          !still && "cursor-grab",
          drag.isDragging && "z-20 cursor-grabbing rounded-lg opacity-90 shadow-2xl shadow-black/60",
        )}
      >
        {media.thumb ? (
          <img src={media.thumb} alt="" draggable={false} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-200 group-hover:brightness-110" />
        ) : (
          <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground/40" /></span>
        )}
        {changed && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[3px] ring-2 ring-inset ring-amber-400" />}
        <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-semibold leading-none text-white">
          {locked && <Lock className="h-2.5 w-2.5" />}
          {shortDate(p.publish_date)}
        </span>
        <span className="absolute right-1 top-1 flex items-center gap-1">
          {pinned ? (
            <span className="grid h-5 w-5 place-items-center rounded-full bg-black/55"><Pin className="h-3 w-3 rotate-45 fill-white text-white" /></span>
          ) : (
            <>
              {media.pages > 1 && <LayoutGrid className="h-3.5 w-3.5 text-white drop-shadow" />}
              {media.isVideo && <Film className="h-3.5 w-3.5 text-white drop-shadow" />}
            </>
          )}
        </span>
      </button>
    </div>
  );
}

interface Props {
  /** Publicações do ciclo como estão gravadas (sem o rascunho). */
  publications: CalendarPublication[];
  /** O que aparece na grade: já com o rascunho aplicado e na ordem do feed. */
  feed: CalendarPublication[];
  draft: FeedDraft;
  onDraftChange: (draft: FeedDraft) => void;
  mediaFor: (publication: CalendarPublication) => FeedTileMedia;
  outsideCount: number;
  clientName?: string | null;
  clientLogoUrl?: string | null;
  clientId: string;
  /** yyyy-MM-01 do perfil deste período (profileMonthKey). */
  month: string;
  username?: string | null;
  onEditProfile: () => void;
  sensors: DndContextProps["sensors"];
  saving: boolean;
  onSave: () => void;
  onOpen: (publicationId: string) => void;
  onClose: () => void;
}

/** Prévia do feed ao lado do calendário: arrastar um post sobre outro troca data e horário dos dois (só grava em "Salvar ordem"). */
export function FeedSidePanel({ publications, feed, draft, onDraftChange, mediaFor, outsideCount, clientName, clientLogoUrl, clientId, month, username, onEditProfile, sensors, saving, onSave, onOpen, onClose }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const changes = draftChanges(draft);
  const byId = new Map(publications.map((p) => [p.id, p]));
  const blocked = blockedChanges(changes, publications);
  const scheduled = changes.filter((c) => byId.get(c.id)?.instagram_scheduled);
  const blockedReason = blocked.past.length > 0
    ? "Um post já agendado no Instagram iria para um horário que já passou e sairia na hora."
    : blocked.noTime.length > 0
      ? "Um post já agendado no Instagram ficaria sem horário e não sairia."
      : null;
  const hasLocked = feed.some(isFeedLocked);

  // Perfil do mês como o cliente vê: só o que foi salvo no Estúdio
  const rowsQ = useProfileMonths(clientId);
  const start = startingProfile(rowsQ.data ?? [], month, { name: clientName ?? "Cliente", photo: clientLogoUrl ?? null });
  const profile = start.savedId ? start.draft : null;
  const photo = profile ? profile.photo_url : clientLogoUrl;
  const name = profile?.display_name || clientName || "Cliente";
  const grid = profileGrid(feed, profile?.pinned_publication_ids ?? []);
  const pinnedShown = grid.filter((g) => g.pinned).length;
  const pinnedElsewhere = (profile?.pinned_publication_ids.length ?? 0) - pinnedShown;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || saving) return;
    onDraftChange(swapInDraft(draft, publications, String(active.id), String(over.id)));
  };

  const requestSave = () => {
    const now = blockedChanges(changes, publications); // o relógio pode ter passado desde o último desenho da tela
    if (now.past.length > 0 || now.noTime.length > 0) {
      onDraftChange({ ...draft }); // redesenha para mostrar o motivo
      return;
    }
    if (scheduled.length > 0) setConfirmOpen(true);
    else onSave();
  };

  return (
    <section aria-label="Prévia do feed" className="overflow-hidden rounded-3xl border border-border/50 bg-card shadow-xl shadow-black/20">
      <div className="flex items-center gap-3 px-3.5 pb-3 pt-3.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-foreground/25">
          {photo ? (
            <img src={photo} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-sm font-semibold">{name.slice(0, 2).toUpperCase()}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{username ? `@${username}` : "Prévia do feed"}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar prévia do feed" className="self-start rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul aria-label="Destaques" className="no-scrollbar flex gap-3 overflow-x-auto px-3.5 pb-3">
        {(profile?.highlights ?? []).map((h) => (
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
        <li className="w-14 shrink-0 text-center">
          <button type="button" onClick={onEditProfile} aria-label="Editar destaques no Estúdio do feed" className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-dashed border-foreground/25 text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground">
            <Plus className="h-5 w-5" />
          </button>
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">{profile?.highlights.length ? "Editar" : "Destaque"}</span>
        </li>
      </ul>

      <div aria-hidden className="flex justify-center border-t border-border/50">
        <span className="-mt-px border-t-2 border-foreground px-5 py-1.5"><Grid3x3 className="h-4 w-4" /></span>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="max-h-[min(62vh,600px)] overflow-y-auto overflow-x-hidden">
          {feed.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">Nenhuma publicação pronta para o feed ainda.</p>
          ) : (
            <div className="grid grid-cols-3 gap-0.5">
              {grid.map(({ post, pinned }) => (
                <FeedTile key={post.id} publication={post} media={mediaFor(post)} changed={!!draft[post.id]} pinned={pinned} onOpen={() => onOpen(post.id)} />
              ))}
            </div>
          )}
        </div>
      </DndContext>

      <div className="border-t border-border/50 px-3.5 py-3">
        <p className="text-xs leading-snug text-muted-foreground" aria-live="polite">
          {changes.length > 0 ? `${changes.length} posts vão mudar de data.` : "Arraste um post sobre outro para trocar as datas. Clique para editar."}
        </p>
        {(hasLocked || pinnedShown > 0 || pinnedElsewhere > 0 || outsideCount > 0) && (
          <div className="mt-1.5 space-y-1 text-[11px] leading-snug text-muted-foreground/80">
            {pinnedShown > 0 && <p className="flex items-center gap-1"><Pin className="h-3 w-3 shrink-0" /> Fixados se organizam no Estúdio.</p>}
            {pinnedElsewhere > 0 && <p>{pinnedElsewhere} fixado(s) de outro período: veja no Estúdio.</p>}
            {hasLocked && <p className="flex items-center gap-1"><Lock className="h-3 w-3 shrink-0" /> Já publicado: não se move.</p>}
            {outsideCount > 0 && <p>{outsideCount} fora da prévia (sem data, sem arquivo final ou story).</p>}
          </div>
        )}
        {blockedReason && <p className="mt-1.5 text-xs text-destructive" role="alert">{blockedReason}</p>}
        {changes.length > 0 && (
          <div className="mt-2.5 flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-8 flex-1 rounded-full text-xs" disabled={saving} onClick={() => onDraftChange({})}>Desfazer</Button>
            <Button type="button" size="sm" className="h-8 flex-[1.4] rounded-full text-xs" disabled={saving || !!blockedReason} onClick={requestSave}>{saving ? "Salvando…" : "Salvar ordem"}</Button>
          </div>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mudar quando os posts agendados saem?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>{scheduled.length === 1 ? "Este post já está agendado no Instagram e vai sair na nova data:" : "Estes posts já estão agendados no Instagram e vão sair nas novas datas:"}</p>
                <ul className="space-y-1">
                  {scheduled.map((c) => (
                    <li key={c.id}>{byId.get(c.id) ? publicationTypeLabel(byId.get(c.id)!) : "Post"}: {slotLabel(c.base)} → <strong className="text-foreground">{slotLabel(c.slot)}</strong></li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onSave}>Salvar ordem</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
