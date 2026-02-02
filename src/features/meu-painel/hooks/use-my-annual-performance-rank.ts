import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers } from "@/features/data/queries";

type ScoreRow = {
  user_id: string;
  year: number;
  month: number;
  aprendizado_continuo: number;
  padrao_qualidade_uau: number;
  metas_prazos: number;
  ambiente_organizado: number;
  comprometimento: number;
};

function totalPoints(s: Pick<
  ScoreRow,
  "aprendizado_continuo" | "padrao_qualidade_uau" | "metas_prazos" | "ambiente_organizado" | "comprometimento"
>) {
  return s.aprendizado_continuo + s.padrao_qualidade_uau + s.metas_prazos + s.ambiente_organizado + s.comprometimento;
}

function medalForRank(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
}

export function useMyAnnualPerformanceRank(params: { userId?: string; year: number }) {
  const { userId, year } = params;
  const teamQ = useTeamMembers();

  const scoresQ = useQuery({
    enabled: !!userId,
    queryKey: ["performance_scores_annual_widget", year],
    queryFn: async (): Promise<{ scope: "all" | "self"; rows: ScoreRow[] }> => {
      // Tenta buscar geral (precisa permissão). Se falhar, faz fallback para apenas o próprio usuário.
      const baseSelect =
        "user_id, year, month, aprendizado_continuo, padrao_qualidade_uau, metas_prazos, ambiente_organizado, comprometimento";

      const all = await supabase.from("performance_scores").select(baseSelect).eq("year", year).order("month");
      if (!all.error) {
        return { scope: "all", rows: (all.data ?? []) as ScoreRow[] };
      }

      const mine = await supabase
        .from("performance_scores")
        .select(baseSelect)
        .eq("year", year)
        .eq("user_id", userId!)
        .order("month");
      if (mine.error) throw mine.error;
      return { scope: "self", rows: (mine.data ?? []) as ScoreRow[] };
    },
  });

  const computed = useMemo(() => {
    if (!userId) {
      return { rank: null as number | null, total: null as number | null, medal: null as string | null };
    }

    const rows = scoresQ.data?.rows ?? [];
    const scope = scoresQ.data?.scope ?? ("self" as const);

    // Total do usuário (sempre dá para calcular mesmo no fallback)
    const myTotal = rows
      .filter((r) => r.user_id === userId)
      .reduce((acc, r) => acc + totalPoints(r), 0);

    if (scope !== "all") {
      return { rank: null as number | null, total: myTotal, medal: null as string | null };
    }

    const members = teamQ.data ?? [];
    if (members.length === 0) {
      return { rank: null as number | null, total: myTotal, medal: null as string | null };
    }

    const totalsByUser = new Map<string, number>();
    for (const r of rows) {
      totalsByUser.set(r.user_id, (totalsByUser.get(r.user_id) ?? 0) + totalPoints(r));
    }

    const base = members
      .map((m) => ({ user_id: m.user_id, total: totalsByUser.get(m.user_id) ?? 0 }))
      .sort((a, b) => b.total - a.total);

    const idx = base.findIndex((r) => r.user_id === userId);
    if (idx < 0) return { rank: null as number | null, total: myTotal, medal: null as string | null };

    const rank = idx + 1;
    return { rank, total: base[idx]?.total ?? myTotal, medal: medalForRank(rank) };
  }, [scoresQ.data?.rows, scoresQ.data?.scope, teamQ.data, userId]);

  return {
    ...computed,
    isLoading: teamQ.isLoading || scoresQ.isLoading,
  };
}
