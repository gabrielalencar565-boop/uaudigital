import { useEffect } from "react";
import { useAppSettings } from "@/features/data/queries";
import { deriveBrandPalette, setBrandGradient } from "@/lib/brand-gradient";
import { brandGlowPalette, clampLightness, contrastingForeground, hexToHsl, twoColorGlowPalette } from "@/lib/color";

const DEFAULT_BRAND_COLOR = "#6932c9";

// Applies the agency's look to every CSS custom property that previously hardcoded the Uau
// Digital purple, by setting inline overrides on the <html> element — inline styles win over any
// stylesheet rule (including the light/dark theme blocks), which is exactly what already made
// the sidebar "always purple regardless of theme" work before this became configurable. Runs
// app-wide (mounted once in App.tsx) so it also covers pages rendered before login, like /auth.
//
// What it drives:
//  - brand color (+ optional separate sidebar color): sidebar, mobile bottom nav, avatar ring,
//    `variant="brand"` buttons;
//  - header gradient (optional two colors, else derived from the brand color): the animated
//    --brand-glow-N gradients (Meu Painel, Clientes, Magic Number headers);
//  - chart gradient (optional accent color): every chart/progress visual via setBrandGradient();
//  - favicon (optional).
// Anything left empty keeps the app's default look.
export function BrandColorProvider() {
  const appSettingsQ = useAppSettings();
  const s = appSettingsQ.data;
  const brandColor = s?.brand_color || DEFAULT_BRAND_COLOR;
  const sidebarColor = s?.sidebar_color || brandColor;
  const chartAccent = s?.chart_accent_color ?? null;
  const headerFrom = s?.header_gradient_from ?? null;
  const headerTo = s?.header_gradient_to ?? null;
  const favicon = s?.favicon_url ?? null;

  useEffect(() => {
    const root = document.documentElement.style;

    // Sidebar / nav
    const sb = hexToHsl(sidebarColor);
    const sbBase = `${sb.h} ${sb.s}% ${sb.l}%`;
    root.setProperty("--sidebar-background", sbBase);
    root.setProperty("--sidebar", sbBase);
    root.setProperty("--sidebar-accent", `${sb.h} ${sb.s}% ${clampLightness(sb.l - 8)}%`);
    root.setProperty("--sidebar-border", `${sb.h} ${sb.s}% ${clampLightness(sb.l - 12)}%`);
    root.setProperty("--sidebar-foreground", contrastingForeground(sb.l) === "0 0% 100%" ? "0 0% 100%" : "0 0% 10%");
    root.setProperty("--sidebar-primary", "0 0% 100%");
    root.setProperty("--sidebar-primary-foreground", sbBase);
    root.setProperty("--sidebar-ring", "0 0% 100%");
    root.setProperty("--mobilenav-background", `hsl(${sbBase})`);
    root.setProperty("--mobilenav-subbar-background", `hsla(${sb.h}, ${clampLightness(sb.s - 10)}%, ${clampLightness(sb.l - 15)}%, 0.85)`);

    // Brand buttons / accents
    const { h, s: sat, l } = hexToHsl(brandColor);
    root.setProperty("--brand", `${h} ${sat}% ${l}%`);
    root.setProperty("--brand-foreground", contrastingForeground(l));
    root.setProperty("--brand-color-hex", brandColor);

    // Animated header gradients
    const glow = headerFrom || headerTo
      ? twoColorGlowPalette(headerFrom ?? brandColor, headerTo ?? chartAccent ?? headerFrom ?? brandColor)
      : brandGlowPalette(brandColor);
    root.setProperty("--brand-glow-1", glow.glow1);
    root.setProperty("--brand-glow-2", glow.glow2);
    root.setProperty("--brand-glow-3", glow.glow3);
    root.setProperty("--brand-glow-4", glow.glow4);
    root.setProperty("--brand-glow-5", glow.glow5);
    root.setProperty("--brand-glow-6", glow.glow6);
    root.setProperty("--brand-glow-7", glow.glow7);

    // Chart gradient: the default Uau identity unless the agency changed any color.
    const palette = deriveBrandPalette({ brand: brandColor, defaultBrand: DEFAULT_BRAND_COLOR, accent: chartAccent, from: headerFrom, to: headerTo });
    setBrandGradient(palette?.stops ?? null, palette?.series ?? null);
  }, [sidebarColor, brandColor, chartAccent, headerFrom, headerTo]);

  useEffect(() => {
    if (!favicon) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = favicon;
  }, [favicon]);

  return null;
}
