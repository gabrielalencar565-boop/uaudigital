import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MAGIC2_STAGES, type Magic2StageKey } from "@/features/magic2/magic2-stages";
import { getBrazilDay } from "@/features/projetos/utils/score-utils";

type Magic2YearCycleRow = {
  id: string;
  client_id: string;
  year: number;
  month: number;
  due_date: string;
  is_active: boolean;
  magic2_clients?: { id: string; name: string } | null;
};

type Magic2YearStageRow = {
  id: string;
  cycle_id: string;
  stage: Magic2StageKey;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
};

export function useMagic2Year(year: number) {
  return useQuery({
    queryKey: ["magic2", "year", { year }],
    queryFn: async () => {
      const cyclesRes = await supabase
        .from("magic2_cycles")
        .select("id, client_id, year, month, due_date, is_active, magic2_clients ( id, name )")
        .eq("year", year)
        .order("month", { ascending: true });
      if (cyclesRes.error) throw cyclesRes.error;

      const cycles = (cyclesRes.data ?? []) as Magic2YearCycleRow[];
      const cycleIds = cycles.filter((c) => c.is_active).map((c) => c.id);

      const stagesRes = cycleIds.length
        ? await supabase
            .from("magic2_cycle_stages")
            .select("id, cycle_id, stage, completed, completed_at, completed_by")
            .in("cycle_id", cycleIds)
        : { data: [] as any[], error: null };
      if ((stagesRes as any).error) throw (stagesRes as any).error;

      const stages = ((stagesRes as any).data ?? []) as Magic2YearStageRow[];

      const monthlyMap = new Map<
        number,
        { totalClients: number; doneOnTime: number; doneLate: number; inProgress: number }
      >();

      for (let m = 1; m <= 12; m++) {
        const monthCycles = cycles.filter((c) => c.month === m && c.is_active);
        const totalClients = monthCycles.length;
        let doneOnTime = 0;
        let doneLate = 0;
        let inProgress = 0;

        for (const c of monthCycles) {
          const cycleStages = stages.filter((s) => s.cycle_id === c.id);
          const done = cycleStages.filter((s) => s.completed).length;
          const completedAll = done >= MAGIC2_STAGES.length;

          if (!completedAll) {
            inProgress += 1;
            continue;
          }

          const maxDate = Math.max(
            ...cycleStages.filter((s) => s.completed_at).map((s) => new Date(s.completed_at!).getTime()),
          );
          const completed = maxDate > 0 ? new Date(maxDate) : null;
          const completedDay = completed ? getBrazilDay(completed.toISOString()) : null;
          const due = 27;

          if (completed && completed <= due) doneOnTime += 1;
          else doneLate += 1;
        }

        monthlyMap.set(m, { totalClients, doneOnTime, doneLate, inProgress });
      }

      const monthly = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        ...(monthlyMap.get(i + 1) ?? { totalClients: 0, doneOnTime: 0, doneLate: 0, inProgress: 0 }),
      }));

      return { cycles, stages, monthly };
    },
  });
}
