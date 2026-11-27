import { useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CircleDashed, ImagePlus, Loader2, Pin, Plus, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { CalendarPublication } from "../calendar-types";
import { buildCarouselPages } from "../lib/carousel-pages";
import { HIGHLIGHT_TITLE_LIMIT, MAX_HIGHLIGHTS, MAX_PINNED, NAME_LIMIT, moveItem, startingProfile, togglePinned, type Highlight, type ProfileDraft, type ProfileRow } from "../lib/profile-month";
import { uploadProfileImage, usePreviousFeedPublications, useProfileMonths, useSaveProfileMonth } from "../hooks/use-profile-month";
import { useCoverAttachmentsById, useTaskAttachmentsMap } from "../hooks/use-calendar-data";
import { ProfilePreview, type ProfileTile } from "./ProfilePreview";

const monthName = (key: string) => format(parseISO(key), "MMMM 'de' yyyy", { locale: ptBR });

interface Props {
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  username: string;
  /** yyyy-MM-01 do mês escolhido no Cronograma. */
  month: string;
  cycleStart: string;
  calendarIds: string[];
  /** Posts do ciclo na ordem do feed. */
  currentTiles: ProfileTile[];
  toThumb: (url: string) => string;
  onClose: () => void;
}

/** Estúdio do feed: a equipe monta o perfil do mês à esquerda e vê o resultado à direita. */
export function ProfileStudioDialog(props: Props) {
  const rowsQ = useProfileMonths(props.clientId);
  const dirtyRef = useRef(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const requestClose = () => (dirtyRef.current ? setConfirmClose(true) : props.onClose());

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent className="flex h-[94vh] w-[96vw] max-w-[1080px] flex-col gap-0 overflow-hidden rounded-3xl p-0">
        <div className="border-b border-border/40 px-5 py-4 pr-14">
          <DialogTitle className="text-base">Estúdio do feed · <span className="inline-block first-letter:uppercase">{monthName(props.month)}</span></DialogTitle>
          <DialogDescription className="text-xs">{props.clientName}. É uma prévia para montar o mês: não muda o Instagram de verdade.</DialogDescription>
        </div>
        {rowsQ.data ? (
          <StudioBody {...props} rows={rowsQ.data} dirtyRef={dirtyRef} />
        ) : rowsQ.isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
            Não foi possível abrir o perfil deste cliente.
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => rowsQ.refetch()}>Tentar de novo</Button>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        )}

        <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
              <AlertDialogDescription>As mudanças neste perfil serão perdidas.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Continuar editando</AlertDialogCancel>
              <AlertDialogAction onClick={props.onClose}>Sair sem salvar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon: Icon, title, action, children }: { icon: typeof Pin; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/40 bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-bold">{title}</h3>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function StudioBody({ clientId, clientName, clientLogoUrl, username, month, cycleStart, calendarIds, currentTiles, toThumb, rows, dirtyRef }: Props & { rows: ProfileRow[]; dirtyRef: React.MutableRefObject<boolean> }) {
  // o ponto de partida é lido uma vez: uma atualização no fundo não pode passar por cima do que está sendo editado
  const [start] = useState(() => startingProfile(rows, month, { name: clientName, photo: clientLogoUrl }));
  const [draft, setDraft] = useState<ProfileDraft>(start.draft);
  const [baseline, setBaseline] = useState(() => JSON.stringify(start.draft));
  const [savedId, setSavedId] = useState(start.savedId);
  const [uploading, setUploading] = useState<string | null>(null);
  const save = useSaveProfileMonth(clientId);
  const dirty = JSON.stringify(draft) !== baseline;
  dirtyRef.current = dirty;

  // posts de antes do ciclo, para a grade ficar como o perfil inteiro
  const previousQ = usePreviousFeedPublications(calendarIds, cycleStart, start.draft.pinned_publication_ids);
  const previous = useMemo(() => {
    const current = new Set(currentTiles.map((t) => t.id));
    return (previousQ.data ?? []).filter((p) => !current.has(p.id));
  }, [previousQ.data, currentTiles]);
  const taskIds = useMemo(() => previous.map((p) => p.task_id), [previous]);
  const attachmentsQ = useTaskAttachmentsMap(taskIds);
  const coverIds = useMemo(() => previous.map((p) => p.cover_attachment_id).filter((id): id is string => !!id), [previous]);
  const coversQ = useCoverAttachmentsById(coverIds);

  const tiles = useMemo(() => {
    const toTile = (p: CalendarPublication): ProfileTile | null => {
      const media = attachmentsQ.data?.get(p.task_id) ?? [];
      const images = media.filter((m) => m.type?.startsWith("image/"));
      const cover = p.content_type !== "carrossel" && p.cover_attachment_id ? coversQ.data?.get(p.cover_attachment_id) : undefined;
      if (media.length === 0 && !cover) return null;
      const url = cover?.thumbUrl ?? images[0]?.thumbUrl;
      return {
        id: p.id,
        thumb: url ? toThumb(url) : null,
        date: p.publish_date,
        isCarousel: p.content_type === "carrossel" && images.length > 1,
        isVideo: p.content_type === "reel" || (p.content_type === "carrossel" && buildCarouselPages(media).some((page) => page.videoUrl)),
      };
    };
    return [...currentTiles, ...previous.map(toTile).filter((t): t is ProfileTile => !!t)];
  }, [currentTiles, previous, attachmentsQ.data, coversQ.data, toThumb]);

  const postsLoading = previousQ.isLoading || attachmentsQ.isLoading;
  // fixado que foi removido do calendário não pode ocupar uma das 3 vagas sem aparecer
  const visiblePinned = postsLoading ? draft.pinned_publication_ids : draft.pinned_publication_ids.filter((id) => tiles.some((t) => t.id === id));
  const preview = { ...draft, pinned_publication_ids: visiblePinned };

  const patch = (values: Partial<ProfileDraft>) => setDraft((d) => ({ ...d, ...values }));
  const patchHighlight = (id: string, values: Partial<Highlight>) =>
    setDraft((d) => ({ ...d, highlights: d.highlights.map((h) => (h.id === id ? { ...h, ...values } : h)) }));

  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string>("photo");
  const pickImage = (target: string) => {
    targetRef.current = target;
    fileRef.current?.click();
  };
  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const target = targetRef.current;
    setUploading(target);
    try {
      const url = await uploadProfileImage(clientId, file);
      if (target === "photo") patch({ photo_url: url });
      else patchHighlight(target, { cover_url: url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(null);
    }
  };

  const onSave = () => {
    const sent: ProfileDraft = { ...preview };
    save.mutate({ savedId, month, draft: sent }, {
      onSuccess: (id) => {
        setSavedId(id);
        setBaseline(JSON.stringify(sent));
        setDraft(sent);
        toast.success("Perfil do mês salvo.");
      },
      onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar o perfil."),
    });
  };

  const status = dirty
    ? "Há mudanças não salvas."
    : savedId
      ? "Salvo."
      : start.copiedFrom
        ? `Ainda não salvo neste mês: copiado de ${monthName(start.copiedFrom)}.`
        : "Ainda não salvo: começou com a foto e o nome do cliente.";

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Enviar imagem" onChange={onFile} />
      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto md:grid md:grid-cols-[minmax(0,1fr)_400px] md:overflow-hidden">
        <div className="space-y-3 p-4 md:overflow-y-auto">
          <Section icon={UserRound} title="Foto e nome">
            <div className="flex items-center gap-3">
              {draft.photo_url ? (
                <img src={draft.photo_url} alt="" className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-border" />
              ) : (
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-muted"><UserRound className="h-6 w-6 text-muted-foreground" /></span>
              )}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-full text-xs" disabled={!!uploading} onClick={() => pickImage("photo")}>
                  {uploading === "photo" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} Trocar foto
                </Button>
                {clientLogoUrl && draft.photo_url !== clientLogoUrl && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={() => patch({ photo_url: clientLogoUrl })}>Usar a foto do cliente</Button>
                )}
              </div>
            </div>
            <Input className="mt-3" aria-label="Nome no perfil" placeholder="Nome no perfil" maxLength={NAME_LIMIT} value={draft.display_name} onChange={(e) => patch({ display_name: e.target.value })} />
          </Section>

          <Section
            icon={CircleDashed}
            title="Destaques"
            action={
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 rounded-full text-xs" disabled={draft.highlights.length >= MAX_HIGHLIGHTS} onClick={() => patch({ highlights: [...draft.highlights, { id: crypto.randomUUID(), title: "", cover_url: null }] })}>
                <Plus className="h-3.5 w-3.5" /> Novo destaque
              </Button>
            }
          >
            {draft.highlights.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum destaque. Clique em "Novo destaque" para criar.</p>
            ) : (
              <ul className="space-y-2">
                {draft.highlights.map((h, index) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <button type="button" disabled={!!uploading} onClick={() => pickImage(h.id)} aria-label={`Trocar a capa do destaque ${h.title || index + 1}`} title="Trocar capa" className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-dashed border-border bg-muted/50 hover:bg-muted">
                      {uploading === h.id ? <Loader2 className="h-4 w-4 animate-spin" /> : h.cover_url ? <img src={h.cover_url} alt="" className="h-[42px] w-[42px] rounded-full object-cover" /> : <ImagePlus className="h-4 w-4 text-muted-foreground" />}
                    </button>
                    <Input className="h-9 min-w-0 flex-1" aria-label={`Nome do destaque ${index + 1}`} placeholder="Nome do destaque" maxLength={HIGHLIGHT_TITLE_LIMIT} value={h.title} onChange={(e) => patchHighlight(h.id, { title: e.target.value })} />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={index === 0} aria-label="Mover para antes" onClick={() => patch({ highlights: moveItem(draft.highlights, index, -1) })}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={index === draft.highlights.length - 1} aria-label="Mover para depois" onClick={() => patch({ highlights: moveItem(draft.highlights, index, 1) })}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive" aria-label="Remover destaque" onClick={() => patch({ highlights: draft.highlights.filter((x) => x.id !== h.id) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section icon={Pin} title="Posts fixados" action={<span className="text-xs tabular-nums text-muted-foreground">{visiblePinned.length} de {MAX_PINNED}</span>}>
            {postsLoading && <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando os posts…</p>}
            {previousQ.isError && <p className="mb-2 text-xs text-destructive">Não foi possível carregar os posts anteriores.</p>}
            {tiles.length === 0 && !postsLoading ? (
              <p className="text-xs text-muted-foreground">Nenhuma publicação com arquivo final ainda.</p>
            ) : (
              <>
                {visiblePinned.length > 0 && (
                  <ol aria-label="Ordem dos fixados" className="mb-3 flex gap-3">
                    {visiblePinned.map((id, index) => {
                      const tile = tiles.find((t) => t.id === id);
                      return (
                        <li key={id} className="w-20">
                          <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted ring-1 ring-border">
                            {tile?.thumb && <img src={tile.thumb} alt="" className="h-full w-full object-cover" />}
                            <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">{index + 1}</span>
                            <button type="button" aria-label={`Desafixar o ${index + 1}º`} onClick={() => patch({ pinned_publication_ids: togglePinned(visiblePinned, id) })} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/65 text-white hover:bg-black">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="mt-1 flex justify-center gap-1">
                            <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={index === 0} aria-label={`Mover o ${index + 1}º para a esquerda`} onClick={() => patch({ pinned_publication_ids: moveItem(visiblePinned, index, -1) })}><ArrowLeft className="h-3.5 w-3.5" /></Button>
                            <Button type="button" variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={index === visiblePinned.length - 1} aria-label={`Mover o ${index + 1}º para a direita`} onClick={() => patch({ pinned_publication_ids: moveItem(visiblePinned, index, 1) })}><ArrowRight className="h-3.5 w-3.5" /></Button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <p className="mb-2 text-xs text-muted-foreground">Toque num post para fixar ou desafixar.{visiblePinned.length > 1 ? " Use as setas para mudar a ordem." : ""}</p>
                <div className="grid max-h-64 grid-cols-5 gap-1.5 overflow-y-auto p-0.5 sm:grid-cols-6">
                  {tiles.map((t) => {
                    const position = visiblePinned.indexOf(t.id);
                    const label = t.date ? `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}` : "sem data";
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={position >= 0}
                        aria-label={`Fixar o post de ${label}`}
                        disabled={position < 0 && visiblePinned.length >= MAX_PINNED}
                        onClick={() => patch({ pinned_publication_ids: togglePinned(visiblePinned, t.id) })}
                        className={cn("relative aspect-[4/5] overflow-hidden rounded-lg bg-muted transition disabled:opacity-40", position >= 0 && "ring-2 ring-foreground")}
                      >
                        {t.thumb && <img src={t.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />}
                        <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[10px] leading-4 text-white">{label}</span>
                        {position >= 0 && <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">{position + 1}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </Section>
        </div>

        <div className="border-border/40 bg-muted/20 p-4 md:overflow-y-auto md:border-l">
          <ProfilePreview profile={preview} username={username} tiles={tiles} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border/40 px-5 py-3">
        <p className="min-w-0 text-xs text-muted-foreground" aria-live="polite">{status}</p>
        <Button type="button" size="sm" className="h-9 shrink-0 rounded-full px-5 text-xs" disabled={save.isPending || !!uploading || (!dirty && !!savedId)} onClick={onSave}>
          {save.isPending ? "Salvando…" : "Salvar perfil"}
        </Button>
      </div>
    </>
  );
}
