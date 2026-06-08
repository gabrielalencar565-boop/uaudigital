import { useMemo, useState } from "react";
import { Pin, Reply, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { AttachmentView } from "./AttachmentView";
import { deleteChatMessage, togglePin } from "../chat-api";
import type { ChatMessage, TeamMemberLite } from "../types";


interface Props {
  message: ChatMessage;
  isOwn: boolean;
  isAdmin: boolean;
  isGeneral: boolean;
  sender?: TeamMemberLite;
  replyTo?: ChatMessage | null;
  onReply: () => void;
  showAvatar: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message, isOwn, isAdmin, isGeneral, sender, replyTo, onReply, showAvatar }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const initials = useMemo(() => {
    const n = sender?.display_name ?? "?";
    return n.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
  }, [sender]);

  const canModerate = isOwn || (isAdmin && isGeneral);


  return (
    <div className={cn("group flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
      <div className="w-8 shrink-0">
        {showAvatar && !isOwn && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={sender?.avatar_url ?? undefined} />
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
        )}
      </div>
      <div className={cn("flex flex-col max-w-[75%]", isOwn ? "items-end" : "items-start")}>
        {showAvatar && !isOwn && (
          <div className="text-[11px] font-medium text-muted-foreground mb-0.5 px-1">
            {sender?.display_name ?? "Usuário"}
          </div>
        )}
        <div
          className={cn(
            "relative rounded-2xl px-3 py-2 text-sm break-words",
            isOwn
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-muted text-foreground rounded-tl-sm",
            message.is_pinned && "ring-2 ring-amber-400/60"
          )}
        >
          {replyTo && (
            <div
              className={cn(
                "mb-1 rounded-md border-l-2 px-2 py-1 text-[11px] opacity-80",
                isOwn ? "border-primary-foreground/50 bg-primary-foreground/10" : "border-primary/60 bg-background/60"
              )}
            >
              <div className="font-semibold truncate">Respondendo</div>
              <div className="truncate">{replyTo.is_deleted ? "(mensagem removida)" : replyTo.content}</div>
            </div>
          )}
          {message.is_deleted ? (
            <span className="italic opacity-60">Mensagem removida</span>
          ) : (
            <>
              {message.content && (
                <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
              )}
              {message.attachments.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {message.attachments.map((a) => (
                    <AttachmentView key={a.id} att={a} />
                  ))}
                </div>
              )}
            </>
          )}
          <div className={cn("mt-1 text-[10px] flex items-center gap-1", isOwn ? "justify-end opacity-80" : "opacity-60")}>
            {message.is_pinned && <Pin className="h-2.5 w-2.5" />}
            {formatTime(message.created_at)}
            {message.edited_at && <span className="italic">(editada)</span>}
          </div>
        </div>
        {!message.is_deleted && (
          <div
            className={cn(
              "mt-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition",
              isOwn ? "flex-row-reverse" : "flex-row"
            )}
          >
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onReply} title="Responder">
              <Reply className="h-3.5 w-3.5" />
            </Button>
            {isAdmin && isGeneral && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                title={message.is_pinned ? "Desfixar" : "Fixar"}
                onClick={() => togglePin(message.id, !message.is_pinned).then(() => {}, () => {})}
              >
                <Pin className="h-3.5 w-3.5" />
              </Button>
            )}
            {canModerate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive"
                title="Remover"
                onClick={() => {
                  if (confirm("Remover esta mensagem?")) {
                    deleteChatMessage(message.id).then(() => {}, () => {});
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
