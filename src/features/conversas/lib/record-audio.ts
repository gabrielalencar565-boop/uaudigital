import { Mp3Encoder } from "@breezystack/lamejs";

export const MAX_AUDIO_SECONDS = 300;

export interface Recorder {
  /** Volume atual do microfone, de 0 a 1 (para desenhar as ondinhas enquanto grava). */
  level: () => number;
  /** Para a gravação e devolve o áudio já convertido para MP3 (o formato que o WhatsApp aceita em todos os navegadores). */
  finish: () => Promise<{ mp3: Blob; seconds: number }>;
  cancel: () => void;
}

const pickMime = () => ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));

export async function startRecording(): Promise<Recorder> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Este navegador não permite gravar áudio.");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).catch(() => {
    throw new Error("Permita o microfone no navegador para gravar o áudio.");
  });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const startedAt = Date.now();
  rec.start(250);
  // mede o volume para desenhar as ondinhas da gravação
  const meterCtx = new AudioContext();
  const analyser = meterCtx.createAnalyser();
  analyser.fftSize = 512;
  meterCtx.createMediaStreamSource(stream).connect(analyser);
  const wave = new Uint8Array(analyser.fftSize);
  const release = () => { stream.getTracks().forEach((t) => t.stop()); void meterCtx.close().catch(() => undefined); };

  return {
    level: () => {
      analyser.getByteTimeDomainData(wave);
      let peak = 0;
      for (let i = 0; i < wave.length; i++) peak = Math.max(peak, Math.abs(wave[i] - 128));
      return Math.min(1, (peak / 128) * 2.2);
    },
    cancel: () => { try { rec.stop(); } catch { /* já parado */ } release(); },
    finish: () => new Promise((resolve, reject) => {
      rec.onstop = async () => {
        release();
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
          resolve({ mp3: await toMp3(blob), seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) });
        } catch (e) { reject(e); }
      };
      try { rec.stop(); } catch (e) { release(); reject(e); }
    }),
  };
}

export async function toMp3(blob: Blob): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
    const rate = audio.sampleRate;
    const ch0 = audio.getChannelData(0);
    const samples = new Int16Array(ch0.length);
    for (let i = 0; i < ch0.length; i++) samples[i] = Math.max(-1, Math.min(1, ch0[i])) * 0x7fff;
    const enc = new Mp3Encoder(1, rate, 64);
    const parts: Uint8Array[] = [];
    for (let i = 0; i < samples.length; i += 1152) {
      const buf = enc.encodeBuffer(samples.subarray(i, i + 1152));
      if (buf.length) parts.push(buf);
    }
    const tail = enc.flush();
    if (tail.length) parts.push(tail);
    return new Blob(parts, { type: "audio/mpeg" });
  } finally {
    void ctx.close();
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
