import { useEffect, useRef } from "react";
import React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useMyProfile } from "@/hooks/use-my-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const CHANNEL_NAME = "team-activity";

type ActivityType = "task_opened" | "task_completed" | "subtask_completed";

type ActivityPayload = {
  type: ActivityType;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  task_title: string;
};

/** Module-scoped sender used by `broadcastTeamActivity`. */
let sender: {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  channel: ReturnType<typeof supabase.channel> | null;
} | null = null;

export async function broadcastTeamActivity(type: ActivityType, taskTitle: string) {
  if (!sender || !sender.channel || !sender.user_id) return;
  try {
    await sender.channel.send({
      type: "broadcast",
      event: "activity",
      payload: {
        type,
        user_id: sender.user_id,
        display_name: sender.display_name,
        avatar_url: sender.avatar_url,
        task_title: taskTitle,
      } satisfies ActivityPayload,
    });
  } catch {
    /* noop */
  }
}

const labelFor: Record<ActivityType, string> = {
  task_opened: "abriu a tarefa",
  task_completed: "concluiu a tarefa",
  subtask_completed: "concluiu a subtarefa",
};

const accentFor: Record<ActivityType, string> = {
  task_opened: "border-l-sky-500",
  task_completed: "border-l-emerald-500",
  subtask_completed: "border-l-emerald-500",
};

/**
 * Subscribes to the global team-activity broadcast channel and shows a
 * bottom-right toast with avatar whenever a co-worker opens or completes
 * a task / subtask.
 */
export function useTeamActivity() {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  const lastByUserRef = useRef<Map<string, { type: ActivityType; title: string; at: number }>>(
    new Map(),
  );

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    sender = {
      user_id: user.id,
      display_name: profile?.full_name ?? user.email?.split("@")[0] ?? "Usuário",
      avatar_url: profile?.avatar_url ?? null,
      channel,
    };

    channel
      .on("broadcast", { event: "activity" }, ({ payload }) => {
        const p = payload as ActivityPayload | undefined;
        if (!p) return;
        if (p.user_id === user.id) return;
        // Only show notifications for completion events
        if (p.type !== "task_completed" && p.type !== "subtask_completed") return;

        // Dedupe: same user + same type + same title within 4s
        const key = p.user_id;
        const prev = lastByUserRef.current.get(key);
        const now = Date.now();
        if (prev && prev.type === p.type && prev.title === p.task_title && now - prev.at < 4000) {
          return;
        }
        lastByUserRef.current.set(key, { type: p.type, title: p.task_title, at: now });



        const name = p.display_name?.trim() || "Alguém";
        const initials = name
          .split(/\s+/)
          .map((part) => part[0])
          .filter(Boolean)
          .slice(0, 2)
          .join("")
          .toUpperCase();

        toast.custom(
          (id) =>
            React.createElement(
              "div",
              {
                className: `flex items-start gap-3 rounded-2xl overflow-hidden border bg-background shadow-lg px-3 py-2.5 min-w-[280px] max-w-[360px] border-l-4 ${accentFor[p.type]}`,
                onClick: () => toast.dismiss(id),
                role: "button",
              },
              React.createElement(
                Avatar,
                { className: "h-9 w-9 shrink-0" },
                p.avatar_url
                  ? React.createElement(AvatarImage, { src: p.avatar_url, alt: name })
                  : null,
                React.createElement(AvatarFallback, { className: "text-xs" }, initials || "?"),
              ),
              React.createElement(
                "div",
                { className: "flex flex-col leading-tight min-w-0" },
                React.createElement(
                  "span",
                  { className: "text-sm text-foreground" },
                  React.createElement("span", { className: "font-semibold" }, name),
                  " ",
                  labelFor[p.type],
                ),
                React.createElement(
                  "span",
                  {
                    className: "text-xs text-muted-foreground truncate",
                    title: p.task_title,
                  },
                  p.task_title || "—",
                ),
              ),
            ),
          { position: "bottom-right", duration: 4500 },
        );
      })
      .subscribe();

    return () => {
      sender = null;
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.email, profile?.full_name, profile?.avatar_url]);
}
