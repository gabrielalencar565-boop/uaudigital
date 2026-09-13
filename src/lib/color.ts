// Converts a hex color (e.g. "#6932c9") into the "H S% L%" triplet format Tailwind/shadcn
// expects inside its CSS custom properties (used as `hsl(var(--x))`).
export function hexToHslTriplet(hex: string): string {
  const { h, s, l } = hexToHsl(hex);
  return `${h} ${s}% ${l}%`;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized.split("").map((c) => c + c).join("")
      : normalized;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// Small helper so a chosen brand color always keeps legible foreground text — dark text on
// light/bright picks, white text on darker/saturated ones. Not a full contrast-ratio checker,
// just enough for the common case of a single accent color.
export function contrastingForeground(l: number): string {
  return l > 65 ? "0 0% 10%" : "0 0% 100%";
}

// clamp lightness so derived shades (accent/border, a bit darker than the base) never go
// negative or wrap around for very dark or very light base colors.
export function clampLightness(l: number): number {
  return Math.min(100, Math.max(0, l));
}

// Multi-stop "glow" palette used by decorative animated gradient headers (Meu Painel card,
// Magic2 "Visão Geral" card). Keeps the brand hue/saturation but spreads lightness across the
// same 7 stops the original hardcoded violet palette used (#4C1D95…#A78BFA), so swapping the
// brand color re-tints these gradients instead of leaving them stuck on the old purple.
export function brandGlowPalette(hex: string): {
  glow1: string; glow2: string; glow3: string; glow4: string; glow5: string; glow6: string; glow7: string;
} {
  const { h, s: rawS } = hexToHsl(hex);
  const s = Math.max(rawS, 55);
  const stop = (l: number) => `${h} ${s}% ${l}%`;
  return {
    glow1: stop(26),
    glow2: stop(38),
    glow3: stop(58),
    glow4: stop(42),
    glow5: stop(66),
    glow6: stop(76),
    glow7: stop(52),
  };
}
