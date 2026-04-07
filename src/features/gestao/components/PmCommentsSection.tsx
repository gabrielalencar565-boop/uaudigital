import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, ChevronDown, ChevronUp, ImagePlus, X, ExternalLink, Play, Instagram, Youtube, Globe, Copy, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddPmComment, useUploadPmAttachment, usePmActivityLog } from "../hooks/use-pm-data";
import { stageLabel } from "../pm-constants";
import type { PmComment } from "../pm-types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function initials(n: string) { return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join(""); }

/* ── Link preview types ── */
interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
  site_name: string | null;
  platform: string | null;
}

/* ── Link preview cache (client-side) ── */
const previewCache = new Map<string, LinkPreviewData | null>();

async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  if (previewCache.has(url)) return previewCache.get(url) ?? null;
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const fnUrl = `https://${projectId}.supabase.co/functions/v1/link-preview?url=${encodeURIComponent(url)}`;
    const response = await fetch(fnUrl, {
      headers: { "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
    });
    if (!response.ok) { previewCache.set(url, null); return null; }
    const data = await response.json() as LinkPreviewData;
    if (!data.title && !data.image) { previewCache.set(url, null); return null; }
    previewCache.set(url, data);
    return data;
  } catch {
    previewCache.set(url, null);
    return null;
  }
}

/* ── Extract first URL ── */
function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

/* ── Format action text ── */
function formatActionText(action: string, metadata: any, membersMap: Record<string, { name: string; avatar?: string }>): string {
  switch (action) {
    case "created":
      if (metadata?.parent_task_id) return `criou a subtarefa: ${metadata.title ?? ""}`;
      return "criou esta tarefa";
    case "updated": {
      const parts: string[] = [];
      if (metadata?.stage_current) parts.push(`etapa alterada: ${stageLabel(metadata.stage_current)}`);
      if (metadata?.assignee_id) {
        const name = membersMap[metadata.assignee_id]?.name ?? "alguém";
        parts.push(`responsável alterado: ${name}`);
      }
      if (metadata?.title) parts.push(`nome alterado: ${metadata.title}`);
      if (metadata?.priority) parts.push(`prioridade alterada: ${metadata.priority}`);
      if (metadata?.due_date !== undefined) parts.push(`data de entrega alterada: ${metadata.due_date ?? "removida"}`);
      if (metadata?.tags) parts.push(`etiquetas atualizadas`);
      if (metadata?.watchers) parts.push(`observadores atualizados`);
      if (metadata?.description !== undefined) parts.push(`descrição atualizada`);
      if (metadata?.cover_url !== undefined) parts.push(metadata.cover_url ? "capa definida" : "capa removida");
      return parts.length > 0 ? parts.join(", ") : "atualizou a tarefa";
    }
    case "comment_added": return `comentou`;
    case "file_added": return `adicionou anexo: ${metadata?.file_name ?? "arquivo"}`;
    default: return action;
  }
}

/* ── Link Preview Card Component ── */
function LinkPreviewCard({ preview, url, onOpenPreview }: { preview: LinkPreviewData; url: string; onOpenPreview?: (img: string) => void }) {
  const hostname = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } })();
  const isYouTube = preview.platform === "youtube";
  const isInstagram = preview.platform === "instagram";

  const PlatformIcon = isInstagram ? Instagram : isYouTube ? Youtube : Globe;
  const platformLabel = preview.site_name || (isInstagram ? "Instagram" : isYouTube ? "YouTube" : hostname);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    window.open(url, "_blank");
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (preview.image && onOpenPreview) onOpenPreview(preview.image);
  };

  return (
    <div
      className="mt-2 rounded-2xl border border-border/40 bg-card overflow-hidden hover:shadow-lg hover:border-border/60 transition-all cursor-pointer max-w-full"
      onClick={() => window.open(url, "_blank")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-muted/50 border border-border/30 flex items-center justify-center shrink-0 overflow-hidden">
            {preview.image ? (
              <img src={preview.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <PlatformIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate text-foreground/90">
              {preview.title ? preview.title.split(" ").slice(0, 4).join(" ") : hostname}
            </p>
            <span className="text-[10px] text-muted-foreground">{platformLabel}</span>
          </div>
        </div>
        <span className="shrink-0 text-[11px] font-medium px-3 py-1 rounded-md bg-primary text-primary-foreground">
          {isInstagram ? "Ver perfil" : "Abrir"}
        </span>
      </div>

      {/* Image with hover actions */}
      {preview.image && (
        <div className="relative w-full bg-muted/20 group/img">
          <img
            src={preview.image}
            alt={preview.title ?? ""}
            className="w-full h-auto max-h-[500px] object-cover block"
            loading="lazy"
          />
          {isYouTube && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-14 w-14 rounded-full bg-destructive/90 flex items-center justify-center shadow-lg">
                <Play className="h-6 w-6 text-destructive-foreground ml-0.5" fill="currentColor" />
              </div>
            </div>
          )}
          {/* Hover overlay with actions */}
          <div className="absolute inset-0 bg-background/50 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
            <button
              onClick={handleCopy}
              className="h-9 w-9 rounded-full bg-card/90 border border-border/50 flex items-center justify-center hover:bg-card transition shadow-md"
              title="Copiar link"
            >
              <Copy className="h-4 w-4 text-foreground/80" />
            </button>
            <button
              onClick={handleOpen}
              className="h-9 w-9 rounded-full bg-card/90 border border-border/50 flex items-center justify-center hover:bg-card transition shadow-md"
              title="Abrir link"
            >
              <ExternalLink className="h-4 w-4 text-foreground/80" />
            </button>
            {onOpenPreview && (
              <button
                onClick={handlePreview}
                className="h-9 w-9 rounded-full bg-card/90 border border-border/50 flex items-center justify-center hover:bg-card transition shadow-md"
                title="Pré-visualizar"
              >
                <Eye className="h-4 w-4 text-foreground/80" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      {preview.description && (
        <div className="px-3 py-2.5">
          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
            {preview.description}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Link Preview Skeleton ── */
function LinkPreviewSkeleton() {
  return (
    <div className="mt-2 rounded-xl border border-border/30 bg-card/60 overflow-hidden">
      <Skeleton className="w-full h-32" />
      <div className="px-3 py-2.5 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

/* ── Inline Preview Hook (while typing) ── */
function useTypingPreview(text: string) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const url = extractUrl(text);
    if (!url || url === lastUrlRef.current) {
      if (!url) { setPreview(null); setLoading(false); lastUrlRef.current = null; }
      return;
    }
    lastUrlRef.current = url;
    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchLinkPreview(url).then(data => {
        if (!cancelled) { setPreview(data); setLoading(false); }
      });
    }, 600); // debounce
    return () => { cancelled = true; clearTimeout(timer); };
  }, [text]);

  return { preview, loading, detectedUrl: lastUrlRef.current };
}

/* ── Saved Comment Preview Hook ── */
function useSavedPreview(comment: PmComment) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(
    comment.link_title || comment.link_image
      ? { title: comment.link_title ?? null, description: null, image: comment.link_image ?? null, url: comment.link_url ?? "", site_name: null, platform: null }
      : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preview || !comment.link_url) return;
    // Fetch preview if we have a URL but no saved metadata
    setLoading(true);
    fetchLinkPreview(comment.link_url).then(data => { setPreview(data); setLoading(false); });
  }, [comment.link_url]);

  return { preview, loading };
}

/* ── Comment Bubble ── */
function CommentBubble({ c, membersMap, formatMentions }: { c: PmComment; membersMap: Record<string, { name: string; avatar?: string }>; formatMentions: (t: string) => string }) {
  const member = membersMap[c.author_id];
  const { preview, loading } = useSavedPreview(c);

  return (
    <div className="flex gap-2.5">
      <Avatar className="h-6 w-6 shrink-0 mt-0.5">
        <AvatarImage src={member?.avatar} />
        <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials(member?.name ?? "?")}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold">{member?.name ?? "Usuário"}</span>
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(c.created_at), "MMM d 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
        {c.content && (
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground/90 leading-relaxed">{formatMentions(c.content)}</p>
        )}
        {c.image_url && (
          <div className="mt-2">
            <img
              src={c.image_url}
              alt={c.image_description || "Imagem"}
              className="rounded-lg max-w-[280px] max-h-[200px] object-cover border border-border/30 cursor-pointer hover:opacity-90 transition"
              onClick={() => window.open(c.image_url!, "_blank")}
            />
            {c.image_description && (
              <p className="text-[11px] text-muted-foreground mt-1 italic">{c.image_description}</p>
            )}
          </div>
        )}
        {loading && <LinkPreviewSkeleton />}
        {preview && c.link_url && <LinkPreviewCard preview={preview} url={c.link_url} />}
      </div>
    </div>
  );
}

/* ── Main Component ── */
interface Props {
  taskId: string;
  comments: PmComment[];
  membersMap: Record<string, { name: string; avatar?: string }>;
  members?: { id: string; name: string }[];
}

export function PmCommentsSection({ taskId, comments, membersMap, members = [] }: Props) {
  const [content, setContent] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const addComment = useAddPmComment();
  const uploadAttachment = useUploadPmAttachment();
  const activityLogQ = usePmActivityLog(taskId);
  const activityLog = activityLogQ.data ?? [];

  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [imageDescription, setImageDescription] = useState("");
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);

  // Live link preview while typing
  const { preview: typingPreview, loading: typingLoading } = useTypingPreview(content);

  const timeline = useMemo(() => {
    const items: Array<{ type: "comment" | "activity"; data: any; timestamp: string }> = [];
    comments.forEach(c => items.push({ type: "comment", data: c, timestamp: c.created_at }));
    const seen = new Set<string>();
    activityLog.forEach(a => {
      if (a.action === "comment_added") return;
      const ts = Math.floor(new Date(a.created_at).getTime() / 2000);
      const key = `${a.action}:${a.created_by}:${JSON.stringify(a.metadata)}:${ts}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ type: "activity", data: a, timestamp: a.created_at });
    });
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return items;
  }, [comments, activityLog]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Apenas imagens são permitidas"); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("Imagem muito grande (máx 50MB)"); return; }
    const preview = URL.createObjectURL(file);
    setPendingImage({ file, preview });
    setImageDescription("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const clearPendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
    setImageDescription("");
  };

  const handleSend = async () => {
    if (!content.trim() && !pendingImage) return;

    let imageUrl: string | null = null;
    if (pendingImage) {
      try {
        const att = await uploadAttachment.mutateAsync({ task_id: taskId, file: pendingImage.file });
        imageUrl = att.public_url;
      } catch { toast.error("Erro ao enviar imagem"); return; }
    }

    const linkUrl = extractUrl(content.trim());

    // Fetch link preview data for storage
    let linkTitle: string | undefined;
    let linkImage: string | undefined;
    if (linkUrl && typingPreview) {
      linkTitle = typingPreview.title ?? undefined;
      linkImage = typingPreview.image ?? undefined;
    } else if (linkUrl) {
      // Try to fetch if not yet loaded
      const data = await fetchLinkPreview(linkUrl);
      if (data) { linkTitle = data.title ?? undefined; linkImage = data.image ?? undefined; }
    }

    const storageContent = contentToStorage(content.trim());
    await addComment.mutateAsync({
      task_id: taskId,
      content: storageContent || (pendingImage ? (imageDescription || "Imagem anexada") : ""),
      image_url: imageUrl ?? undefined,
      image_description: imageDescription || undefined,
      link_url: linkUrl ?? undefined,
      link_title: linkTitle,
      link_image: linkImage,
    });
    setContent("");
    setMentionMap({});
    clearPendingImage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    const lastAtIdx = val.lastIndexOf("@");
    if (lastAtIdx >= 0) {
      const textAfterAt = val.slice(lastAtIdx + 1);
      if (!textAfterAt.includes(" ") && textAfterAt.length < 30) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (memberId: string, name: string) => {
    const lastAtIdx = content.lastIndexOf("@");
    if (lastAtIdx >= 0) {
      const before = content.slice(0, lastAtIdx);
      setContent(`${before}@${name} `);
      setMentionMap(prev => ({ ...prev, [name]: memberId }));
    }
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const contentToStorage = (text: string): string => {
    let result = text;
    for (const [name, id] of Object.entries(mentionMap)) {
      result = result.split(`@${name}`).join(`@${id}`);
    }
    return result;
  };

  const formatMentions = useCallback((text: string) => {
    return text.replace(/@([a-f0-9-]{36})/gi, (_, id) => {
      const m = membersMap[id];
      return m ? `@${m.name}` : "@alguém";
    });
  }, [membersMap]);

  const filteredMembers = members.filter(m => m.name.toLowerCase().includes(mentionSearch));

  const renderTimelineItem = (item: { type: "comment" | "activity"; data: any; timestamp: string }) => {
    if (item.type === "comment") {
      const c = item.data as PmComment;
      return <CommentBubble key={`c-${c.id}`} c={c} membersMap={membersMap} formatMentions={formatMentions} />;
    } else {
      const a = item.data;
      const member = membersMap[a.created_by];
      const actionText = formatActionText(a.action, a.metadata, membersMap);
      return (
        <div key={`a-${a.id}`} className="flex items-start gap-2.5 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 mt-2 shrink-0 ml-2" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/70">{member?.name ?? "Usuário"}</span>
              {" "}{actionText}
            </p>
            <span className="text-[10px] text-muted-foreground/60">
              {format(new Date(a.created_at), "MMM d 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>
      );
    }
  };

  const firstItem = timeline.length > 0 ? timeline[0] : null;
  const lastItem = timeline.length > 1 ? timeline[timeline.length - 1] : null;
  const middleItems = timeline.length > 2 ? timeline.slice(1, -1) : [];
  const hiddenCount = middleItems.length;

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-1 space-y-3 min-h-0 overflow-y-auto overflow-x-hidden">
        {timeline.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade ainda.</p>
        )}
        {firstItem && renderTimelineItem(firstItem)}
        {hiddenCount > 0 && (
          <>
            <button
              type="button"
              onClick={() => setExpanded(prev => !prev)}
              className="flex items-center gap-1.5 w-full text-xs text-primary/80 hover:text-primary transition py-1 px-2"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? "Mostrar menos" : `Mostrar mais ${hiddenCount} atividade${hiddenCount > 1 ? "s" : ""}`}
            </button>
            {expanded && middleItems.map(item => renderTimelineItem(item))}
          </>
        )}
        {lastItem && renderTimelineItem(lastItem)}
      </div>

      <div className="border-t border-border/30 pt-3 relative">
        {pendingImage && (
          <div className="mb-2 relative inline-block">
            <img src={pendingImage.preview} alt="Preview" className="rounded-lg max-h-32 max-w-[200px] object-cover border border-border/40" />
            <button onClick={clearPendingImage} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
              <X className="h-3 w-3" />
            </button>
            <Input value={imageDescription} onChange={(e) => setImageDescription(e.target.value)} placeholder="Descrição da imagem (opcional)" className="mt-1.5 h-7 text-xs" />
          </div>
        )}

        {/* Live link preview while typing */}
        {typingLoading && <LinkPreviewSkeleton />}
        {typingPreview && !typingLoading && extractUrl(content) && (
          <div className="mb-2">
            <LinkPreviewCard preview={typingPreview} url={extractUrl(content)!} />
          </div>
        )}

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Escreva um comentário..."
          className="min-h-[60px] text-sm resize-none"
          onKeyDown={handleKeyDown}
        />
        {showMentions && filteredMembers.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 w-full bg-popover border border-border rounded-md shadow-lg z-50 max-h-40 overflow-y-auto">
            {filteredMembers.map(m => {
              const info = membersMap[m.id];
              return (
                <button
                  key={m.id}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition text-left"
                  onMouseDown={(e) => { e.preventDefault(); insertMention(m.id, m.name); }}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={info?.avatar} />
                    <AvatarFallback className="text-[7px] bg-primary/20 text-primary">{initials(m.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{m.name}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => imageInputRef.current?.click()}>
              <ImagePlus className="h-4 w-4" />
            </Button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>
          <Button size="sm" onClick={handleSend} disabled={(!content.trim() && !pendingImage) || addComment.isPending || uploadAttachment.isPending} className="gap-1.5">
            <Send className="h-3 w-3" /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
