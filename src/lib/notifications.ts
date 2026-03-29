/**
 * Core notification system — modular, scalable, Slack/ClickUp-style.
 *
 * Usage:
 *   import { triggerNotification, playNotificationSound } from "@/lib/notifications";
 *   triggerNotification("mention", "Você foi mencionado em uma tarefa");
 */

import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────
export type NotificationType =
  | "mention"
  | "task_assigned"
  | "task_overdue"
  | "task_due_soon";

export interface NotificationConfig {
  label: string;
  icon: string; // emoji fallback for toast
  /** Sonner class name for coloring */
  className: string;
  /** Default duration in ms */
  duration: number;
}

// ─── Config per type ──────────────────────────────────────────────────
export const NOTIFICATION_CONFIG: Record<NotificationType, NotificationConfig> = {
  mention: {
    label: "Menção",
    icon: "💬",
    className: "border-l-4 !border-l-primary",
    duration: 7000,
  },
  task_assigned: {
    label: "Tarefa atribuída",
    icon: "👤",
    className: "border-l-4 !border-l-blue-500",
    duration: 7000,
  },
  task_overdue: {
    label: "Tarefa atrasada",
    icon: "🔴",
    className: "border-l-4 !border-l-destructive",
    duration: 10000,
  },
  task_due_soon: {
    label: "Vence em breve",
    icon: "⏰",
    className: "border-l-4 !border-l-amber-500",
    duration: 8000,
  },
};

// ─── Sound engine ─────────────────────────────────────────────────────
const SOUND_DEBOUNCE_MS = 1000;
let lastSoundAt = 0;
let audioCtx: AudioContext | null = null;

/** Check if user has sound enabled (localStorage preference) */
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("uau:notif:sound") !== "false";
}

/** Toggle sound on/off */
export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem("uau:notif:sound", enabled ? "true" : "false");
}

/**
 * Play notification sound with debounce & overlap protection.
 * Uses Web Audio API — no external file needed.
 */
export function playNotificationSound() {
  if (!isSoundEnabled()) return;

  const now = Date.now();
  if (now - lastSoundAt < SOUND_DEBOUNCE_MS) return;
  lastSoundAt = now;

  try {
    // Reuse or create AudioContext
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContext();
    }

    // If suspended (browser policy), try to resume
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const ctx = audioCtx;
    const t = ctx.currentTime;

    // --- Two-tone chime (modern notification feel) ---
    // Tone 1: E6 (1318 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1318, t);
    osc1.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
    gain1.gain.setValueAtTime(0, t);
    gain1.gain.linearRampToValueAtTime(0.06, t + 0.01);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.25);

    // Tone 2: G6 (1568 Hz) — offset by 100ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1568, t + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(1400, t + 0.25);
    gain2.gain.setValueAtTime(0, t + 0.1);
    gain2.gain.linearRampToValueAtTime(0.05, t + 0.115);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.4);
  } catch {
    // Audio not available — silently ignore
  }
}

// ─── Toast trigger ────────────────────────────────────────────────────
/**
 * Main entry point — triggers a visual toast notification + sound.
 */
export function triggerNotification(
  type: NotificationType,
  message: string,
  options?: {
    description?: string;
    duration?: number;
    /** Skip sound for this notification */
    silent?: boolean;
  }
) {
  const cfg = NOTIFICATION_CONFIG[type];
  const duration = options?.duration ?? cfg.duration;

  if (!options?.silent) {
    playNotificationSound();
  }

  toast(message, {
    description: options?.description,
    duration,
    position: "top-right",
    className: cfg.className,
  });
}
