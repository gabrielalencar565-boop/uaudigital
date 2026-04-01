import { useState, useRef, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send, ChevronDown, ChevronUp, ImagePlus, X, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAddPmComment, useUploadPmAttachment, usePmActivityLog } from "../hooks/use-pm-data";
import { stageLabel } from "../pm-constants";
import type { PmComment } from "../pm-types";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function initials(n: string) { return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join(""); }

function formatActionText(action: string, metadata: any, membersMap: Record<string, { name: string; avatar?: string }>): string {
  switch (action) {
    case "created":
      if (metadata?.parent_task_id) {
        return `criou a subtarefa: ${metadata.title ?? ""}`;
      }
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
    case "comment_added":
      return `comentou`;
    case "file_added":
      return `adicionou anexo: ${metadata?.file_name ?? "arquivo"}`;
    default:
      return action;
  }
}

/** Extract first URL from text */
function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/i);
  return match ? match[0] : null;
}

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

  // Image attachment state
  const [pendingImage, setPendingImage] = useState<{ file: File; preview: string } | null>(null);
  const [imageDescription, setImageDescription] = useState("");

  // Merge comments and activity log into unified timeline, deduplicating
  const timeline = useMemo(() => {
    const items: Array<{ type: "comment" | "activity"; data: any; timestamp: string }> = [];

    comments.forEach(c => {
      items.push({ type: "comment", data: c, timestamp: c.created_at });
    });

    // Filter activity log: skip comment_added (shown as comments) and deduplicate by action+metadata
    const seen = new Set<string>();
    activityLog.forEach(a => {
      if (a.action === "comment_added") return;
      // Create dedup key from action + metadata JSON + created_by + rounded timestamp (within 2s)
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
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 50MB)");
      return;
    }
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

    // Upload image if present
    if (pendingImage) {
      try {
        const att = await uploadAttachment.mutateAsync({ task_id: taskId, file: pendingImage.file });
        imageUrl = att.public_url;
      } catch {
        toast.error("Erro ao enviar imagem");
        return;
      }
    }

    // Extract link from content
    const linkUrl = extractUrl(content.trim());

    const storageContent = contentToStorage(content.trim());
    await addComment.mutateAsync({
      task_id: taskId,
      content: storageContent || (pendingImage ? (imageDescription || "Imagem anexada") : ""),
      image_url: imageUrl ?? undefined,
      image_description: imageDescription || undefined,
      link_url: linkUrl ?? undefined,
    });
    setContent("");
    setMentionMap({});
    clearPendingImage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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

  const [mentionMap, setMentionMap] = useState<Record<string, string>>({});

  const insertMention = (memberId: string, name: string) => {
    const lastAtIdx = content.lastIndexOf("@");
    if (lastAtIdx >= 0) {
      const before = content.slice(0, lastAtIdx);
      const displayTag = `@${name}`;
      setContent(`${before}${displayTag} `);
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

  const formatMentions = (text: string) => {
    return text.replace(/@([a-f0-9-]{36})/gi, (_, id) => {
      const m = membersMap[id];
      return m ? `@${m.name}` : "@alguém";
    });
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(mentionSearch)
  );

  const [expanded, setExpanded] = useState(false);

  /** Render a link preview card */
  const renderLinkPreview = (url: string, title?: string | null, image?: string | null) => {
    const displayUrl = url.replace(/^https?:\/\//, "").split("/")[0];
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block rounded-lg border border-border/50 bg-card/60 overflow-hidden hover:bg-accent/30 transition group"
      >
        {image && (
          <div className="w-full max-h-48 overflow-hidden">
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="px-3 py-2">
          {title && <p className="text-xs font-medium truncate">{title}</p>}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{displayUrl}</span>
          </div>
        </div>
      </a>
    );
  };

  const renderTimelineItem = (item: { type: "comment" | "activity"; data: any; timestamp: string }) => {
    if (item.type === "comment") {
      const c = item.data as PmComment;
      const member = membersMap[c.author_id];
      const hasLink = c.link_url;
      return (
        <div key={`c-${c.id}`} className="flex gap-2.5">
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
            {hasLink && renderLinkPreview(c.link_url!, c.link_title, c.link_image)}
          </div>
        </div>
      );
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
      <div className="flex-1 space-y-3 min-h-0 overflow-y-auto">
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
        {/* Pending image preview */}
        {pendingImage && (
          <div className="mb-2 relative inline-block">
            <img
              src={pendingImage.preview}
              alt="Preview"
              className="rounded-lg max-h-32 max-w-[200px] object-cover border border-border/40"
            />
            <button
              onClick={clearPendingImage}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
            <Input
              value={imageDescription}
              onChange={(e) => setImageDescription(e.target.value)}
              placeholder="Descrição da imagem (opcional)"
              className="mt-1.5 h-7 text-xs"
            />
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
        {/* @ mention dropdown */}
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
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              onClick={() => imageInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
            </Button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={(!content.trim() && !pendingImage) || addComment.isPending || uploadAttachment.isPending}
            className="gap-1.5"
          >
            <Send className="h-3 w-3" /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
