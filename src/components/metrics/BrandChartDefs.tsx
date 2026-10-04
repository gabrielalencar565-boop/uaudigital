import { useId } from "react";

import { BRAND_GRADIENT_OFFSETS, BRAND_GRADIENT_STOPS } from "@/lib/brand-gradient";

export type BrandGradientIds = { h: string; v: string; area: string };

// Unique ids per chart instance — a url(#id) reference inside a hidden SVG (collapsed card,
// inactive tab) fails to resolve if the id lives in another chart's <defs>.
export function useBrandGradientIds(): BrandGradientIds {
  const base = useId().replace(/[^a-zA-Z0-9]/g, "");
  return { h: `brand-h-${base}`, v: `brand-v-${base}`, area: `brand-area-${base}` };
}

// Call INSIDE a recharts chart (AreaChart/BarChart/LineChart…) as `{brandChartDefs(ids)}` — it must
// be a plain function returning a raw <defs>, not a component: recharts drops custom component
// children, so `<BrandChartDefs />` silently rendered nothing. Reference with
// fill/stroke={`url(#${ids.x})`}:
//   ids.h    → left→right brand gradient: line strokes and horizontal bars
//   ids.v    → bottom→top brand gradient: vertical bars
//   ids.area → violet fading to transparent: area fills
export function brandChartDefs(ids: BrandGradientIds) {
  const stops = (opacity: [number, number, number] = [1, 1, 1]) =>
    BRAND_GRADIENT_STOPS.map((color, i) => (
      <stop key={color} offset={`${BRAND_GRADIENT_OFFSETS[i]}%`} stopColor={color} stopOpacity={opacity[i]} />
    ));
  return (
    <defs>
      {/* Chart-wide (userSpaceOnUse), not per-shape: a perfectly flat line has a zero-height box
          and an objectBoundingBox gradient would make its stroke vanish. */}
      <linearGradient id={ids.h} gradientUnits="userSpaceOnUse" x1="0%" y1="0%" x2="100%" y2="0%">{stops()}</linearGradient>
      <linearGradient id={ids.v} x1="0" y1="1" x2="0" y2="0">{stops()}</linearGradient>
      <linearGradient id={ids.area} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={BRAND_GRADIENT_STOPS[0]} stopOpacity={0.45} />
        <stop offset="100%" stopColor={BRAND_GRADIENT_STOPS[0]} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}
