import { useEffect, useId, useMemo, useState } from "react";
import { Expand, Minimize2 } from "lucide-react";

import { BRAND_GRADIENT_STOPS } from "@/lib/brand-gradient";
import { cn } from "@/lib/utils";
import { BRAZIL_STATE_PATHS, BRAZIL_VIEWBOX, isInsideBrazil, projectBrazil } from "../lib/brazil-map";
import { toPercentList } from "../lib/report-metrics";

const FULL_VIEW = { x: 0, y: 0, w: BRAZIL_VIEWBOX.width, h: BRAZIL_VIEWBOX.height };
const ASPECT = 1.25;
const MIN_SPAN = 70;

type CityPoint = { label: string; name: string; state: string; pct: number; value: number; x: number; y: number };

const shortName = (label: string) => label.split(",")[0].trim();

// Zooms to where the audience actually lives: the bounding box of the cities that add up to ~90% of the
// mapped followers (outliers like one follower in another state would otherwise zoom the map all the way out).
function focusView(points: CityPoint[]) {
  const sorted = [...points].sort((a, b) => b.pct - a.pct);
  const total = sorted.reduce((acc, p) => acc + p.pct, 0);
  const focus: CityPoint[] = [];
  let acc = 0;
  for (const p of sorted) {
    focus.push(p);
    acc += p.pct;
    if (acc / total >= 0.9 && focus.length >= 3) break;
  }
  const xs = focus.map((p) => p.x);
  const ys = focus.map((p) => p.y);
  const pad = 14;
  let w = Math.max(MIN_SPAN, Math.max(...xs) - Math.min(...xs) + pad * 2);
  let h = Math.max(MIN_SPAN / ASPECT, Math.max(...ys) - Math.min(...ys) + pad * 2);
  if (w / h > ASPECT) h = w / ASPECT;
  else w = h * ASPECT;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function AudienceMap({ cities, geo }: { cities: Record<string, number> | null | undefined; geo: Record<string, [number, number]> | null | undefined }) {
  const gradId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const list = useMemo(() => toPercentList(cities), [cities]);
  const points = useMemo<CityPoint[]>(
    () =>
      list.flatMap((c) => {
        const g = geo?.[c.label];
        if (!g || !isInsideBrazil(g[0], g[1])) return [];
        const { x, y } = projectBrazil(g[0], g[1]);
        const [name, state = ""] = c.label.split(",").map((p) => p.trim());
        return [{ label: c.label, name, state, pct: c.pct, value: c.value, x, y }];
      }),
    [list, geo],
  );

  const [zoomed, setZoomed] = useState(true);
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = pinned ?? hover;
  useEffect(() => {
    if (!pinned) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest("[data-map-city]")) setPinned(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [pinned]);

  if (list.length === 0) return <p className="text-sm text-muted-foreground">A distribuição por cidade ainda não está disponível para este perfil.</p>;

  const view = zoomed && points.length > 0 ? focusView(points) : FULL_VIEW;
  const scale = view.w / BRAZIL_VIEWBOX.width;
  const maxPct = Math.max(...points.map((p) => p.pct), 1);
  const radius = (pct: number) => (3.2 + Math.sqrt(pct / maxPct) * 9) * Math.max(0.55, Math.min(1.4, scale * 1.15));
  const ranking = list.slice(0, 8);
  const activePoint = points.find((p) => p.label === active) ?? null;
  const activeEntry = list.find((c) => c.label === active) ?? null;
  const labeled = new Set([...points].sort((a, b) => b.pct - a.pct).slice(0, 3).map((p) => p.label));

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
      <div className="relative overflow-hidden rounded-xl border border-border/40 bg-background/40">
        {points.length > 0 ? (
          <>
            <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="block h-auto w-full" role="img" aria-label="Mapa com as cidades dos seguidores">
              <defs>
                <radialGradient id={`bubble-${gradId}`}>
                  <stop offset="0%" stopColor={BRAND_GRADIENT_STOPS[1]} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={BRAND_GRADIENT_STOPS[0]} stopOpacity={0.8} />
                </radialGradient>
              </defs>
              {BRAZIL_STATE_PATHS.map((d, i) => (
                <path key={i} d={d} fill="hsl(var(--muted-foreground) / 0.12)" stroke="hsl(var(--muted-foreground) / 0.45)" strokeWidth={0.7 * scale} strokeLinejoin="round" />
              ))}
              {[...points].sort((a, b) => b.pct - a.pct).map((p) => {
                const r = radius(p.pct);
                const isActive = active === p.label;
                return (
                  <g key={p.label} data-map-city className="cursor-pointer" onMouseEnter={() => setHover(p.label)} onMouseLeave={() => setHover(null)} onClick={() => setPinned((prev) => (prev === p.label ? null : p.label))}>
                    <circle cx={p.x} cy={p.y} r={r + 2.2 * scale} fill={BRAND_GRADIENT_STOPS[1]} opacity={isActive ? 0.28 : 0.14} />
                    <circle cx={p.x} cy={p.y} r={r} fill={`url(#bubble-${gradId})`} stroke={isActive ? "#f5b27a" : "#fff"} strokeOpacity={isActive ? 1 : 0.55} strokeWidth={(isActive ? 1.6 : 0.8) * scale} />
                    {labeled.has(p.label) && (
                      <text
                        x={p.x + r + 1.5 * scale}
                        y={p.y + 1.2 * scale}
                        fontSize={3.6 * scale}
                        fontWeight={600}
                        fill="hsl(var(--foreground))"
                        stroke="hsl(var(--background))"
                        strokeWidth={1.1 * scale}
                        paintOrder="stroke"
                        pointerEvents="none"
                      >
                        {p.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            {activePoint && activeEntry && (
              <div className="pointer-events-none absolute bottom-10 left-3 rounded-lg border border-border/60 bg-popover/95 px-3 py-2 text-xs shadow-md backdrop-blur">
                <p className="font-semibold">{shortName(activeEntry.label)}</p>
                <p className="text-muted-foreground">{activePoint.state}</p>
                <p className="mt-1"><b className="tabular-nums">{activeEntry.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</b> dos seguidores · {activeEntry.value.toLocaleString("pt-BR")}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setZoomed((z) => !z)}
              className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-border/60 bg-popover/95 px-3 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent print:hidden"
            >
              {zoomed ? <><Expand className="h-3 w-3" /> Brasil inteiro</> : <><Minimize2 className="h-3 w-3" /> Aproximar</>}
            </button>
            <p className="px-3 pb-2 pt-1 text-[10px] text-muted-foreground">O tamanho da bolha mostra quantos seguidores moram na cidade. Passe o mouse ou clique para ver os detalhes.</p>
          </>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Ainda não foi possível localizar estas cidades no mapa.</p>
        )}
      </div>

      <div className="space-y-1.5">
        {ranking.map((c, i) => (
          <button
            key={c.label}
            type="button"
            data-map-city
            onMouseEnter={() => setHover(c.label)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setPinned((prev) => (prev === c.label ? null : c.label))}
            className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/60", active === c.label && "bg-muted/60")}
          >
            <span className="w-4 shrink-0 text-center text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="w-32 shrink-0 truncate" title={c.label}>{shortName(c.label)}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full" style={{ width: `${(c.pct / ranking[0].pct) * 100}%`, background: "linear-gradient(90deg, #6d3cf0, #c86be6 55%, #f5b27a)" }} />
            </span>
            <span className="w-10 text-right tabular-nums">{Math.round(c.pct)}%</span>
          </button>
        ))}
        {list.length > ranking.length && (
          <p className="px-2 pt-1 text-[11px] text-muted-foreground">+ {list.length - ranking.length} outras cidades</p>
        )}
      </div>
    </div>
  );
}
