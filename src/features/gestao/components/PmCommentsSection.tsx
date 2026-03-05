import { useState } from "react";
import { format } from "date-fns";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAddPmComment } from "../hooks/use-pm-data";
import type { PmComment } from "../pm-types";

function initials(n: string) { return n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join(""); }

interface Props {
  taskId?: string;
  subtaskId?: string;
  comments: PmComment[];
  membersMap: Record<string, { name: string; avatar?: string }>;
}

export function PmCommentsSection({ taskId, subtaskId, comments, membersMap }: Props) {
  const [content, setContent] = useState("");
  const addComment = useAddPmComment();

  const handleSend = async () => {
    if (!content.trim()) return;
    await addComment.mutateAsync({
      task_id: taskId,
      subtask_id: subtaskId,
      content: content.trim(),
    });
    setContent("");
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex-1 space-y-4 min-h-0">
        {comments.map((c) => {
          const member = membersMap[c.author_id];
          return (
            <div key={c.id} className="flex gap-2.5">
              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                <AvatarImage src={member?.avatar} />
                <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials(member?.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">{member?.name ?? "Usuário"}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "dd 'de' MMM 'às' HH:mm")}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-foreground/90 leading-relaxed">{c.content}</p>
              </div>
            </div>
          );
        })}
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
        )}
      </div>

      <div className="border-t border-border/30 pt-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva um comentário..."
          className="min-h-[60px] text-sm resize-none"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
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
