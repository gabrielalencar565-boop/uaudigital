import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek, addWeeks, subWeeks, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Film, Image, LayoutGrid, Camera, Calendar, Clock, Instagram, ChevronLeft, ChevronRight, X, CalendarRange, LayoutGrid as GridIcon, Check, MessageSquare, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";


const sb = supabase as any;

const POST_TYPE_META: Record<string, { label: string; icon: typeof Film; color: string; bgPage: string }> = {
  reels: { label: "Reels", icon: Film, color: "bg-pink-500/20 text-pink-500", bgPage: "border-pink-300" },
  carrossel: { label: "Carrossel", icon: LayoutGrid, color: "bg-blue-500/20 text-blue-500", bgPage: "border-blue-300" },
  post: { label: "Post", icon: Image, color: "bg-emerald-500/20 text-emerald-500", bgPage: "border-emerald-300" },
  foto: { label: "Foto", icon: Camera, color: "bg-amber-500/20 text-amber-500", bgPage: "border-amber-300" },
};

interface PostData {
  id: string;
  title: string;
  post_type: string | null;
  posting_date: string | null;
  posting_time: string | null;
  caption: string | null;
  cover_url: string | null;
  attachment_url?: string | null;
  all_attachment_urls?: string[];
}

interface FeedbackData {
  id: string;
  task_id: string;
  status: string;
  feedback_text: string | null;
}

export default function CronogramaPublic() {
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const isPrint = searchParams.get("print") === "1";
  const clientFilterId = searchParams.get("client");

  const [loading, setLoading] = useState(true);
  const [parentTitle, setParentTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, FeedbackData>>({});
  

  useEffect(() => {
    if (!taskId) return;

    const load = async () => {
      setLoading(true);
      try {
        let resolvedClientId = clientFilterId;

        if (resolvedClientId) {
          const { data: client } = await sb.from("clients").select("name").eq("id", resolvedClientId).single();
          if (client?.name) {
            setClientName(client.name);
            setParentTitle(client.name);
          }
        } else {
          const { data: parent } = await sb.from("pm_tasks").select("title, client_id").eq("id", taskId).single();
          if (parent) {
            setParentTitle(parent.title);
            resolvedClientId = parent.client_id;
            const { data: client } = await sb.from("clients").select("name").eq("id", parent.client_id).single();
            if (client?.name) setClientName(client.name);
          }
        }

        let childrenQuery = sb
          .from("pm_tasks")
          .select("id, title, post_type, posting_date, posting_time, caption, cover_url")
          .not("posting_date", "is", null)
          .order("posting_date", { ascending: true });

        if (clientFilterId) {
          childrenQuery = childrenQuery.eq("client_id", clientFilterId).not("parent_task_id", "is", null);
        } else {
          childrenQuery = childrenQuery.eq("parent_task_id", taskId);
        }

        const { data: children } = await childrenQuery;
        const childRows = (children ?? []) as PostData[];

        if (childRows.length > 0) {
          const childIds = childRows.map((c) => c.id);
          const { data: attachments } = await sb
            .from("pm_attachments")
            .select("task_id, public_url, file_type, order_index")
            .in("task_id", childIds)
            .order("order_index", { ascending: true })
            .order("created_at", { ascending: true });

          const firstImageMap = new Map<string, string>();
          const allImagesMap = new Map<string, string[]>();
          (attachments ?? []).forEach((att: any) => {
            if (att.file_type?.startsWith("image/") && att.public_url) {
              if (!firstImageMap.has(att.task_id)) firstImageMap.set(att.task_id, att.public_url);
              const arr = allImagesMap.get(att.task_id) ?? [];
              arr.push(att.public_url);
              allImagesMap.set(att.task_id, arr);
            }
          });

          const enriched = childRows.map((c) => ({
            ...c,
            attachment_url: firstImageMap.get(c.id) ?? null,
            all_attachment_urls: allImagesMap.get(c.id) ?? [],
          }));

          setPosts(enriched);
          setSelectedPost(enriched[0]);

          const { data: fbData } = await sb
            .from("pm_cronograma_feedback")
            .select("*")
            .in("task_id", childIds);

          const fbMap: Record<string, FeedbackData> = {};
          (fbData ?? []).forEach((fb: FeedbackData) => {
            fbMap[fb.task_id] = fb;
          });
          setFeedbacks(fbMap);
        } else {
          setPosts([]);
          setSelectedPost(null);
          setFeedbacks({});
        }

        const { data: layout } = await sb.from("pm_pdf_settings").select("*").limit(1).maybeSingle();
        setPdfSettings((layout ?? null) as PdfExportSettings | null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [taskId, clientFilterId]);

  const handleSubmitFeedback = async (postId: string, status: string, text: string) => {
    const existing = feedbacks[postId];
    if (existing) {
      await sb.from("pm_cronograma_feedback").update({ status, feedback_text: text || null, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await sb.from("pm_cronograma_feedback").insert({ task_id: postId, status, feedback_text: text || null });
    }
    const { data } = await sb.from("pm_cronograma_feedback").select("*").eq("task_id", postId).single();
    if (data) setFeedbacks(prev => ({ ...prev, [postId]: data }));
    toast.success(status === "aprovado" ? "Postagem aprovada!" : "Alteração solicitada!");
  };

  const handleDownloadPdf = async () => {
    if (!posts.length) {
      toast.error("Não há postagens para baixar.");
      return;
    }

    try {
      await downloadCronogramaPdf({
        clientName: clientName || parentTitle || "Cliente",
        posts: posts as any,
        settings: pdfSettings,
      });
      toast.success("PDF baixado com sucesso!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao gerar o PDF.";
      toast.error(message);
    }
  };

  useEffect(() => {
    if (isPrint && !loading && posts.length > 0) {
      // Wait for images to load before printing
      const images = document.querySelectorAll('img');
      const promises = Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      Promise.all(promises).then(() => setTimeout(() => window.print(), 500));
    }
  }, [isPrint, loading, posts]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50">
        <div className="animate-pulse text-gray-400">Carregando cronograma...</div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50">
        <p className="text-gray-400">Nenhuma postagem agendada.</p>
      </div>
    );
  }

  // ── PDF / Print View ──
  if (isPrint) {
    return (
      <div className="bg-white min-h-screen">
        <style>{`@media print { @page { size: A4 landscape; margin: 15mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
        <div className="max-w-5xl mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">{clientName || parentTitle}</h1>
            <p className="text-sm text-gray-500">Cronograma de Postagens</p>
          </div>
          {posts.map((post, i) => {
            const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
            const allImages = post.all_attachment_urls ?? [];
            const singleImg = post.attachment_url || post.cover_url;
            const isCarousel = post.post_type === "carrossel" && allImages.length > 1;
            return (
              <div key={post.id} className={cn("mb-8 rounded-xl border-2 p-6", meta.bgPage)} style={{ pageBreakInside: "avoid" }}>
                <div className="flex gap-6">
                  <div className="w-1/3 shrink-0">
                    {isCarousel ? (
                      <div className="grid grid-cols-2 gap-1">
                        {allImages.map((url, j) => (
                          <img key={j} src={url} alt="" className="w-full rounded-lg object-cover aspect-square" crossOrigin="anonymous" />
                        ))}
                      </div>
                    ) : singleImg ? (
                      <img src={singleImg} alt="" className="w-full rounded-xl object-cover aspect-square" crossOrigin="anonymous" />
                    ) : null}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Instagram className="h-5 w-5 text-pink-500" />
                      <span className="text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded">Feed</span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-2xl font-bold">Post {i + 1}</h2>
                      <span className="text-sm text-gray-500">{meta.label}</span>
                    </div>
                    {post.caption && (
                      <div>
                        <h3 className="font-bold text-sm mb-1">Legenda:</h3>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
                      </div>
                    )}
                    <div className="inline-flex items-center gap-4 bg-indigo-100 text-indigo-800 rounded-xl px-4 py-2 mt-2">
                      <span className="text-sm font-bold">
                        Data: {post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yy") : "—"}
                      </span>
                      {post.posting_time && (
                        <span className="text-sm font-bold">Horário: {post.posting_time}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Interactive Public View ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <Toaster />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{clientName || parentTitle}</h1>
            <p className="text-xs text-gray-500">Cronograma de Postagens</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleDownloadPdf}>
            <Download className="h-3.5 w-3.5" /> Baixar PDF
          </Button>
        </div>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="semanal" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="semanal" className="gap-1.5 text-xs">
                  <CalendarRange className="h-3.5 w-3.5" /> Semanal
                </TabsTrigger>
                <TabsTrigger value="mensal" className="gap-1.5 text-xs">
                  <Calendar className="h-3.5 w-3.5" /> Mensal
                </TabsTrigger>
                <TabsTrigger value="feed" className="gap-1.5 text-xs">
                  <GridIcon className="h-3.5 w-3.5" /> Feed
                </TabsTrigger>
              </TabsList>

              <TabsContent value="semanal">
                <PublicWeeklyView posts={posts} selectedPost={selectedPost} onSelectPost={setSelectedPost} />
              </TabsContent>
              <TabsContent value="mensal">
                <PublicMonthlyView posts={posts} selectedPost={selectedPost} onSelectPost={setSelectedPost} />
              </TabsContent>
              <TabsContent value="feed">
                <PublicFeedView posts={posts} selectedPost={selectedPost} onSelectPost={setSelectedPost} />
              </TabsContent>
            </Tabs>
          </div>

          {selectedPost && (
            <PublicPostSidebar
              post={selectedPost}
              feedback={feedbacks[selectedPost.id]}
              onClose={() => setSelectedPost(null)}
              onSubmitFeedback={handleSubmitFeedback}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Post sidebar with approval ──
function PublicPostSidebar({ post, feedback, onClose, onSubmitFeedback }: {
  post: PostData;
  feedback?: FeedbackData;
  onClose: () => void;
  onSubmitFeedback: (postId: string, status: string, text: string) => void;
}) {
  const [feedbackText, setFeedbackText] = useState(feedback?.feedback_text ?? "");
  const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
  const allImages = post.all_attachment_urls ?? [];
  const isCarousel = post.post_type === "carrossel" && allImages.length > 1;
  const singleImg = post.attachment_url || post.cover_url;

  return (
    <div className="w-96 shrink-0 border border-gray-200 rounded-2xl bg-white p-5 shadow-sm space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Instagram className="h-5 w-5 text-pink-500" />
          <span className="text-[10px] font-semibold bg-gray-100 px-2 py-0.5 rounded">Feed</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div>
        <h2 className="text-xl font-bold">{post.title}</h2>
        {post.post_type && (
          <Badge className={cn("text-[10px] mt-1", meta.color)}>{meta.label}</Badge>
        )}
      </div>

      {/* Images */}
      {isCarousel ? (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">{allImages.length} páginas</p>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {allImages.map((url, i) => (
              <img key={i} src={url} alt={`Página ${i + 1}`} className="h-28 w-28 rounded-lg object-cover shrink-0" />
            ))}
          </div>
        </div>
      ) : singleImg ? (
        <img src={singleImg} alt="" className="w-full rounded-xl object-cover aspect-square" />
      ) : null}

      {post.caption && (
        <div>
          <h4 className="font-bold text-sm mb-1">Legenda:</h4>
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{post.caption}</p>
        </div>
      )}

      <div className="inline-flex items-center gap-4 bg-indigo-100 text-indigo-800 rounded-xl px-4 py-2">
        <span className="text-sm font-bold">
          Data: {post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yy") : "—"}
        </span>
        {post.posting_time && (
          <span className="text-sm font-bold">Horário: {post.posting_time}</span>
        )}
      </div>

      {/* Approval / Feedback section */}
      <div className="border-t border-gray-200 pt-4 space-y-3">
        <h4 className="text-sm font-bold flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" /> Aprovação
        </h4>

        {feedback?.status === "aprovado" ? (
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 rounded-xl px-4 py-3">
            <Check className="h-4 w-4" />
            <span className="text-sm font-semibold">Aprovado</span>
          </div>
        ) : feedback?.status === "alteracao" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 rounded-xl px-4 py-3">
              <Edit3 className="h-4 w-4" />
              <span className="text-sm font-semibold">Alteração solicitada</span>
            </div>
            {feedback.feedback_text && (
              <p className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3">{feedback.feedback_text}</p>
            )}
          </div>
        ) : null}

        <Textarea
          value={feedbackText}
          onChange={(e) => setFeedbackText(e.target.value)}
          placeholder="Descreva as alterações necessárias..."
          className="text-xs min-h-[60px] rounded-lg resize-none"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => onSubmitFeedback(post.id, "aprovado", feedbackText)}
          >
            <Check className="h-3.5 w-3.5" /> Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50"
            onClick={() => onSubmitFeedback(post.id, "alteracao", feedbackText)}
          >
            <Edit3 className="h-3.5 w-3.5" /> Solicitar Alteração
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-views for public page ──

function PublicMonthlyView({ posts, selectedPost, onSelectPost }: { posts: PostData[]; selectedPost: PostData | null; onSelectPost: (p: PostData) => void }) {
  const [cursor, setCursor] = useState(() => startOfMonth(posts[0]?.posting_date ? parseISO(posts[0].posting_date) : new Date()));
  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) }), [cursor]);
  const postsByDay = useMemo(() => {
    const map = new Map<string, PostData[]>();
    posts.forEach(p => { if (p.posting_date) map.set(p.posting_date, [...(map.get(p.posting_date) ?? []), p]); });
    return map;
  }, [posts]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(d => startOfMonth(subMonths(d, 1)))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-bold capitalize min-w-[140px] text-center">{format(cursor, "MMMM yyyy", { locale: ptBR })}</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(d => startOfMonth(addMonths(d, 1)))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
          <div key={d} className="px-1 py-1 text-[10px] font-semibold text-gray-400 uppercase text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`b-${i}`} className="min-h-24" />)}
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const isToday = isSameDay(day, new Date());
          return (
            <div key={key} className={cn("min-h-24 rounded-xl border p-1.5 cursor-pointer transition", dayPosts.length > 0 ? "border-indigo-200 bg-indigo-50/50 hover:border-indigo-400" : "border-gray-100 bg-white/50", isToday && "ring-2 ring-indigo-300", selectedPost?.posting_date === key && "ring-2 ring-indigo-500")} onClick={() => dayPosts.length > 0 && onSelectPost(dayPosts[0])}>
              <div className={cn("text-[10px] font-bold mb-1", isToday ? "text-indigo-600" : "text-gray-400")}>{format(day, "d")}</div>
              {dayPosts.map(p => {
                const meta = POST_TYPE_META[p.post_type ?? "post"] ?? POST_TYPE_META.post;
                const Icon = meta.icon;
                const imgUrl = p.attachment_url || p.cover_url;
                return (
                  <div key={p.id} className="mb-1" onClick={(e) => { e.stopPropagation(); onSelectPost(p); }}>
                    {imgUrl && <img src={imgUrl} alt="" className="w-full aspect-square rounded object-cover mb-0.5" />}
                    <div className={cn("flex items-center gap-1 px-1 py-0.5 rounded text-[8px] font-medium truncate", meta.color)}>
                      <Icon className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{p.title}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PublicWeeklyView({ posts, selectedPost, onSelectPost }: { posts: PostData[]; selectedPost: PostData | null; onSelectPost: (p: PostData) => void }) {
  const [cursor, setCursor] = useState(() => startOfWeek(posts[0]?.posting_date ? parseISO(posts[0].posting_date) : new Date(), { weekStartsOn: 0 }));
  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(cursor, { weekStartsOn: 0 }), end: endOfWeek(cursor, { weekStartsOn: 0 }) }), [cursor]);
  const postsByDay = useMemo(() => {
    const map = new Map<string, PostData[]>();
    posts.forEach(p => { if (p.posting_date) map.set(p.posting_date, [...(map.get(p.posting_date) ?? []), p]); });
    return map;
  }, [posts]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(d => subWeeks(d, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-bold capitalize min-w-[200px] text-center">
          {format(days[0], "dd MMM", { locale: ptBR })} — {format(days[6], "dd MMM yyyy", { locale: ptBR })}
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(d => addWeeks(d, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {days.map(day => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          const isToday = isSameDay(day, new Date());
          return (
            <div key={key} className={cn("rounded-xl border p-2 min-h-[160px]", isToday ? "border-indigo-300 bg-indigo-50/50" : "border-gray-100 bg-white/50")}>
              <div className="text-center mb-2">
                <div className="text-[10px] uppercase font-semibold text-gray-400">{format(day, "EEE", { locale: ptBR })}</div>
                <div className={cn("text-lg font-bold mx-auto w-8 h-8 flex items-center justify-center rounded-full", isToday ? "bg-indigo-500 text-white" : "")}>{format(day, "d")}</div>
              </div>
              <div className="space-y-1.5">
                {dayPosts.map(post => {
                  const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
                  const Icon = meta.icon;
                  const imgUrl = post.attachment_url || post.cover_url;
                  return (
                    <div key={post.id} className={cn("rounded-lg border p-1.5 cursor-pointer transition hover:scale-[1.02]", selectedPost?.id === post.id ? "ring-2 ring-indigo-500" : "border-gray-200")} onClick={() => onSelectPost(post)}>
                      {imgUrl && <img src={imgUrl} alt="" className="w-full aspect-square rounded-md object-cover mb-1" />}
                      <div className="flex items-center gap-1">
                        <Icon className="h-2.5 w-2.5 shrink-0" />
                        <span className="text-[9px] font-medium truncate">{post.title}</span>
                      </div>
                      {post.posting_time && <div className="flex items-center gap-0.5 mt-0.5"><Clock className="h-2 w-2 text-gray-400" /><span className="text-[8px] text-gray-400">{post.posting_time}</span></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PublicFeedView({ posts, selectedPost, onSelectPost }: { posts: PostData[]; selectedPost: PostData | null; onSelectPost: (p: PostData) => void }) {
  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Instagram className="h-5 w-5 text-pink-500" />
        <span className="text-sm font-bold">Prévia do Feed</span>
      </div>
      <div className="grid grid-cols-3 gap-0.5 rounded-xl overflow-hidden border border-gray-200">
        {posts.map(post => {
          const imgUrl = post.attachment_url || post.cover_url;
          const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
          const Icon = meta.icon;
          return (
            <div key={post.id} className={cn("relative aspect-square cursor-pointer group overflow-hidden", selectedPost?.id === post.id && "ring-2 ring-indigo-500 ring-inset")} onClick={() => onSelectPost(post)}>
              {imgUrl ? (
                <img src={imgUrl} alt="" className="w-full h-full object-cover transition group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-100">
                  <Icon className="h-6 w-6 text-gray-400" />
                  <span className="text-[8px] font-medium text-gray-400">{meta.label}</span>
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="text-white text-center">
                  <Icon className="h-4 w-4 mx-auto mb-0.5" />
                  <span className="text-[9px] font-medium">{meta.label}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
