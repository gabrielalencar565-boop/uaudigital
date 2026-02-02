import * as React from "react";

import { cn } from "@/lib/utils";
import { clamp } from "@/lib/uau";

type RingTone = "success" | "warning" | "danger" | "primary";

function toneFromValue(value01: number): RingTone {
  if (value01 >= 0.95) return "success";
  if (value01 >= 0.6) return "primary";
  if (value01 >= 0.3) return "warning";
  return "danger";
}

export function ProgressRing({
  value,
  label,
  size = 132,
  stroke = 14,
  tone: toneProp,
  className,
}: {
  value: number; // 0-100
  label?: React.ReactNode;
  size?: number;
  stroke?: number;
  tone?: RingTone | "auto";
  className?: string;
}) {
  const normalized = clamp(value / 100, 0, 1);
  const tone = toneProp && toneProp !== "auto" ? toneProp : toneFromValue(normalized);

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - normalized);

  const strokeColor =
    tone === "success"
      ? "hsl(var(--success))"
      : tone === "warning"
        ? "hsl(var(--warning))"
        : tone === "danger"
          ? "hsl(var(--danger))"
          : "hsl(var(--primary))";

  return (
    <div className={cn("relative grid place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={strokeColor}
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
