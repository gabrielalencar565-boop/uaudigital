import { useEffect } from "react";
import { useAppSettings } from "@/features/data/queries";
import { clampLightness, contrastingForeground, hexToHsl } from "@/lib/color";

const DEFAULT_BRAND_COLOR = "#6932c9";

// Applies the admin-configured brand color to every CSS custom property that previously
// hardcoded the Uau Digital purple, by setting inline overrides on the <html> element —
// inline styles win over any stylesheet rule (including the light/dark theme blocks), which
// is exactly what already made the sidebar "always purple regardless of theme" work before
// this became configurable. Runs app-wide (mounted once in App.tsx) so it also covers pages
// rendered before login, like /auth.
//
// Scope, by design (see project notes): this is the app's single brand/accent color — it
// drives the sidebar, mobile bottom nav, the profile avatar ring, and any `variant="brand"`
// button. It does not attempt to re-tint every decorative multi-stop gradient in the app
// (e.g. the "Meu Painel" header card) — those stay purple until a real design pass touches
// them specifically.
export function BrandColorProvider() {
  const appSettingsQ = useAppSettings();
  const brandColor = appSettingsQ.data?.brand_color || DEFAULT_BRAND_COLOR;

  useEffect(() => {
    const { h, s, l } = hexToHsl(brandColor);
    const root = document.documentElement.style;

    const base = `${h} ${s}% ${l}%`;
    const accent = `${h} ${s}% ${clampLightness(l - 8)}%`;
    const border = `${h} ${s}% ${clampLightness(l - 12)}%`;
    const foreground = contrastingForeground(l);

    root.setProperty("--sidebar-background", base);
    root.setProperty("--sidebar", base);
    root.setProperty("--sidebar-accent", accent);
    root.setProperty("--sidebar-border", border);
    root.setProperty("--sidebar-foreground", "0 0% 100%");
    root.setProperty("--sidebar-primary", "0 0% 100%");
    root.setProperty("--sidebar-primary-foreground", base);
    root.setProperty("--sidebar-ring", "0 0% 100%");

    root.setProperty("--mobilenav-background", `hsl(${base})`);
    root.setProperty(
      "--mobilenav-subbar-background",
      `hsla(${h}, ${clampLightness(s - 10)}%, ${clampLightness(l - 15)}%, 0.85)`,
    );

    root.setProperty("--brand", base);
    root.setProperty("--brand-foreground", foreground);
    root.setProperty("--brand-color-hex", brandColor);
  }, [brandColor]);

  return null;
}
