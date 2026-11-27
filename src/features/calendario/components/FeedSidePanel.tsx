import { useState } from "react";
import { DndContext, useDraggable, useDroppable, type DndContextProps, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Film, Image as ImageIcon, Instagram, LayoutGrid, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { CalendarPublication } from "../calendar-types";
import { blockedChanges, draftChanges, isFeedLocked, swapInDraft, type FeedDraft, type FeedSlot } from "../lib/feed-swap";
import { publicationTypeLabel } from "./PublicationCard";

export type FeedTileMedia = { thumb: string | null; pages: number; isVideo: boolean };

const shortDate = (date: string | null) => (date ? `${date.slice(8, 10)}/${date.slice(5, 7)}` : "sem data");
const slotLabel = (slot: FeedSlot) => (slot.time ? `${shortDate(slot.date)} às ${slot.time.slice(0, 5)}` : shortDate(slot.date));

function FeedTile({ publication: p, media, changed, onOpen }: { publication: CalendarPublication; media: FeedTileMedia; changed: boolean; onOpen: () => void }) {
  const locked = isFeedLocked(p);
  const drag = useDraggable({ id: p.id, disabled: locked });
  const drop = useDroppable({ id: p.id, disabled: locked });
  const label = `${publicationTypeLabel(p)}, ${slotLabel({ date: p.publish_date, time: p.publish_time })}${locked ? " (publicado)" : ""}`;
  return (
    <div ref={drop.setNodeRef} className={cn("relative aspect-[4/5] rounded-md", drop.isOver && !drag.isDragging && "ring-2 ring-foreground/70")}>
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
          "group relative block h-full w-full touch-manipulation overflow-hidden rounded-md bg-muted",
          !locked && "cursor-grab",
          drag.isDragging && "z-20 cursor-grabbing opacity-90 shadow-2xl shadow-black/50",
          changed && "ring-2 ring-amber-400",
        )}
      >
        {media.thumb ? (
          <img src={media.thumb} alt="" draggable={false} loading="lazy" decoding="async" className="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
        ) : (
          <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-5 w-5 text-muted-foreground/40" /></span>
        )}
        <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-full bg-black/65 px-1.5 text-[10px] font-medium leading-4 text-white">
          {locked && <Lock className="h-2.5 w-2.5" />}
          {shortDate(p.publish_date)}
        </span>
        <span className="absolute bottom-1 right-1 flex items-center gap-1">
          {media.pages > 1 && <LayoutGrid className="h-3.5 w-3.5 text-white drop-shadow" />}
          {media.isVideo && <Film className="h-3.5 w-3.5 text-white drop-shadow" />}
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
  sensors: DndContextProps["sensors"];
  saving: boolean;
  onSave: () => void;
  onOpen: (publicationId: string) => void;
  onClose: () => void;
}

/** Prévia do feed ao lado do calendário: arrastar um post sobre outro troca data e horário dos dois (só grava em "Salvar ordem"). */
export function FeedSidePanel({ publications, feed, draft, onDraftChange, mediaFor, outsideCount, clientName, clientLogoUrl, sensors, saving, onSave, onOpen, onClose }: Props) {
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
    <section aria-label="Prévia do feed" className="rounded-2xl border border-border/40 bg-card p-3 shadow-lg shadow-black/10">
      <div className="flex items-center gap-2.5">
        {clientLogoUrl ? (
          <img src={clientLogoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold ring-1 ring-border">{(clientName ?? "?").slice(0, 2).toUpperCase()}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{clientName ?? "Cliente"}</p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Instagram className="h-3 w-3" /> Prévia do feed</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar prévia do feed" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="-mx-1 mt-3 max-h-[min(68vh,640px)] overflow-y-auto overflow-x-hidden p-1">
          {feed.length === 0 ? (
            <p className="px-2 py-8 text-center text-xs text-muted-foreground">Nenhuma publicação pronta para o feed ainda.</p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {feed.map((p) => (
                <FeedTile key={p.id} publication={p} media={mediaFor(p)} changed={!!draft[p.id]} onOpen={() => onOpen(p.id)} />
              ))}
            </div>
          )}
        </div>
      </DndContext>

      <div className="mt-2 space-y-1 text-[11px] leading-snug text-muted-foreground">
        {hasLocked && <p className="flex items-center gap-1"><Lock className="h-3 w-3" /> Já publicado: não se move.</p>}
        {outsideCount > 0 && <p>{outsideCount} fora da prévia (sem data, sem arquivo final ou story).</p>}
      </div>

      <div className="mt-2 border-t border-border/40 pt-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {changes.length > 0 ? `${changes.length} posts vão mudar de data.` : "Arraste um post sobre outro para trocar as datas. Clique para editar."}
        </p>
        {blockedReason && <p className="mt-1 text-xs text-destructive" role="alert">{blockedReason}</p>}
        {changes.length > 0 && (
          <div className="mt-2 flex gap-2">
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
