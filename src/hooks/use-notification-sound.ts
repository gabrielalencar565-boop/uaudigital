import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

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
    gain.gain.linearRampToValueAtTime(0.08, now + 0.015);  // soft attack
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
            toast("Você foi mencionado", {
              description: row.content?.substring(0, 80)?.replace(/@([a-f0-9-]{36})/gi, "@alguém") ?? "",
              duration: 5000,
              position: "top-right",
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
          // Don't notify for tasks created by self
          if (row.created_by === uid) return;
          // Notify if assigned to this user
          if (row.assignee_id === uid) {
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
