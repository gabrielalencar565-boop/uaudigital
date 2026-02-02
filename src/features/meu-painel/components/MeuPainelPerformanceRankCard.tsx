import { Card, CardContent } from "@/components/ui/card";

function getRankDisplay(rank: number | null, medal: string | null): { icon: string | null; number: number | null } {
  // 1º, 2º, 3º = medalha emoji
  // 4º+ = mostra o número
  if (rank === null) return { icon: "🏁", number: null };
  if (rank <= 3 && medal) return { icon: medal, number: null };
  return { icon: null, number: rank };
}

export function MeuPainelPerformanceRankCard({
  rank,
  total,
  medal,
  isLoading,
  label,
}: {
  rank: number | null;
  total: number | null;
  medal: string | null;
  isLoading: boolean;
  label: string;
}) {
  const { icon, number } = getRankDisplay(rank, medal);

  return (
    <Card className="w-full md:w-fit">
      <CardContent className="relative flex w-full items-center justify-between gap-3 p-4 pt-7">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border/60 bg-card/40">
            {isLoading ? (
              <span className="text-2xl leading-none">…</span>
            ) : icon ? (
              <span className="text-2xl leading-none">{icon}</span>
            ) : (
              <span className="text-lg font-bold leading-none tabular-nums">{number}º</span>
            )}
          </div>

          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
              {isLoading ? "—" : total ?? 0}
            </span>
            <span className="text-sm text-muted-foreground">pts</span>
          </div>
        </div>

        <span className="absolute right-3 top-2 text-[11px] font-medium text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
