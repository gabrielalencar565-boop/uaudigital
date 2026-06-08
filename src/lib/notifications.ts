/**
 * Core notification system — modular, scalable, Slack/ClickUp-style.
 *
 * Sons configuráveis por categoria ("chat" / "task") via localStorage.
 * Usage:
 *   import { triggerNotification, playChatSound } from "@/lib/notifications";
 */

import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────
export type NotificationType =
  | "mention"
  | "task_assigned"
  | "task_overdue"
  | "task_due_soon";

export type SoundCategory = "chat" | "task";

export interface NotificationConfig {
  label: string;
  icon: string;
  className: string;
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

// ─── Global on/off (legado, kill switch) ──────────────────────────────
export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("uau:notif:sound") !== "false";
}
export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem("uau:notif:sound", enabled ? "true" : "false");
}

// ─── Categoria de som (chat / task) ───────────────────────────────────
const SOUND_STORAGE_PREFIX = "uau:notif:sound:";
const VOLUME_STORAGE_KEY = "uau:notif:volume";
const DEFAULT_SOUND_BY_CATEGORY: Record<SoundCategory, string> = {
  chat: "pulse",
  task: "chime",
};


export function getCategorySound(category: SoundCategory): string {
  if (typeof window === "undefined") return DEFAULT_SOUND_BY_CATEGORY[category];
  return (
    localStorage.getItem(SOUND_STORAGE_PREFIX + category) ??
    DEFAULT_SOUND_BY_CATEGORY[category]
  );
}
export function setCategorySound(category: SoundCategory, soundId: string) {
  localStorage.setItem(SOUND_STORAGE_PREFIX + category, soundId);
}

// ─── Volume global (0..1) ─────────────────────────────────────────────
export function getNotificationVolume(): number {
  if (typeof window === "undefined") return 1;
  const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
  if (raw === null) return 1;
  const n = parseFloat(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}
export function setNotificationVolume(v: number) {
  const clamped = Math.max(0, Math.min(1, v));
  localStorage.setItem(VOLUME_STORAGE_KEY, String(clamped));
}

// ─── Engine: sons sintetizados (Web Audio) + arquivo ──────────────────
let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(opts: {
  freq: number;
  duration?: number;
  type?: OscillatorType;
  volume?: number;
  attack?: number;
  decay?: number;
  endFreq?: number;
}) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const { freq, duration = 0.18, type = "sine", volume = 0.25, attack = 0.005, decay = 0.12, endFreq } = opts;
  const vol = volume * getNotificationVolume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const now = ctx.currentTime;
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
  }
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

function noiseBurst(opts: {
  duration?: number;
  volume?: number;
  filterType?: BiquadFilterType;
  filterFreq?: number;
  filterQ?: number;
  decay?: number;
}) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const { duration = 0.18, volume = 0.25, filterType = "bandpass", filterFreq = 2000, filterQ = 1, decay = 0.15 } = opts;
  const vol = volume * getNotificationVolume();
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  filter.Q.value = filterQ;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(now);
  src.stop(now + duration);
}


let notifAudio: HTMLAudioElement | null = null;
function playDefaultMp3() {
  try {
    if (!notifAudio) {
      notifAudio = new Audio("/sounds/notification.mp3");
      notifAudio.volume = 0.5;
    }
    notifAudio.currentTime = 0;
    notifAudio.play().catch(() => {});
  } catch {}
}

// Catálogo de sons disponíveis
export interface SoundOption {
  id: string;
  label: string;
  play: () => void;
}

export const NOTIFICATION_SOUNDS: SoundOption[] = [
  { id: "default", label: "Padrão", play: playDefaultMp3 },
  {
    id: "ping",
    label: "Ping",
    play: () => tone({ freq: 880, duration: 0.22, type: "sine", volume: 0.28, decay: 0.18 }),
  },
  {
    id: "pop",
    label: "Pop",
    play: () => tone({ freq: 520, duration: 0.1, type: "triangle", volume: 0.3, decay: 0.08 }),
  },
  {
    id: "chime",
    label: "Sino duplo",
    play: () => {
      tone({ freq: 659.25, duration: 0.25, type: "sine", volume: 0.25, decay: 0.22 });
      setTimeout(
        () => tone({ freq: 783.99, duration: 0.35, type: "sine", volume: 0.25, decay: 0.3 }),
        120
      );
    },
  },
  {
    id: "bell",
    label: "Sino",
    play: () => {
      tone({ freq: 1320, duration: 0.6, type: "sine", volume: 0.18, decay: 0.55 });
      tone({ freq: 1980, duration: 0.6, type: "sine", volume: 0.08, decay: 0.5 });
    },
  },
  {
    id: "soft",
    label: "Suave",
    play: () => tone({ freq: 440, duration: 0.35, type: "sine", volume: 0.16, decay: 0.32 }),
  },
  {
    id: "whistle",
    label: "Assobio",
    play: () =>
      tone({ freq: 700, endFreq: 1200, duration: 0.28, type: "sine", volume: 0.22, decay: 0.26 }),
  },
  {
    id: "blip",
    label: "Blip retrô",
    play: () => tone({ freq: 660, duration: 0.09, type: "square", volume: 0.18, decay: 0.08 }),
  },
  {
    id: "knock",
    label: "Batida",
    play: () => {
      tone({ freq: 180, duration: 0.1, type: "sine", volume: 0.35, decay: 0.08 });
      setTimeout(
        () => tone({ freq: 180, duration: 0.1, type: "sine", volume: 0.3, decay: 0.08 }),
        110
      );
    },
  },
  {
    id: "drop",
    label: "Gota",
    play: () =>
      tone({ freq: 1500, endFreq: 600, duration: 0.22, type: "sine", volume: 0.22, decay: 0.2 }),
  },
  {
    id: "coin",
    label: "Moeda",
    play: () => {
      tone({ freq: 523.25, duration: 0.07, type: "square", volume: 0.18, decay: 0.06 });
      setTimeout(
        () => tone({ freq: 1318.51, duration: 0.18, type: "square", volume: 0.18, decay: 0.16 }),
        70
      );
    },
  },
  {
    id: "pulse",
    label: "Pulso",
    play: () =>
      tone({ freq: 330, duration: 0.35, type: "triangle", volume: 0.22, attack: 0.05, decay: 0.3 }),
  },
  {
    id: "tap",
    label: "Toque",
    play: () =>
      noiseBurst({ duration: 0.08, volume: 0.35, filterType: "bandpass", filterFreq: 2500, filterQ: 1.5, decay: 0.07 }),
  },
  {
    id: "swoosh",
    label: "Swoosh",
    play: () =>
      noiseBurst({ duration: 0.3, volume: 0.18, filterType: "highpass", filterFreq: 1200, filterQ: 0.7, decay: 0.28 }),
  },
];


function findSound(id: string): SoundOption | undefined {
  return NOTIFICATION_SOUNDS.find((s) => s.id === id);
}

// Debounce por categoria
const SOUND_DEBOUNCE_MS = 800;
const lastPlayedAt: Record<SoundCategory, number> = { chat: 0, task: 0 };

export function playCategorySound(category: SoundCategory) {
  if (!isSoundEnabled()) return;
  const id = getCategorySound(category);
  if (id === "off") return;
  const now = Date.now();
  if (now - lastPlayedAt[category] < SOUND_DEBOUNCE_MS) return;
  lastPlayedAt[category] = now;
  const s = findSound(id) ?? findSound("default");
  s?.play();
}

// Compat / atalhos
export function playNotificationSound() {
  playCategorySound("task");
}
export function playChatSound() {
  playCategorySound("chat");
}

// ─── Trash sound (mantido) ────────────────────────────────────────────
export function playTrashSound() {
  if (!isSoundEnabled()) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const duration = 0.45;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 12) * 0.6;
      const bounce = Math.exp(-(t - 0.12) * 18) * 0.25 * (t > 0.1 ? 1 : 0);
      data[i] = (Math.random() * 2 - 1) * (envelope + bounce);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    src.onended = () => ctx.close();
  } catch {}
}

// ─── Toast trigger ────────────────────────────────────────────────────
export function triggerNotification(
  type: NotificationType,
  message: string,
  options?: {
    description?: string;
    duration?: number;
    silent?: boolean;
  }
) {
  const cfg = NOTIFICATION_CONFIG[type];
  const duration = options?.duration ?? cfg.duration;

  if (!options?.silent) {
    playCategorySound("task");
  }

  toast(message, {
    description: options?.description,
    duration,
    position: "top-right",
    className: cfg.className,
    dismissible: true,
  });
}
