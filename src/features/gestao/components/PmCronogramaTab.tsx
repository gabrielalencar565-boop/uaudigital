import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Download, Share2, CalendarRange, LayoutGrid as GridIcon, List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { PmTask } from "../pm-types";
import { useUpdatePmTask } from "../hooks/use-pm-data";
import { toast } from "sonner";

import { POST_TYPE_META, type CronogramaPost } from "./cronograma/types";
import { MonthlyView } from "./cronograma/MonthlyView";
import { WeeklyView } from "./cronograma/WeeklyView";
import { FeedView } from "./cronograma/FeedView";
import { ListView } from "./cronograma/ListView";
import { PostDetailSidebar } from "./cronograma/PostDetailSidebar";
import { PostListItem } from "./cronograma/PostListItem";

const sb = supabase as any;

interface Props {
  parentTask: PmTask;
  childTasks: PmTask[];
  clientName: string;
  membersMap: Record<string, { name: string; avatar?: string }>;
}

export function PmCronogramaTab({ parentTask, childTasks, clientName, membersMap }: Props) {
  const [selectedPost, setSelectedPost] = useState<CronogramaPost | null>(null);
  const updateTask = useUpdatePmTask();

  const childIds = useMemo(() => childTasks.map(t => t.id), [childTasks]);
  const attachmentsQ = useQuery({
    queryKey: ["pm_attachments_batch", childIds],
    enabled: childIds.length > 0,
    queryFn: async () => {
      const { data } = await sb
        .from("pm_attachments")
        .select("task_id, public_url, file_type, order_index")
        .in("task_id", childIds)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      return (data ?? []) as { task_id: string; public_url: string | null; file_type: string | null; order_index: number }[];
    },
  });

  const scheduledPosts: CronogramaPost[] = useMemo(() => {
    const attachments = attachmentsQ.data ?? [];
    const firstImageMap = new Map<string, string>();
    const allImagesMap = new Map<string, string[]>();
    attachments.forEach(att => {
      if (att.file_type?.startsWith("image/") && att.public_url) {
        if (!firstImageMap.has(att.task_id)) firstImageMap.set(att.task_id, att.public_url);
        const existing = allImagesMap.get(att.task_id) ?? [];
        existing.push(att.public_url);
        allImagesMap.set(att.task_id, existing);
      }
    });

    return childTasks
      .filter(t => t.posting_date)
      .map(t => ({
        ...t,
        attachment_url: firstImageMap.get(t.id) ?? null,
        all_attachment_urls: allImagesMap.get(t.id) ?? [],
      }))
      .sort((a, b) => (a.posting_date! > b.posting_date! ? 1 : -1));
  }, [childTasks, attachmentsQ.data]);

  const resolvedSelected = useMemo(() => {
    if (!selectedPost) return null;
    return scheduledPosts.find(p => p.id === selectedPost.id) ?? null;
  }, [selectedPost, scheduledPosts]);

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

  const handleUpdatePost = (field: string, value: string | null) => {
    if (!resolvedSelected) return;
    updateTask.mutate({ id: resolvedSelected.id, [field]: value || null } as any);
  };

  const handleDateChange = (postId: string, newDate: string) => {
    updateTask.mutate({ id: postId, posting_date: newDate } as any);
    toast.success("Data atualizada!");
  };

  const handleRenamePost = (postId: string, newTitle: string) => {
    updateTask.mutate({ id: postId, title: newTitle } as any);
    toast.success("Nome atualizado!");
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

      <div className="flex flex-col md:flex-row gap-4">
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
              <TabsTrigger value="lista" className="gap-1.5 text-xs">
                <List className="h-3.5 w-3.5" /> Lista
              </TabsTrigger>
            </TabsList>

            <TabsContent value="semanal">
              <WeeklyView posts={scheduledPosts} selectedPost={resolvedSelected} onSelectPost={setSelectedPost} onDateChange={handleDateChange} />
            </TabsContent>
            <TabsContent value="mensal">
              <MonthlyView posts={scheduledPosts} selectedPost={resolvedSelected} onSelectPost={setSelectedPost} onDateChange={handleDateChange} />
            </TabsContent>
            <TabsContent value="feed">
              <FeedView posts={scheduledPosts} selectedPost={resolvedSelected} onSelectPost={setSelectedPost} />
            </TabsContent>
          </Tabs>
        </div>

        {resolvedSelected && (
          <PostDetailSidebar
            post={resolvedSelected}
            onClose={() => setSelectedPost(null)}
            onUpdate={handleUpdatePost}
            onRename={(newTitle) => handleRenamePost(resolvedSelected.id, newTitle)}
            clientName={clientName}
          />
        )}
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Todas as postagens ({scheduledPosts.length})
        </h4>
        {scheduledPosts.map(post => (
          <PostListItem
            key={post.id}
            post={post}
            isSelected={resolvedSelected?.id === post.id}
            onSelect={() => setSelectedPost(post)}
            onRename={(newTitle) => handleRenamePost(post.id, newTitle)}
          />
        ))}
      </div>
    </div>
  );
}
