import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useState } from "react";

function getRankDisplay(rank: number | null, medal: string | null): {icon: string | null; number: number | null;} {
  if (rank === null) return { icon: "🏁", number: null };
  if (rank <= 3 && medal) return { icon: medal, number: null };
  return { icon: null, number: rank };
}

function getRankStyle(rank: number | null) {
  if (rank === 1)
    return {
      gradient: "linear-gradient(135deg, #F5D76E, #D4A843, #FFFBE6, #C9973E, #F5D76E)",
      border: "rgba(212,168,67,0.5)",
      shadow: "0 4px 20px -4px rgba(212,168,67,0.3)",
      hoverShadow: "0 12px 32px -4px rgba(212,168,67,0.5), 0 0 20px -2px rgba(245,215,110,0.3)",
      glow: "rgba(245,215,110,0.4)",
      text: "text-amber-900",
    };
  if (rank === 2)
    return {
      gradient: "linear-gradient(135deg, #E8E8E8, #B8B8B8, #F5F5F5, #A8A8A8, #E8E8E8)",
      border: "rgba(180,180,180,0.5)",
      shadow: "0 4px 20px -4px rgba(160,160,160,0.25)",
      hoverShadow: "0 12px 32px -4px rgba(160,160,160,0.45), 0 0 20px -2px rgba(220,220,220,0.3)",
      glow: "rgba(200,200,200,0.4)",
      text: "text-gray-700",
    };
  if (rank === 3)
    return {
      gradient: "linear-gradient(135deg, #E2A76F, #C27E3A, #F0D0A8, #A86B2D, #E2A76F)",
      border: "rgba(194,126,58,0.4)",
      shadow: "0 4px 20px -4px rgba(178,111,47,0.25)",
      hoverShadow: "0 12px 32px -4px rgba(178,111,47,0.45), 0 0 20px -2px rgba(226,167,111,0.3)",
      glow: "rgba(226,167,111,0.4)",
      text: "text-orange-900",
    };
  return null;
}

export function MeuPainelPerformanceRankCard({
  rank, total, medal, isLoading, label,
}: { rank: number | null; total: number | null; medal: string | null; isLoading: boolean; label: string }) {
  const { icon, number } = getRankDisplay(rank, medal);
  const style = getRankStyle(rank);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl transition-all duration-500 ease-out"
      style={{
        border: `1px solid ${style?.border ?? "hsl(var(--border))"}`,
        boxShadow: hovered ? (style?.hoverShadow ?? "0 12px 32px -8px hsl(var(--primary) / 0.18)") : (style?.shadow ?? "none"),
        transform: hovered ? "translateY(-6px) scale(1.01)" : "translateY(0) scale(1)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Animated gradient background */}
      {style ? (
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: style.gradient,
            backgroundSize: "300% 300%",
            animation: "gradientFlow 20s ease-in-out infinite",
          }}
        />
      ) : (
        <div className="absolute inset-0 -z-10 bg-card" />
      )}

      {/* Glow overlay on hover */}
      {style && (
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl transition-opacity duration-500"
          style={{
            opacity: hovered ? 0.6 : 0,
            boxShadow: `inset 0 0 30px ${style.glow}`,
          }}
        />
      )}

      <CardContent className="relative flex w-full items-center justify-between gap-3 p-4 pt-7">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform duration-300",
              style ? "border border-white/40 bg-white/25" : "border border-border/60 bg-card/40",
              hovered && "scale-110"
            )}
          >
            {isLoading ? (
              <span className="text-2xl leading-none">…</span>
            ) : icon ? (
              <span className="text-2xl leading-none">{icon}</span>
            ) : (
              <span className={cn("text-lg font-bold leading-none tabular-nums", style?.text)}>{number}º</span>
            )}
          </div>

          <div className="flex min-w-0 items-baseline gap-2">
            <span className={cn("text-2xl font-semibold tracking-tight tabular-nums md:text-4xl text-black")}>
              {isLoading ? "—" : total ?? 0}
            </span>
            <span className={cn("text-sm", style ? "opacity-70 " + (style.text ?? "") : "text-muted-foreground")}>pts</span>
          </div>
        </div>

        <span className={cn("absolute right-3 top-2 text-[11px] font-medium", style ? "opacity-60 " + (style.text ?? "") : "text-muted-foreground")}>{label}</span>
      </CardContent>
    </div>
  );
}