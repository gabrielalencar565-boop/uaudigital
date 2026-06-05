import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useMyProfile } from "@/hooks/use-my-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import React from "react";

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
        const avatarUrl = meta?.avatar_url ?? null;
        const initials = name
          .split(/\s+/)
          .map((p) => p[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();

        toast.custom(
          (id) =>
            React.createElement(
              "div",
              {
                className:
                  "flex items-center gap-3 rounded-2xl overflow-hidden border bg-background shadow-lg px-3 py-2.5 min-w-[260px] border-l-4 border-l-emerald-500",
                onClick: () => toast.dismiss(id),
                role: "button",
              },
              React.createElement(
                "div",
                { className: "relative" },
                React.createElement(
                  Avatar,
                  { className: "h-9 w-9" },
                  avatarUrl
                    ? React.createElement(AvatarImage, { src: avatarUrl, alt: name })
                    : null,
                  React.createElement(AvatarFallback, { className: "text-xs" }, initials || "?")
                ),
                React.createElement("span", {
                  className:
                    "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background",
                })
              ),
              React.createElement(
                "div",
                { className: "flex flex-col leading-tight" },
                React.createElement("span", { className: "text-sm font-medium text-foreground" }, name),
                React.createElement(
                  "span",
                  { className: "text-xs text-muted-foreground" },
                  "entrou online"
                )
              )
            ),
          {
            position: "bottom-right",
            duration: 4000,
          }
        );
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
