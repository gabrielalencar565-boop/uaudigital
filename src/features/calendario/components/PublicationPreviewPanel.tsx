import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ExternalLink, Heart, MessageCircle, Send, Bookmark, Trash2, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { CONTENT_TYPE_LABELS, PUBLICATION_STATUS_LABELS, type CalendarPublication, type PublicationContentType, type PublicationStatus } from "../calendar-types";
import { useRemoveCalendarPublication, useUpdateCalendarPublication } from "../hooks/use-calendar-data";

interface Props {
  publication: CalendarPublication | null;
  media: { url: string; type: string | null }[];
  clientName: string;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  onNavigate?: (direction: "prev" | "next") => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const CAPTION_LIMIT = 2200;

export function PublicationPreviewPanel({ publication, media, clientName, onClose, onOpenTask, onNavigate, hasPrev, hasNext }: Props) {
  const updatePublication = useUpdateCalendarPublication();
  const removePublication = useRemoveCalendarPublication();
  const [caption, setCaption] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  useEffect(() => {
    setCaption(publication?.caption ?? "");
    setInternalNote(publication?.internal_note ?? "");
    setClientNote(publication?.client_note ?? "");
    setCarouselIndex(0);
    setCaptionExpanded(false);
  }, [publication?.id]);

  if (!publication) return null;

  const save = (updates: Partial<CalendarPublication>) => {
    updatePublication.mutate({ id: publication.id, ...updates });
  };

  const images = media.filter((m) => m.type?.startsWith("image/"));
  const videos = media.filter((m) => m.type?.startsWith("video/"));
  const isCarousel = publication.content_type === "carrossel" && images.length > 1;
  const isStory = publication.content_type === "story";
  const hasVideo = (publication.content_type === "reel" || publication.content_type === "video") && videos.length > 0;

  const clientInitial = clientName?.charAt(0)?.toUpperCase() || "C";
  const dateFormatted = publication.publish_date
    ? format(parseISO(publication.publish_date), "dd/MM/yyyy", { locale: ptBR })
    : null;

  const plainCaption = caption.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const LIMIT = 150;
  const isLong = plainCaption.length > LIMIT;

  return (
    <>
      <Sheet open onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full max-w-md overflow-y-auto p-0">
          {/* Nav bar */}
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!hasPrev} onClick={() => onNavigate?.("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!hasNext} onClick={() => onNavigate?.("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Instagram-style visual simulation */}
          <div className="border-b pb-3">
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400">
                <span className="text-xs font-bold text-white">{clientInitial}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight">{clientName}</span>
              </div>
            </div>

            <div className={cn("relative w-full bg-black/5 group px-3", isStory && "flex justify-center")}>
              {isStory ? (
                images[0] ? (
                  <img src={images[0].url} alt="" className="aspect-[9/16] max-h-[55vh] rounded-xl object-cover" />
                ) : (
                  <div className="flex aspect-[9/16] max-h-[55vh] w-full items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Sem mídia</div>
                )
              ) : hasVideo ? (
                <video src={videos[0].url} controls className="max-h-[60vh] w-full rounded-xl bg-black object-contain" />
              ) : images.length > 0 ? (
                <>
                  <img src={images[carouselIndex]?.url ?? images[0].url} alt="" className="max-h-[60vh] w-full rounded-xl object-cover" />
                  {isCarousel && (
                    <>
                      <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                        {carouselIndex + 1}/{images.length}
                      </div>
                      {carouselIndex > 0 && (
                        <button onClick={() => setCarouselIndex((i) => i - 1)} className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm transition group-hover:opacity-100">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                      )}
                      {carouselIndex < images.length - 1 && (
                        <button onClick={() => setCarouselIndex((i) => i + 1)} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-sm transition group-hover:opacity-100">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1">
                        {images.map((_, i) => (
                          <span key={i} className={cn("h-1.5 rounded-full transition-all", i === carouselIndex ? "w-1.5 bg-primary" : "w-1.5 bg-white/60")} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="flex h-40 w-full items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Sem mídia anexada</div>
              )}
            </div>

            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-3 text-foreground/70">
                <Heart className="h-5 w-5" />
                <MessageCircle className="h-5 w-5" />
                <Send className="h-5 w-5" />
              </div>
              <Bookmark className="h-5 w-5 text-foreground/70" />
            </div>

            <div className="space-y-1 px-3">
              <div>
                <span className="mr-1 text-sm font-semibold">{clientName}</span>
                {plainCaption ? (
                  isLong && !captionExpanded ? (
                    <>
                      <span className="text-sm text-foreground/80">{plainCaption.slice(0, LIMIT)}</span>
                      <button onClick={() => setCaptionExpanded(true)} className="ml-0.5 text-sm text-muted-foreground hover:text-primary">... ver mais</button>
                    </>
                  ) : (
                    <span className="whitespace-pre-line text-sm text-foreground/80">{plainCaption}</span>
                  )
                ) : (
                  <span className="text-sm italic text-muted-foreground">sem legenda</span>
                )}
              </div>
              {dateFormatted && (
                <p className="text-[11px] uppercase text-muted-foreground">
                  Publicação prevista para: {dateFormatted}{publication.publish_time ? ` às ${publication.publish_time.slice(0, 5)}` : ""}
                </p>
              )}
            </div>
          </div>

          {/* Internal editing fields */}
          <div className="space-y-4 px-3 py-4">
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
                rows={4}
                onChange={(e) => setCaption(e.target.value)}
                onBlur={() => caption !== (publication.caption ?? "") && save({ caption: caption || null })}
                placeholder="Escreva ou revise a legenda..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Data de publicação</Label>
                <Input type="date" defaultValue={publication.publish_date ?? ""} onBlur={(e) => save({ publish_date: e.target.value || null })} />
              </div>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input type="time" defaultValue={publication.publish_time?.slice(0, 5) ?? ""} onBlur={(e) => save({ publish_time: e.target.value || null })} />
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
              <Textarea value={internalNote} rows={2} onChange={(e) => setInternalNote(e.target.value)} onBlur={() => internalNote !== (publication.internal_note ?? "") && save({ internal_note: internalNote || null })} />
            </div>

            <div className="space-y-1.5">
              <Label>Observação para o cliente</Label>
              <Textarea value={clientNote} rows={2} onChange={(e) => setClientNote(e.target.value)} onBlur={() => clientNote !== (publication.client_note ?? "") && save({ client_note: clientNote || null })} />
            </div>

            <div className="flex items-center gap-2 border-t pt-4">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onOpenTask(publication.task_id)}>
                <ExternalLink className="h-3.5 w-3.5" /> Abrir tarefa original
              </Button>
              <Button variant="outline" size="sm" className="ml-auto gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmRemoveOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Remover do calendário
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

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
