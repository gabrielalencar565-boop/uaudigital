import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useMyProfile } from "@/hooks/use-my-profile";

type PresenceMeta = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

const CHANNEL_NAME = "online-users";
// Suppress join toasts for users already announced in this session (or seen on initial sync)
const announcedRef = new Set<string>();

/**
 * Tracks online users globally via Supabase Realtime presence.
 * Shows a bottom-left toast whenever another user comes online.
 */
export function useOnlinePresence() {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const syncedOnceRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

    syncedOnceRef.current = false;

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        // On the first sync, treat everyone already present as "already announced"
        // so we don't spam toasts for users who were online before us.
        if (!syncedOnceRef.current) {
          const state = channel.presenceState() as Record<string, PresenceMeta[]>;
          Object.keys(state).forEach((key) => announcedRef.add(key));
          syncedOnceRef.current = true;
        }
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        if (!syncedOnceRef.current) return;
        if (key === user.id) return;
        if (announcedRef.has(key)) return;
        announcedRef.add(key);

        const meta = newPresences?.[0] as unknown as PresenceMeta | undefined;
        const name = meta?.display_name?.trim() || "Alguém";

        toast(`${name} entrou online`, {
          position: "bottom-left",
          duration: 4000,
          className: "border-l-4 !border-l-emerald-500",
        });
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        announcedRef.delete(key);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            display_name: profile?.full_name ?? user.email?.split("@")[0] ?? "Usuário",
            avatar_url: profile?.avatar_url ?? null,
          } satisfies PresenceMeta);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.full_name, profile?.avatar_url, user?.email]);
}
