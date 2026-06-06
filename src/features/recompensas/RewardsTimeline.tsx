import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trophy, ListChecks, Award, Check, Lock, Medal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const [showLevels, setShowLevels] = useState(false);
  const [showRanking, setShowRanking] = useState(false);

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
  const N = rewards.length;

  // Fill position interpolated between marker centers (evenly distributed)
  const fillPct = useMemo(() => {
    if (N === 0) return 0;
    let lastAchieved = -1;
    for (let i = 0; i < N; i++) if (userXp >= rewards[i].xp_cost) lastAchieved = i;
    const centerOf = (i: number) => ((i + 0.5) / N) * 100;
    if (lastAchieved === -1) return 0;
    if (lastAchieved === N - 1) return 100;
    const a = rewards[lastAchieved].xp_cost;
    const b = rewards[lastAchieved + 1].xp_cost;
    const f = b > a ? (userXp - a) / (b - a) : 0;
    return centerOf(lastAchieved) + f * (centerOf(lastAchieved + 1) - centerOf(lastAchieved));
  }, [rewards, userXp, N]);

  const nextReward = rewards.find((r) => r.xp_cost > userXp);
  const xpToNext = nextReward ? nextReward.xp_cost - userXp : 0;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(263_70%_50%)] via-[hsl(263_75%_55%)] to-[hsl(270_80%_60%)] p-6 shadow-lg">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

        {/* Header row */}
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-white">Vitrine de Prêmios</h3>
              <p className="text-xs text-white/70">Resgate prêmios incríveis com seus pontos XP!</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLevels(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25"
            >
              <ListChecks className="h-3.5 w-3.5" />
              Ver todos os níveis
            </button>
            <button
              type="button"
              onClick={() => setShowRanking(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25"
            >
              <Medal className="h-3.5 w-3.5" />
              Ranking
            </button>
          </div>
        </div>

        {/* XP summary row */}
        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/20">
            <Award className="h-3.5 w-3.5" />
            {userXp.toLocaleString("pt-BR")} XP acumulados
          </span>
          {nextReward ? (
            <span className="text-xs font-medium text-white/85">
              Faltam <b className="text-white">{xpToNext.toLocaleString("pt-BR")} XP</b> para {nextReward.name}
            </span>
          ) : (
            <span className="text-xs font-semibold text-emerald-200">Todos os prêmios conquistados! 🏆</span>
          )}
        </div>

        {/* Timeline */}
        {N === 0 ? (
          <div className="relative mt-8 rounded-xl bg-white/10 px-4 py-6 text-center text-sm text-white/70">
            Nenhuma recompensa cadastrada ainda.
          </div>
        ) : (
          <div className="relative mt-10">
            <div className="overflow-x-auto pb-2 [scrollbar-color:rgba(255,255,255,0.3)_transparent] [scrollbar-width:thin]">
              <div
                className="relative"
                style={{ minWidth: `${Math.max(N * 130, 720)}px` }}
              >
                {/* Track */}
                <div className="relative mx-0 h-2 rounded-full bg-white/15">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[hsl(160_70%_55%)] to-[hsl(150_75%_50%)] shadow-[0_0_12px_hsl(160_70%_55%/0.6)] transition-all duration-700 ease-out"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>

                {/* Markers as evenly-spaced flex columns, centered on the bar */}
                <TooltipProvider delayDuration={150}>
                  <div className="absolute left-0 right-0" style={{ top: "-14px" }}>
                    <div className="flex w-full">
                      {rewards.map((r) => {
                        const achieved = userXp >= r.xp_cost;
                        const isNext = !achieved && nextReward?.id === r.id;
                        return (
                          <div key={r.id} className="flex flex-1 flex-col items-center px-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="group flex flex-col items-center focus:outline-none"
                                  aria-label={`${r.name} — ${r.xp_cost} XP`}
                                >
                                  <span
                                    className={cn(
                                      "relative grid h-11 w-11 place-items-center rounded-full border-2 transition-all duration-300",
                                      achieved
                                        ? "border-white bg-white text-[hsl(263_70%_45%)] shadow-[0_0_14px_hsl(160_70%_55%/0.7)]"
                                        : isNext
                                          ? "border-white bg-white/95 text-[hsl(263_70%_45%)] ring-2 ring-white/60 ring-offset-2 ring-offset-[hsl(263_70%_50%)]"
                                          : "border-white/45 bg-white/10 text-white/60 backdrop-blur-sm group-hover:border-white/80",
                                    )}
                                  >
                                    {isNext && (
                                      <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
                                    )}
                                    <span
                                      className="leading-none"
                                      style={{
                                        fontSize: "20px",
                                        fontFamily:
                                          '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla","EmojiOne Color","Android Emoji",sans-serif',
                                      }}
                                      aria-hidden="true"
                                    >
                                      {r.icon && /\p{Extended_Pictographic}/u.test(r.icon) ? r.icon : "🎁"}
                                    </span>
                                  </span>


                                  <span
                                    className={cn(
                                      "mt-2.5 max-w-[110px] truncate text-center text-[11px] font-semibold leading-tight",
                                      achieved || isNext ? "text-white" : "text-white/55",
                                    )}
                                  >
                                    {r.name}
                                  </span>
                                  <span
                                    className={cn(
                                      "mt-0.5 text-[10px] tabular-nums",
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
                                  {achieved
                                    ? "Conquistado ✓"
                                    : isNext
                                      ? "Próximo prêmio"
                                      : `Faltam ${(r.xp_cost - userXp).toLocaleString("pt-BR")} XP`}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </TooltipProvider>

                {/* Spacer for labels */}
                <div className="h-20" />
              </div>
            </div>
          </div>
        )}
      </div>

      <AllLevelsDialog
        open={showLevels}
        onOpenChange={setShowLevels}
        rewards={rewards}
        userXp={userXp}
      />
      <RankingDialog open={showRanking} onOpenChange={setShowRanking} currentUserId={userId} />
    </>
  );
}

function AllLevelsDialog({
  open,
  onOpenChange,
  rewards,
  userXp,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rewards: Reward[];
  userXp: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Todos os Níveis
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {rewards.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma recompensa cadastrada.</p>
          )}
          {rewards.map((r) => {
            const achieved = userXp >= r.xp_cost;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition",
                  achieved ? "border-primary/30 bg-primary/5" : "border-border/40 bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-full text-lg",
                    achieved ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <DynamicLucideIcon name={r.icon} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.xp_cost.toLocaleString("pt-BR")} XP</div>
                </div>
                {achieved ? (
                  <Check className="h-5 w-5 text-emerald-500" />
                ) : (
                  <Lock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type RankingRow = {
  user_id: string;
  total: number;
  full_name: string | null;
  avatar_url: string | null;
};

function RankingDialog({
  open,
  onOpenChange,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUserId: string;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["rewards", "xp_ranking"],
    enabled: open,
    queryFn: async (): Promise<RankingRow[]> => {
      const { data: events, error } = await supabase
        .from("user_xp_events")
        .select("user_id, amount")
        .gt("amount", 0);
      if (error) throw error;
      const totals = new Map<string, number>();
      (events ?? []).forEach((e: any) => {
        totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + Number(e.amount ?? 0));
      });
      const ids = Array.from(totals.keys());
      if (ids.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", ids);
      const pm = new Map<string, { full_name: string | null; avatar_url: string | null }>();
      (profiles ?? []).forEach((p: any) => pm.set(p.user_id, { full_name: p.full_name, avatar_url: p.avatar_url }));
      return ids
        .map((id) => ({
          user_id: id,
          total: totals.get(id) ?? 0,
          full_name: pm.get(id)?.full_name ?? "Usuário",
          avatar_url: pm.get(id)?.avatar_url ?? null,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Medal className="h-5 w-5 text-primary" />
            Ranking de XP
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-1.5 overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {data?.length === 0 && <p className="text-sm text-muted-foreground">Sem dados ainda.</p>}
          {data?.map((row, i) => {
            const me = row.user_id === currentUserId;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            return (
              <div
                key={row.user_id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-2.5 transition",
                  me ? "border-primary/40 bg-primary/5" : "border-border/40",
                )}
              >
                <div className="grid h-7 w-7 place-items-center text-sm font-bold tabular-nums">
                  {medal ?? `${i + 1}º`}
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={row.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {(row.full_name ?? "U").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">
                    {row.full_name ?? "Usuário"} {me && <span className="text-xs text-primary">(você)</span>}
                  </div>
                </div>
                <div className="text-sm font-bold tabular-nums text-primary">
                  {row.total.toLocaleString("pt-BR")} XP
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
