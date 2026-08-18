import { useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, ExternalLink, Heart, MessageCircle, Send, Bookmark, Trash2, X, ImagePlus, Loader2, CalendarDays, Clock, Camera, Check } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CONTENT_TYPE_LABELS, PUBLICATION_STATUS_LABELS, type CalendarPublication, type PublicationContentType, type PublicationStatus } from "../calendar-types";
import { useCoverCandidates, useRemoveCalendarPublication, useReorderCarouselImages, useUpdateCalendarPublication } from "../hooks/use-calendar-data";
import { useUploadPmAttachment } from "@/features/gestao/hooks/use-pm-data";
import { PmImageViewer } from "@/features/gestao/components/PmImageViewer";

const sb = supabase as any;

interface Props {
  publication: CalendarPublication | null;
  media: { id: string; url: string; type: string | null }[];
  clientName: string;
  clientLogoUrl?: string | null;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  onNavigate?: (direction: "prev" | "next") => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

const CAPTION_LIMIT = 2200;

const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

function nearestTimeSlot() {
  const now = new Date();
  const rounded = (Math.round((now.getHours() * 60 + now.getMinutes()) / 30) * 30) % (24 * 60);
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${rounded % 60 === 0 ? "00" : "30"}`;
}

export function PublicationPreviewPanel({ publication, media, clientName, clientLogoUrl, onClose, onOpenTask, onNavigate, hasPrev, hasNext }: Props) {
  const qc = useQueryClient();
  const updatePublication = useUpdateCalendarPublication();
  const removePublication = useRemoveCalendarPublication();
  const uploadCover = useUploadPmAttachment();
  const reorderCarousel = useReorderCarouselImages();
  const coverCandidatesQ = useCoverCandidates(publication?.task_id ?? null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [clientNote, setClientNote] = useState("");
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [coverDragActive, setCoverDragActive] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [frameDialogOpen, setFrameDialogOpen] = useState(false);
  const [capturingFrame, setCapturingFrame] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [dragImageIndex, setDragImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
  const frameVideoRef = useRef<HTMLVideoElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);
  const timeButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    if (!timeOpen) return;
    const nearestSlot = nearestTimeSlot();
    requestAnimationFrame(() => {
      timeButtonRefs.current.get(nearestSlot)?.scrollIntoView({ block: "start" });
    });
  }, [timeOpen]);

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

  // Marking a post as done closes the loop so the team doesn't have to separately go
  // mark the task complete in Gestão after posting. The publication's own approval
  // status (aguardando_aprovacao / alteracao_solicitada / aprovada) is untouched.
  const handlePublish = async () => {
    const missing: string[] = [];
    if (!publication.publish_date) missing.push("Data");
    if (!publication.publish_time) missing.push("Horário");
    if (!publication.caption?.trim()) missing.push("Legenda");
    if (missing.length > 0) {
      toast.error(`Ciclo incompleto — falta ${missing.join(", ")} antes de concluir.`);
      return;
    }
    setPublishing(true);
    try {
      const { error } = await sb.from("pm_tasks").update({ status_global: "concluido" }).eq("id", publication.task_id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      toast.success("Tarefa marcada como concluída!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao concluir");
    } finally {
      setPublishing(false);
    }
  };

  const pickDate = (d: Date | undefined) => {
    if (!d) return;
    save({ publish_date: format(d, "yyyy-MM-dd") });
    setDateOpen(false);
  };

  const pickTime = (t: string) => {
    save({ publish_time: `${t}:00` });
    setTimeOpen(false);
  };

  const uploadAsCover = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    uploadCover.mutate(
      { task_id: publication.task_id, file, category: "final" },
      { onSuccess: (att) => save({ cover_attachment_id: att.id }) },
    );
  };

  const deleteCoverImage = async (imgId: string) => {
    const { data, error } = await sb.from("pm_attachments").delete().eq("id", imgId).select("drive_file_id").maybeSingle();
    if (error) {
      toast.error("Erro ao excluir imagem");
      return;
    }
    if (data?.drive_file_id) {
      const { error: driveErr } = await supabase.functions.invoke("drive-delete", { body: { drive_file_id: data.drive_file_id, attachment_id: imgId } });
      if (driveErr) console.warn("Drive delete error:", driveErr);
    }
    if (publication.cover_attachment_id === imgId) save({ cover_attachment_id: null });
    qc.invalidateQueries({ queryKey: ["pm_attachments_for_calendar"] });
    qc.invalidateQueries({ queryKey: ["cover_candidates"] });
    qc.invalidateQueries({ queryKey: ["cover_attachments_by_id"] });
    toast.success("Imagem excluída");
  };

  // Grabs whatever frame the video is paused on and uploads it as a new cover
  // image attachment — lets picking the cover be "pause where it looks good"
  // instead of relying on the auto-generated poster (which can land on a black
  // or fade-in frame, see renderVideoPoster in PmAttachmentsSection.tsx).
  const captureVideoFrame = async () => {
    const video = frameVideoRef.current;
    if (!video || !video.videoWidth) return;
    setCapturingFrame(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas context indisponível");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("falha ao gerar imagem");
      const file = new File([blob], `capa-video-${Date.now()}.jpg`, { type: "image/jpeg" });
      uploadCover.mutate(
        { task_id: publication.task_id, file, category: "final" },
        {
          onSuccess: (att) => {
            save({ cover_attachment_id: att.id });
            setFrameDialogOpen(false);
            toast.success("Capa atualizada com o quadro escolhido");
          },
          onError: () => toast.error("Erro ao salvar a capa"),
        },
      );
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível capturar esse quadro. Tente pausar em outro ponto.");
    } finally {
      setCapturingFrame(false);
    }
  };

  const images = media.filter((m) => m.type?.startsWith("image/"));
  const videos = media.filter((m) => m.type?.startsWith("video/"));
  const isCarousel = publication.content_type === "carrossel" && images.length > 1;

  const handleReorderDrop = (targetIndex: number) => {
    if (dragImageIndex === null || dragImageIndex === targetIndex) {
      setDragImageIndex(null);
      setDragOverImageIndex(null);
      return;
    }
    const reordered = [...images];
    const [moved] = reordered.splice(dragImageIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderCarousel.mutate(
      { orderedIds: reordered.map((img) => img.id) },
      { onError: (e: any) => toast.error(e?.message ?? "Erro ao reordenar o carrossel") },
    );
    setDragImageIndex(null);
    setDragOverImageIndex(null);
  };
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
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent hideClose className="w-full max-w-5xl overflow-hidden border-black/10 bg-white/80 p-0 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.07] sm:rounded-2xl">
          <DialogTitle className="sr-only">Publicação de {clientName}</DialogTitle>
          <DialogDescription className="sr-only">Pré-visualização e edição da publicação</DialogDescription>

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

          <div
            className={cn(
              "grid max-h-[80vh] grid-cols-1",
              isStory || hasVideo ? "md:grid-cols-[min(38.25vh,420px)_1fr]" : "md:grid-cols-[420px_1fr]",
            )}
          >
            {/* Left: Instagram-style visual simulation */}
            <div className="overflow-y-auto border-b md:border-b-0 md:border-r">
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400">
                  {clientLogoUrl ? (
                    <img src={clientLogoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{clientInitial}</span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold leading-tight">{clientName}</span>
                </div>
              </div>

              <div className={cn("relative w-full bg-black/5 group px-3", isStory && "flex justify-center")}>
                {isStory ? (
                  images[0] ? (
                    <button type="button" onClick={() => setViewerOpen(true)} className="block">
                      <img src={images[0].url} alt="" className="aspect-[9/16] max-h-[68vh] cursor-zoom-in rounded-xl object-cover" />
                    </button>
                  ) : (
                    <div className="flex aspect-[9/16] max-h-[68vh] w-full items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Sem mídia</div>
                  )
                ) : hasVideo ? (
                  <video src={videos[0].url} controls className="mx-auto block h-auto max-h-[68vh] w-auto max-w-full rounded-xl object-contain" />
                ) : images.length > 0 ? (
                  <>
                    <button type="button" onClick={() => setViewerOpen(true)} className="block w-full">
                      <img src={images[carouselIndex]?.url ?? images[0].url} alt="" className="max-h-[68vh] w-full cursor-zoom-in rounded-xl object-cover" />
                    </button>
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

              <div className="space-y-1 px-3 pb-3">
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

            {/* Right: internal editing fields */}
            <div className="space-y-4 overflow-y-auto px-4 py-4">
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

              {isCarousel && (
                <div className="space-y-1.5">
                  <Label>Ordem das páginas do carrossel</Label>
                  <div className="flex flex-wrap gap-2">
                    {images.map((img, idx) => (
                      <HoverCard key={img.id} openDelay={200} closeDelay={0}>
                        <HoverCardTrigger asChild>
                          <div
                            draggable
                            onDragStart={() => setDragImageIndex(idx)}
                            onDragOver={(e) => { e.preventDefault(); setDragOverImageIndex(idx); }}
                            onDragLeave={() => setDragOverImageIndex((i) => (i === idx ? null : i))}
                            onDrop={(e) => { e.preventDefault(); handleReorderDrop(idx); }}
                            onDragEnd={() => { setDragImageIndex(null); setDragOverImageIndex(null); }}
                            className={cn(
                              "relative h-16 w-16 shrink-0 cursor-grab overflow-hidden rounded-lg border-2 transition active:cursor-grabbing",
                              dragImageIndex === idx ? "opacity-40" : "opacity-100",
                              dragOverImageIndex === idx && dragImageIndex !== idx ? "border-primary" : "border-transparent",
                            )}
                          >
                            <img src={img.url} alt="" className="pointer-events-none h-full w-full object-cover" />
                            <span className="pointer-events-none absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] font-semibold text-white">
                              {idx + 1}
                            </span>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent side="top" className="w-auto overflow-hidden rounded-md p-0">
                          <img src={img.url} alt="" className="max-h-80 max-w-80 object-contain" />
                        </HoverCardContent>
                      </HoverCard>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Arraste as miniaturas para mudar a ordem das páginas.</p>
                </div>
              )}

              {(publication.content_type === "reel" || publication.content_type === "video") && (() => {
                const ownIds = new Set(images.map((img) => img.id));
                const allCandidates = coverCandidatesQ.data ?? [];
                const coverId = publication.cover_attachment_id;
                // When the chosen cover is a PDF-stage suggestion (not one of this task's own
                // attachments), pin it at the front of "Capa do Reel" — as the one actually in
                // use — and hide it from the suggestions row below to free up space there.
                // Pressing its X un-pins it, which naturally makes it reappear in suggestions.
                const pinnedCandidate = coverId && !ownIds.has(coverId)
                  ? allCandidates.find((img) => img.id === coverId)
                  : undefined;
                const coverCandidates = allCandidates.filter((img) => !ownIds.has(img.id) && img.id !== coverId);
                // Own attachments can be hard-deleted from here — they belong to this task.
                // PDF-stage suggestions belong to a *different* task ("Capa"), so their X only
                // clears the selection (if it's the current cover) and never touches that
                // other task's real attachment.
                const renderCoverThumb = (img: { id: string; url: string }, deletable: boolean) => {
                  const isCover = publication.cover_attachment_id
                    ? publication.cover_attachment_id === img.id
                    : img.id === images[0]?.id;
                  return (
                    <HoverCard key={img.id} openDelay={200} closeDelay={0}>
                      <HoverCardTrigger asChild>
                        <div className="group/cover relative h-16 w-16 shrink-0">
                          <button
                            type="button"
                            onClick={() => save({ cover_attachment_id: img.id })}
                            className={cn(
                              "h-full w-full overflow-hidden rounded-lg border-2 transition",
                              isCover ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
                            )}
                          >
                            <img src={img.url} alt="" className="h-full w-full object-cover" />
                            {isCover && (
                              <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-center text-[9px] font-semibold text-primary-foreground">
                                Capa
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (deletable) deleteCoverImage(img.id);
                              else save({ cover_attachment_id: null });
                            }}
                            aria-label={deletable ? "Excluir imagem" : "Remover seleção"}
                            className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover/cover:opacity-100"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent side="top" className="w-auto p-1">
                        <img src={img.url} alt="" className="max-h-80 max-w-80 rounded-md object-contain" />
                      </HoverCardContent>
                    </HoverCard>
                  );
                };
                return (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Capa do {publication.content_type === "reel" ? "Reel" : "Vídeo"}</Label>
                      <div
                        onDragOver={(e) => { e.preventDefault(); setCoverDragActive(true); }}
                        onDragLeave={() => setCoverDragActive(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setCoverDragActive(false);
                          const file = e.dataTransfer.files?.[0];
                          if (file) uploadAsCover(file);
                        }}
                        className={cn(
                          "flex flex-wrap gap-2 rounded-lg p-1 transition",
                          coverDragActive && "bg-primary/5 ring-2 ring-primary/40",
                        )}
                      >
                        {pinnedCandidate && renderCoverThumb(pinnedCandidate, false)}
                        {images.map((img) => renderCoverThumb(img, true))}
                        {hasVideo && (
                          <button
                            type="button"
                            onClick={() => setFrameDialogOpen(true)}
                            className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary"
                          >
                            <Camera className="h-4 w-4" />
                            <span className="text-[9px] font-medium">Do vídeo</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={uploadCover.isPending}
                          onClick={() => coverFileInputRef.current?.click()}
                          className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                        >
                          {uploadCover.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                          <span className="text-[9px] font-medium">{uploadCover.isPending ? "Enviando" : "Arraste"}</span>
                        </button>
                        <input
                          ref={coverFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) uploadAsCover(file);
                          }}
                        />
                      </div>
                    </div>

                    {coverCandidates.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-normal text-muted-foreground">
                          Capas Anexadas em PDF
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {coverCandidates.map((img) => renderCoverThumb(img, false))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

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
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-border/50 bg-muted/30 px-3 text-left text-sm ring-offset-background transition-all duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring/60"
                      >
                        <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {publication.publish_date ? (
                          <span>{format(parseISO(publication.publish_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                        ) : (
                          <span className="text-muted-foreground">Selecionar</span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto max-h-[400px] overflow-y-auto p-0"
                      align="start"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      <Calendar
                        mode="single"
                        selected={publication.publish_date ? parseISO(publication.publish_date) : undefined}
                        onSelect={pickDate}
                        locale={ptBR}
                        initialFocus
                      />
                      {publication.publish_date && (
                        <div className="border-t p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => { save({ publish_date: null }); setDateOpen(false); }}
                          >
                            Limpar
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label>Horário</Label>
                  <Popover open={timeOpen} onOpenChange={setTimeOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-border/50 bg-muted/30 px-3 text-left text-sm ring-offset-background transition-all duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring/60"
                      >
                        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {publication.publish_time ? (
                          <span>{publication.publish_time.slice(0, 5)}</span>
                        ) : (
                          <span className="text-muted-foreground">Selecionar</span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-40 p-2"
                      align="start"
                      side="bottom"
                      avoidCollisions={false}
                    >
                      <div className="mb-2 grid grid-cols-2 gap-1.5 border-b pb-2">
                        <button
                          type="button"
                          onClick={() => pickTime("12:00")}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-center text-sm font-medium transition-colors",
                            publication.publish_time?.slice(0, 5) === "12:00"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/50 hover:bg-muted",
                          )}
                        >
                          12h
                        </button>
                        <button
                          type="button"
                          onClick={() => pickTime("18:00")}
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-center text-sm font-medium transition-colors",
                            publication.publish_time?.slice(0, 5) === "18:00"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border/50 hover:bg-muted",
                          )}
                        >
                          18h
                        </button>
                      </div>
                      <div
                        ref={timeListRef}
                        className="flex max-h-[240px] flex-col gap-1 overflow-y-auto"
                        onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; }}
                      >
                        {TIME_SLOTS.map((t) => (
                          <button
                            key={t}
                            ref={(el) => {
                              if (el) timeButtonRefs.current.set(t, el);
                              else timeButtonRefs.current.delete(t);
                            }}
                            type="button"
                            onClick={() => pickTime(t)}
                            className={cn(
                              "shrink-0 rounded-lg border px-2.5 py-1.5 text-center text-sm transition-colors",
                              publication.publish_time?.slice(0, 5) === t
                                ? "border-primary bg-primary text-primary-foreground"
                                : !publication.publish_time && t === nearestTimeSlot()
                                ? "border-primary/60 bg-primary/10 text-foreground"
                                : "border-border/50 hover:bg-muted",
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      {publication.publish_time && (
                        <div className="mt-2 border-t pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => { save({ publish_time: null }); setTimeOpen(false); }}
                          >
                            Limpar
                          </Button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
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

              <Button className="w-full gap-1.5" onClick={handlePublish} disabled={publishing}>
                {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Concluir
              </Button>

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
          </div>
        </DialogContent>
      </Dialog>

      <PmImageViewer
        images={images.map((img, i) => ({ url: img.url, name: `Imagem ${i + 1}` }))}
        initialIndex={carouselIndex}
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      <Dialog open={frameDialogOpen} onOpenChange={setFrameDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Escolher quadro do vídeo</DialogTitle>
          <DialogDescription>
            Pause o vídeo no take que quiser e use esse quadro como capa.
          </DialogDescription>
          {videos[0] && (
            <video
              ref={frameVideoRef}
              key={videos[0].url}
              src={videos[0].url}
              crossOrigin="anonymous"
              controls
              playsInline
              className="w-full rounded-lg bg-black"
            />
          )}
          <Button onClick={captureVideoFrame} disabled={capturingFrame} className="w-full gap-2">
            {capturingFrame ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Usar este quadro como capa
          </Button>
        </DialogContent>
      </Dialog>

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
