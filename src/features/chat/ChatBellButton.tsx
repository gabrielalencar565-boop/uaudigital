import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTotalUnread } from "./hooks/useChatUnread";
import { useChatNotifier } from "./hooks/useChatNotifier";
import { usePresenceNotifier } from "./hooks/usePresenceNotifier";
import { getOrCreateDirect } from "./chat-api";
import { ChatPanel } from "./ChatPanel";

export function ChatBellButton() {
  const [open, setOpen] = useState(false);
  const [initialConv, setInitialConv] = useState<string | null>(null);
  const total = useTotalUnread();

  useChatNotifier((conversationId) => {
    setInitialConv(conversationId);
    setOpen(true);
  });

  usePresenceNotifier(async (userId) => {
    const convId = await getOrCreateDirect(userId);
    if (convId) setInitialConv(convId);
    setOpen(true);
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { conversationId?: string } | undefined;
      if (detail?.conversationId) setInitialConv(detail.conversationId);
      setOpen(true);
    };
    window.addEventListener("uau:open-chat", handler);
    return () => window.removeEventListener("uau:open-chat", handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-accent/50"
        aria-label="Abrir chat"
      >
        <MessageCircle className="h-[18px] w-[18px]" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>
      <ChatPanel open={open} onOpenChange={setOpen} initialConversationId={initialConv} />
    </>
  );
}
