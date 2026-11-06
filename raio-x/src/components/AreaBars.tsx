import { AREAS, BANDS } from "@/data/raiox";
import { bandFor, type AreaScores } from "@/lib/scoring";

/** Cores das 4 faixas, do mais fraco ao mais forte. */
const BAND_COLORS = ["#3A2440", "#4A2C78", "#6230B0", "#7A35D6"];

export default function AreaBars({ scores }: { scores: AreaScores }) {
  return (
    <div>
      <ul className="mb-5 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs font-medium text-muted" aria-label="Legenda das faixas">
        {BANDS.map((b, i) => (
          <li key={b.id} className="flex items-center gap-2">
            <span className="h-2.5 w-4 rounded-sm" style={{ background: BAND_COLORS[i] }} aria-hidden="true" />
            {b.name} ({b.min}–{b.max})
          </li>
        ))}
      </ul>

      <ul className="flex flex-col gap-5">
        {AREAS.map((a) => {
          const score = scores[a.id];
          const band = bandFor(score);
          return (
            <li key={a.id}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="font-bold">
                  <span aria-hidden="true">{a.emoji}</span> {a.name}
                </span>
                <span className="text-sm text-muted">
                  <strong className="text-base font-extrabold text-white tabular-nums">{score}</strong> · {band.name}
                </span>
              </div>
              <div className="relative h-3" aria-hidden="true">
                <div className="flex h-full gap-[3px] overflow-hidden rounded-full">
                  {BANDS.map((b, i) => (
                    <span key={b.id} style={{ flexGrow: b.max - b.min + 1, background: BAND_COLORS[i] }} />
                  ))}
                </div>
                <span
                  className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-ink bg-amarelo"
                  style={{ left: `${Math.min(97, Math.max(3, score))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
