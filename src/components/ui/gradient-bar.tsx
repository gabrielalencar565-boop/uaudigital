import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { BRAND_KNOB_COLOR, brandGradientCss } from "@/lib/brand-gradient";

const SIZES = {
  sm: { track: 6, knob: 12, ring: 3 },
  md: { track: 10, knob: 16, ring: 4 },
} as const;

// Progress/ranking bar in the brand gradient, optionally ending in a round "thumb".
// The thumb is positioned like a native range input (never overflows the track at 0%/100%)
// and the fill always ends under its center.
export function GradientBar({
  value,
  size = "sm",
  knob = true,
  className,
}: {
  value: number; // 0-100
  size?: keyof typeof SIZES;
  knob?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  const target = Math.min(Math.max(value, 0), 100) / 100;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const knobSize = knob ? s.knob : 0;
  const knobLeft = `calc(${shown * 100}% - ${shown * knobSize}px)`;

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(target * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative", className)}
      style={{ height: Math.max(s.knob, s.track) }}
    >
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-full bg-muted" style={{ height: s.track }} />
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full transition-[width] duration-700 ease-out"
        style={{ height: s.track, width: `calc(${knobLeft} + ${knobSize / 2}px)`, background: brandGradientCss(90) }}
      />
      {knob && (
        <div
          className="absolute top-1/2 -translate-y-1/2 rounded-full transition-[left] duration-700 ease-out"
          style={{
            left: knobLeft,
            width: s.knob,
            height: s.knob,
            background: "#fff",
            border: `${s.ring}px solid ${BRAND_KNOB_COLOR}`,
            boxShadow: `0 0 0 2px ${BRAND_KNOB_COLOR}33, 0 1px 4px rgba(0,0,0,0.4)`,
          }}
        />
      )}
    </div>
  );
}
