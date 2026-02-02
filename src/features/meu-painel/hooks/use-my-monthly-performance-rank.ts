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

export function useMyMonthlyPerformanceRank(params: { userId?: string; year: number; month: number }) {
  const { userId, year, month } = params;
  const teamQ = useTeamMembers();

  const scoresQ = useQuery({
    enabled: !!userId,
    queryKey: ["performance_scores", year, month],
    queryFn: async (): Promise<ScoreRow[]> => {
      const { data, error } = await supabase
        .from("performance_scores")
        .select(
          "user_id, year, month, aprendizado_continuo, padrao_qualidade_uau, metas_prazos, ambiente_organizado, comprometimento",
        )
        .eq("year", year)
        .eq("month", month)
        .order("user_id");
      if (error) throw error;
      return (data ?? []) as ScoreRow[];
    },
  });

  const computed = useMemo(() => {
    const members = teamQ.data ?? [];
    if (!userId || members.length === 0) {
      return { rank: null as number | null, total: null as number | null, medal: null as string | null };
    }

    const scores = scoresQ.data ?? [];
    const byUser = new Map(scores.map((s) => [s.user_id, s] as const));

    const base = members
      .map((m) => {
        const s = byUser.get(m.user_id);
        const row: ScoreRow = {
          user_id: m.user_id,
          year,
          month,
          aprendizado_continuo: s?.aprendizado_continuo ?? 0,
          padrao_qualidade_uau: s?.padrao_qualidade_uau ?? 0,
          metas_prazos: s?.metas_prazos ?? 0,
          ambiente_organizado: s?.ambiente_organizado ?? 0,
          comprometimento: s?.comprometimento ?? 0,
        };
        return { ...row, total: totalPoints(row) };
      })
      .sort((a, b) => b.total - a.total);

    const idx = base.findIndex((r) => r.user_id === userId);
    if (idx < 0) return { rank: null as number | null, total: null as number | null, medal: null as string | null };

    const rank = idx + 1;
    return { rank, total: base[idx]?.total ?? 0, medal: medalForRank(rank) };
  }, [month, scoresQ.data, teamQ.data, userId, year]);

  return {
    ...computed,
    isLoading: teamQ.isLoading || scoresQ.isLoading,
  };
}
