import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2, CalendarX, LayoutGrid, Grid3x3, List, X, Check, MessageSquareWarning, Film, Image as ImageIcon, Camera, Smartphone, File, Clock, CalendarDays, ChevronLeft, ChevronRight, Images, Aperture, Play, Heart, MessageCircle, Send, Bookmark, Sun, Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { TAG_COLORS } from "@/features/gestao/pm-constants";
import { useAppSettings } from "@/features/data/queries";

const FN_URL = "https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/public-calendario-publicacao";

// Tema isolado desta página: sempre abre em modo escuro para quem recebe o link,
// independente do tema usado no painel interno. Guarda a preferência do cliente
// numa chave própria (não a do painel interno) para não misturar os dois.
const PUBLIC_THEME_KEY = "uau-theme-public";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  carrossel: "Carrossel", reel: "Reels", video: "Vídeo", story: "Stories", outro: "Outro", post: "Post", foto: "Foto",
};

const CONTENT_TYPE_ICON: Record<string, typeof Film> = {
  carrossel: LayoutGrid, reel: Film, video: Camera, story: Smartphone, outro: File, post: Images, foto: Aperture,
};

// Mirrors the internal Cronograma's color-per-content-type mapping so the
// client-facing page reads exactly like the team's own tool.
const CONTENT_TYPE_COLOR_KEY: Record<string, string> = {
  carrossel: "blue", reel: "yellow", video: "purple", story: "red", outro: "slate", post: "green", foto: "teal",
};

function getContentTypeColor(contentType: string) {
  const key = CONTENT_TYPE_COLOR_KEY[contentType] ?? "slate";
  const found = TAG_COLORS.find((c) => c.key === key);
  return found ? { bg: found.dot, text: "text-white" } : { bg: "bg-muted-foreground", text: "text-white" };
}

function VideoBadge() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/35">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-md">
        <Play className="h-5 w-5 fill-black text-black" />
      </span>
      <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">Assista o vídeo</span>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; shortLabel: string; className: string }> = {
  aguardando_aprovacao: { label: "Aguardando sua aprovação", shortLabel: "Aguardando", className: "bg-amber-500/15 text-amber-600" },
  aprovada: { label: "Aprovada", shortLabel: "Aprovada", className: "bg-emerald-500/15 text-emerald-600" },
  alteracao_solicitada: { label: "Alteração solicitada", shortLabel: "Alteração", className: "bg-red-500/15 text-red-600" },
};

const CALENDAR_STATUS_META: Record<string, { label: string; className: string }> = {
  em_montagem: { label: "Em montagem", className: "bg-muted text-muted-foreground" },
  enviado_ao_cliente: { label: "Aguardando sua aprovação", className: "bg-amber-500/15 text-amber-600" },
  alteracoes_solicitadas: { label: "Alterações solicitadas", className: "bg-red-500/15 text-red-600" },
  aprovado: { label: "Aprovado", className: "bg-emerald-500/15 text-emerald-600" },
};

interface PublicationData {
  id: string;
  title: string;
  content_type: string;
  caption: string | null;
  publish_date: string | null;
  publish_time: string | null;
  status: string;
  client_note: string | null;
  client_feedback: string | null;
  media: { url: string; type: string | null }[];
}

function PublicListCard({ publication: p, idx, onClick, onApprove }: { publication: PublicationData; idx: number; onClick: () => void; onApprove: () => void }) {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  // Only "carrossel" posts page through every image — everything else shows just
  // the one cover image as a static thumbnail (mirrors the internal Cronograma view).
  const allImages = p.media.filter((m) => m.type?.startsWith("image/")).map((m) => m.url);
  const images = p.content_type === "carrossel" ? allImages : allImages.slice(0, 1);
  const hasMultiple = images.length > 1;
  const hasVideo = p.media.some((m) => m.type?.startsWith("video/"));
  const ContentIcon = CONTENT_TYPE_ICON[p.content_type] ?? File;
  const contentTypeColor = getContentTypeColor(p.content_type);
  const statusMeta = STATUS_META[p.status] ?? { label: p.status, shortLabel: p.status, className: "bg-muted text-muted-foreground" };

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
      className="group grid cursor-pointer overflow-hidden rounded-3xl border border-border/40 bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elevated sm:grid-cols-[220px_1fr]"
    >
      <div
        className="relative flex items-center justify-center bg-muted/30 p-3 sm:border-r sm:border-border/30"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {hasMultiple ? (
          <div className="h-64 w-full overflow-hidden rounded-2xl bg-background">
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
            <ContentIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {hasVideo && <VideoBadge />}
        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSlide((s) => (s - 1 + images.length) % images.length); }}
              className="absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              aria-label="Imagem anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSlide((s) => (s + 1) % images.length); }}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/90 text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              aria-label="Próxima imagem"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground">
              {slide + 1}/{images.length}
            </span>
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", contentTypeColor.bg, contentTypeColor.text)}>
            <ContentIcon className="h-3.5 w-3.5" />
            {CONTENT_TYPE_LABELS[p.content_type] ?? p.content_type}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white">
              <CalendarDays className="h-3.5 w-3.5" />
              {p.publish_date ? format(parseISO(p.publish_date), "dd/MM/yy") : "Sem data"}
            </span>
            {p.publish_time && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white">
                <Clock className="h-3.5 w-3.5" />
                {p.publish_time.slice(0, 5)}
              </span>
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold tracking-tight text-foreground">Post {idx + 1}</h3>

        {p.caption && (
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Legenda</p>
            <p className="whitespace-pre-wrap text-sm text-foreground/90">{p.caption}</p>
          </div>
        )}

        {p.status !== "aprovada" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
            >
              <Check className="h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-full"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
              <MessageSquareWarning className="h-3.5 w-3.5" /> Solicitar alteração
            </Button>
          </div>
        )}

        <div className="mt-auto flex items-center justify-end">
          <Badge className={cn("rounded-full text-[10px]", statusMeta.className)} variant="secondary">{statusMeta.shortLabel}</Badge>
        </div>
      </div>
    </div>
  );
}

function firstImageUrl(p: { media: { url: string; type: string | null }[] }): string | null {
  return p.media.find((m) => m.type?.startsWith("image/"))?.url ?? null;
}

async function callFn(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "erro");
  return data;
}

export default function AprovacaoPublic() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientLogoUrl, setClientLogoUrl] = useState<string | null>(null);
  const [calendarInfo, setCalendarInfo] = useState<{ cycleStart: string; cycleEnd: string; status: string; updatedAt: string } | null>(null);
  const [publications, setPublications] = useState<PublicationData[]>([]);
  const [view, setView] = useState<"lista" | "feed">("feed");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [confirmApproveAll, setConfirmApproveAll] = useState(false);

  const appSettingsQ = useAppSettings();

  const [publicTheme, setPublicThemeState] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem(PUBLIC_THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  const originalHtmlThemeRef = useRef<"light" | "dark" | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (originalHtmlThemeRef.current === null) {
      originalHtmlThemeRef.current = root.classList.contains("dark") ? "dark" : "light";
    }
    const apply = () => {
      root.classList.remove("light", "dark");
      root.classList.add(publicTheme);
    };
    apply();
    // O ThemeProvider global do painel interno também gerencia essa mesma classe e
    // roda seu próprio efeito de montagem depois deste (é um componente pai na
    // árvore), sobrescrevendo-a de volta para o tema interno. Reaplica no próximo
    // tick para vencer essa corrida.
    const timer = setTimeout(apply, 0);
    return () => clearTimeout(timer);
  }, [publicTheme]);

  useEffect(() => {
    return () => {
      const original = originalHtmlThemeRef.current;
      if (original) {
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(original);
      }
    };
  }, []);

  const setPublicTheme = (next: "light" | "dark") => {
    setPublicThemeState(next);
    try {
      localStorage.setItem(PUBLIC_THEME_KEY, next);
    } catch {
      /* noop */
    }
  };

  const appLogoUrl = publicTheme === "dark"
    ? (appSettingsQ.data?.sidebar_logo_dark_url ?? appSettingsQ.data?.sidebar_logo_url)
    : appSettingsQ.data?.sidebar_logo_url;

  const load = async () => {
    if (!token) return;
    try {
      const data = await callFn({ action: "load", token });
      setClientName(data.clientName);
      setClientLogoUrl(data.clientLogoUrl ?? null);
      setCalendarInfo(data.calendar);
      setPublications(data.publications);
      setNotFound(false);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const [carouselIndex, setCarouselIndex] = useState(0);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);

  const respond = async (publicationId: string, respAction: "aprovar" | "alteracao", text?: string) => {
    if (!token) return;
    try {
      await callFn({ action: "respond", token, publicationId, respAction, text });
      toast.success(respAction === "aprovar" ? "Publicação aprovada!" : "Alteração solicitada!");
      await load();
    } catch {
      toast.error("Não foi possível registrar sua resposta. Tente novamente.");
    }
  };

  const approveAll = async () => {
    if (!token) return;
    try {
      await callFn({ action: "approve_all", token });
      toast.success("Todas as publicações foram aprovadas!");
      setConfirmApproveAll(false);
      await load();
    } catch {
      toast.error("Ainda existem publicações com alteração pendente.");
      setConfirmApproveAll(false);
    }
  };

  const listOrder = useMemo(
    () => publications.filter((p) => p.publish_date).sort((a, b) => (a.publish_date! > b.publish_date! ? 1 : -1)),
    [publications],
  );

  const feedItems = useMemo(() => {
    // Only the date is required (mirrors the internal Cronograma's Feed) — a card
    // scheduled by dragging onto the calendar only gets a date, not a time.
    return publications
      .filter((p) => p.content_type !== "story" && p.publish_date && p.media.length > 0)
      .sort((a, b) => `${b.publish_date}T${b.publish_time ?? "00:00"}`.localeCompare(`${a.publish_date}T${a.publish_time ?? "00:00"}`));
  }, [publications]);

  const navList = view === "feed" ? feedItems : listOrder;
  const navIndex = navList.findIndex((p) => p.id === selectedId);
  const selected = navIndex >= 0 ? navList[navIndex] : (publications.find((p) => p.id === selectedId) ?? null);
  useEffect(() => setFeedbackText(selected?.client_feedback ?? ""), [selectedId]);
  useEffect(() => setCarouselIndex(0), [selectedId]);
  useEffect(() => { setVideoLoading(true); setVideoProgress(0); }, [selectedId]);

  const handleNavigate = (direction: "prev" | "next") => {
    if (navIndex < 0) return;
    const nextIndex = direction === "prev" ? navIndex - 1 : navIndex + 1;
    if (nextIndex < 0 || nextIndex >= navList.length) return;
    setSelectedId(navList[nextIndex].id);
  };

  const hasPending = publications.some((p) => p.status === "alteracao_solicitada");
  const canApproveAll = publications.length > 0 && !hasPending && publications.some((p) => p.status !== "aprovada");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !calendarInfo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <CalendarX className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Este link não está mais disponível.</p>
      </div>
    );
  }

  const statusMeta = CALENDAR_STATUS_META[calendarInfo.status] ?? { label: calendarInfo.status, className: "bg-muted" };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="border-b border-border/40 bg-card px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground"
              onClick={() => setPublicTheme(publicTheme === "dark" ? "light" : "dark")}
            >
              {publicTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 sm:h-24 sm:w-24">
              {clientLogoUrl ? (
                <img src={clientLogoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-white sm:text-3xl">{clientName?.charAt(0)?.toUpperCase() || "C"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <h1 className="truncate text-2xl font-bold sm:text-3xl">{clientName}</h1>
              <p className="text-sm text-muted-foreground capitalize">
                {format(parseISO(calendarInfo.cycleStart), "dd/MM")} a {format(parseISO(calendarInfo.cycleEnd), "dd/MM/yyyy")}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge className={cn("rounded-full", statusMeta.className)} variant="secondary">{statusMeta.label}</Badge>
                <span className="text-xs text-muted-foreground">Atualizado em {format(parseISO(calendarInfo.updatedAt), "dd/MM/yyyy 'às' HH:mm")}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="mb-4 flex items-center gap-2 rounded-full border border-border/40 bg-card p-1 w-fit">
          <button
            type="button"
            onClick={() => setView("lista")}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", view === "lista" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
          <button
            type="button"
            onClick={() => setView("feed")}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", view === "feed" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            <Grid3x3 className="h-3.5 w-3.5" /> Feed
          </button>
        </div>

        {view === "lista" ? (
          <div className="space-y-3">
            {listOrder.length === 0 && (
              <p className="rounded-2xl border border-border/40 bg-card p-8 text-center text-sm text-muted-foreground">
                {publications.length === 0 ? "Nada programado ainda." : "Nenhuma publicação com data ainda."}
              </p>
            )}
            {listOrder.map((p, idx) => (
              <PublicListCard key={p.id} publication={p} idx={idx} onClick={() => setSelectedId(p.id)} onApprove={() => respond(p.id, "aprovar")} />
            ))}
          </div>
        ) : (
          <div className="mx-auto grid max-w-md grid-cols-3 gap-1.5 sm:max-w-none">
            {feedItems.length === 0 && <p className="col-span-3 p-8 text-center text-sm text-muted-foreground">Nada pronto para mostrar ainda.</p>}
            {feedItems.map((p) => {
              const ContentIcon = CONTENT_TYPE_ICON[p.content_type] ?? File;
              return (
                // Instagram's feed post ratio (1080x1350 = 4:5), not the profile grid's square crop.
                <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                  {firstImageUrl(p) ? <img src={firstImageUrl(p)!} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-6 w-6 text-muted-foreground" />}
                  <ContentIcon className="absolute left-1.5 top-1.5 h-4 w-4 text-white drop-shadow" />
                </button>
              );
            })}
          </div>
        )}

        {canApproveAll && (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-5 text-center sm:gap-4 sm:rounded-2xl sm:py-6">
            <div>
              <p className="text-base font-bold sm:text-lg">Revisou tudo?</p>
              <p className="text-xs font-light text-muted-foreground sm:text-sm">Aprove o ciclo inteiro de uma vez.</p>
            </div>
            <Button size="sm" className="h-8 gap-1.5 rounded-full px-3 text-xs sm:h-9 sm:px-4 sm:text-sm" onClick={() => setConfirmApproveAll(true)}>
              <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Aprovar todas as publicações
            </Button>
          </div>
        )}
      </main>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="mx-auto flex flex-col items-center gap-1 text-center">
          {appLogoUrl ? (
            <img src={appLogoUrl} alt="Uau Digital" className="h-8 w-auto max-w-[150px] object-contain" />
          ) : (
            <p className="text-base font-bold"><span className="text-primary">uaü</span> digital</p>
          )}
          <p className="text-[10px] font-light text-muted-foreground">
            Produzido por <span className="font-semibold text-primary">Uau Digital</span>
          </p>
        </div>
      </div>

      {selected && (() => {
        const images = selected.media.filter((m) => m.type?.startsWith("image/"));
        const videos = selected.media.filter((m) => m.type?.startsWith("video/"));
        const isStory = selected.content_type === "story";
        const hasVideo = (selected.content_type === "reel" || selected.content_type === "video") && videos.length > 0;
        const isCarousel = selected.content_type === "carrossel" && images.length > 1;
        const clientInitial = clientName?.charAt(0)?.toUpperCase() || "C";
        const statusMeta = STATUS_META[selected.status] ?? { label: selected.status, shortLabel: selected.status, className: "bg-muted text-muted-foreground" };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl" onClick={() => setSelectedId(null)}>
            <div
              className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border-black/10 bg-white/80 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/[0.07] sm:border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Nav bar */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-white/80 px-3 py-2 backdrop-blur-2xl dark:bg-[#171717]/90">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={navIndex <= 0} onClick={() => handleNavigate("prev")}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={navIndex < 0 || navIndex >= navList.length - 1} onClick={() => handleNavigate("next")}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedId(null)}><X className="h-4 w-4" /></Button>
              </div>

              <div
                className={cn(
                  "grid grid-cols-1 md:max-h-[80vh]",
                  isStory || hasVideo ? "md:grid-cols-[min(38.25vh,420px)_1fr]" : "md:grid-cols-[420px_1fr]",
                )}
              >
                {/* Left: Instagram-style visual simulation */}
                <div className="border-b border-border/40 md:overflow-y-auto md:border-b-0 md:border-r">
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400">
                      {clientLogoUrl ? (
                        <img src={clientLogoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-white">{clientInitial}</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold leading-tight">{clientName}</span>
                  </div>

                  <div className={cn("relative w-full bg-black/5 group px-3", isStory && "flex justify-center")}>
                    {isStory ? (
                      images[0] ? (
                        <img src={images[0].url} alt="" className="aspect-[9/16] max-h-[68vh] rounded-xl object-cover" />
                      ) : (
                        <div className="flex aspect-[9/16] max-h-[68vh] w-full items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground">Sem mídia</div>
                      )
                    ) : hasVideo ? (
                      <>
                        <video
                          src={videos[0].url}
                          controls
                          preload="auto"
                          playsInline
                          poster={images[0]?.url}
                          onProgress={(e) => {
                            const v = e.currentTarget;
                            if (!v.duration || Number.isNaN(v.duration) || v.buffered.length === 0) return;
                            setVideoProgress(Math.min(100, Math.round((v.buffered.end(v.buffered.length - 1) / v.duration) * 100)));
                          }}
                          onWaiting={() => setVideoLoading(true)}
                          onCanPlay={() => setVideoLoading(false)}
                          onPlaying={() => setVideoLoading(false)}
                          className="mx-auto block h-auto max-h-[68vh] w-auto max-w-full rounded-xl object-contain"
                        />
                        {videoLoading && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90 drop-shadow-lg">
                              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                              <circle
                                cx="28" cy="28" r="24" fill="none"
                                stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 24}
                                strokeDashoffset={2 * Math.PI * 24 * (1 - videoProgress / 100)}
                                style={{ transition: "stroke-dashoffset 0.2s linear" }}
                              />
                            </svg>
                          </div>
                        )}
                      </>
                    ) : images.length > 0 ? (
                      <>
                        <img src={images[carouselIndex]?.url ?? images[0].url} alt="" className="max-h-[68vh] w-full rounded-xl object-cover" />
                        {isCarousel && (
                          <>
                            <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                              {carouselIndex + 1}/{images.length}
                            </div>
                            {carouselIndex > 0 && (
                              <button onClick={() => setCarouselIndex((i) => i - 1)} className="absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow-sm transition group-hover:opacity-100">
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                            )}
                            {carouselIndex < images.length - 1 && (
                              <button onClick={() => setCarouselIndex((i) => i + 1)} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-black opacity-0 shadow-sm transition group-hover:opacity-100">
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
                    {selected.publish_date && (
                      <p className="text-[11px] uppercase text-muted-foreground">
                        Publicação prevista para: {format(parseISO(selected.publish_date), "dd/MM/yyyy")}{selected.publish_time ? ` às ${selected.publish_time.slice(0, 5)}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: status + client actions */}
                <div className="space-y-4 px-4 py-4 md:overflow-y-auto">
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium leading-none text-foreground">Tipo de conteúdo</p>
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold", getContentTypeColor(selected.content_type).bg, getContentTypeColor(selected.content_type).text)}>
                      {CONTENT_TYPE_LABELS[selected.content_type] ?? selected.content_type}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-sm font-medium leading-none text-foreground">Status</p>
                    <Badge className={cn("rounded-full", statusMeta.className)} variant="secondary">{statusMeta.label}</Badge>
                  </div>

                  {selected.caption && (
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium leading-none text-foreground">Legenda</p>
                      <p className="whitespace-pre-line text-sm text-foreground/80">{selected.caption}</p>
                    </div>
                  )}

                  {selected.client_note && (
                    <div className="rounded-xl bg-primary/5 p-3 text-sm">
                      <p className="mb-1 text-xs font-semibold text-primary">Observação da equipe</p>
                      {selected.client_note}
                    </div>
                  )}

                  {selected.status !== "aprovada" && (
                    <div className="space-y-2 border-t border-border/40 pt-4">
                      <Button className="w-full gap-1.5 rounded-full" onClick={() => respond(selected.id, "aprovar")}>
                        <Check className="h-4 w-4" /> Aprovar
                      </Button>
                      <Textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        placeholder="Descreva o que precisa ser alterado..."
                        rows={3}
                      />
                      <Button
                        variant="outline"
                        className="w-full gap-1.5 rounded-full"
                        onClick={() => feedbackText.trim() && respond(selected.id, "alteracao", feedbackText)}
                        disabled={!feedbackText.trim()}
                      >
                        <MessageSquareWarning className="h-4 w-4" /> Solicitar alteração
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <AlertDialog open={confirmApproveAll} onOpenChange={setConfirmApproveAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aprovar todas as publicações?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a aprovar todas as publicações deste calendário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={approveAll}>Aprovar tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
