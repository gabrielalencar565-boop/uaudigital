import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable fade-up entrance wrapper.
 * Wraps children in a div that fades in while sliding up.
 *
 * @param delay – stagger delay in seconds (default 0)
 * @param duration – animation duration in seconds (default 0.5)
 * @param className – extra classes
 */
export function FadeUp({
  children,
  delay = 0,
  duration = 0.5,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("opacity-0", className)}
      style={{
        animation: `fadeUp ${duration}s ease-out forwards`,
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
}
