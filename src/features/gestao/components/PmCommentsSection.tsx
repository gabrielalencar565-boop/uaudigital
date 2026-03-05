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
  taskId: string;
  comments: PmComment[];
  membersMap: Record<string, { name: string; avatar?: string }>;
}

export function PmCommentsSection({ taskId, comments, membersMap }: Props) {
  const [content, setContent] = useState("");
  const addComment = useAddPmComment();

  const handleSend = async () => {
    if (!content.trim()) return;
    await addComment.mutateAsync({ task_id: taskId, content: content.trim() });
    setContent("");
  };

  return (
    <div className="space-y-3">
      <span className="text-sm font-medium">Comentários ({comments.length})</span>

      <div className="max-h-60 space-y-3 overflow-y-auto">
        {comments.map((c) => {
          const member = membersMap[c.author_id];
          return (
            <div key={c.id} className="flex gap-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={member?.avatar} />
                <AvatarFallback className="text-[9px]">{initials(member?.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">{member?.name ?? "Usuário"}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "dd/MM HH:mm")}</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground/90">{c.content}</p>
              </div>
            </div>
          );
        })}
        {comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>}
      </div>

      <div className="flex items-end gap-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva um comentário..."
          className="min-h-[60px] text-sm"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <Button size="icon" variant="ghost" onClick={handleSend} disabled={!content.trim() || addComment.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
