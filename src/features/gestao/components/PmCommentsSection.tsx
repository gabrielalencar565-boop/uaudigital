import { useState, useRef, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAddPmComment, usePmActivityLog } from "../hooks/use-pm-data";
import { stageLabel } from "../pm-constants";
import type { PmComment } from "../pm-types";

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
  const addComment = useAddPmComment();
  const activityLogQ = usePmActivityLog(taskId);
  const activityLog = activityLogQ.data ?? [];

  // Merge comments and activity log into unified timeline
  const timeline = useMemo(() => {
    const items: Array<{ type: "comment" | "activity"; data: any; timestamp: string }> = [];

    comments.forEach(c => {
      items.push({ type: "comment", data: c, timestamp: c.created_at });
    });

    // Filter activity log to not duplicate comment entries
    activityLog.forEach(a => {
      if (a.action === "comment_added") return; // Already shown as comment
      items.push({ type: "activity", data: a, timestamp: a.created_at });
    });

    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return items;
  }, [comments, activityLog]);

  const handleSend = async () => {
    if (!content.trim()) return;
    const storageContent = contentToStorage(content.trim());
    await addComment.mutateAsync({
      task_id: taskId,
      content: storageContent,
    });
    setContent("");
    setMentionMap({});
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "@" || (content.endsWith("@") && e.key !== "Backspace")) {
      // Will be handled by onChange
    }
  };

  const handleContentChange = (val: string) => {
    setContent(val);
    // Check for @ mentions
    const lastAtIdx = val.lastIndexOf("@");
    if (lastAtIdx >= 0) {
      const textAfterAt = val.slice(lastAtIdx + 1);
      // If there's no space after @, show mention picker
      if (!textAfterAt.includes(" ") && textAfterAt.length < 30) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  // Map to track display names for hidden UUIDs
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

  /** Convert display @Name back to @UUID for storage */
  const contentToStorage = (text: string): string => {
    let result = text;
    for (const [name, id] of Object.entries(mentionMap)) {
      result = result.split(`@${name}`).join(`@${id}`);
    }
    return result;
  };

  /** Replace @userId with @Name for display */
  const formatMentions = (text: string) => {
    return text.replace(/@([a-f0-9-]{36})/gi, (_, id) => {
      const m = membersMap[id];
      return m ? `@${m.name}` : "@alguém";
    });
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(mentionSearch)
  );

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-1 space-y-3 min-h-0 overflow-y-auto">
        {timeline.map((item, idx) => {
          if (item.type === "comment") {
            const c = item.data as PmComment;
            const member = membersMap[c.author_id];
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
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground/90 leading-relaxed">{formatMentions(c.content)}</p>
                </div>
              </div>
            );
          } else {
            // Activity log entry
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
        })}
        {timeline.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade ainda.</p>
        )}
      </div>

      <div className="border-t border-border/30 pt-3 relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Escreva um comentário... Use @ para mencionar"
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
        <div className="flex justify-end mt-2">
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!content.trim() || addComment.isPending}
            className="gap-1.5"
          >
            <Send className="h-3 w-3" /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
