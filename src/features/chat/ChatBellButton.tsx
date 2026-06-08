import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTotalUnread } from "./hooks/useChatUnread";
import { ChatPanel } from "./ChatPanel";

export function ChatBellButton() {
  const [open, setOpen] = useState(false);
  const total = useTotalUnread();
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
      <ChatPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
