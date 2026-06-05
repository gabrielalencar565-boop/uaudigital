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
  task_id?: string;
};

// ── Module-scoped sender used by `broadcastTeamActivity` ────────────────
let sender: {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  channel: ReturnType<typeof supabase.channel> | null;
  subscribed: boolean;
  pending: ActivityPayload[];
} | null = null;

async function flushPending() {
  if (!sender || !sender.channel || !sender.subscribed) return;
  const queue = sender.pending.splice(0);
  for (const payload of queue) {
    try {
      await sender.channel.send({ type: "broadcast", event: "activity", payload });
    } catch {
      /* noop */
    }
  }
}

export async function broadcastTeamActivity(
  type: ActivityType,
  taskTitle: string,
  taskId?: string,
) {
  if (!sender || !sender.user_id) return;
  const payload: ActivityPayload = {
    type,
    user_id: sender.user_id,
    display_name: sender.display_name,
    avatar_url: sender.avatar_url,
    task_title: taskTitle,
    task_id: taskId,
  };
  // Also remember locally so the pg_changes fallback doesn't re-toast my own action
  if (taskId) markLocalCompletion(taskId);
  if (!sender.channel || !sender.subscribed) {
    sender.pending.push(payload);
    return;
  }
  try {
    await sender.channel.send({ type: "broadcast", event: "activity", payload });
  } catch {
    sender.pending.push(payload);
  }
}

// ── Local completion suppression (for the pg_changes fallback) ──────────
const recentlyCompletedByMe = new Map<string, number>();
const SELF_SUPPRESSION_MS = 12_000;

export function markLocalCompletion(taskId: string) {
  recentlyCompletedByMe.set(taskId, Date.now());
  setTimeout(() => recentlyCompletedByMe.delete(taskId), SELF_SUPPRESSION_MS);
}

function isRecentlyMine(taskId: string) {
  const at = recentlyCompletedByMe.get(taskId);
  if (!at) return false;
  return Date.now() - at < SELF_SUPPRESSION_MS;
}

// ── Visual config ──────────────────────────────────────────────────────
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

function renderToast(
  type: ActivityType,
  name: string,
  avatarUrl: string | null,
  taskTitle: string,
) {
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
          className: `flex items-start gap-3 rounded-2xl overflow-hidden border bg-background shadow-lg px-3 py-2.5 min-w-[280px] max-w-[360px] border-l-4 ${accentFor[type]}`,
          onClick: () => toast.dismiss(id),
          role: "button",
        },
        React.createElement(
          Avatar,
          { className: "h-9 w-9 shrink-0" },
          avatarUrl
            ? React.createElement(AvatarImage, { src: avatarUrl, alt: name })
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
            labelFor[type],
          ),
          React.createElement(
            "span",
            { className: "text-xs text-muted-foreground truncate", title: taskTitle },
            taskTitle || "—",
          ),
        ),
      ),
    { position: "bottom-right", duration: 4500, unstyled: true },
  );
}

/**
 * Subscribes to real-time team activity:
 *   1. Broadcast channel (fastest, carries display_name + avatar).
 *   2. Postgres changes on `pm_tasks` (UPDATE → status_global concluido).
 *      Acts as a guaranteed-delivery fallback in case the broadcast is
 *      missed by a client.
 *
 * Toasts are deduplicated per (taskId, ~4s window) so the same completion
 * never shows twice when both sources fire.
 */
export function useTeamActivity() {
  const { user } = useSession();
  const { data: profile } = useMyProfile();
  // Dedupe key: `${taskId}` or `${userId}|${title}` → last shown timestamp
  const lastShownRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user?.id) return;

    const sessionStart = Date.now() - 5_000;
    lastShownRef.current.clear();

    const maybeShow = (
      dedupeKey: string,
      type: ActivityType,
      name: string,
      avatarUrl: string | null,
      title: string,
    ) => {
      const prev = lastShownRef.current.get(dedupeKey);
      const now = Date.now();
      if (prev && now - prev < 6_000) return;
      lastShownRef.current.set(dedupeKey, now);
      renderToast(type, name, avatarUrl, title);
    };

    // ─── Broadcast channel ────────────────────────────────────────────
    const broadcastChannel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } },
    });

    sender = {
      user_id: user.id,
      display_name: profile?.full_name ?? user.email?.split("@")[0] ?? "Usuário",
      avatar_url: profile?.avatar_url ?? null,
      channel: broadcastChannel,
      subscribed: false,
      pending: [],
    };

    broadcastChannel
      .on("broadcast", { event: "activity" }, ({ payload }) => {
        const p = payload as ActivityPayload | undefined;
        if (!p) return;
        if (p.user_id === user.id) return;
        if (p.type !== "task_completed" && p.type !== "subtask_completed") return;
        const key = p.task_id ?? `${p.user_id}|${p.task_title}`;
        maybeShow(
          key,
          p.type,
          p.display_name?.trim() || "Alguém",
          p.avatar_url,
          p.task_title,
        );
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && sender) {
          sender.subscribed = true;
          void flushPending();
        }
      });

    // ─── Postgres changes fallback (guaranteed real-time delivery) ────
    const pgChannel = supabase
      .channel(`team-activity-pg-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pm_tasks" },
        async (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;
          if (!row || !old) return;
          if (row.status_global !== "concluido") return;
          if (old.status_global === "concluido") return;
          if (row.deleted_at) return;
          // Ignore stale events from before this session
          const ts = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
          if (ts < sessionStart) return;
          // Skip my own action (either as assignee or just-completed locally)
          if (row.id && isRecentlyMine(row.id)) return;
          if (row.assignee_id === user.id) return;

          // Resolve who completed (fallback to assignee_id)
          let name = "Alguém";
          let avatarUrl: string | null = null;
          if (row.assignee_id) {
            try {
              const { data: tm } = await supabase
                .from("team_members")
                .select("display_name, avatar_url")
                .eq("user_id", row.assignee_id)
                .maybeSingle();
              if (tm) {
                name = tm.display_name ?? name;
                avatarUrl = (tm as any).avatar_url ?? null;
              }
            } catch {
              /* ignore */
            }
          }

          const isSubtask = !!row.parent_task_id;
          const type: ActivityType = isSubtask ? "subtask_completed" : "task_completed";
          const dedupeKey = row.id ?? `${row.assignee_id}|${row.title}`;
          maybeShow(dedupeKey, type, name, avatarUrl, row.title ?? "Tarefa");
        },
      )
      .subscribe();

    return () => {
      sender = null;
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(pgChannel);
    };
  }, [user?.id, user?.email, profile?.full_name, profile?.avatar_url]);
}
