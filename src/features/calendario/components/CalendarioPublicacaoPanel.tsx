import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Film, LayoutGrid, List, Grid3x3, Image as ImageIcon, Link2, Copy, RefreshCw, ArrowUpRight, UserRound, CircleDashed, Clock, AlertTriangle, CheckCircle2, Check, CalendarDays, Bookmark, Play, Instagram, Plus } from "lucide-react";
import { TAG_COLORS } from "@/features/gestao/pm-constants";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useClients, useTeamMembers } from "@/features/data/queries";
import { useDefaultFlowWithDates, getFixedAssignee } from "@/features/gestao/components/PmStageFlowConfig";
import { useSession } from "@/hooks/use-session";
import {
  useCalendarPublications, useCalendarsForClient, useCalendarsForCycle, useCapaTaskIds, useCoverAttachmentsById, useInstagramRiskSummary, usePublishCycle, useScheduleCyclePublications, useUnscheduleCyclePublications, useUnpublishCycle, useTaskAttachmentsMap, useTaskCompletionMap, useUpdateCalendarPublication, useUpdateCalendarShare, useUpdateCalendarStatus,
  type ClientInstagramRisk,
} from "../hooks/use-calendar-data";
import { CALENDAR_STATUS_LABELS, CONTENT_TYPE_LABELS, PUBLICATION_STATUS_LABELS, type CalendarPublication, type CalendarStatus } from "../calendar-types";
import { PublicationCard, CONTENT_TYPE_ICON, getContentTypeColor } from "./PublicationCard";
import { PublicationPreviewPanel } from "./PublicationPreviewPanel";
import { QuickAddPublicationDialog } from "./QuickAddPublicationDialog";
import { useConnectInstagram, useDisconnectInstagram, useInstagramConnections } from "../hooks/use-instagram";

interface Props {
  onOpenTask: (taskId: string) => void;
  focusRequest?: { clientId: string; cycleStart: string; publicationId: string } | null;
  onFocusHandled?: () => void;
}

function anchorForDate(d: Date) {
  return d.getDate() >= 28 ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : new Date(d.getFullYear(), d.getMonth(), 1);
}
function cycleEnd(anchor: Date) {
  return new Date(anchor.getFullYear(), anchor.getMonth(), 27);
}
function cycleStart(anchor: Date) {
  const end = cycleEnd(anchor);
  return new Date(end.getFullYear(), end.getMonth() - 1, 28);
}
const UNSCHEDULED_ID = "unscheduled";

function describeInstagramRisk(r: ClientInstagramRisk): string {
  const parts: string[] = [];
  if (r.notConnectedCount > 0) {
    parts.push(`${r.notConnectedCount} publicaç${r.notConnectedCount > 1 ? "ões" : "ão"} agendada${r.notConnectedCount > 1 ? "s" : ""} sem Instagram conectado`);
  }
  if (r.failedCount > 0) {
    parts.push(`${r.failedCount} falha${r.failedCount > 1 ? "s" : ""} ao publicar`);
  }
  if (r.unsupportedCount > 0) {
    parts.push(`${r.unsupportedCount} agendada${r.unsupportedCount > 1 ? "s" : ""} num tipo que não sai sozinho (Stories/Outro)`);
  }
  if (r.tokenExpiresInDays !== null) {
    parts.push(r.tokenExpiresInDays === 0 ? "acesso ao Instagram expira hoje" : `acesso ao Instagram expira em ${r.tokenExpiresInDays} dia${r.tokenExpiresInDays > 1 ? "s" : ""}`);
  }
  return parts.join(" · ");
}

// Maps the 4 calendar_status values to the badge shown on the client card in the
// sidebar — label matches CALENDAR_STATUS_LABELS exactly, key is just the status
// itself, used to match against STATUS_FILTERS below.
const CLIENT_CARD_STATUS: Record<string, { key: string; label: string; className: string }> = {
  em_montagem: { key: "em_montagem", label: "Em montagem", className: "bg-muted text-muted-foreground" },
  enviado_ao_cliente: { key: "enviado_ao_cliente", label: "Enviado ao cliente", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  alteracoes_solicitadas: { key: "alteracoes_solicitadas", label: "Alterações solicitadas", className: "bg-destructive/15 text-destructive" },
  aprovado: { key: "aprovado", label: "Aprovado", className: "bg-success/15 text-success" },
};

const STATUS_FILTERS: { key: string; label: string; icon: typeof CircleDashed }[] = [
  { key: "em_montagem", label: "Em montagem", icon: CircleDashed },
  { key: "enviado_ao_cliente", label: "Enviado ao cliente", icon: Clock },
  { key: "alteracoes_solicitadas", label: "Alterações solicitadas", icon: AlertTriangle },
  { key: "aprovado", label: "Aprovado", icon: CheckCircle2 },
];

function DraggablePublication({ publication, images, onClick, isCapa }: { publication: CalendarPublication; images?: string[]; onClick: () => void; isCapa?: boolean }) {
  const { setNodeRef, listeners, attributes, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: publication.id,
    data: { publication },
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div ref={setNodeRef} style={style}>
      <PublicationCard
        publication={publication}
        images={images}
        onClick={onClick}
        dragHandleProps={{ listeners, attributes, setActivatorNodeRef }}
        isDragging={isDragging}
        isCapa={isCapa}
      />
    </div>
  );
}

function ListPublicationCard({ publication: p, idx, images, onClick, isCapa, hasVideo }: { publication: CalendarPublication; idx: number; images: string[]; onClick: () => void; isCapa?: boolean; hasVideo?: boolean }) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const Icon = isCapa ? Bookmark : CONTENT_TYPE_ICON[p.content_type];
  const label = isCapa ? "Capa" : CONTENT_TYPE_LABELS[p.content_type];
  const typeColor = isCapa
    ? { bg: TAG_COLORS.find((c) => c.key === "indigo")!.dot, text: "text-white" }
    : getContentTypeColor(p.content_type);
  const hasMultiple = images.length > 1;

  useEffect(() => {
    if (!hasMultiple || paused) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % images.length), 3000);
    return () => clearInterval(id);
  }, [hasMultiple, paused, images.length]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className="group grid cursor-pointer overflow-hidden rounded-3xl border border-border/40 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:grid-cols-[240px_1fr]"
    >
      <div
        className="relative flex items-center justify-center bg-muted/30 p-3 sm:border-r sm:border-border/30"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {hasMultiple ? (
          <div className="h-72 w-full overflow-hidden rounded-2xl bg-background">
            <div
              className="flex h-full transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${slide * 100}%)` }}
            >
              {images.map((url, i) => (
                <img key={i} src={url} alt="" className="h-full w-full shrink-0 object-contain" />
              ))}
            </div>
          </div>
        ) : images[0] ? (
          <img src={images[0]} alt="" className="h-auto max-h-72 w-auto max-w-full rounded-2xl object-contain" />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-muted">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {hasVideo && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/35">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-md">
              <Play className="h-5 w-5 fill-black text-black" />
            </span>
            <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">Assista o vídeo</span>
          </div>
        )}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSlide((s) => (s - 1 + images.length) % images.length); }}
              className="absolute left-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur transition-opacity opacity-0 group-hover:opacity-100"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSlide((s) => (s + 1) % images.length); }}
              className="absolute right-4 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground shadow-md backdrop-blur transition-opacity opacity-0 group-hover:opacity-100"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur">
              {slide + 1}/{images.length}
            </span>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", typeColor.bg, typeColor.text)}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </span>
          <Badge variant="outline" className="shrink-0 rounded-full text-[10px]">{PUBLICATION_STATUS_LABELS[p.status]}</Badge>
        </div>

        <h3 className="text-lg font-semibold tracking-tight">Post {idx + 1}</h3>

        {p.caption && (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Legenda</p>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{p.caption}</p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-button-sheen px-3 py-1.5 text-xs font-semibold text-white shadow-glow">
            <CalendarDays className="h-3.5 w-3.5" />
            {p.publish_date ? format(new Date(`${p.publish_date}T00:00:00`), "dd/MM/yy") : "Sem data"}
          </span>
          {p.publish_time && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-button-sheen px-3 py-1.5 text-xs font-semibold text-white shadow-glow">
              <Clock className="h-3.5 w-3.5" />
              {p.publish_time.slice(0, 5)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DropZone({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn(className, isOver && "bg-primary/5 ring-1 ring-inset ring-primary/30")}>
      {children}
    </div>
  );
}

export function CalendarioPublicacaoPanel({ onOpenTask, focusRequest, onFocusHandled }: Props) {
  const [clientId, setClientId] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => anchorForDate(new Date()));
  const [view, setView] = useState<"calendario" | "lista" | "feed">("calendario");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Deep-link from elsewhere in the app (e.g. the Agenda's "Ciclo incompleto" dialog):
  // jump straight to a client's cycle and open one publication, instead of making the
  // team re-navigate the client list + month picker by hand.
  useEffect(() => {
    if (!focusRequest) return;
    const cycleStartDate = parseISO(focusRequest.cycleStart);
    setClientId(focusRequest.clientId);
    setCursor(new Date(cycleStartDate.getFullYear(), cycleStartDate.getMonth() + 1, 1));
    setSelectedId(focusRequest.publicationId);
    onFocusHandled?.();
  }, [focusRequest, onFocusHandled]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const clientsQ = useClients();
  const sortedClients = useMemo(
    () => [...(clientsQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [clientsQ.data],
  );
  const selectedClient = clientsQ.data?.find((c) => c.id === clientId);
  const clientName = selectedClient?.name ?? "Cliente";
  const clientLogoUrl = selectedClient?.logo_url ?? null;

  const igConnectionsQ = useInstagramConnections();
  const igConnectionMap = useMemo(() => {
    const m = new Map<string, (typeof igConnectionsQ.data)[number]>();
    for (const c of igConnectionsQ.data ?? []) m.set(c.client_id, c);
    return m;
  }, [igConnectionsQ.data]);
  const connectInstagram = useConnectInstagram();
  const disconnectInstagram = useDisconnectInstagram();
  const [igDisconnectTarget, setIgDisconnectTarget] = useState<{ id: string; name: string } | null>(null);
  const instagramRiskQ = useInstagramRiskSummary(igConnectionsQ.data);
  const instagramRisks = instagramRiskQ.data ?? [];
  const currentClientRisk = clientId ? instagramRisks.find((r) => r.clientId === clientId) ?? null : null;

  const qc = useQueryClient();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);

  // "Social" responsável por cliente: vem do assignee fixo da etapa "planejamento".
  const teamMembersQ = useTeamMembers();
  const teamMemberById = useMemo(() => {
    const map = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const m of teamMembersQ.data ?? []) map.set(m.user_id, m);
    return map;
  }, [teamMembersQ.data]);
  const { stageAssignees } = useDefaultFlowWithDates();
  const responsibleByClientId = useMemo(() => {
    const map = new Map<string, { display_name: string; avatar_url: string | null }>();
    for (const c of sortedClients) {
      const userId = getFixedAssignee(stageAssignees, "planejamento", c.id);
      const member = userId ? teamMemberById.get(userId) : undefined;
      if (member) map.set(c.id, member);
    }
    return map;
  }, [sortedClients, stageAssignees, teamMemberById]);
  const calendarsQ = useCalendarsForClient(clientId);
  const cycleStartKey = format(cycleStart(cursor), "yyyy-MM-dd");
  const calendar = useMemo(() => (calendarsQ.data ?? []).find((c) => c.cycle_start === cycleStartKey) ?? null, [calendarsQ.data, cycleStartKey]);

  // Which clients have a calendar in the current ciclo, for the sidebar dots.
  const cycleCalendarsQ = useCalendarsForCycle(cycleStartKey);
  const calendarByClientId = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    for (const c of cycleCalendarsQ.data ?? []) map.set(c.client_id, c);
    return map;
  }, [cycleCalendarsQ.data]);

  // Filtros da grade de clientes: "Meus" (responsável = eu) + status do ciclo.
  const { user } = useSession();
  const [onlyMine, setOnlyMine] = useState(false);
  const [activeStatusFilters, setActiveStatusFilters] = useState<Set<string>>(new Set());
  const toggleStatusFilter = (key: string) => {
    setActiveStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const filteredClients = useMemo(() => {
    return sortedClients.filter((c) => {
      if (onlyMine) {
        const responsibleId = getFixedAssignee(stageAssignees, "planejamento", c.id);
        if (!responsibleId || responsibleId !== user?.id) return false;
      }
      if (activeStatusFilters.size > 0) {
        const cal = calendarByClientId.get(c.id);
        const bucketKey = cal ? CLIENT_CARD_STATUS[cal.status]?.key ?? "incompleto" : null;
        if (!bucketKey || !activeStatusFilters.has(bucketKey)) return false;
      }
      return true;
    });
  }, [sortedClients, onlyMine, user?.id, stageAssignees, activeStatusFilters, calendarByClientId]);

  const publicationsQ = useCalendarPublications(calendar?.id ?? null);
  const publications = publicationsQ.data ?? [];
  const taskIds = useMemo(() => publications.map((p) => p.task_id), [publications]);
  const capaTaskIdsQ = useCapaTaskIds(taskIds);
  const isCapaTask = (taskId: string) => capaTaskIdsQ.data?.has(taskId) ?? false;
  // Only approved publications are eligible to be concluded — a post still awaiting
  // review or with changes requested shouldn't have its task closed out yet.
  const publishablePublications = useMemo(
    () => publications.filter((p) => p.status === "aprovada"),
    [publications],
  );
  // Concluir só faz sentido quando o ciclo inteiro já está pronto pra ir ao ar —
  // toda publicação precisa ter data, horário e legenda definidos, senão o time
  // fecharia a tarefa sem ainda saber quando/como postar.
  const missingFieldsFor = (p: CalendarPublication) => {
    const missing: string[] = [];
    if (!p.publish_date) missing.push("Data");
    if (!p.publish_time) missing.push("Horário");
    if (!p.caption?.trim()) missing.push("Legenda");
    return missing;
  };
  // "Capa" tasks only exist to hand off a cover image to a sibling publication (see
  // useCapaTaskIds/useCoverCandidates) — they never get their own data/horário/legenda, so
  // they shouldn't count against "Concluir PDF" readiness.
  const notReadyPublications = useMemo(
    () => publications.filter((p) => !isCapaTask(p.task_id) && missingFieldsFor(p).length > 0),
    [publications, capaTaskIdsQ.data],
  );
  const cycleReadyToConclude = publications.length > 0 && notReadyPublications.length === 0;
  const [incompleteDialogOpen, setIncompleteDialogOpen] = useState(false);
  // "PDF concluído" — mirrors the same status_global signal the Agenda and o Magic Number
  // já mostram como concluído. Um pipeline task vira status_global='concluido' assim que o
  // time termina a própria etapa (ex.: PDF) — ver pm_sync_stage_completion. O fluxo exige essa
  // etapa feita antes de liberar o agendamento pro Instagram (ver isPdfConcluded abaixo).
  const allTaskIdsInCycle = useMemo(
    () => [...new Set(publications.map((p) => p.task_id))],
    [publications],
  );
  const taskCompletionQ = useTaskCompletionMap(allTaskIdsInCycle);
  const cycleConcluded = allTaskIdsInCycle.length > 0 && allTaskIdsInCycle.every((id) => taskCompletionQ.data?.has(id));
  const isPdfConcluded = (p: CalendarPublication) => taskCompletionQ.data?.has(p.task_id) ?? false;
  // "Agendar publicações": libera de uma vez pro cron do Instagram tudo que o cliente já
  // aprovou e que já tem data/horário/legenda — só as aprovadas entram aqui (diferente de
  // notReadyPublications acima, que olha o ciclo inteiro pra "Concluir PDF"). Segue o fluxo:
  // só é possível agendar depois que o PDF daquela publicação já foi concluído.
  const notReadyToSchedule = useMemo(
    () => publishablePublications.filter((p) => !isCapaTask(p.task_id) && missingFieldsFor(p).length > 0),
    [publishablePublications, capaTaskIdsQ.data],
  );
  const schedulablePublications = useMemo(
    () => publishablePublications.filter((p) => !p.instagram_scheduled && p.instagram_status !== "published" && missingFieldsFor(p).length === 0 && isPdfConcluded(p)),
    [publishablePublications, taskCompletionQ.data],
  );
  // Fallback quando não há nada aprovado ainda pra agendar da forma normal: o time pode
  // forçar o agendamento de publicações completas (legenda+data+horário, PDF concluído) mesmo
  // sem aprovação do cliente — oferecido via diálogo de confirmação, não como caminho padrão.
  const forceSchedulablePublications = useMemo(
    () => publications.filter((p) => !p.instagram_scheduled && p.instagram_status !== "published" && missingFieldsFor(p).length === 0 && isPdfConcluded(p)),
    [publications, taskCompletionQ.data],
  );
  // Completas e sem agendamento, mas o PDF ainda não foi concluído — bloqueadas até o time
  // marcar "Concluir PDF", pra dar um feedback claro em vez de simplesmente não aparecerem.
  const blockedByPdfNotConcluded = useMemo(
    () => publications.filter((p) => !p.instagram_scheduled && p.instagram_status !== "published" && missingFieldsFor(p).length === 0 && !isPdfConcluded(p)),
    [publications, taskCompletionQ.data],
  );
  const [incompleteScheduleDialogOpen, setIncompleteScheduleDialogOpen] = useState(false);
  const scheduleCycle = useScheduleCyclePublications();
  const unscheduleCycle = useUnscheduleCyclePublications();
  const [unscheduleConfirmOpen, setUnscheduleConfirmOpen] = useState(false);
  const [forceScheduleConfirmOpen, setForceScheduleConfirmOpen] = useState(false);
  // "Publicações agendadas" (roxo, desagendável) uma vez que tudo que já pode ser agendado
  // (completo, PDF concluído e ainda não publicado) já está com instagram_scheduled=true —
  // mesmo padrão do toggle "Concluir PDF"/"PDF concluído".
  const schedulableUniverse = useMemo(
    () => publications.filter((p) => p.instagram_status !== "published" && missingFieldsFor(p).length === 0 && isPdfConcluded(p)),
    [publications, taskCompletionQ.data],
  );
  const cycleScheduled = schedulableUniverse.length > 0 && schedulableUniverse.every((p) => p.instagram_scheduled);
  const attachmentsQ = useTaskAttachmentsMap(taskIds);
  const unpublishCycle = useUnpublishCycle();
  const [unpublishConfirmOpen, setUnpublishConfirmOpen] = useState(false);
  const coverAttachmentIds = useMemo(
    () => [...new Set(publications.map((p) => p.cover_attachment_id).filter((id): id is string => !!id))],
    [publications],
  );
  const coverAttachmentsQ = useCoverAttachmentsById(coverAttachmentIds);

  const updatePublication = useUpdateCalendarPublication();
  const updateCalendarStatus = useUpdateCalendarStatus();
  const updateCalendarShare = useUpdateCalendarShare();
  const publishCycle = usePublishCycle();
  const [shareOpen, setShareOpen] = useState(false);

  const publicationByTask = useMemo(() => {
    const map = new Map<string, CalendarPublication>();
    for (const p of publications) map.set(p.task_id, p);
    return map;
  }, [publications]);

  // Puts the publication's chosen cover attachment (if any) first in the list, so every
  // consumer that just reads "the first image" (thumbnailFor, imagesFor, the Feed grid)
  // automatically shows the cover without needing its own cover-aware logic. The cover
  // may belong to a different task entirely (e.g. chosen from a sibling "Capa" task
  // during the PDF stage), so when it's not found in this task's own attachments, it's
  // looked up via coverAttachmentsQ and prepended instead.
  const mediaFor = (taskId: string) => {
    const list = attachmentsQ.data?.get(taskId) ?? [];
    const coverId = publicationByTask.get(taskId)?.cover_attachment_id;
    if (!coverId) return list;
    const idx = list.findIndex((m) => m.id === coverId);
    if (idx === 0) return list;
    if (idx > 0) {
      const reordered = [...list];
      const [cover] = reordered.splice(idx, 1);
      reordered.unshift(cover);
      return reordered;
    }
    const external = coverAttachmentsQ.data?.get(coverId);
    return external ? [external, ...list] : list;
  };
  const thumbnailFor = (taskId: string) => mediaFor(taskId).find((m) => m.type?.startsWith("image/"))?.url ?? null;

  // A "Capa" holding-task (see useCoverCandidates) whose image is currently pinned as
  // some *other* publication's cover is "in use" — hide it from "Publicações sem data"
  // so it doesn't clutter the unscheduled pile while claimed. It reappears there the
  // moment it's unpinned (cover_attachment_id no longer points at one of its attachments).
  const hiddenFromUnscheduled = useMemo(() => {
    const hidden = new Set<string>();
    for (const p of publications) {
      const ownAttachmentIds = new Set((attachmentsQ.data?.get(p.task_id) ?? []).map((a) => a.id));
      const usedByOther = publications.some(
        (other) => other.id !== p.id && other.cover_attachment_id && ownAttachmentIds.has(other.cover_attachment_id),
      );
      if (usedByOther) hidden.add(p.task_id);
    }
    return hidden;
  }, [publications, attachmentsQ.data]);
  // Only "carrossel" posts are meant to page through every image — for every other
  // content type (reel, vídeo, imagem...) the card should show just the one cover
  // image as a static thumbnail, even if the task has other image attachments
  // (e.g. an auto-generated video poster alongside a manually chosen cover).
  const imagesFor = (p: CalendarPublication) => {
    const imgs = mediaFor(p.task_id).filter((m) => m.type?.startsWith("image/")).map((m) => m.url);
    return p.content_type === "carrossel" ? imgs : imgs.slice(0, 1);
  };

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarPublication[]>();
    for (const p of publications) {
      const key = p.publish_date ?? UNSCHEDULED_ID;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [publications]);

  const weeks = useMemo(() => {
    const start = cycleStart(cursor);
    const end = cycleEnd(cursor);
    const out: Date[][] = [];
    let weekStart = startOfWeek(start, { weekStartsOn: 0 });
    while (weekStart <= end) {
      out.push(Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)));
      weekStart = addDays(weekStart, 7);
    }
    return out;
  }, [cursor]);

  const counts = useMemo(() => ({
    total: publications.length,
    aguardando: publications.filter((p) => p.status === "aguardando_aprovacao").length,
    aprovada: publications.filter((p) => p.status === "aprovada").length,
    alteracao: publications.filter((p) => p.status === "alteracao_solicitada").length,
  }), [publications]);

  // Feed: chronological reading order (most recent first), excluding stories
  // and anything missing what it needs to actually appear in a real feed. Only the
  // date is required — a card scheduled by dragging onto the calendar only gets a
  // date, not a time, and making time mandatory too just made those cards vanish
  // into "outsideFeed" with no obvious reason. Time still refines same-day ordering
  // when it's set; it just isn't a gate anymore.
  const { feedItems, outsideFeed } = useMemo(() => {
    const feed: CalendarPublication[] = [];
    const outside: { publication: CalendarPublication; reason: string }[] = [];
    for (const p of publications) {
      if (p.content_type === "story") {
        outside.push({ publication: p, reason: "Stories não entram na grade do feed" });
        continue;
      }
      if (!p.publish_date) {
        outside.push({ publication: p, reason: "Data não definida" });
        continue;
      }
      if (mediaFor(p.task_id).length === 0) {
        outside.push({ publication: p, reason: "Arquivo final não selecionado" });
        continue;
      }
      feed.push(p);
    }
    feed.sort((a, b) => `${b.publish_date}T${b.publish_time ?? "00:00"}`.localeCompare(`${a.publish_date}T${a.publish_time ?? "00:00"}`));
    return { feedItems: feed, outsideFeed: outside };
  }, [publications, attachmentsQ.data]);

  const listOrder = useMemo(
    () => [...publications].sort((a, b) => (a.publish_date ?? "9999") > (b.publish_date ?? "9999") ? 1 : -1),
    [publications],
  );

  const navList = view === "feed" ? feedItems : listOrder;
  const navIndex = navList.findIndex((p) => p.id === selectedId);
  const selected = navIndex >= 0 ? navList[navIndex] : null;

  const handleNavigate = (direction: "prev" | "next") => {
    if (navIndex < 0) return;
    const nextIndex = direction === "prev" ? navIndex - 1 : navIndex + 1;
    if (nextIndex < 0 || nextIndex >= navList.length) return;
    setSelectedId(navList[nextIndex].id);
  };

  const handleConfirmPublish = () => {
    if (!calendar) return;
    const taskIdsToComplete = allTaskIdsInCycle;
    publishCycle.mutate(
      { calendarId: calendar.id, taskIds: taskIdsToComplete },
      {
        onSuccess: () => {
          if (taskIdsToComplete.length > 0) {
            toast.success(`${taskIdsToComplete.length} tarefa${taskIdsToComplete.length > 1 ? "s" : ""} marcada${taskIdsToComplete.length > 1 ? "s" : ""} como concluída${taskIdsToComplete.length > 1 ? "s" : ""}!`);
          }
          // Concluir is often the last step before handing the cycle off to the
          // client, so surface the share link right away instead of making the
          // team separately click "Compartilhar" — enabling it first if it's off.
          const shareUrl = `${window.location.origin}/aprovacao/${calendar.share_token}`;
          navigator.clipboard.writeText(shareUrl);
          toast.success("Link do cliente copiado!");
          if (!calendar.share_enabled) {
            updateCalendarShare.mutate({ id: calendar.id, clientId: clientId!, share_enabled: true });
          }
          if (calendar.status === "em_montagem") {
            updateCalendarStatus.mutate({ id: calendar.id, status: "enviado_ao_cliente", clientId: clientId! });
          }
          setShareOpen(true);
        },
        onError: (e: any) => toast.error(e?.message ?? "Erro ao concluir o ciclo"),
      },
    );
  };

  const handleUnpublish = () => {
    if (!calendar) return;
    unpublishCycle.mutate(
      { calendarId: calendar.id, taskIds: allTaskIdsInCycle },
      {
        onSuccess: () => toast.success("Conclusão desmarcada."),
        onError: (e: any) => toast.error(e?.message ?? "Erro ao desmarcar"),
      },
    );
    setUnpublishConfirmOpen(false);
  };

  const handleUnschedule = () => {
    if (!calendar) return;
    unscheduleCycle.mutate(
      { calendarId: calendar.id, publicationIds: schedulableUniverse.map((p) => p.id) },
      {
        onSuccess: () => toast.success("Agendamento desmarcado."),
        onError: (e: any) => toast.error(e?.message ?? "Erro ao desmarcar agendamento"),
      },
    );
    setUnscheduleConfirmOpen(false);
  };

  const handleForceSchedule = () => {
    if (!calendar) return;
    scheduleCycle.mutate(
      { calendarId: calendar.id, publicationIds: forceSchedulablePublications.map((p) => p.id) },
      {
        onSuccess: () => {
          const n = forceSchedulablePublications.length;
          toast.success(`${n} publicaç${n === 1 ? "ão agendada" : "ões agendadas"} à força (sem aprovação do cliente).`);
        },
        onError: (e: any) => toast.error(e?.message ?? "Erro ao agendar publicações"),
      },
    );
    setForceScheduleConfirmOpen(false);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const publication = (active.data.current as { publication?: CalendarPublication } | undefined)?.publication;
    if (!publication) return;
    const targetDayKey = String(over.id);
    const newDate = targetDayKey === UNSCHEDULED_ID ? null : targetDayKey;
    if (publication.publish_date === newDate) return;
    updatePublication.mutate({ id: publication.id, publish_date: newDate });
  };

  const todayKey = format(new Date(), "yyyy-MM-dd");
  const cycleMonthRaw = format(cycleEnd(cursor), "MMMM", { locale: ptBR });
  const cycleMonthLabel = cycleMonthRaw.charAt(0).toUpperCase() + cycleMonthRaw.slice(1);
  const cycleRangeLabel = `${format(cycleStart(cursor), "dd/MM")} a ${format(cycleEnd(cursor), "dd/MM")}`;

  return (
    <div className="space-y-4">
      {/* Top: back/title + filters + cycle nav */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {clientId ? (
          <button
            type="button"
            onClick={() => setClientId(null)}
            className="flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar para clientes
          </button>
        ) : (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Cronograma</h2>
            <p className="text-sm text-muted-foreground">Calendário de publicação por cliente.</p>
          </div>
        )}

        <div className="flex w-fit items-center gap-1 rounded-2xl border border-border/30 bg-muted/20 p-2">
          <button type="button" onClick={() => setCursor((a) => new Date(a.getFullYear(), a.getMonth() - 1, 1))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-muted">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="flex-1 truncate text-center text-xs font-medium">
            {cycleMonthLabel} ({cycleRangeLabel})
          </span>
          <button type="button" onClick={() => setCursor((a) => new Date(a.getFullYear(), a.getMonth() + 1, 1))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-muted">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!clientId && instagramRisks.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-sm font-semibold text-destructive">
              {instagramRisks.length === 1 ? "1 cliente" : `${instagramRisks.length} clientes`} com risco de publicação agendada não sair sozinha no Instagram
            </p>
            <div className="space-y-1">
              {instagramRisks.map((r) => (
                <button
                  key={r.clientId}
                  type="button"
                  onClick={() => setClientId(r.clientId)}
                  className="block text-left text-xs text-destructive/90 underline-offset-2 hover:underline"
                >
                  <span className="font-medium">{r.clientName}</span> — {describeInstagramRisk(r)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!clientId && (
        <div className="flex items-center gap-1 rounded-full border border-border/30 bg-muted/20 p-1 w-fit">
          {[
            { key: "mine", label: "Meus", icon: UserRound, active: onlyMine, onClick: () => setOnlyMine((v) => !v) },
            ...STATUS_FILTERS.map((f) => ({ ...f, active: activeStatusFilters.has(f.key), onClick: () => toggleStatusFilter(f.key) })),
          ].map(({ key, label, icon: Icon, active, onClick }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              title={label}
              aria-label={label}
              aria-pressed={active}
              className={cn(
                "flex h-6 shrink-0 items-center gap-1.5 rounded-full text-xs font-medium transition-all",
                active
                  ? "bg-primary px-2.5 text-primary-foreground shadow-glow"
                  : "w-6 justify-center text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {active && <span className="whitespace-nowrap">{label}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Client grid — hidden once a client is open, so the calendar takes over the full view */}
      {!clientId && filteredClients.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado com esses filtros.
        </div>
      )}

      {!clientId && filteredClients.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredClients.map((c) => {
            const cal = calendarByClientId.get(c.id);
            const statusMeta = cal ? CLIENT_CARD_STATUS[cal.status] ?? CLIENT_CARD_STATUS.em_montagem : null;
            const initial = c.name.trim().charAt(0).toUpperCase() || "?";
            const responsible = responsibleByClientId.get(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setClientId(c.id)}
                className="group relative flex flex-col gap-4 rounded-3xl border border-border/40 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elevated"
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 text-sm font-bold text-white ring-2 ring-background">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      initial
                    )}
                  </span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-all group-hover:border-primary/50 group-hover:bg-primary/5 group-hover:text-primary">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-base font-semibold leading-tight">{c.name}</span>
                  {c.plan_name && <span className="truncate text-xs text-muted-foreground">{c.plan_name}</span>}
                </div>
                {(() => {
                  const igConn = igConnectionMap.get(c.id);
                  if (igConn?.status === "active") {
                    return (
                      <span
                        role="button"
                        tabIndex={0}
                        title="Desconectar Instagram"
                        className="flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setIgDisconnectTarget({ id: c.id, name: c.name });
                        }}
                      >
                        <Instagram className="h-3 w-3" />
                        {igConn.instagram_username ? `@${igConn.instagram_username}` : "Conectado"}
                      </span>
                    );
                  }
                  return (
                    <span
                      role="button"
                      tabIndex={0}
                      className="flex w-fit items-center gap-1 rounded-full border border-border/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        connectInstagram.mutate(
                          { clientId: c.id },
                          {
                            onSuccess: (url) => {
                              window.location.href = url;
                            },
                            onError: (err) => {
                              toast.error(err instanceof Error ? err.message : "Erro ao iniciar conexão com o Instagram");
                            },
                          },
                        );
                      }}
                    >
                      <Instagram className="h-3 w-3" />
                      Conectar Instagram
                    </span>
                  );
                })()}
                {statusMeta && (
                  <span
                    className={cn(
                      "w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      statusMeta.className,
                    )}
                  >
                    {statusMeta.label}
                  </span>
                )}
                {responsible && (
                  <span
                    className="absolute bottom-3 right-3 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-bold text-muted-foreground ring-2 ring-card"
                    title={responsible.display_name}
                  >
                    {responsible.avatar_url ? (
                      <img src={responsible.avatar_url} alt={responsible.display_name} className="h-full w-full object-cover" />
                    ) : (
                      responsible.display_name.trim().charAt(0).toUpperCase() || "?"
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected client's calendar, full view */}
      {clientId && (
      <div className="space-y-4">
      {currentClientRisk && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive/90">
            <span className="font-semibold">Atenção:</span> {describeInstagramRisk(currentClientRisk)}.
            {currentClientRisk.notConnectedCount > 0 && " Conecte o Instagram do cliente pra essas publicações saírem."}
          </p>
        </div>
      )}
      {calendar && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/30 bg-muted/20 p-3">
          <Select value={calendar.status} onValueChange={(v: CalendarStatus) => updateCalendarStatus.mutate({ id: calendar.id, status: v, clientId: clientId! })}>
            <SelectTrigger className="h-9 w-auto rounded-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(CALENDAR_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover open={shareOpen} onOpenChange={setShareOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full">
                <Link2 className="h-3.5 w-3.5" /> Compartilhar
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="share-toggle">Link ativo pro cliente</Label>
                <Switch
                  id="share-toggle"
                  checked={calendar.share_enabled}
                  onCheckedChange={(checked) => updateCalendarShare.mutate({ id: calendar.id, clientId: clientId!, share_enabled: checked })}
                />
              </div>
              {calendar.share_enabled && (
                <>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={`${window.location.origin}/aprovacao/${calendar.share_token}`} className="h-8 text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/aprovacao/${calendar.share_token}`);
                        toast.success("Link copiado!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs text-muted-foreground"
                    onClick={() => updateCalendarShare.mutate({ id: calendar.id, clientId: clientId!, share_token: crypto.randomUUID() })}
                  >
                    <RefreshCw className="h-3 w-3" /> Gerar novo link (invalida o anterior)
                  </Button>
                </>
              )}
            </PopoverContent>
          </Popover>

          {cycleConcluded ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-full border-violet-500/40 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 hover:text-violet-600"
              onClick={() => setUnpublishConfirmOpen(true)}
            >
              <Check className="h-3.5 w-3.5" /> PDF concluído
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-full"
              onClick={() => {
                if (!cycleReadyToConclude) {
                  setIncompleteDialogOpen(true);
                } else {
                  handleConfirmPublish();
                }
              }}
            >
              <Check className="h-3.5 w-3.5" /> Concluir PDF
            </Button>
          )}

          {cycleScheduled ? (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-full border-violet-500/40 bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 hover:text-violet-600"
              onClick={() => setUnscheduleConfirmOpen(true)}
            >
              <Check className="h-3.5 w-3.5" /> Publicações agendadas
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-full"
              disabled={scheduleCycle.isPending}
              onClick={() => {
                if (notReadyToSchedule.length > 0) {
                  setIncompleteScheduleDialogOpen(true);
                } else if (schedulablePublications.length > 0) {
                  scheduleCycle.mutate(
                    { calendarId: calendar!.id, publicationIds: schedulablePublications.map((p) => p.id) },
                    {
                      onSuccess: () => {
                        const n = schedulablePublications.length;
                        toast.success(`${n} publicaç${n === 1 ? "ão agendada" : "ões agendadas"}.`);
                      },
                      onError: (e: any) => toast.error(e?.message ?? "Erro ao agendar publicações"),
                    },
                  );
                } else if (forceSchedulablePublications.length > 0) {
                  // Nada aprovado ainda — oferece agendar à força via diálogo de confirmação.
                  setForceScheduleConfirmOpen(true);
                } else if (blockedByPdfNotConcluded.length > 0) {
                  const n = blockedByPdfNotConcluded.length;
                  toast.info(`${n} publicaç${n === 1 ? "ão está pronta, mas o PDF dela ainda não foi concluído" : "ões estão prontas, mas o PDF delas ainda não foi concluído"}. Marque "Concluir PDF" primeiro.`);
                } else {
                  toast.info("Nenhuma publicação pendente de agendamento.");
                }
              }}
            >
              <Clock className="h-3.5 w-3.5" /> Agendar publicações
            </Button>
          )}

          <Tabs value={view} onValueChange={(v) => setView(v as any)} className="ml-auto">
            <TabsList className="h-9 rounded-full">
              <TabsTrigger value="calendario" className="gap-1.5 rounded-full text-xs"><LayoutGrid className="h-3.5 w-3.5" /> Calendário</TabsTrigger>
              <TabsTrigger value="lista" className="gap-1.5 rounded-full text-xs"><List className="h-3.5 w-3.5" /> Lista</TabsTrigger>
              <TabsTrigger value="feed" className="gap-1.5 rounded-full text-xs"><Grid3x3 className="h-3.5 w-3.5" /> Feed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {!calendar && (
        <div className="space-y-3 rounded-2xl border border-dashed border-border/40 p-10 text-center text-sm text-muted-foreground">
          <p>Nenhum calendário para esse cliente neste ciclo ainda — ele é criado automaticamente assim que uma tarefa chegar na etapa "PDF".</p>
          <Button
            size="sm"
            className="h-9 gap-1.5 rounded-full"
            onClick={() => {
              setQuickAddDate(null);
              setQuickAddOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" /> Nova publicação
          </Button>
        </div>
      )}

      {calendar && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full">{counts.total} publicações</Badge>
            <Badge variant="secondary" className="gap-1 rounded-full bg-amber-500/15 text-amber-600 hover:bg-amber-500/15">{counts.aguardando} aguardando</Badge>
            <Badge variant="secondary" className="gap-1 rounded-full bg-success/15 text-success hover:bg-success/15">{counts.aprovada} aprovadas</Badge>
            <Badge variant="secondary" className="gap-1 rounded-full bg-destructive/15 text-destructive hover:bg-destructive/15">{counts.alteracao} com alteração</Badge>
          </div>

          {view !== "feed" && (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <DropZone id={UNSCHEDULED_ID} className="space-y-2 rounded-2xl border border-dashed border-border/40 p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Publicações sem data</p>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const unscheduled = (byDay.get(UNSCHEDULED_ID) ?? []).filter((p) => !hiddenFromUnscheduled.has(p.task_id));
                    return unscheduled.length === 0 ? (
                      <p className="text-xs text-muted-foreground/60">Nenhuma — arraste uma publicação aqui para tirar a data.</p>
                    ) : (
                      unscheduled.map((p) => (
                        <div key={p.id} className="w-28">
                          <DraggablePublication publication={p} images={imagesFor(p)} onClick={() => setSelectedId(p.id)} isCapa={isCapaTask(p.task_id)} />
                        </div>
                      ))
                    );
                  })()}
                </div>
              </DropZone>

              {view === "calendario" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                      <div key={d} className="px-1 py-1">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {weeks.flat().map((d) => {
                      const key = format(d, "yyyy-MM-dd");
                      const isToday = key === todayKey;
                      const inCycle = d >= cycleStart(cursor) && d <= cycleEnd(cursor);
                      const dayPubs = byDay.get(key) ?? [];
                      return (
                        <DropZone
                          key={key}
                          id={key}
                          className={cn(
                            "group/cell calendar-card-hover relative min-h-[130px] space-y-1.5 rounded-xl border border-border/40 bg-card/20 p-1.5 transition",
                            isToday && "border-primary/40",
                            !inCycle && "opacity-50",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div
                              className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background/60 text-[11px]",
                                isToday ? "text-primary" : "text-muted-foreground",
                              )}
                            >
                              {format(d, "d")}
                            </div>
                            {inCycle && (
                              <button
                                type="button"
                                className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition opacity-0 group-hover/cell:opacity-100"
                                onClick={() => {
                                  setQuickAddDate(key);
                                  setQuickAddOpen(true);
                                }}
                                title="Nova publicação"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          {dayPubs.map((p) => (
                            <DraggablePublication key={p.id} publication={p} images={imagesFor(p)} onClick={() => setSelectedId(p.id)} isCapa={isCapaTask(p.task_id)} />
                          ))}
                        </DropZone>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const scheduled = listOrder.filter((p) => p.publish_date);
                    if (scheduled.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          {publications.length === 0 ? "Nenhuma publicação neste ciclo ainda." : "Nenhuma publicação com data ainda."}
                        </p>
                      );
                    }
                    return scheduled.map((p, idx) => (
                      <ListPublicationCard
                        key={p.id}
                        publication={p}
                        idx={idx}
                        images={imagesFor(p)}
                        onClick={() => setSelectedId(p.id)}
                        isCapa={isCapaTask(p.task_id)}
                        hasVideo={mediaFor(p.task_id).some((m) => m.type?.startsWith("video/"))}
                      />
                    ));
                  })()}
                </div>
              )}
            </DndContext>
          )}

          {view === "feed" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-1.5">
                {feedItems.length === 0 && (
                  <p className="col-span-3 p-6 text-center text-sm text-muted-foreground">Nenhuma publicação pronta para o feed ainda.</p>
                )}
                {feedItems.map((p) => {
                  const media = mediaFor(p.task_id);
                  const images = media.filter((m) => m.type?.startsWith("image/"));
                  const thumb = images[0]?.url ?? null;
                  const isCarousel = p.content_type === "carrossel" && images.length > 1;
                  const isVideoish = p.content_type === "reel";
                  return (
                    // Instagram's feed post ratio (1080x1350 = 4:5), mirrors the public preview's Feed.
                    <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                      {thumb ? (
                        <img src={thumb} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover transition-opacity group-hover:opacity-90" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-muted-foreground/40" /></span>
                      )}
                      <span className="absolute right-1.5 top-1.5 flex items-center gap-1">
                        {isCarousel && <LayoutGrid className="h-3.5 w-3.5 text-white drop-shadow" />}
                        {isVideoish && <Film className="h-3.5 w-3.5 text-white drop-shadow" />}
                      </span>
                      {isCarousel && (
                        <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1 text-[9px] font-medium text-white">{images.length}p</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {outsideFeed.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-dashed border-border/40 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Conteúdos fora do feed</p>
                  <div className="flex flex-wrap gap-2">
                    {outsideFeed.map(({ publication: p, reason }) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className="flex w-56 items-center gap-2 rounded-lg border border-border/30 bg-card px-2 py-1.5 text-left hover:bg-muted/40"
                      >
                        {thumbnailFor(p.task_id) ? (
                          <img src={thumbnailFor(p.task_id)!} alt="" loading="lazy" decoding="async" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                        ) : (
                          <span className="h-8 w-8 shrink-0 rounded-md bg-muted" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-medium">{CONTENT_TYPE_LABELS[p.content_type]}</span>
                          <span className="block truncate text-[10px] text-muted-foreground">{reason}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      </div>
      )}

      <PublicationPreviewPanel
        publication={selected}
        media={selected ? (attachmentsQ.data?.get(selected.task_id) ?? []) : []}
        clientId={clientId}
        clientName={clientName}
        clientLogoUrl={clientLogoUrl}
        cycleStart={calendar?.cycle_start ?? null}
        cycleEnd={calendar?.cycle_end ?? null}
        onClose={() => setSelectedId(null)}
        onOpenTask={onOpenTask}
        onNavigate={handleNavigate}
        hasPrev={navIndex > 0}
        hasNext={navIndex >= 0 && navIndex < navList.length - 1}
      />

      {clientId && (
        <QuickAddPublicationDialog
          open={quickAddOpen}
          onClose={() => {
            setQuickAddOpen(false);
            setQuickAddDate(null);
          }}
          clientId={clientId}
          cycleStart={cycleStartKey}
          initialDate={quickAddDate}
          onCreated={(publicationId) => {
            qc.invalidateQueries({ queryKey: ["publication_calendars", clientId] });
            qc.invalidateQueries({ queryKey: ["unscheduled_client_tasks", clientId] });
            if (calendar?.id) qc.invalidateQueries({ queryKey: ["calendar_publications", calendar.id] });
            setSelectedId(publicationId);
          }}
        />
      )}

      <AlertDialog open={!!igDisconnectTarget} onOpenChange={(open) => !open && setIgDisconnectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar Instagram?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente "{igDisconnectTarget?.name}" deixará de publicar automaticamente no Instagram até ser conectado de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (igDisconnectTarget) disconnectInstagram.mutate({ clientId: igDisconnectTarget.id });
                setIgDisconnectTarget(null);
              }}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unpublishConfirmOpen} onOpenChange={setUnpublishConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desmarcar PDF concluído deste ciclo?</AlertDialogTitle>
            <AlertDialogDescription>
              {allTaskIdsInCycle.length === 1 ? "A tarefa voltará" : `As ${allTaskIdsInCycle.length} tarefas voltarão`} para pendente na Gestão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpublish}>Desmarcar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unscheduleConfirmOpen} onOpenChange={setUnscheduleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desmarcar agendamento deste ciclo?</AlertDialogTitle>
            <AlertDialogDescription>
              {schedulableUniverse.length === 1 ? "A publicação deixará" : `As ${schedulableUniverse.length} publicações deixarão`} de sair sozinha{schedulableUniverse.length === 1 ? "" : "s"} no Instagram até ser{schedulableUniverse.length === 1 ? "" : "em"} agendada{schedulableUniverse.length === 1 ? "" : "s"} de novo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnschedule}>Desmarcar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={forceScheduleConfirmOpen} onOpenChange={setForceScheduleConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {forceSchedulablePublications.length === 1
                ? "A publicação ainda não foi aprovada"
                : `Nenhuma das ${forceSchedulablePublications.length} publicações foi aprovada ainda`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Forçar o agendamento faz elas saírem sozinhas no Instagram no horário marcado, mesmo sem o cliente ter aprovado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleForceSchedule}>Forçar agendamento</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={incompleteDialogOpen} onOpenChange={setIncompleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ciclo incompleto</DialogTitle>
            <DialogDescription>
              {notReadyPublications.length === 1 ? "1 publicação" : `${notReadyPublications.length} publicações`} ainda {notReadyPublications.length === 1 ? "precisa" : "precisam"} de data, horário e/ou legenda antes de concluir. Clique numa publicação para abrir e completar.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {notReadyPublications.map((p) => {
              const thumb = thumbnailFor(p.task_id);
              const ContentIcon = CONTENT_TYPE_ICON[p.content_type];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setIncompleteDialogOpen(false);
                    setSelectedId(p.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/50 px-3 py-2 text-left text-sm hover:bg-accent/50"
                >
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ContentIcon className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{p.title || "Sem título"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{missingFieldsFor(p).join(", ")}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={incompleteScheduleDialogOpen} onOpenChange={setIncompleteScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicações aprovadas incompletas</DialogTitle>
            <DialogDescription>
              {notReadyToSchedule.length === 1 ? "1 publicação aprovada ainda precisa" : `${notReadyToSchedule.length} publicações aprovadas ainda precisam`} de data, horário e/ou legenda antes de agendar. Clique numa publicação para abrir e completar.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {notReadyToSchedule.map((p) => {
              const thumb = thumbnailFor(p.task_id);
              const ContentIcon = CONTENT_TYPE_ICON[p.content_type];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setIncompleteScheduleDialogOpen(false);
                    setSelectedId(p.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-border/50 px-3 py-2 text-left text-sm hover:bg-accent/50"
                >
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" decoding="async" className="h-9 w-9 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <ContentIcon className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{p.title || "Sem título"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{missingFieldsFor(p).join(", ")}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
