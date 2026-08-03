import { useEffect, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PmImageViewer } from "@/features/gestao/components/PmImageViewer";
import { CONTENT_TYPE_LABELS, PUBLICATION_STATUS_LABELS, type CalendarPublication, type PublicationContentType, type PublicationStatus } from "../calendar-types";
import { useRemoveCalendarPublication, useUpdateCalendarPublication } from "../hooks/use-calendar-data";

interface Props {
  publication: CalendarPublication | null;
  media: { url: string; type: string | null }[];
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
}

const CAPTION_LIMIT = 2200;

export function PublicationEditSheet({ publication, media, onClose, onOpenTask }: Props) {
  const updatePublication = useUpdateCalendarPublication();
  const removePublication = useRemoveCalendarPublication();
  const [caption, setCaption] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  useEffect(() => {
    setCaption(publication?.caption ?? "");
    setInternalNote(publication?.internal_note ?? "");
    setClientNote(publication?.client_note ?? "");
  }, [publication?.id]);

  if (!publication) return null;

  const save = (updates: Partial<CalendarPublication>) => {
    updatePublication.mutate({ id: publication.id, ...updates });
  };

  const images = media.filter((m) => m.type?.startsWith("image/")).map((m, i) => ({ url: m.url, name: `Arquivo ${i + 1}` }));
  const videos = media.filter((m) => m.type?.startsWith("video/"));

  return (
    <>
      <Sheet open onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar publicação</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {media.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button key={img.url} type="button" onClick={() => { setViewerIndex(i); setViewerOpen(true); }} className="shrink-0">
                    <img src={img.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                  </button>
                ))}
                {videos.map((v) => (
                  <video key={v.url} src={v.url} controls className="h-20 w-32 shrink-0 rounded-lg bg-black object-cover" />
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Nome da publicação</Label>
              <Input
                defaultValue={publication.title}
                onBlur={(e) => e.target.value.trim() && e.target.value !== publication.title && save({ title: e.target.value.trim() })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de conteúdo</Label>
              <Select value={publication.content_type} onValueChange={(v: PublicationContentType) => save({ content_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTENT_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Legenda</Label>
                <span className="text-xs text-muted-foreground">{caption.length}/{CAPTION_LIMIT}</span>
              </div>
              <Textarea
                value={caption}
                maxLength={CAPTION_LIMIT}
                rows={5}
                onChange={(e) => setCaption(e.target.value)}
                onBlur={() => caption !== (publication.caption ?? "") && save({ caption: caption || null })}
                placeholder="Escreva ou revise a legenda..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de publicação</Label>
                <Input
                  type="date"
                  defaultValue={publication.publish_date ?? ""}
                  onBlur={(e) => save({ publish_date: e.target.value || null })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input
                  type="time"
                  defaultValue={publication.publish_time?.slice(0, 5) ?? ""}
                  onBlur={(e) => save({ publish_time: e.target.value || null })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={publication.status} onValueChange={(v: PublicationStatus) => save({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PUBLICATION_STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Observação interna <span className="text-xs font-normal text-muted-foreground">(só a equipe vê)</span></Label>
              <Textarea
                value={internalNote}
                rows={2}
                onChange={(e) => setInternalNote(e.target.value)}
                onBlur={() => internalNote !== (publication.internal_note ?? "") && save({ internal_note: internalNote || null })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Observação para o cliente</Label>
              <Textarea
                value={clientNote}
                rows={2}
                onChange={(e) => setClientNote(e.target.value)}
                onBlur={() => clientNote !== (publication.client_note ?? "") && save({ client_note: clientNote || null })}
              />
            </div>

            <div className="flex items-center gap-2 border-t pt-4">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onOpenTask(publication.task_id)}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir tarefa original
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive ml-auto" onClick={() => setConfirmRemoveOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Remover do calendário
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {images.length > 0 && (
        <PmImageViewer images={images} initialIndex={viewerIndex} open={viewerOpen} onClose={() => setViewerOpen(false)} />
      )}

      <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover publicação do calendário?</AlertDialogTitle>
            <AlertDialogDescription>
              A tarefa original não será apagada, só o item vinculado a ela neste calendário de aprovação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                removePublication.mutate({ id: publication.id, calendarId: publication.calendar_id });
                setConfirmRemoveOpen(false);
                onClose();
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
