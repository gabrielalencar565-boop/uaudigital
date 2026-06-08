import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import { useChatMessages } from "../hooks/useChatMessages";
import { useTypingIndicator } from "../hooks/useTypingIndicator";
import { useTeamMembers } from "../hooks/useTeamMembers";
import { markConversationRead } from "../chat-api";
import type { ChatMessage } from "../types";

interface Props {
  conversationId: string | null;
  currentUserId: string;
  isAdmin: boolean;
  isGeneral: boolean;
  headerSlot?: React.ReactNode;
}

export function ChatThread({ conversationId, currentUserId, isAdmin, isGeneral, headerSlot }: Props) {
  const { data: messages, isLoading } = useChatMessages(conversationId);
  const { data: members } = useTeamMembers();
  const { typingUsers, notifyTyping } = useTypingIndicator(conversationId);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const memberMap = useMemo(() => {
    const m = new Map<string, any>();
    (members ?? []).forEach((mb) => m.set(mb.user_id, mb));
    return m;
  }, [members]);

  // Mark as read & scroll bottom on changes
  useEffect(() => {
    if (!conversationId) return;
    markConversationRead(conversationId);
  }, [conversationId, messages?.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length, conversationId]);

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Selecione uma conversa
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {headerSlot}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages && messages.length > 0 ? (
          messages.map((m, idx) => {
            const prev = messages[idx - 1];
            const showAvatar = !prev || prev.sender_id !== m.sender_id;
            const replyMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) ?? null : null;
            return (
              <MessageBubble
                key={m.id}
                message={m}
                isOwn={m.sender_id === currentUserId}
                isAdmin={isAdmin}
                isGeneral={isGeneral}
                sender={memberMap.get(m.sender_id)}
                replyTo={replyMsg}
                onReply={() => setReplyTo(m)}
                showAvatar={showAvatar}
              />
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Seja o primeiro a enviar uma mensagem 💬
          </div>
        )}
        {typingUsers.length > 0 && (
          <div className="text-xs text-muted-foreground italic px-2">
            {typingUsers.map((u) => memberMap.get(u)?.display_name ?? "Alguém").join(", ")} digitando…
          </div>
        )}
      </div>
      <MessageComposer
        conversationId={conversationId}
        senderId={currentUserId}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        typingHook={notifyTyping}
      />
    </div>
  );
}
