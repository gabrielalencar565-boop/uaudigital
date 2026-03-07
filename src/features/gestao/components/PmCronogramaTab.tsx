import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Download, Share2, X, Clock, Instagram, CalendarRange, LayoutGrid as GridIcon, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { PmTask } from "../pm-types";
import { useUpdatePmTask } from "../hooks/use-pm-data";
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

      <div className="flex gap-4">
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
          />
        )}
      </div>

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
                resolvedSelected?.id === post.id && "ring-2 ring-primary bg-primary/5"
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

/** Post detail sidebar — click-to-edit */
function PostDetailSidebar({ post, onClose, onUpdate }: { post: CronogramaPost & { all_attachment_urls?: string[] }; onClose: () => void; onUpdate: (field: string, value: string | null) => void }) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");

  const meta = POST_TYPE_META[post.post_type ?? "post"] ?? POST_TYPE_META.post;
  const allImages = post.all_attachment_urls ?? [];
  const isCarousel = post.post_type === "carrossel" && allImages.length > 1;
  const singleImg = post.attachment_url || post.cover_url;

  const startEditing = (field: string, currentValue: string) => {
    setEditingField(field);
    setTempValue(currentValue);
  };

  const saveField = (field: string) => {
    onUpdate(field, tempValue || null);
    setEditingField(null);
  };

  return (
    <div className="w-96 shrink-0 border border-border/30 rounded-2xl bg-card/60 backdrop-blur-sm p-4 space-y-4 animate-in slide-in-from-right-5 duration-200 overflow-y-auto max-h-[70vh]">
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

      {/* Images — carousel shows all pages in larger size */}
      {isCarousel ? (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground font-medium">{allImages.length} páginas</p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {allImages.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Página ${i + 1}`} className="w-full rounded-lg object-cover" />
            ))}
          </div>
        </div>
      ) : singleImg ? (
        <img src={singleImg} alt="" className="w-full rounded-xl object-cover aspect-square" />
      ) : null}

      {/* Date — click to edit */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
          {editingField === "posting_date" ? (
            <Input
              type="date"
              autoFocus
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => saveField("posting_date")}
              onKeyDown={(e) => e.key === "Enter" && saveField("posting_date")}
              className="h-7 text-xs flex-1"
            />
          ) : (
            <div
              className="flex-1 text-sm cursor-pointer group flex items-center gap-1 hover:text-primary transition-colors"
              onClick={() => startEditing("posting_date", post.posting_date ?? "")}
            >
              <span>{post.posting_date ? format(parseISO(post.posting_date), "dd/MM/yyyy", { locale: ptBR }) : "Sem data"}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
          {editingField === "posting_time" ? (
            <Input
              type="time"
              autoFocus
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              onBlur={() => saveField("posting_time")}
              onKeyDown={(e) => e.key === "Enter" && saveField("posting_time")}
              className="h-7 text-xs flex-1"
            />
          ) : (
            <div
              className="flex-1 text-sm cursor-pointer group flex items-center gap-1 hover:text-primary transition-colors"
              onClick={() => startEditing("posting_time", post.posting_time ?? "")}
            >
              <span>{post.posting_time || "Sem horário"}</span>
              <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
            </div>
          )}
        </div>
      </div>

      {/* Caption — click to edit */}
      <div>
        <h4 className="text-xs font-bold mb-1">Legenda:</h4>
        {editingField === "caption" ? (
          <Textarea
            autoFocus
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={() => saveField("caption")}
            placeholder="Escreva a legenda..."
            className="text-xs min-h-[80px] rounded-lg resize-none"
          />
        ) : (
          <div
            className="text-sm text-muted-foreground whitespace-pre-wrap cursor-pointer group rounded-lg p-2 hover:bg-muted/50 transition-colors min-h-[40px]"
            onClick={() => startEditing("caption", post.caption ?? "")}
          >
            {post.caption || <span className="italic text-muted-foreground/50">Clique para adicionar legenda...</span>}
            <Pencil className="h-3 w-3 inline-block ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />
          </div>
        )}
      </div>
    </div>
  );
}
