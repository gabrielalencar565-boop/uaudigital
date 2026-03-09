import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type AnimatedNumberProps = {
  value: number;
  /** Duration of count-up in ms (default 800) */
  duration?: number;
  /** Suffix appended after the number (e.g. "%" or "pts") */
  suffix?: string;
  /** Prefix before the number (e.g. "R$") */
  prefix?: string;
  /** Number of decimal places (default 0) */
  decimals?: number;
  className?: string;
  /** Enable hover glow effect (default true) */
  glow?: boolean;
};

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function AnimatedNumber({
  value,
  duration = 800,
  suffix = "",
  prefix = "",
  decimals = 0,
  className,
  glow = true,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }

    // Trigger flash on value change (not on first mount from 0)
    if (from !== 0) setChanged(true);

    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutExpo(progress);
      const current = from + (to - from) * eased;
      setDisplay(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
        prevValue.current = to;
        // Clear flash after transition
        setTimeout(() => setChanged(false), 400);
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration]);

  // Auto-detect decimals from value if not explicitly set
  const effectiveDecimals = decimals > 0 ? decimals : (() => {
    const str = value.toString();
    const dot = str.indexOf(".");
    return dot >= 0 ? str.length - dot - 1 : 0;
  })();
  const formatted = effectiveDecimals > 0
    ? display.toLocaleString("pt-BR", { minimumFractionDigits: effectiveDecimals, maximumFractionDigits: effectiveDecimals })
    : Math.round(display).toLocaleString("pt-BR");

  return (
    <span
      className={cn(
        "inline-block tabular-nums transition-all duration-300",
        glow && "uau-number-glow",
        changed && "uau-number-flash",
        className,
      )}
    >
      {prefix}{formatted}{suffix}
    </span>
  );
}
