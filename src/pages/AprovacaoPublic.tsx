import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { format, parseISO, addDays, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2, CalendarX, LayoutGrid, Grid3x3, X, Check, MessageSquareWarning, Film, Image as ImageIcon, Camera, Smartphone, File, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const FN_URL = "https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/public-calendario-publicacao";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  imagem: "Imagem", carrossel: "Carrossel", reel: "Reel", video: "Vídeo", story: "Story", outro: "Outro",
};

const CONTENT_TYPE_ICON: Record<string, typeof Film> = {
  imagem: ImageIcon, carrossel: LayoutGrid, reel: Film, video: Camera, story: Smartphone, outro: File,
};

const STATUS_META: Record<string, { label: string; shortLabel: string; className: string }> = {
  rascunho: { label: "Em preparação", shortLabel: "Em preparo", className: "bg-muted text-muted-foreground" },
  aguardando_aprovacao: { label: "Aguardando sua aprovação", shortLabel: "Aguardando", className: "bg-amber-500/15 text-amber-600" },
  aprovada: { label: "Aprovada", shortLabel: "Aprovada", className: "bg-emerald-500/15 text-emerald-600" },
  alteracao_solicitada: { label: "Alteração solicitada", shortLabel: "Alteração", className: "bg-red-500/15 text-red-600" },
  atualizada: { label: "Atualizada", shortLabel: "Atualizada", className: "bg-blue-500/15 text-blue-600" },
};

const CALENDAR_STATUS_META: Record<string, { label: string; className: string }> = {
  em_montagem: { label: "Em montagem", className: "bg-muted text-muted-foreground" },
  em_revisao_interna: { label: "Em revisão interna", className: "bg-muted text-muted-foreground" },
  pronto_para_envio: { label: "Pronto para envio", className: "bg-amber-500/15 text-amber-600" },
  enviado_ao_cliente: { label: "Aguardando sua aprovação", className: "bg-amber-500/15 text-amber-600" },
  alteracoes_solicitadas: { label: "Alterações solicitadas", className: "bg-red-500/15 text-red-600" },
  aprovado: { label: "Aprovado", className: "bg-emerald-500/15 text-emerald-600" },
  arquivado: { label: "Arquivado", className: "bg-muted text-muted-foreground" },
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
  const [calendarInfo, setCalendarInfo] = useState<{ cycleStart: string; cycleEnd: string; status: string; updatedAt: string } | null>(null);
  const [publications, setPublications] = useState<PublicationData[]>([]);
  const [view, setView] = useState<"calendario" | "feed">("calendario");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [confirmApproveAll, setConfirmApproveAll] = useState(false);

  const load = async () => {
    if (!token) return;
    try {
      const data = await callFn({ action: "load", token });
      setClientName(data.clientName);
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

  const selected = publications.find((p) => p.id === selectedId) ?? null;
  useEffect(() => setFeedbackText(selected?.client_feedback ?? ""), [selectedId]);

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

  const byDay = useMemo(() => {
    const map = new Map<string, PublicationData[]>();
    for (const p of publications) {
      if (!p.publish_date) continue;
      map.set(p.publish_date, [...(map.get(p.publish_date) ?? []), p]);
    }
    return map;
  }, [publications]);

  const days = useMemo(() => {
    if (!calendarInfo) return [];
    const start = startOfWeek(parseISO(calendarInfo.cycleStart), { weekStartsOn: 0 });
    const end = parseISO(calendarInfo.cycleEnd);
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [calendarInfo]);

  const feedItems = useMemo(() => {
    return publications
      .filter((p) => p.content_type !== "story" && p.publish_date && p.publish_time && p.media.length > 0)
      .sort((a, b) => `${b.publish_date}T${b.publish_time}`.localeCompare(`${a.publish_date}T${a.publish_time}`));
  }, [publications]);

  const hasPending = publications.some((p) => p.status === "alteracao_solicitada");
  const canApproveAll = publications.length > 0 && !hasPending && publications.some((p) => p.status !== "aprovada");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !calendarInfo) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <CalendarX className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Este link não está mais disponível.</p>
      </div>
    );
  }

  const statusMeta = CALENDAR_STATUS_META[calendarInfo.status] ?? { label: calendarInfo.status, className: "bg-muted" };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-lg font-bold"><span className="text-primary">uaü</span> digital</p>
            <h1 className="text-xl font-bold">{clientName}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {format(parseISO(calendarInfo.cycleStart), "dd/MM")} a {format(parseISO(calendarInfo.cycleEnd), "dd/MM/yyyy")}
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Badge className={cn("rounded-full", statusMeta.className)} variant="secondary">{statusMeta.label}</Badge>
            <p className="text-xs text-muted-foreground">Atualizado em {format(parseISO(calendarInfo.updatedAt), "dd/MM/yyyy 'às' HH:mm")}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        {canApproveAll && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-sm font-medium">Revisou tudo? Aprove o ciclo inteiro de uma vez.</p>
            <Button size="sm" className="gap-1.5 rounded-full" onClick={() => setConfirmApproveAll(true)}>
              <Check className="h-3.5 w-3.5" /> Aprovar todas as publicações
            </Button>
          </div>
        )}

        <div className="mb-4 flex items-center gap-2 rounded-full border bg-white p-1 w-fit">
          <button
            type="button"
            onClick={() => setView("calendario")}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", view === "calendario" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Calendário
          </button>
          <button
            type="button"
            onClick={() => setView("feed")}
            className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", view === "feed" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
          >
            <Grid3x3 className="h-3.5 w-3.5" /> Feed
          </button>
        </div>

        {view === "calendario" ? (
          <>
            {/* Mobile: vertical agenda, one section per day with content, big thumbnails */}
            <div className="space-y-4 sm:hidden">
              {days.filter((d) => (byDay.get(format(d, "yyyy-MM-dd")) ?? []).length > 0).length === 0 && (
                <p className="rounded-2xl border bg-white p-8 text-center text-sm text-muted-foreground">Nada programado ainda.</p>
              )}
              {days.map((d) => {
                const key = format(d, "yyyy-MM-dd");
                const dayPubs = byDay.get(key) ?? [];
                if (dayPubs.length === 0) return null;
                return (
                  <div key={key} className="overflow-hidden rounded-2xl border bg-white">
                    <p className="border-b bg-slate-50 px-3 py-2 text-sm font-semibold capitalize text-foreground">
                      {format(d, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    </p>
                    <div className="divide-y">
                      {dayPubs.map((p) => {
                        const ContentIcon = CONTENT_TYPE_ICON[p.content_type] ?? File;
                        return (
                          <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} className="flex w-full items-center gap-3 p-3 text-left active:bg-slate-50">
                            {p.media[0] ? (
                              <img src={p.media[0].url} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                            ) : (
                              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100"><ImageIcon className="h-7 w-7 text-slate-300" /></span>
                            )}
                            <span className="min-w-0 flex-1 space-y-1.5">
                              <Badge className={cn("rounded-full text-[10px]", (STATUS_META[p.status] ?? {}).className)} variant="secondary">
                                {(STATUS_META[p.status] ?? { label: p.status }).label}
                              </Badge>
                              <span className="flex items-center gap-1.5 text-sm font-medium">
                                <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                {p.publish_time ? p.publish_time.slice(0, 5) : "Sem horário"}
                              </span>
                              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <ContentIcon className="h-3.5 w-3.5 shrink-0" />
                                {CONTENT_TYPE_LABELS[p.content_type] ?? p.content_type}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop / tablet: 7-column grid, same visual language as the internal Agenda */}
            <div className="hidden space-y-2 sm:block">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-muted-foreground">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                  <div key={d} className="px-2 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {days.map((d, i) => {
                  const key = format(d, "yyyy-MM-dd");
                  const dayPubs = byDay.get(key) ?? [];
                  return (
                    <div key={i} className="calendar-card-hover min-h-[190px] space-y-1.5 rounded-xl border border-slate-200 bg-white p-2 transition">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] text-slate-500">
                        {format(d, "d")}
                      </div>
                      {dayPubs.map((p) => {
                        const ContentIcon = CONTENT_TYPE_ICON[p.content_type] ?? File;
                        const statusMeta = STATUS_META[p.status] ?? { shortLabel: p.status, className: "bg-slate-100 text-slate-500" };
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setSelectedId(p.id)}
                            className="block w-full overflow-hidden rounded-lg border border-slate-200 text-left transition-colors hover:border-primary/40"
                          >
                            {p.media[0] ? (
                              <img src={p.media[0].url} alt="" className="aspect-square w-full object-cover" />
                            ) : (
                              <span className="flex aspect-square w-full items-center justify-center bg-slate-100"><ImageIcon className="h-5 w-5 text-slate-300" /></span>
                            )}
                            <span className="block space-y-1 p-1.5">
                              <span className={cn("inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold", statusMeta.className)}>
                                {statusMeta.shortLabel}
                              </span>
                              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                                <ContentIcon className="h-3 w-3 shrink-0" />
                                <span className="truncate">{CONTENT_TYPE_LABELS[p.content_type] ?? p.content_type}</span>
                                {p.publish_time && <span className="shrink-0">· {p.publish_time.slice(0, 5)}</span>}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-2xl border bg-white">
            {feedItems.length === 0 && <p className="col-span-3 p-8 text-center text-sm text-muted-foreground">Nada pronto para mostrar ainda.</p>}
            {feedItems.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} className="group relative aspect-square bg-slate-100">
                {p.media[0] ? <img src={p.media[0].url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto h-6 w-6 text-slate-300" />}
                {(p.content_type === "reel" || p.content_type === "video") && <Film className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-white drop-shadow" />}
                {p.content_type === "carrossel" && <LayoutGrid className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setSelectedId(null)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-semibold">{CONTENT_TYPE_LABELS[selected.content_type] ?? selected.content_type}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedId(null)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="px-3 py-3">
              {selected.media[0] ? (
                selected.media[0].type?.startsWith("video/") ? (
                  <video src={selected.media[0].url} controls className="max-h-[50vh] w-full rounded-xl bg-black object-contain" />
                ) : (
                  <img src={selected.media[0].url} alt="" className="max-h-[50vh] w-full rounded-xl object-cover" />
                )
              ) : (
                <div className="flex h-40 items-center justify-center rounded-xl bg-slate-100 text-xs text-muted-foreground">Sem mídia</div>
              )}

              {selected.caption && <p className="mt-3 whitespace-pre-line text-sm">{selected.caption}</p>}

              {selected.publish_date && (
                <p className="mt-2 text-xs uppercase text-muted-foreground">
                  Previsto para {format(parseISO(selected.publish_date), "dd/MM/yyyy")}{selected.publish_time ? ` às ${selected.publish_time.slice(0, 5)}` : ""}
                </p>
              )}

              {selected.client_note && (
                <div className="mt-3 rounded-xl bg-primary/5 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold text-primary">Observação da equipe</p>
                  {selected.client_note}
                </div>
              )}

              <Badge className={cn("mt-3 rounded-full", (STATUS_META[selected.status] ?? {}).className)} variant="secondary">
                {(STATUS_META[selected.status] ?? { label: selected.status }).label}
              </Badge>

              {selected.status !== "aprovada" && (
                <div className="mt-4 space-y-2 border-t pt-4">
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
      )}

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
