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
  /** Id used for navigation when the toast is clicked (parent task for subtasks). */
  task_id?: string;
  /** Stable id used only for deduplication — defaults to task_id. For subtasks
   *  pass the subtask id so different subtasks of the same parent don't collide. */
  dedupe_id?: string;
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
  dedupeId?: string,
) {
  if (!sender || !sender.user_id) return;
  const payload: ActivityPayload = {
    type,
    user_id: sender.user_id,
    display_name: sender.display_name,
    avatar_url: sender.avatar_url,
    task_title: taskTitle,
    task_id: taskId,
    dedupe_id: dedupeId ?? taskId,
  };
  // Also remember locally so the pg_changes fallback doesn't re-toast my own action.
  // Use the subtask/dedupe id when present so the pg event for the subtask row is suppressed.
  const localKey = dedupeId ?? taskId;
  if (localKey) markLocalCompletion(localKey);
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
  taskId?: string,
) {
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
    h(
      "div",
      {
        className: "absolute -inset-[3px] rounded-full",
        style: {
          background: "linear-gradient(135deg, #A78BFA, #6366F1, #8B5CF6)",
          opacity: 0.9,
          animation: "spin 6s linear infinite",
        },
      },
    ),
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
  );

  const card = h(
    "div",
    {
      className: "relative group overflow-hidden w-full cursor-pointer",
      style: {
        borderRadius: 20,
        boxShadow:
          "0 8px 32px -8px rgba(124,58,237,0.35), 0 0 0 1px rgba(139,92,246,0.20), inset 0 0 0 1px rgba(255,255,255,0.08)",
      },
      onClick: taskId
        ? () =>
            window.dispatchEvent(
              new CustomEvent("uau:open-task", { detail: { taskId } }),
            )
        : undefined,
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
        "div",
        { className: "min-w-0 flex flex-col leading-tight" },
        h(
          "div",
          { className: "flex items-center gap-1" },
          h(
            "span",
            {
              className: "truncate text-sm font-semibold text-white drop-shadow-sm",
            },
            name,
          ),
          h(
            "span",
            {
              className: "truncate text-sm font-semibold text-emerald-400 drop-shadow-sm",
            },
            labelFor[type],
          ),
        ),
        taskTitle
          ? h(
              "span",
              { className: "truncate text-xs text-white/75 mt-0.5" },
              taskTitle,
            )
          : null,
      ),
    ),
  );

  toast.custom(() => card, { duration: 4500, unstyled: true, classNames: { toast: "!bg-transparent !border-0 !shadow-none !p-0 w-full" } });
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
      taskId?: string,
    ) => {
      const prev = lastShownRef.current.get(dedupeKey);
      const now = Date.now();
      if (prev && now - prev < 6_000) return;
      lastShownRef.current.set(dedupeKey, now);
      renderToast(type, name, avatarUrl, title, taskId);
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
        const key = p.dedupe_id ?? p.task_id ?? `${p.user_id}|${p.task_title}`;
        maybeShow(
          key,
          p.type,
          p.display_name?.trim() || "Alguém",
          p.avatar_url,
          p.task_title,
          p.task_id,
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
          // Não notifica subtarefas concluídas — só a tarefa pai gera toast
          // para o time. Isso evita poluição quando muitas subtarefas são
          // marcadas em sequência.
          if (isSubtask) return;
          const type: ActivityType = "task_completed";
          const dedupeKey = row.id ?? `${row.assignee_id}|${row.title}`;
          maybeShow(dedupeKey, type, name, avatarUrl, row.title ?? "Tarefa", row.id);
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
