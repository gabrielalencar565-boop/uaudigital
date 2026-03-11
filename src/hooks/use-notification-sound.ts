import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

/**
 * Plays a ClickUp-style notification pop sound using Web Audio API.
 * Bright, quick two-tone "pop-ding" sound.
 */
function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // --- Pop layer (percussive attack) ---
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = "sine";
    popOsc.frequency.setValueAtTime(1200, now);
    popOsc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
    popGain.gain.setValueAtTime(0.3, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(now);
    popOsc.stop(now + 0.1);

    // --- Ding layer (tonal body) ---
    const dingOsc = ctx.createOscillator();
    const dingGain = ctx.createGain();
    dingOsc.type = "sine";
    dingOsc.frequency.setValueAtTime(880, now + 0.03);
    dingGain.gain.setValueAtTime(0, now);
    dingGain.gain.linearRampToValueAtTime(0.2, now + 0.04);
    dingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    dingOsc.connect(dingGain);
    dingGain.connect(ctx.destination);
    dingOsc.start(now + 0.03);
    dingOsc.stop(now + 0.25);

    // --- Second ding (higher, delayed) ---
    const ding2Osc = ctx.createOscillator();
    const ding2Gain = ctx.createGain();
    ding2Osc.type = "sine";
    ding2Osc.frequency.setValueAtTime(1175, now + 0.1); // D6
    ding2Gain.gain.setValueAtTime(0, now + 0.1);
    ding2Gain.gain.linearRampToValueAtTime(0.15, now + 0.12);
    ding2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    ding2Osc.connect(ding2Gain);
    ding2Gain.connect(ctx.destination);
    ding2Osc.start(now + 0.1);
    ding2Osc.stop(now + 0.35);

    setTimeout(() => ctx.close(), 600);
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
