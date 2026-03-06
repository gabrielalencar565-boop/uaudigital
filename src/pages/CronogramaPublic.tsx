import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Film, Image, LayoutGrid, Camera, Calendar, Clock, Instagram, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
}

export default function CronogramaPublic() {
  const { taskId } = useParams<{ taskId: string }>();
  const [searchParams] = useSearchParams();
  const isPrint = searchParams.get("print") === "1";

  const [loading, setLoading] = useState(true);
  const [parentTitle, setParentTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [posts, setPosts] = useState<PostData[]>([]);
  const [selectedPost, setSelectedPost] = useState<PostData | null>(null);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      // Fetch parent task
      const { data: parent } = await sb.from("pm_tasks").select("title, client_id").eq("id", taskId).single();
      if (parent) {
        setParentTitle(parent.title);
        const { data: client } = await sb.from("clients").select("name").eq("id", parent.client_id).single();
        if (client) setClientName(client.name);
      }

      // Fetch child tasks with posting data
      const { data: children } = await sb
        .from("pm_tasks")
        .select("id, title, post_type, posting_date, posting_time, caption, cover_url")
        .eq("parent_task_id", taskId)
        .not("posting_date", "is", null)
        .order("posting_date", { ascending: true });

      if (children && children.length > 0) {
        setPosts(children);
        setCursor(startOfMonth(parseISO(children[0].posting_date!)));
        setSelectedPost(children[0]);
      }
      setLoading(false);
    })();
  }, [taskId]);

  // Auto-print
  useEffect(() => {
    if (isPrint && !loading && posts.length > 0) {
      setTimeout(() => window.print(), 800);
    }
  }, [isPrint, loading, posts]);

  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  }, [cursor]);

  const postsByDay = useMemo(() => {
    const map = new Map<string, PostData[]>();
    posts.forEach(p => {
      if (!p.posting_date) return;
      map.set(p.posting_date, [...(map.get(p.posting_date) ?? []), p]);
    });
    return map;
  }, [posts]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50">
        <div className="animate-pulse text-muted-foreground">Carregando cronograma...</div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-indigo-50">
        <p className="text-muted-foreground">Nenhuma postagem agendada.</p>
      </div>
    );
  }

  // ── PDF / Print View ──
  if (isPrint) {
    return (
      <div className="bg-white min-h-screen">
        <style>{`@media print { @page { size: A4 landscape; margin: 20mm; } body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }`}</style>
        <div className="max-w-5xl mx-auto p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">{clientName || parentTitle}</h1>
            <p className="text-sm text-gray-500">Cronograma de Postagens</p>
          </div>
          {posts.map((post, i) => {
            const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
            const Icon = meta.icon;
            return (
              <div key={post.id} className={cn("mb-8 page-break-inside-avoid rounded-xl border-2 p-6", meta.bgPage)} style={{ pageBreakInside: "avoid" }}>
                <div className="flex gap-6">
                  {/* Image */}
                  {post.cover_url && (
                    <div className="w-1/3 shrink-0">
                      <img src={post.cover_url} alt="" className="w-full rounded-xl object-cover aspect-square" />
                    </div>
                  )}
                  {/* Content */}
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
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{clientName || parentTitle}</h1>
            <p className="text-xs text-gray-500">Cronograma de Postagens</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => window.open(`${window.location.pathname}?print=1`, "_blank")}>
            <Download className="h-3.5 w-3.5" /> Baixar PDF
          </Button>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(d => startOfMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1)))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-bold capitalize min-w-[140px] text-center">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCursor(d => startOfMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1)))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex gap-6">
          {/* Calendar */}
          <div className="flex-1">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                <div key={d} className="px-1 py-1 text-[10px] font-semibold text-gray-400 uppercase text-center">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: days[0].getDay() }).map((_, i) => <div key={`b-${i}`} className="min-h-20" />)}
              {days.map(day => {
                const key = format(day, "yyyy-MM-dd");
                const dayPosts = postsByDay.get(key) ?? [];
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-20 rounded-xl border p-1.5 cursor-pointer transition",
                      dayPosts.length > 0 ? "border-indigo-200 bg-indigo-50/50 hover:border-indigo-400" : "border-gray-100 bg-white/50",
                      isToday && "ring-2 ring-indigo-300",
                      selectedPost?.posting_date === key && "ring-2 ring-indigo-500"
                    )}
                    onClick={() => dayPosts.length > 0 && setSelectedPost(dayPosts[0])}
                  >
                    <div className={cn("text-[10px] font-bold mb-1", isToday ? "text-indigo-600" : "text-gray-400")}>{format(day, "d")}</div>
                    {dayPosts.map(p => {
                      const meta = POST_TYPE_META[p.post_type ?? "post"] ?? POST_TYPE_META.post;
                      const Icon = meta.icon;
                      return (
                        <div key={p.id} className={cn("flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-medium truncate", meta.color)} onClick={(e) => { e.stopPropagation(); setSelectedPost(p); }}>
                          <Icon className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{p.title}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail sidebar */}
          {selectedPost && (
            <div className="w-96 shrink-0 border border-gray-200 rounded-2xl bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Instagram className="h-5 w-5 text-pink-500" />
                <span className="text-[10px] font-semibold bg-gray-100 px-2 py-0.5 rounded">Feed</span>
              </div>
              <div>
                <h2 className="text-xl font-bold">{selectedPost.title}</h2>
                {selectedPost.post_type && (
                  <Badge className={cn("text-[10px] mt-1", POST_TYPE_META[selectedPost.post_type]?.color ?? "bg-gray-100")}>
                    {POST_TYPE_META[selectedPost.post_type]?.label ?? selectedPost.post_type}
                  </Badge>
                )}
              </div>
              {selectedPost.cover_url && (
                <img src={selectedPost.cover_url} alt="" className="w-full rounded-xl object-cover aspect-square" />
              )}
              {selectedPost.caption && (
                <div>
                  <h4 className="font-bold text-sm mb-1">Legenda:</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{selectedPost.caption}</p>
                </div>
              )}
              <div className="inline-flex items-center gap-4 bg-indigo-100 text-indigo-800 rounded-xl px-4 py-2">
                <span className="text-sm font-bold">
                  Data: {selectedPost.posting_date ? format(parseISO(selectedPost.posting_date), "dd/MM/yy") : "—"}
                </span>
                {selectedPost.posting_time && (
                  <span className="text-sm font-bold">Horário: {selectedPost.posting_time}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
