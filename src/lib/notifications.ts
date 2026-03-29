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

let notifAudio: HTMLAudioElement | null = null;

/**
 * Play notification sound with debounce & overlap protection.
 * Uses the custom notification.mp3 file.
 */
export function playNotificationSound() {
  if (!isSoundEnabled()) return;

  const now = Date.now();
  if (now - lastSoundAt < SOUND_DEBOUNCE_MS) return;
  lastSoundAt = now;

  try {
    if (!notifAudio) {
      notifAudio = new Audio("/sounds/notification.mp3");
      notifAudio.volume = 0.5;
    }
    // Reset and replay if already playing
    notifAudio.currentTime = 0;
    notifAudio.play().catch(() => {});
  } catch {
    // Audio not available
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
