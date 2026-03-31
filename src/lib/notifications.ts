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

// ─── Trash sound (macOS-style crumple) ────────────────────────────────
/**
 * Synthesises a short "paper crumple" sound reminiscent of the macOS trash.
 * Uses Web Audio API — no external file needed.
 */
export function playTrashSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const duration = 0.45;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // White-noise burst shaped by a fast-decay envelope
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 12) * 0.6;
      // Add a second softer "bounce" for the macOS feel
      const bounce = Math.exp(-(t - 0.12) * 18) * 0.25 * (t > 0.1 ? 1 : 0);
      data[i] = (Math.random() * 2 - 1) * (envelope + bounce);
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    // Band-pass filter to sound less harsh
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.5;

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    src.onended = () => ctx.close();
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
    dismissible: true,
  });
}
