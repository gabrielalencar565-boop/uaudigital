import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, ChevronUp, ChevronDown, ChevronRight, Paperclip, ArrowRight, UserRound, Eye, CalendarDays, CheckCircle2, Plus, Pencil, Flag, Ban, Wrench, ListPlus, Activity, X, ExternalLink, Play, Instagram, Youtube, Globe, Link2, Maximize2, FileText, Download, MoreHorizontal, Trash2, Copy, ClipboardCopy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAddPmComment, useUploadPmAttachment, usePmActivityLog } from "../hooks/use-pm-data";
import { useQueryClient } from "@tanstack/react-query";
import { stageLabel, statusLabel, PM_STAGES } from "../pm-constants";
import { buildActivityEvents, dayLabel, type EventKind, type TimelineEvent } from "../lib/activity-timeline";
import type { PmComment } from "../pm-types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LinkChip } from "@/components/LinkChip";

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

/** Splits text on URLs, rendering each as the same dark link chip used across the app. */
function renderTextWithLinks(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/i);
  return parts.map((part, i) =>
    /^https?:\/\//i.test(part) ? <LinkChip key={i} url={part} className="mx-0.5" /> : <span key={i}>{part}</span>
  );
}

/* ── Activity events (what changed, in plain words) ── */
const EVENT_ICON: Record<EventKind, React.ComponentType<{ className?: string }>> = {
  created: Plus, watchers: Eye, edit: Pencil, stage: ArrowRight, sent: Send, assignee: UserRound, date: CalendarDays, done: CheckCircle2,
  cancel: Ban, file: Paperclip, revision: Pencil, extra: Flag, status: Activity, fix: Wrench, subtask: ListPlus,
};
const EVENT_TONE: Partial<Record<EventKind, string>> = {
  done: "text-emerald-500", stage: "text-primary", sent: "text-primary", cancel: "text-destructive", fix: "text-amber-500",
};

function ActivityEventCard({ ev, actorName, connectNext }: { ev: TimelineEvent; actorName: string; connectNext: boolean }) {
  const Icon = EVENT_ICON[ev.lines[0].kind];
  const tone = EVENT_TONE[ev.lines[0].kind] ?? "text-muted-foreground";
  // the task's own changes first, then one block per subtask (or group of subtasks) with what changed in it
  const groups: Array<{ subject: string | null; lines: typeof ev.lines }> = [];
  for (const l of ev.lines) {
    const key = l.subject ?? null;
    const found = groups.find((g) => g.subject === key);
    if (found) found.lines.push(l); else groups.push({ subject: key, lines: [l] });
  }
  groups.sort((a, b) => (a.subject === null ? -1 : 0) - (b.subject === null ? -1 : 0));
  const hasSubtaskGroups = groups.some((g) => g.subject !== null);
  return (
    <div className="relative pl-7">
      {connectNext && <span className="absolute left-[9px] top-5 -bottom-2.5 w-px bg-border/40" />}
      <span className="absolute left-0 top-0.5 flex h-[19px] w-[19px] items-center justify-center rounded-full bg-muted/50">
        <Icon className={`h-2.5 w-2.5 ${tone}`} />
      </span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] font-medium text-foreground/90">{actorName}</span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">{format(new Date(ev.at), "HH:mm")}</span>
      </div>
      <div className="mt-1 space-y-1.5">
        {groups.map((g) => (
          <div key={g.subject ?? "__task"} className={hasSubtaskGroups ? "border-l border-border/50 pl-2.5" : ""}>
            {g.subject && <p className="text-[12px] font-medium leading-snug text-foreground/80 break-words">{g.subject}</p>}
            {!g.subject && hasSubtaskGroups && <p className="text-[12px] font-medium leading-snug text-foreground/80">Esta tarefa</p>}
            {g.lines.map((l, i) => (
              <p key={i} className="text-[12px] leading-snug text-muted-foreground break-words">{l.text}</p>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
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
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground/90 leading-relaxed">{renderTextWithLinks(displayContent)}</p>
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
  /** this task was generated from a previous stage (it has an origin task) */
  derived?: boolean;
  /** when and by whom the task was created, to start the history of tasks whose log never recorded it */
  created?: { at: string; by: string | null };
}

export function PmCommentsSection({ taskId, comments, membersMap, members = [], derived = false, created }: Props) {
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
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "comments" | "history">("all");
  const bottomRef = useRef<HTMLDivElement>(null);
  // Only the newest day starts open; the person's own folding/unfolding (by calendar date) wins over that default
  const [foldOverride, setFoldOverride] = useState<Record<string, boolean>>({});
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

  const events = useMemo(
    () => buildActivityEvents(activityLog, {
      taskId,
      stageName: stageLabel,
      statusName: statusLabel,
      memberName: (id) => membersMap[id]?.name ?? null,
      stageIndex: (k) => PM_STAGES.findIndex((st) => st.key === k),
      derived,
      created,
    }),
    [activityLog, taskId, membersMap, derived, created?.at, created?.by],
  );

  // one chronological stream: comments and changes together, oldest first, so the newest sits next to the box that writes the next one
  const stream = useMemo(() => {
    const items: Array<{ type: "comment" | "event"; at: string; comment?: PmComment; event?: TimelineEvent }> = [];
    if (filter !== "history") comments.forEach((c) => items.push({ type: "comment", at: c.created_at, comment: c }));
    if (filter !== "comments") events.forEach((ev) => items.push({ type: "event", at: ev.at, event: ev }));
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return items;
  }, [comments, events, filter]);

  const VISIBLE = 14;
  const hidden = !showAll && stream.length > VISIBLE ? stream.length - VISIBLE : 0;
  const shown = hidden > 0 ? stream.slice(-VISIBLE) : stream;
  const dayGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: typeof stream }> = [];
    for (const item of shown) {
      const key = format(new Date(item.at), "yyyy-MM-dd");
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(item);
      else groups.push({ key, label: dayLabel(item.at), items: [item] });
    }
    return groups;
  }, [shown]);

  // keep the newest entry in view when the feed opens or grows
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [stream.length, showAll, filter]);

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

  const sendingRef = useRef(false);
  const handleSend = async () => {
    if (!content.trim() && !pendingFile) return;
    if (sendingRef.current || addComment.isPending || uploadAttachment.isPending) return;
    sendingRef.current = true;

    try {
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
    } finally {
      sendingRef.current = false;
    }
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

  const renderStreamItem = (item: (typeof stream)[number], connectNext: boolean) => {
    if (item.type === "comment" && item.comment) {
      const c = item.comment;
      return <CommentBubble key={`c-${c.id}`} c={c} membersMap={membersMap} formatMentions={formatMentions} onOpenPreview={(data) => setPreviewModal(data)} onDelete={handleDeleteComment} />;
    }
    const ev = item.event!;
    return <ActivityEventCard key={`e-${ev.id}`} ev={ev} actorName={ev.actorId ? membersMap[ev.actorId]?.name ?? "Alguém da equipe" : "Sistema"} connectNext={connectNext} />;
  };

  const counts = { all: comments.length + events.length, comments: comments.length, history: events.length };
  const FILTERS: Array<{ key: "all" | "comments" | "history"; label: string }> = [
    { key: "all", label: "Tudo" },
    { key: "comments", label: "Comentários" },
    { key: "history", label: "Histórico" },
  ];

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-4 border-b border-border/30" role="tablist" aria-label="Filtrar atividade">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => { setFilter(f.key); setShowAll(false); }}
            className={`-mb-px border-b pb-1.5 text-[11px] transition ${filter === f.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {f.label} <span className="ml-0.5 text-[10px] opacity-50">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-3 min-h-0 overflow-y-auto overflow-x-hidden pt-1">
        {stream.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">
            {filter === "comments" ? "Nenhum comentário ainda." : filter === "history" ? "Nenhuma mudança registrada ainda." : "Nenhuma atividade ainda."}
          </p>
        )}
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
          >
            <ChevronUp className="h-3.5 w-3.5" /> Ver {hidden} anterior{hidden > 1 ? "es" : ""}
          </button>
        )}
        {dayGroups.map((g, gi) => {
          const folded = foldOverride[g.key] ?? gi < dayGroups.length - 1;
          const nComments = g.items.filter((x) => x.type === "comment").length;
          const nChanges = g.items.length - nComments;
          const summary = [
            nComments > 0 ? `${nComments} comentário${nComments > 1 ? "s" : ""}` : null,
            nChanges > 0 ? `${nChanges} mudança${nChanges > 1 ? "s" : ""}` : null,
          ].filter(Boolean).join(" · ");
          return (
            <section key={g.key} className="space-y-3">
              <button
                type="button"
                onClick={() => setFoldOverride((prev) => ({ ...prev, [g.key]: !folded }))}
                aria-expanded={!folded}
                className={
                  folded
                    ? "group flex w-full items-center gap-2 rounded-lg bg-muted/30 px-2.5 py-2 text-left transition hover:bg-muted/50"
                    : "group flex w-full items-center gap-1.5 pt-2 text-left"
                }
              >
                {folded ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/60" />}
                <span className={`text-[10px] font-medium uppercase tracking-[0.12em] ${folded ? "text-foreground/80" : "text-muted-foreground/70 group-hover:text-foreground"}`}>{g.label}</span>
                {folded ? (
                  <span className="ml-auto flex items-center gap-2">
                    <span className="hidden text-[10px] text-muted-foreground sm:inline">{summary}</span>
                    <span className="min-w-[22px] rounded-full bg-primary/15 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-primary">{g.items.length}</span>
                  </span>
                ) : (
                  <>
                    <span className="text-[10px] text-muted-foreground/50">{g.items.length}</span>
                    <span className="h-px flex-1 bg-border/30" />
                  </>
                )}
              </button>
              {!folded && g.items.map((item, idx) => (
                <div key={`${item.type}-${item.comment?.id ?? item.event?.id}`}>
                  {renderStreamItem(item, item.type === "event" && g.items[idx + 1]?.type === "event")}
                </div>
              ))}
            </section>
          );
        })}
        <div ref={bottomRef} />
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
