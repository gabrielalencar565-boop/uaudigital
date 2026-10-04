import * as React from "react";

import { cn } from "@/lib/utils";
import { clamp } from "@/lib/uau";
import { BRAND_GRADIENT_OFFSETS, BRAND_GRADIENT_STOPS } from "@/lib/brand-gradient";

export function ProgressRing({
  value,
  label,
  size = 132,
  stroke = 14,
  trackColor,
  className,
}: {
  value: number; // 0-100
  label?: React.ReactNode;
  size?: number;
  stroke?: number;
  trackColor?: string;
  className?: string;
}) {
  const normalized = clamp(value / 100, 0, 1);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - normalized);

  const gradId = React.useId();
  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size, maxWidth: "100%", maxHeight: "100%", aspectRatio: "1/1" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            {BRAND_GRADIENT_STOPS.map((color, i) => (
              <stop key={color} offset={`${BRAND_GRADIENT_OFFSETS[i]}%`} stopColor={color} />
            ))}
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor ?? "hsl(var(--border))"} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center">
        {label}
      </div>
    </div>
  );
}
