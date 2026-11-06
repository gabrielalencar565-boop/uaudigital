import { AREAS } from "@/data/raiox";
import type { AreaScores } from "@/lib/scoring";
import { radarPoint, radarPolygon } from "@/lib/radar";

const W = 380;
const H = 300;
const CX = W / 2;
const CY = H / 2 + 4;
const R = 84;
const RINGS = [25, 50, 75, 100];

export default function RadarChart({ scores }: { scores: AreaScores }) {
  const values = AREAS.map((a) => scores[a.id]);
  const n = values.length;
  const toPath = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
  const shape = radarPolygon(values, CX, CY, R);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="radar-title radar-desc">
        <title id="radar-title">Gráfico radar das 6 áreas</title>
        <desc id="radar-desc">{AREAS.map((a) => `${a.name}: ${scores[a.id]}`).join(", ")}</desc>

        {RINGS.map((ring) => (
          <path key={ring} d={toPath(radarPolygon(Array(n).fill(ring), CX, CY, R))} fill="none" stroke="#24212C" strokeWidth={1.5} />
        ))}
        {AREAS.map((a, i) => {
          const p = radarPoint(i, n, 100, CX, CY, R);
          return <line key={a.id} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#24212C" strokeWidth={1.5} />;
        })}

        <path d={toPath(shape)} fill="rgba(122,53,214,0.5)" stroke="#7A35D6" strokeWidth={2.5} strokeLinejoin="round" />
        {shape.map((p, i) => (
          <circle key={AREAS[i].id} cx={p.x} cy={p.y} r={4} fill="#FFD23F" />
        ))}

        {AREAS.map((a, i) => {
          const p = radarPoint(i, n, 100, CX, CY, R + 18);
          const cos = Math.cos(p.angle);
          const anchor = Math.abs(cos) < 0.1 ? "middle" : cos > 0 ? "start" : "end";
          const sin = Math.sin(p.angle);
          const dy = sin < -0.9 ? -10 : sin > 0.9 ? 14 : 0;
          return (
            <text key={a.id} x={p.x} y={p.y + dy} textAnchor={anchor} fill="#FFFFFF" fontSize={13} fontWeight={700} fontFamily="inherit">
              <tspan>{a.shortName}</tspan>
              <tspan x={p.x} dy={15} fill="#A9A3B4" fontWeight={500}>
                {scores[a.id]}
              </tspan>
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
