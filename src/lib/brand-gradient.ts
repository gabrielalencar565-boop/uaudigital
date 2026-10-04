// Identity gradient used by every chart/progress visual: violet → magenta → peach.
export const BRAND_GRADIENT_STOPS = ["#6d3cf0", "#c86be6", "#f5b27a"] as const;
export const BRAND_GRADIENT_OFFSETS = [0, 55, 100] as const;
export const BRAND_KNOB_COLOR = "#f5a43c";

export const brandGradientCss = (angleDeg = 90) =>
  `linear-gradient(${angleDeg}deg, ${BRAND_GRADIENT_STOPS[0]} 0%, ${BRAND_GRADIENT_STOPS[1]} 55%, ${BRAND_GRADIENT_STOPS[2]} 100%)`;

// Discrete colors for multi-series / categorical charts (donut slices, one line per person,
// one bar per squad…), sampled from the same violet → magenta → peach family so every
// series still reads as a different color while staying on-brand.
export const BRAND_SERIES_COLORS = [
  "#6d3cf0", "#e06bd0", "#f5b27a", "#a855f7", "#8aa4ff", "#f08fc0", "#9b7cf6", "#fbcf9e",
] as const;

export const brandSeriesColor = (index: number) => BRAND_SERIES_COLORS[index % BRAND_SERIES_COLORS.length];
