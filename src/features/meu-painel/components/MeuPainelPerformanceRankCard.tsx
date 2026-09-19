import { cn } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/animated-number";

function getRankDisplay(rank: number | null, medal: string | null): {icon: string | null; number: number | null;} {
  if (rank === null) return { icon: "🏁", number: null };
  if (rank <= 3 && medal) return { icon: medal, number: null };
  return { icon: null, number: rank };
}

function getRankStyle(rank: number | null) {
  // Gradientes vêm de tokens (--gradient-podium-1/2) que já trocam sozinhos por tema:
  // claro mantém dourado/prata/bronze metálico; escuro vira roxo (1º) ou grafite (2º/3º),
  // consistente com o pódio de "The Best".
  if (rank === 1)
    return {
      gradient: "var(--gradient-podium-1)",
      border: "rgba(212,168,67,0.5)",
      text: "text-amber-900 dark:text-white",
    };
  if (rank === 2)
    return {
      gradient: "var(--gradient-podium-2)",
      border: "rgba(180,180,180,0.5)",
      text: "text-gray-700 dark:text-foreground",
    };
  if (rank === 3)
    return {
      gradient: "var(--gradient-podium-3)",
      border: "rgba(194,126,58,0.4)",
      text: "text-orange-900 dark:text-foreground",
    };
  return null;
}

// Chip translúcido pensado pra viver dentro do banner com gradiente animado do
// cumprimento — não carrega fundo/sombra próprios (a não ser no pódio top-3,
// que ganha a cor de ouro/prata/bronze pra se destacar).
export function MeuPainelPerformanceRankCard({
  rank, total, medal, isLoading, label,
}: { rank: number | null; total: number | null; medal: string | null; isLoading: boolean; label: string }) {
  const { icon, number } = getRankDisplay(rank, medal);
  const style = getRankStyle(rank);

  return (
    <div
      className="relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3 backdrop-blur-xl transition-transform duration-300 hover:-translate-y-0.5"
      style={{
        borderColor: style?.border ?? "rgba(255,255,255,0.15)",
        background: style?.gradient ?? "rgba(255,255,255,0.1)",
        backgroundSize: style ? "300% 300%" : undefined,
        animation: style ? "gradientFlow 20s ease-in-out infinite" : undefined,
      }}
    >
      <div
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full border",
          style ? "border-white/40 bg-white/25" : "border-white/20 bg-white/10"
        )}
      >
        {isLoading ? (
          <span className="text-xl leading-none text-white">…</span>
        ) : icon ? (
          <span className="text-2xl leading-none">{icon}</span>
        ) : (
          <span className={cn("text-base font-bold leading-none tabular-nums", style?.text ?? "text-white")}>{number}º</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[11px] font-medium uppercase tracking-wide", style ? cn("opacity-70", style.text) : "text-white/60")}>
          {label}
        </p>
        <div className="flex items-baseline gap-1">
          {isLoading ? (
            <span className={cn("text-xl font-semibold tabular-nums sm:text-2xl", style?.text ?? "text-white")}>—</span>
          ) : (
            <AnimatedNumber
              value={total ?? 0}
              className={cn("text-xl font-semibold tracking-tight tabular-nums sm:text-2xl", style?.text ?? "text-white")}
              glow={false}
            />
          )}
          <span className={cn("text-xs", style ? cn("opacity-70", style.text) : "text-white/60")}>pts</span>
        </div>
      </div>
    </div>
  );
}
