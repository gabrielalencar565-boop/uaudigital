import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Download, Share2, X, Clock, Instagram, CalendarRange, LayoutGrid as GridIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { PmTask } from "../pm-types";
import { toast } from "sonner";

import { POST_TYPE_META, type CronogramaPost } from "./cronograma/types";
import { MonthlyView } from "./cronograma/MonthlyView";
import { WeeklyView } from "./cronograma/WeeklyView";
import { FeedView } from "./cronograma/FeedView";

const sb = supabase as any;

interface Props {
  parentTask: PmTask;
  childTasks: PmTask[];
  clientName: string;
  membersMap: Record<string, { name: string; avatar?: string }>;
}

export function PmCronogramaTab({ parentTask, childTasks, clientName, membersMap }: Props) {
  const [selectedPost, setSelectedPost] = useState<CronogramaPost | null>(null);

  // Fetch attachments for all child tasks to auto-populate images
  const childIds = useMemo(() => childTasks.map(t => t.id), [childTasks]);
  const attachmentsQ = useQuery({
    queryKey: ["pm_attachments_batch", childIds],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const { data } = await sb
        .from("pm_attachments")
        .select("task_id, public_url, file_type")
        .in("task_id", childIds)
        .order("created_at", { ascending: true });
      return (data ?? []) as { task_id: string; public_url: string | null; file_type: string | null }[];
    },
  });

  // Build posts with auto-attached images
  const scheduledPosts: CronogramaPost[] = useMemo(() => {
    const attachments = attachmentsQ.data ?? [];
    // Map: taskId -> first image URL
    const firstImageMap = new Map<string, string>();
    attachments.forEach(att => {
      if (!firstImageMap.has(att.task_id) && att.file_type?.startsWith("image/") && att.public_url) {
        firstImageMap.set(att.task_id, att.public_url);
      }
    });

    return childTasks
      .filter(t => t.posting_date)
      .map(t => ({
        ...t,
        attachment_url: firstImageMap.get(t.id) ?? null,
      }))
      .sort((a, b) => (a.posting_date! > b.posting_date! ? 1 : -1));
  }, [childTasks, attachmentsQ.data]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/cronograma/${parentTask.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiado para a área de transferência!");
    } catch {
      toast.info(`Link: ${shareUrl}`);
    }
  };

  const handleDownloadPDF = () => {
    const url = `${window.location.origin}/cronograma/${parentTask.id}?print=1`;
    window.open(url, "_blank");
  };

  if (scheduledPosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <h3 className="text-sm font-semibold mb-1">Nenhuma postagem agendada</h3>
        <p className="text-xs text-muted-foreground max-w-sm">
          Preencha a data de postagem, tipo e legenda nas subtarefas para montar o cronograma.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={handleShare}>
            <Share2 className="h-3.5 w-3.5" /> Compartilhar
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" onClick={handleDownloadPDF}>
            <Download className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main content with tabs */}
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
              <WeeklyView posts={scheduledPosts} selectedPost={selectedPost} onSelectPost={setSelectedPost} />
            </TabsContent>
            <TabsContent value="mensal">
              <MonthlyView posts={scheduledPosts} selectedPost={selectedPost} onSelectPost={setSelectedPost} />
            </TabsContent>
            <TabsContent value="feed">
              <FeedView posts={scheduledPosts} selectedPost={selectedPost} onSelectPost={setSelectedPost} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Post detail preview */}
        {selectedPost && (
          <PostDetailSidebar post={selectedPost} onClose={() => setSelectedPost(null)} />
        )}
      </div>

      {/* All posts list */}
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Todas as postagens</h4>
        {scheduledPosts.map(post => {
          const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
          const Icon = meta.icon;
          return (
            <div
              key={post.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl border border-border/20 cursor-pointer transition hover:bg-card/60",
                selectedPost?.id === post.id && "ring-2 ring-primary bg-primary/5"
              )}
              onClick={() => setSelectedPost(post)}
            >
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", meta.color)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{post.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yy", { locale: ptBR }) : "—"}
                  {post.posting_time ? ` às ${post.posting_time}` : ""}
                </p>
              </div>
              <Badge className={cn("text-[9px] shrink-0", meta.color)}>{meta.label}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Post detail sidebar */
function PostDetailSidebar({ post, onClose }: { post: CronogramaPost; onClose: () => void }) {
  const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
  const imgUrl = post.attachment_url || post.cover_url;

  return (
    <div className="w-80 shrink-0 border border-border/30 rounded-2xl bg-card/60 backdrop-blur-sm p-4 space-y-4 animate-in slide-in-from-right-5 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Instagram className="h-4 w-4 text-pink-500" />
          <span className="text-[10px] font-semibold bg-muted px-2 py-0.5 rounded">Feed</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div>
        <h3 className="text-lg font-bold">{post.title}</h3>
        {post.post_type && (
          <Badge className={cn("text-[10px] mt-1", meta.color)}>
            {meta.label}
          </Badge>
        )}
      </div>

      {post.caption && (
        <div>
          <h4 className="text-xs font-bold mb-1">Legenda:</h4>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{post.caption}</p>
        </div>
      )}

      <div className="flex items-center gap-2 bg-primary/10 rounded-xl px-3 py-2">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold">
          Data: {post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yy") : "—"}
        </span>
        {post.posting_time && (
          <>
            <Clock className="h-3.5 w-3.5 text-primary ml-2" />
            <span className="text-xs font-semibold">Horário: {post.posting_time}</span>
          </>
        )}
      </div>

      {imgUrl && (
        <img src={imgUrl} alt="" className="w-full rounded-xl object-cover aspect-square" />
      )}
    </div>
  );
}
