import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, ChevronDown, ChevronUp, Paperclip, X, ExternalLink, Play, Instagram, Youtube, Globe, Link2, Maximize2, FileText, Download, MoreHorizontal, Trash2, Copy, ClipboardCopy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddPmComment, useUploadPmAttachment, usePmActivityLog } from "../hooks/use-pm-data";
import { useQueryClient } from "@tanstack/react-query";
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

/* ── Important actions kept in the activity feed ── */
function isImportantActivity(action: string, metadata: any): boolean {
  if (action === "created" || action === "file_added") return true;
  if (action === "correction_tags" || action === "correction_assignee") return true;
  if (action === "updated" && metadata) {
    // Only show when one of these meaningful fields changed
    if (metadata.status_global) return true;
    if (metadata.stage_current) return true;
    if (metadata.assignee_id) return true;
    if (metadata._revision_change) return true;
    if (metadata.is_extra_demand !== undefined) return true;
    if (metadata.due_date !== undefined) return true;
  }
  return false;
}

/* ── Format action text (only important ones reach here) ── */
function formatActionText(action: string, metadata: any, membersMap: Record<string, { name: string; avatar?: string }>): string {
  switch (action) {
    case "created":
      if (metadata?.parent_task_id) return `criou a subtarefa: ${metadata.title ?? ""}`;
      return "criou esta tarefa";
    case "updated": {
      // Completion takes priority — most important signal
      if (metadata?.status_global === "concluido") return "marcou como concluída ✅";
      if (metadata?.status_global === "cancelado") return "cancelou a tarefa";
      const parts: string[] = [];
      if (metadata?.stage_current) parts.push(`avançou para ${stageLabel(metadata.stage_current)}`);
      if (metadata?.assignee_id) {
        const name = membersMap[metadata.assignee_id]?.name ?? "alguém";
        parts.push(`responsável: ${name}`);
      }
      if (metadata?._revision_change) {
        const rc = metadata._revision_change;
        const statusLabel = rc.newStatus === "aprovado" ? "aprovada" : rc.newStatus === "alteracao" ? "pediu alteração" : "pendente";
        parts.push(`"${rc.childTitle}" ${statusLabel}`);
      }
      if (metadata?.is_extra_demand !== undefined) parts.push(metadata.is_extra_demand ? "marcou como extra" : "removeu marca extra");
      if (metadata?.status_global) parts.push(`status: ${metadata.status_global}`);
      return parts.join(", ");
    }
    case "correction_tags": return "corrigiu etiquetas";
    case "correction_assignee": return "corrigiu responsável";
    case "file_added": return `adicionou anexo: ${metadata?.file_name ?? "arquivo"}`;
    default: return action;
  }
}

/* ── Link Preview Card Component ── */
interface PreviewModalData {
  image: string;
  title: string | null;
  description: string | null;
  url: string;
  platform: string | null;
}

function LinkPreviewCard({ preview, url, onOpenPreview }: { preview: LinkPreviewData; url: string; onOpenPreview?: (data: PreviewModalData) => void }) {
  const hostname = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } })();
  const isYouTube = preview.platform === "youtube";
  const isInstagram = preview.platform === "instagram";

  const PlatformIcon = isInstagram ? Instagram : isYouTube ? Youtube : Globe;
  const platformLabel = preview.site_name || (isInstagram ? "Instagram" : isYouTube ? "YouTube" : hostname);

  const openLink = (e?: React.MouseEvent) => {
    e?.preventDefault(); e?.stopPropagation();
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handlePreview = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (preview.image && onOpenPreview) {
      onOpenPreview({ image: preview.image, title: preview.title, description: preview.description, url, platform: preview.platform });
    }
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group mt-2 block rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer max-w-sm no-underline text-left"
      onClick={(e) => { e.preventDefault(); openLink(); }}
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="h-9 w-9 rounded-full bg-muted border border-border/40 flex items-center justify-center shrink-0 overflow-hidden">
          <PlatformIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate text-foreground leading-tight">
            {preview.title ? preview.title.split(" ").slice(0, 5).join(" ") : hostname}
          </p>
          <span className="text-[11px] text-muted-foreground leading-tight">{platformLabel}</span>
        </div>
        {/* Actions on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0">
          <button onClick={handleCopy} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition" title="Copiar link">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button onClick={(e) => openLink(e)} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition" title="Abrir link">
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {onOpenPreview && preview.image && (
            <button onClick={handlePreview} className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted transition" title="Ver prévia">
              <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* ── Image (fixed aspect ratio) ── */}
      {preview.image && (
        <div className="relative w-full aspect-video bg-muted/30 overflow-hidden">
          <img
            src={preview.image}
            alt={preview.title ?? ""}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          {isYouTube && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-14 w-14 rounded-full bg-destructive/90 flex items-center justify-center shadow-lg">
                <Play className="h-6 w-6 text-destructive-foreground ml-0.5" fill="currentColor" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      {preview.description && (
        <div className="px-3 py-2.5 border-t border-border/30">
          <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{preview.description}</p>
        </div>
      )}
    </a>
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

/* ── Strip URLs from text when preview is active ── */
function stripUrls(text: string): string {
  return text.replace(/https?:\/\/[^\s]+/gi, "").trim();
}

/* ── Comment Bubble ── */
/* helper: is the URL pointing to an image? */
function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp|svg|bmp|avif|heic|heif)(\?|$)/i.test(url);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CommentBubble({ c, membersMap, formatMentions, onOpenPreview, onDelete }: { c: PmComment; membersMap: Record<string, { name: string; avatar?: string }>; formatMentions: (t: string) => string; onOpenPreview: (data: PreviewModalData) => void; onDelete?: (id: string) => void }) {
  const member = membersMap[c.author_id];
  const { preview, loading } = useSavedPreview(c);
  const displayContent = c.content ? formatMentions(c.content) : "";
  const fileUrl = c.image_url;
  const fileName = c.image_description || "Arquivo";
  const isImage = fileUrl ? isImageUrl(fileUrl) : false;

  const handleDownload = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!fileUrl) return;
    try {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch { window.open(fileUrl, "_blank"); }
  };

  const handleCopyText = () => {
    if (displayContent) {
      navigator.clipboard.writeText(displayContent);
      toast.success("Texto copiado!");
    }
  };

  return (
    <div className="flex gap-2.5 items-start group/comment">
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
        {displayContent && (
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground/90 leading-relaxed">{displayContent}</p>
        )}
        {fileUrl && isImage && (
          <div className="mt-2">
            <img
              src={fileUrl}
              alt={fileName}
              className="rounded-lg max-w-[280px] max-h-[200px] object-cover border border-border/30 cursor-pointer hover:opacity-90 transition"
              onClick={() => window.open(fileUrl, "_blank")}
            />
            {fileName && fileName !== "Arquivo" && (
              <p className="text-[11px] text-muted-foreground mt-1">{fileName}</p>
            )}
          </div>
        )}
        {fileUrl && !isImage && (
          <div
            className="mt-2 flex items-center gap-2.5 rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5 max-w-xs cursor-pointer hover:bg-muted/50 transition group"
            onClick={handleDownload}
          >
            <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-xs truncate flex-1 text-foreground/80">{fileName}</span>
            <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0" />
          </div>
        )}
      </div>
      {/* 3-dot menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="h-6 w-6 rounded-md flex items-center justify-center opacity-0 group-hover/comment:opacity-100 transition hover:bg-muted shrink-0 mt-0.5">
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[140px]" style={{ zIndex: 99999 }}>
          {displayContent && (
            <DropdownMenuItem onClick={handleCopyText} className="gap-2 text-xs">
              <ClipboardCopy className="h-3.5 w-3.5" /> Copiar texto
            </DropdownMenuItem>
          )}
          {fileUrl && (
            <DropdownMenuItem onClick={() => handleDownload()} className="gap-2 text-xs">
              <Download className="h-3.5 w-3.5" /> Baixar anexo
            </DropdownMenuItem>
          )}
          {onDelete && (
            <DropdownMenuItem onClick={() => onDelete(c.id)} className="gap-2 text-xs text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addComment = useAddPmComment();
  const queryClient = useQueryClient();
  const uploadAttachment = useUploadPmAttachment();
  const activityLogQ = usePmActivityLog(taskId);
  const activityLog = activityLogQ.data ?? [];

  const [pendingFile, setPendingFile] = useState<{ file: File; preview: string | null; isImage: boolean } | null>(null);
  const [fileDescription, setFileDescription] = useState("");
  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [previewModal, setPreviewModal] = useState<PreviewModalData | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 200MB)"); return; }
    const isImage = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
    const preview = isImage ? URL.createObjectURL(file) : null;
    setPendingFile({ file, preview, isImage });
    setFileDescription("");
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDraggingOver(false);
  }, []);

  // Live link preview while typing
  const { preview: typingPreview, loading: typingLoading } = useTypingPreview(content);

  const timeline = useMemo(() => {
    const items: Array<{ type: "comment" | "activity"; data: any; timestamp: string }> = [];
    comments.forEach(c => items.push({ type: "comment", data: c, timestamp: c.created_at }));
    const seen = new Set<string>();
    activityLog.forEach(a => {
      if (a.action === "comment_added") return;
      if (!isImportantActivity(a.action, a.metadata)) return;
      const ts = Math.floor(new Date(a.created_at).getTime() / 2000);
      const key = `${a.action}:${a.created_by}:${JSON.stringify(a.metadata)}:${ts}`;
      if (seen.has(key)) return;
      seen.add(key);
      items.push({ type: "activity", data: a, timestamp: a.created_at });
    });
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return items;
  }, [comments, activityLog]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) { toast.error("Arquivo muito grande (máx 200MB)"); return; }
    const isImage = file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);
    const preview = isImage ? URL.createObjectURL(file) : null;
    setPendingFile({ file, preview, isImage });
    setFileDescription("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearPendingFile = () => {
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview);
    setPendingFile(null);
    setFileDescription("");
  };

  const handleSend = async () => {
    if (!content.trim() && !pendingFile) return;

    let imageUrl: string | null = null;
    let fileName: string | undefined;
    if (pendingFile) {
      try {
        const att = await uploadAttachment.mutateAsync({ task_id: taskId, file: pendingFile.file });
        imageUrl = att.public_url;
        fileName = pendingFile.file.name;
      } catch { toast.error("Erro ao enviar arquivo"); return; }
    }

    const linkUrl = extractUrl(content.trim());

    let linkTitle: string | undefined;
    let linkImage: string | undefined;
    if (linkUrl && typingPreview) {
      linkTitle = typingPreview.title ?? undefined;
      linkImage = typingPreview.image ?? undefined;
    } else if (linkUrl) {
      const data = await fetchLinkPreview(linkUrl);
      if (data) { linkTitle = data.title ?? undefined; linkImage = data.image ?? undefined; }
    }

    const storageContent = contentToStorage(content.trim());
    await addComment.mutateAsync({
      task_id: taskId,
      content: storageContent || (pendingFile ? (fileDescription || fileName || "Arquivo anexado") : ""),
      image_url: imageUrl ?? undefined,
      image_description: pendingFile ? (fileDescription || fileName) : undefined,
      link_url: linkUrl ?? undefined,
      link_title: linkTitle,
      link_image: linkImage,
    });
    setContent("");
    setMentionMap({});
    clearPendingFile();
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

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase.from("pm_comments").delete().eq("id", commentId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["pm_comments"] });
      toast.success("Comentário removido");
    } catch { toast.error("Erro ao remover comentário"); }
  };

  const renderTimelineItem = (item: { type: "comment" | "activity"; data: any; timestamp: string }) => {
    if (item.type === "comment") {
      const c = item.data as PmComment;
      return <CommentBubble key={`c-${c.id}`} c={c} membersMap={membersMap} formatMentions={formatMentions} onOpenPreview={(data) => setPreviewModal(data)} onDelete={handleDeleteComment} />;
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

      <div
        className={`border-t border-border/30 pt-3 relative rounded-lg transition ${draggingOver ? "ring-2 ring-primary/50 bg-primary/5" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {draggingOver && (
          <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            <p className="text-sm text-primary font-medium">Solte o arquivo aqui</p>
          </div>
        )}
        {pendingFile && (
          <div className="mb-2 relative inline-block">
            {pendingFile.isImage && pendingFile.preview ? (
              <img src={pendingFile.preview} alt="Preview" className="rounded-lg max-h-32 max-w-[200px] object-cover border border-border/40" />
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 max-w-[260px]">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <span className="text-xs truncate text-foreground/80">{pendingFile.file.name}</span>
              </div>
            )}
            <button onClick={clearPendingFile} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
              <X className="h-3 w-3" />
            </button>
            <Input value={fileDescription} onChange={(e) => setFileDescription(e.target.value)} placeholder="Descrição (opcional)" className="mt-1.5 h-7 text-xs" />
          </div>
        )}

        {typingLoading && <LinkPreviewSkeleton />}
        {typingPreview && !typingLoading && extractUrl(content) && (
          <div className="mb-2">
            <LinkPreviewCard preview={typingPreview} url={extractUrl(content)!} onOpenPreview={(data) => setPreviewModal(data)} />
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
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          </div>
          <Button size="sm" onClick={handleSend} disabled={(!content.trim() && !pendingFile) || addComment.isPending || uploadAttachment.isPending} className="gap-1.5">
            <Send className="h-3 w-3" /> Enviar
          </Button>
        </div>
      </div>

      {/* Preview Modal */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewModal(null)}
        >
          <div className="relative max-w-lg w-full bg-card rounded-2xl border border-border/40 overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewModal(null)}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-card/90 border border-border/50 flex items-center justify-center hover:bg-muted transition shadow-md"
            >
              <X className="h-4 w-4" />
            </button>
            <img src={previewModal.image} alt={previewModal.title ?? "Preview"} className="w-full h-auto max-h-[60vh] object-contain bg-muted/20" />
            <div className="p-4 space-y-2">
              {previewModal.title && <h3 className="text-sm font-semibold text-foreground">{previewModal.title}</h3>}
              {previewModal.description && <p className="text-xs text-muted-foreground leading-relaxed">{previewModal.description}</p>}
              <Button
                size="sm"
                className="gap-1.5 mt-2"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = previewModal.url; a.target = "_blank"; a.rel = "noopener noreferrer";
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                }}
              >
                <ExternalLink className="h-3 w-3" />
                {previewModal.platform === "instagram" ? "Abrir no Instagram" : previewModal.platform === "youtube" ? "Abrir no YouTube" : "Abrir link"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
