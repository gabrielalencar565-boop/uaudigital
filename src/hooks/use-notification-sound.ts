import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

type PendingToast = {
  key: string;
  title: string;
  description?: string;
  timestamp?: string;
};

const TOAST_DURATION_MS = 5000;
const MAX_PENDING = 20;

/**
 * Soft digital ping — UI notification sound.
 * ~200ms, gentle chime, low volume, non-intrusive.
 */
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Soft sine ping — E6 (1318 Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1318, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.2);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    setTimeout(() => ctx.close(), 400);
  } catch {
    // Audio not available
  }
}

/**
 * Realtime notifications with visibility-aware toast behavior:
 * - If tab is visible: shows immediately.
 * - If tab is hidden/background: queues and shows when user returns.
 * - Also checks missed mentions/assignments that happened while away.
 */
export function useNotificationSound() {
  const { user } = useSession();
  const userIdRef = useRef<string | null>(null);
  const pendingRef = useRef<PendingToast[]>([]);
  const shownKeysRef = useRef<Set<string>>(new Set());

  const isTabActive = useCallback(() => {
    if (typeof document === "undefined") return true;
    return document.visibilityState === "visible" && document.hasFocus();
  }, []);

  const showToast = useCallback((item: PendingToast) => {
    if (shownKeysRef.current.has(item.key)) return;
    shownKeysRef.current.add(item.key);

    playNotificationSound();
    toast(item.title, {
      description: item.description,
      duration: TOAST_DURATION_MS,
      position: "top-right",
    });
  }, []);

  const enqueueOrShow = useCallback((item: PendingToast) => {
    if (shownKeysRef.current.has(item.key)) return;

    if (isTabActive()) {
      showToast(item);
      return;
    }

    const alreadyQueued = pendingRef.current.some((p) => p.key === item.key);
    if (!alreadyQueued) {
      pendingRef.current.push(item);
      if (pendingRef.current.length > MAX_PENDING) {
        pendingRef.current = pendingRef.current.slice(-MAX_PENDING);
      }
    }
  }, [isTabActive, showToast]);

  const flushPending = useCallback(() => {
    if (!isTabActive() || pendingRef.current.length === 0) return;
    const queue = [...pendingRef.current].sort((a, b) =>
      new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime()
    );
    pendingRef.current = [];
    queue.forEach(showToast);
  }, [isTabActive, showToast]);

  const setLastSeen = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(`uau:notif:last-seen:${user.id}`, new Date().toISOString());
  }, [user?.id]);

  const fetchMissedWhileAway = useCallback(async () => {
    if (!user?.id) return;

    const key = `uau:notif:last-seen:${user.id}`;
    const since = localStorage.getItem(key);
    if (!since) return;

    const [mentionsRes, assignedRes] = await Promise.all([
      (supabase as any)
        .from("pm_comments")
        .select("id, content, created_at, author_id")
        .neq("author_id", user.id)
        .ilike("content", `%@${user.id}%`)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(20),
      (supabase as any)
        .from("pm_tasks")
        .select("id, title, created_by, assignee_id, updated_at")
        .eq("assignee_id", user.id)
        .neq("created_by", user.id)
        .gte("updated_at", since)
        .order("updated_at", { ascending: true })
        .limit(20),
    ]);

    const mentions = (mentionsRes.data ?? []).map((row: any) => ({
      key: `mention-${row.id}`,
      title: "Você foi mencionado",
      description: row.content?.substring(0, 80)?.replace(/@([a-f0-9-]{36})/gi, "@alguém") ?? "",
      timestamp: row.created_at,
    })) as PendingToast[];

    const assigned = (assignedRes.data ?? []).map((row: any) => ({
      key: `assigned-${row.id}-${row.updated_at ?? ""}`,
      title: "Tarefa atribuída a você",
      description: row.title ?? "Uma tarefa foi atribuída",
      timestamp: row.updated_at,
    })) as PendingToast[];

    [...mentions, ...assigned]
      .sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime())
      .forEach(enqueueOrShow);
  }, [enqueueOrShow, user?.id]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const key = `uau:notif:last-seen:${user.id}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, new Date().toISOString());
    }

    const handleVisibilityOrFocus = () => {
      if (!isTabActive()) return;
      void fetchMissedWhileAway().finally(() => {
        flushPending();
        setLastSeen();
      });
    };

    const handleHidden = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        setLastSeen();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleHidden);
    window.addEventListener("beforeunload", setLastSeen);

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleHidden);
      window.removeEventListener("beforeunload", setLastSeen);
    };
  }, [fetchMissedWhileAway, flushPending, isTabActive, setLastSeen, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`notification-sound-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pm_comments" },
        (payload) => {
          const uid = userIdRef.current;
          if (!uid) return;
          const row = payload.new as any;
          if (row.author_id === uid) return;

          if (row.content && row.content.includes(`@${uid}`)) {
            enqueueOrShow({
              key: `mention-${row.id}`,
              title: "Você foi mencionado",
              description: row.content?.substring(0, 80)?.replace(/@([a-f0-9-]{36})/gi, "@alguém") ?? "",
              timestamp: row.created_at,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pm_tasks" },
        (payload) => {
          const uid = userIdRef.current;
          if (!uid) return;
          const row = payload.new as any;
          if (row.created_by === uid) return;

          if (row.assignee_id === uid) {
            enqueueOrShow({
              key: `assigned-${row.id}-${row.updated_at ?? row.created_at ?? ""}`,
              title: "Nova tarefa atribuída a você",
              description: row.title ?? "Uma nova tarefa foi atribuída",
              timestamp: row.updated_at ?? row.created_at,
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pm_tasks" },
        (payload) => {
          const uid = userIdRef.current;
          if (!uid) return;
          const row = payload.new as any;
          const old = payload.old as any;

          if (row.assignee_id === uid && old.assignee_id !== uid) {
            enqueueOrShow({
              key: `assigned-${row.id}-${row.updated_at ?? ""}`,
              title: "Tarefa atribuída a você",
              description: row.title ?? "Uma tarefa foi atribuída",
              timestamp: row.updated_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enqueueOrShow, user?.id]);
}
