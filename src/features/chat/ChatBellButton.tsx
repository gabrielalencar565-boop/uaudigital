import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { TeamStatusPanel } from "./ChatPanel";
import { useChatPresence } from "./hooks/useChatPresence";
import { useTeamMembers } from "./hooks/useTeamMembers";
import { useSession } from "@/hooks/use-session";

export function ChatBellButton() {
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const { data: presence } = useChatPresence();
  const { data: members } = useTeamMembers();

  const onlineCount = useMemo(() => {
    if (!members) return 0;
    return members.filter((m) => m.user_id !== user?.id && presence?.[m.user_id]?.is_online).length;
  }, [members, presence, user?.id]);

  // Legacy event: some flows still dispatch `uau:open-chat` to open the panel.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("uau:open-chat", handler);
    return () => window.removeEventListener("uau:open-chat", handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-accent/50"
        aria-label="Status da equipe"
        title="Status da equipe"
      >
        <Users className="h-[18px] w-[18px]" />
        {onlineCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-green-500 px-1 text-[10px] font-semibold text-white ring-2 ring-background">
            {onlineCount > 99 ? "99+" : onlineCount}
          </span>
        )}
      </button>
      <TeamStatusPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
