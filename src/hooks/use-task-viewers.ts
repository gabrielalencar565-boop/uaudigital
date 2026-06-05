import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useMyProfile } from "@/hooks/use-my-profile";

export type TaskViewer = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
};

/**
 * Global Supabase Realtime Presence channel that tracks which task each
 * online user currently has open. Used by the Agenda to show an "eye" icon
 * on tasks that a co-worker is viewing.
 */
const CHANNEL_NAME = "task-viewers";

// ─── Module-level store ────────────────────────────────────────────────
let viewersByTask = new Map<string, TaskViewer[]>();
const listeners = new Set<() => void>();
const EMPTY: TaskViewer[] = [];

function emit() {
  listeners.forEach((l) => l());
}

// ─── Channel + sender ──────────────────────────────────────────────────
let channel: ReturnType<typeof supabase.channel> | null = null;
let currentTaskId: string | null = null;
let me: { user_id: string; display_name: string; avatar_url: string | null } | null = null;
let subscribed = false;

async function pushPresence() {
  if (!channel || !me || !subscribed) return;
  try {
    await channel.track({
      user_id: me.user_id,
      display_name: me.display_name,
      avatar_url: me.avatar_url,
      task_id: currentTaskId,
      at: Date.now(),
    });
  } catch {
    /* noop */
  }
}

/** Call when this user opens/closes a task. Pass null when closing. */
export function setViewingTask(taskId: string | null) {
  if (currentTaskId === taskId) return;
  currentTaskId = taskId;
  void pushPresence();
}

// ─── Public hooks ──────────────────────────────────────────────────────

/** Mount once at the app shell. Subscribes to the presence channel. */
export function useTaskViewersPresence() {
  const { user } = useSession();
  const { data: profile } = useMyProfile();

  useEffect(() => {
    if (!user?.id) return;

    me = {
      user_id: user.id,
      display_name: profile?.full_name ?? user.email?.split("@")[0] ?? "Usuário",
      avatar_url: profile?.avatar_url ?? null,
    };

    const ch = supabase.channel(CHANNEL_NAME, {
      config: { presence: { key: user.id } },
    });
    channel = ch;
    subscribed = false;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<
        string,
        Array<{ user_id: string; display_name: string; avatar_url: string | null; task_id: string | null }>
      >;
      const next = new Map<string, TaskViewer[]>();
      for (const arr of Object.values(state)) {
        // most recent meta per user
        const meta = arr[arr.length - 1];
        if (!meta || !meta.task_id) continue;
        if (meta.user_id === user.id) continue; // don't show self
        const list = next.get(meta.task_id) ?? [];
        if (!list.some((v) => v.user_id === meta.user_id)) {
          list.push({
            user_id: meta.user_id,
            display_name: meta.display_name,
            avatar_url: meta.avatar_url,
          });
        }
        next.set(meta.task_id, list);
      }
      viewersByTask = next;
      emit();
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        subscribed = true;
        await pushPresence();
      }
    });

    return () => {
      subscribed = false;
      channel = null;
      supabase.removeChannel(ch);
      viewersByTask = new Map();
      emit();
    };
  }, [user?.id, user?.email, profile?.full_name, profile?.avatar_url]);
}

/** Returns the full task → viewers map. Re-renders on any change. */
export function useAllTaskViewers(): Map<string, TaskViewer[]> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => viewersByTask,
    () => viewersByTask,
  );
}

/** Returns viewers (other users) for a single task. */
export function useTaskViewers(taskId: string | undefined): TaskViewer[] {
  const map = useAllTaskViewers();
  if (!taskId) return EMPTY;
  return map.get(taskId) ?? EMPTY;
}
