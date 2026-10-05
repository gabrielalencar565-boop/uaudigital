import { mixHex, rotateHue } from "@/lib/color";

// Identity gradient used by every chart/progress visual. Default = the Uau identity
// (violet → magenta → peach); BrandColorProvider swaps in the agency's own colors at runtime
// via setBrandGradient(). The arrays are mutated in place so every importer sees the change
// on its next render.
export const DEFAULT_BRAND_GRADIENT_STOPS = ["#6d3cf0", "#c86be6", "#f5b27a"] as const;
export const DEFAULT_BRAND_SERIES_COLORS = [
  "#6d3cf0", "#e06bd0", "#f5b27a", "#a855f7", "#8aa4ff", "#f08fc0", "#9b7cf6", "#fbcf9e",
] as const;

export const BRAND_GRADIENT_STOPS: string[] = [...DEFAULT_BRAND_GRADIENT_STOPS];
export const BRAND_GRADIENT_OFFSETS = [0, 55, 100] as const;
export const BRAND_KNOB_COLOR = "#f5a43c";

// Discrete colors for multi-series / categorical charts (donut slices, one line per person,
// one bar per squad…), all from the same family as the gradient so every series still reads
// as a different color while staying on-brand.
export const BRAND_SERIES_COLORS: string[] = [...DEFAULT_BRAND_SERIES_COLORS];

// Chart gradient derived from the agency colors; null = the agency changed nothing, keep the Uau identity.
// Shared by BrandColorProvider (the real app) and the live preview in Configurações → Agência.
export function deriveBrandPalette(c: {
  brand: string; defaultBrand: string; accent: string | null; from: string | null; to: string | null;
}): { stops: [string, string, string]; series: string[] } | null {
  const customized = c.brand.toLowerCase() !== c.defaultBrand.toLowerCase() || !!c.accent || !!c.from || !!c.to;
  if (!customized) return null;
  const start = c.from ?? c.brand;
  const end = c.accent ?? c.to ?? rotateHue(c.brand, 45, 12);
  const mid = mixHex(start, end, 0.5);
  return {
    stops: [start, mid, end],
    series: [start, end, mid, rotateHue(start, 30), rotateHue(end, -30), rotateHue(start, 0, 22), rotateHue(end, 0, 18), rotateHue(mid, 60)],
  };
}

export function setBrandGradient(stops: readonly string[] | null, series: readonly string[] | null) {
  BRAND_GRADIENT_STOPS.splice(0, BRAND_GRADIENT_STOPS.length, ...(stops ?? DEFAULT_BRAND_GRADIENT_STOPS));
  BRAND_SERIES_COLORS.splice(0, BRAND_SERIES_COLORS.length, ...(series ?? DEFAULT_BRAND_SERIES_COLORS));
}

export const brandGradientCss = (angleDeg = 90) =>
  `linear-gradient(${angleDeg}deg, ${BRAND_GRADIENT_STOPS[0]} 0%, ${BRAND_GRADIENT_STOPS[1]} 55%, ${BRAND_GRADIENT_STOPS[2]} 100%)`;

export const brandSeriesColor = (index: number) => BRAND_SERIES_COLORS[index % BRAND_SERIES_COLORS.length];
