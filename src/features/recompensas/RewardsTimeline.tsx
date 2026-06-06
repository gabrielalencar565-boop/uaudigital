import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, ListChecks, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DynamicLucideIcon } from "./LucideIconPicker";

type Reward = {
  id: string;
  name: string;
  icon: string;
  xp_cost: number;
  is_active: boolean;
  order_index: number;
};

type XPSummary = {
  total_earned: number;
  available: number;
};

export function RewardsTimeline({ userId }: { userId: string }) {
  const summaryQ = useQuery({
    queryKey: ["rewards", "xp_summary", userId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_xp_summary", { _user_id: userId });
      return (data as any[])?.[0] as XPSummary;
    },
  });

  const rewardsQ = useQuery({
    queryKey: ["rewards", "catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("id,name,icon,xp_cost,is_active,order_index")
        .eq("is_active", true)
        .order("xp_cost", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Reward[];
    },
  });

  const rewards = useMemo(
    () => [...(rewardsQ.data ?? [])].sort((a, b) => a.xp_cost - b.xp_cost),
    [rewardsQ.data],
  );

  const userXp = summaryQ.data?.total_earned ?? 0;
  const maxXp = rewards.length > 0 ? rewards[rewards.length - 1].xp_cost : 1;
  const fillPct = Math.min(100, (Math.min(userXp, maxXp) / maxXp) * 100);

  const nextReward = rewards.find((r) => r.xp_cost > userXp);
  const xpToNext = nextReward ? nextReward.xp_cost - userXp : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(263_70%_50%)] via-[hsl(263_75%_55%)] to-[hsl(270_80%_60%)] p-5 shadow-lg">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

      {/* Header */}
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-white">Vitrine de Prêmios</h3>
            <p className="text-xs text-white/70">Resgate prêmios incríveis com seus pontos XP!</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge icon={<Award className="h-3.5 w-3.5" />} label={`${userXp.toLocaleString("pt-BR")} XP`} solid />
          {nextReward && (
            <Badge
              icon={<ListChecks className="h-3.5 w-3.5" />}
              label={`Faltam ${xpToNext.toLocaleString("pt-BR")} XP para ${nextReward.name}`}
            />
          )}
        </div>
      </div>

      {/* Timeline */}
      {rewards.length === 0 ? (
        <div className="relative mt-6 rounded-xl bg-white/10 px-4 py-6 text-center text-sm text-white/70">
          Nenhuma recompensa cadastrada ainda.
        </div>
      ) : (
        <div className="relative mt-7">
          <div className="overflow-x-auto pb-2 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.3)_transparent]">
            <div
              className="relative min-w-full"
              style={{ minWidth: `${Math.max(rewards.length * 110, 600)}px` }}
            >
              {/* Track */}
              <div className="relative h-2 rounded-full bg-white/15">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[hsl(160_70%_55%)] to-[hsl(150_75%_50%)] shadow-[0_0_12px_hsl(160_70%_55%/0.6)] transition-all duration-700 ease-out"
                  style={{ width: `${fillPct}%` }}
                />
              </div>

              {/* Markers */}
              <TooltipProvider delayDuration={150}>
                <ul className="relative">
                  {rewards.map((r, idx) => {
                    const pct = (r.xp_cost / maxXp) * 100;
                    const achieved = userXp >= r.xp_cost;
                    const isNext = !achieved && nextReward?.id === r.id;

                    return (
                      <li
                        key={r.id}
                        className="absolute -translate-x-1/2"
                        style={{ left: `${pct}%`, top: "-12px" }}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="group flex flex-col items-center focus:outline-none"
                              aria-label={`${r.name} — ${r.xp_cost} XP`}
                            >
                              <span
                                className={cn(
                                  "relative grid h-7 w-7 place-items-center rounded-full border-2 text-base transition-all duration-300",
                                  achieved
                                    ? "border-white bg-white text-[hsl(263_70%_45%)] shadow-[0_0_14px_hsl(160_70%_55%/0.7)]"
                                    : isNext
                                      ? "border-white bg-white/95 text-[hsl(263_70%_45%)] ring-2 ring-white/60 ring-offset-2 ring-offset-[hsl(263_70%_50%)]"
                                      : "border-white/50 bg-white/10 text-white/60 backdrop-blur-sm group-hover:border-white/80",
                                )}
                              >
                                {isNext && (
                                  <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
                                )}
                                <DynamicLucideIcon name={r.icon} className="text-[15px]" />
                              </span>

                              <span
                                className={cn(
                                  "mt-2 max-w-[100px] truncate text-[11px] font-semibold leading-tight",
                                  achieved || isNext ? "text-white" : "text-white/55",
                                )}
                              >
                                {r.name}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] tabular-nums",
                                  achieved ? "text-emerald-200" : isNext ? "text-white/90" : "text-white/45",
                                )}
                              >
                                {r.xp_cost.toLocaleString("pt-BR")} XP
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-semibold">{r.name}</div>
                            <div className="text-muted-foreground">
                              {achieved ? "Conquistado ✓" : isNext ? "Próximo prêmio" : `Faltam ${(r.xp_cost - userXp).toLocaleString("pt-BR")} XP`}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </TooltipProvider>

              {/* Spacer to make room for labels under markers */}
              <div className="h-16" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({
  icon,
  label,
  solid,
}: {
  icon: React.ReactNode;
  label: string;
  solid?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm",
        solid
          ? "bg-black/30 text-white ring-1 ring-white/20"
          : "bg-white/15 text-white ring-1 ring-white/20",
      )}
    >
      {icon}
      {label}
    </span>
  );
}
