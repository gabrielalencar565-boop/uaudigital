import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function getRankDisplay(rank: number | null, medal: string | null): {icon: string | null;number: number | null;} {
  if (rank === null) return { icon: "🏁", number: null };
  if (rank <= 3 && medal) return { icon: medal, number: null };
  return { icon: null, number: rank };
}

function getRankStyle(rank: number | null) {
  if (rank === 1)
  return {
    bg: "linear-gradient(135deg, #F5D76E 0%, #D4A843 40%, #FFFBE6 70%, #C9973E 100%)",
    border: "1px solid rgba(212,168,67,0.5)",
    shadow: "0 4px 20px -4px rgba(212,168,67,0.3)",
    text: "text-amber-900"
  };
  if (rank === 2)
  return {
    bg: "linear-gradient(135deg, #E8E8E8 0%, #B8B8B8 40%, #F5F5F5 70%, #A8A8A8 100%)",
    border: "1px solid rgba(180,180,180,0.5)",
    shadow: "0 4px 20px -4px rgba(160,160,160,0.25)",
    text: "text-gray-700"
  };
  if (rank === 3)
  return {
    bg: "linear-gradient(135deg, #E2A76F 0%, #C27E3A 40%, #F0D0A8 70%, #A86B2D 100%)",
    border: "1px solid rgba(194,126,58,0.4)",
    shadow: "0 4px 20px -4px rgba(178,111,47,0.25)",
    text: "text-orange-900"
  };
  return null;
}

export function MeuPainelPerformanceRankCard({
  rank,
  total,
  medal,
  isLoading,
  label






}: {rank: number | null;total: number | null;medal: string | null;isLoading: boolean;label: string;}) {
  const { icon, number } = getRankDisplay(rank, medal);
  const style = getRankStyle(rank);

  return (
    <Card
      className="w-full overflow-hidden transition-all duration-300"
      style={
      style ?
      { background: style.bg, border: style.border, boxShadow: style.shadow } :
      undefined
      }>
      
      <CardContent className="relative flex w-full items-center justify-between gap-3 p-4 pt-7">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full",
              style ? "border border-white/40 bg-white/25" : "border border-border/60 bg-card/40"
            )}>
            
            {isLoading ?
            <span className="text-2xl leading-none">…</span> :
            icon ?
            <span className="text-2xl leading-none">{icon}</span> :

            <span className={cn("text-lg font-bold leading-none tabular-nums", style?.text)}>{number}º</span>
            }
          </div>

          <div className="flex min-w-0 items-baseline gap-2">
            <span className={cn("text-2xl font-semibold tracking-tight tabular-nums text-black md:text-4xl", style?.text)}>
              {isLoading ? "—" : total ?? 0}
            </span>
            <span className={cn("text-sm", style ? "opacity-70 " + (style.text ?? "") : "text-muted-foreground")}>pts</span>
          </div>
        </div>

        <span className={cn("absolute right-3 top-2 text-[11px] font-medium", style ? "opacity-60 " + (style.text ?? "") : "text-muted-foreground")}>{label}</span>
      </CardContent>
    </Card>);

}