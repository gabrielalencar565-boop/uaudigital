import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { clock } from "../lib/record-audio";

const BARS = 44;
const RATES = [1, 1.5, 2];

/** Ondinhas de enfeite (sempre as mesmas para a mesma mensagem), usadas enquanto o desenho real do áudio não carrega. */
function fakePeaks(seed: string): number[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return 0.22 + 0.78 * Math.abs(Math.sin(i / 3.1 + r * 3)) * (0.55 + 0.45 * r);
  });
}

/** Desenho real do áudio: o volume de cada pedacinho. Se o navegador não conseguir ler o arquivo, fica o desenho de enfeite. */
async function realPeaks(src: string): Promise<number[] | null> {
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const ctx = new AudioContext();
    try {
      const audio = await ctx.decodeAudioData(await res.arrayBuffer());
      const data = audio.getChannelData(0);
      const size = Math.max(1, Math.floor(data.length / BARS));
      const peaks = Array.from({ length: BARS }, (_, i) => {
        let max = 0;
        for (let j = i * size; j < Math.min(data.length, (i + 1) * size); j += 8) max = Math.max(max, Math.abs(data[j]));
        return max;
      });
      const top = Math.max(...peaks, 0.001);
      return peaks.map((p) => Math.max(0.12, p / top));
    } finally {
      void ctx.close();
    }
  } catch {
    return null;
  }
}

/** Mensagem de voz no estilo do WhatsApp: play, ondas com a bolinha de progresso (dá para clicar e arrastar), tempo e velocidade. */
export function AudioBubble({ src, seed, seconds }: { src: string; seed: string; seconds?: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const wave = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(seconds ?? 0);
  const [rate, setRate] = useState(1);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const bars = useMemo(() => peaks ?? fakePeaks(seed), [peaks, seed]);

  useEffect(() => {
    let dead = false;
    void realPeaks(src).then((p) => { if (!dead && p) setPeaks(p); });
    return () => { dead = true; };
  }, [src]);

  const progress = duration > 0 ? Math.min(1, time / duration) : 0;
  const toggle = () => { const a = audio.current; if (!a) return; if (a.paused) void a.play(); else a.pause(); };
  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };
  const seek = (clientX: number) => {
    const a = audio.current, box = wave.current;
    if (!a || !box || !duration) return;
    const r = box.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    a.currentTime = ratio * duration;
    setTime(a.currentTime);
  };

  return (
    <div className="flex min-w-[240px] max-w-full items-center gap-2.5 py-0.5">
      <button type="button" onClick={toggle} aria-label={playing ? "Pausar áudio" : "Ouvir áudio"} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/15 transition hover:bg-black/25">
        {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 translate-x-px" fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          ref={wave}
          className="relative flex h-7 cursor-pointer touch-none items-center gap-[2px]"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e.clientX); }}
          onPointerMove={(e) => { if (e.buttons) seek(e.clientX); }}
        >
          {bars.map((v, i) => (
            <span key={i} className={cn("w-[3px] flex-1 rounded-full bg-current transition-opacity", (i + 0.5) / BARS <= progress ? "opacity-100" : "opacity-40")} style={{ height: `${Math.max(14, Math.round(v * 100))}%` }} />
          ))}
          <span className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-400 shadow" style={{ left: `${progress * 100}%` }} />
        </div>
        <span className="text-[11px] tabular-nums opacity-70">{clock(Math.round(playing || time > 0 ? time : duration))}</span>
      </div>
      <button type="button" onClick={cycleRate} aria-label="Velocidade do áudio" className="shrink-0 rounded-full bg-black/15 px-2 py-1 text-xs font-medium tabular-nums transition hover:bg-black/25">{rate === 1.5 ? "1,5" : rate}x</button>
      <audio
        ref={audio}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setDuration(d); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setTime(0); if (audio.current) audio.current.currentTime = 0; }}
      />
    </div>
  );
}
