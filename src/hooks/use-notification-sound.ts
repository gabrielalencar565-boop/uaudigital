import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

/**
 * Plays a short notification chime using Web Audio API.
 */
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Two-tone chime
    [660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.15, now + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.3);
    });

    // Clean up context after sound finishes
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Audio not available (e.g. SSR or blocked by browser)
  }
}

/**
 * Listens to realtime changes on pm_comments and pm_tasks.
 * Plays a notification sound when the current user is:
 * - Mentioned in a comment (@userId)
 * - Assigned to a task (assignee_id changed to them)
 */
export function useNotificationSound() {
  const { user } = useSession();
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("notification-sound")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pm_comments" },
        (payload) => {
          const uid = userIdRef.current;
          if (!uid) return;
          const row = payload.new as any;
          // Don't notify for own comments
          if (row.author_id === uid) return;
          // Check if content mentions the current user
          if (row.content && row.content.includes(`@${uid}`)) {
            playNotificationSound();
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
          // Don't notify for tasks created by self
          if (row.created_by === uid) return;
          // Notify if assigned to this user
          if (row.assignee_id === uid) {
            playNotificationSound();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pm_tasks" },
        (payload) => {
          const uid = userIdRef.current;
          if (!uid) return;
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          // Notify when assignee changes TO this user
          if (newRow.assignee_id === uid && oldRow.assignee_id !== uid) {
            playNotificationSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
