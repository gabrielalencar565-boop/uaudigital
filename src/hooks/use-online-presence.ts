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

        const h = React.createElement;

        const avatarNode = h(
          "div",
          { className: "relative shrink-0" },
          h("div", {
            className: "absolute -inset-[3px] rounded-full",
            style: {
              background: "linear-gradient(135deg, #A78BFA, #6366F1, #8B5CF6)",
              opacity: 0.9,
              animation: "spin 6s linear infinite",
            },
          }),
          h(
            Avatar,
            { className: "relative h-10 w-10 ring-2 ring-white/20" },
            avatarUrl ? h(AvatarImage, { src: avatarUrl, alt: name }) : null,
            h(
              AvatarFallback,
              { className: "bg-white/15 text-white font-bold text-xs" },
              initials || "?",
            ),
          ),
          h("span", {
            className:
              "absolute bottom-0 right-0 z-10 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-[#4C1D95] translate-x-[2px] translate-y-[2px]",
          }),
        );

        const card = h(
          "div",
          {
            className: "relative group overflow-hidden w-full",
            style: {
              borderRadius: 20,
              boxShadow:
                "0 8px 32px -8px rgba(124,58,237,0.35), 0 0 0 1px rgba(139,92,246,0.20), inset 0 0 0 1px rgba(255,255,255,0.08)",
            },
          },
          h("div", {
            className: "absolute -inset-8 opacity-90",
            style: {
              background:
                "linear-gradient(135deg, #4C1D95 0%, #6D28D9 25%, #7C3AED 50%, #5B21B6 75%, #4C1D95 100%)",
              backgroundSize: "300% 300%",
              animation: "gradientFlow 14s ease-in-out infinite",
            },
          }),
          h("div", {
            className: "absolute -inset-12 opacity-60",
            style: {
              background:
                "radial-gradient(ellipse 70% 60% at 25% 35%, #8B5CF6 0%, transparent 70%), radial-gradient(ellipse 55% 65% at 75% 65%, #5B21B6 0%, transparent 65%)",
              animation: "parallaxLayer2 12s ease-in-out infinite",
            },
          }),
          h("div", {
            className: "absolute -inset-16 opacity-50",
            style: {
              background:
                "radial-gradient(circle 280px at 20% 70%, #7C3AED 0%, transparent 60%), radial-gradient(circle 220px at 80% 25%, #6D28D9 0%, transparent 55%)",
              filter: "blur(30px)",
              animation: "parallaxLayer3 9s ease-in-out infinite",
            },
          }),
          h("div", {
            className: "absolute inset-0 opacity-[0.07]",
            style: {
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              animation: "gridDrift 22s linear infinite",
            },
          }),
          h("div", {
            className: "absolute inset-0 pointer-events-none",
            style: {
              borderRadius: 20,
              boxShadow:
                "inset 0 0 0 1.5px rgba(167,139,250,0.3), 0 0 20px 0 rgba(124,58,237,0.08)",
            },
          }),
          h(
            "div",
            { className: "relative z-10 flex items-center gap-3 p-4" },
            avatarNode,
            h(
              "span",
              { className: "text-sm text-white drop-shadow-sm" },
              h("strong", { className: "font-semibold" }, name),
              h("span", { className: "text-white/80" }, " tá on!"),
            ),
          ),
        );

        toast.custom(() => card, { duration: 4000 });

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
