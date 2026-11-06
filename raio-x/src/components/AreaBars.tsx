import { BANDS } from "@/data/raiox";

/** Cores das 4 faixas, do mais fraco ao mais forte. */
export const BAND_COLORS = ["#3A3542", "#7B2FE0", "#C9307A", "#F2A04A"];

export function BandLegend() {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-medium text-dim" aria-label="Legenda das faixas">
      {BANDS.map((b, i) => (
        <li key={b.id} className="flex items-center gap-2">
          <span className="h-2.5 w-4 shrink-0 rounded-sm" style={{ background: BAND_COLORS[i] }} aria-hidden="true" />
          {b.name} ({b.min}–{b.max})
        </li>
      ))}
    </ul>
  );
}

/** Barra com as 4 faixas e um marcador na posição da nota. */
export function BandBar({ score }: { score: number }) {
  return (
    <div className="relative h-3" aria-hidden="true">
      <div className="flex h-full gap-[3px] overflow-hidden rounded-full">
        {BANDS.map((b, i) => (
          <span key={b.id} style={{ flexGrow: b.max - b.min + 1, background: BAND_COLORS[i] }} />
        ))}
      </div>
      <span
        className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-bg2 bg-fg shadow-[0_0_0_1px_rgba(255,255,255,0.15)]"
        style={{ left: `${Math.min(97, Math.max(3, score))}%` }}
      />
    </div>
  );
}
