import { useMemo } from "react";

import { MAGIC2_STAGES, type Magic2StageKey } from "@/features/magic2/magic2-stages";
import { useMagic2Closure, useMagic2Month } from "@/features/magic2/hooks/use-magic2";

export type Magic2DashboardData = {
  totalClients: number;
  totalStages: number;
  doneStages: number;
  pendingStages: number;
  overallPct: number;
  clients100: number;
  // última etapa concluída, só quando o mês está em 100% (base do selo "no prazo / com atraso")
  completedAt: string | null;
  byStage: Record<Magic2StageKey, { done: number; total: number; pct: number }>;
};

export function useMagic2Dashboard(year: number, month: number) {
  const q = useMagic2Month(year, month);
  const closureQ = useMagic2Closure(year, month);
  const closure = closureQ.data;

  const byCycleStage = useMemo(() => {
    const map = new Map<string, Map<Magic2StageKey, { id: string; completed: boolean }>>();
    for (const s of q.data?.stages ?? []) {
      const stageMap = map.get(s.cycle_id) ?? new Map();
      stageMap.set(s.stage, { id: s.id, completed: !!s.completed });
      map.set(s.cycle_id, stageMap);
    }
    return map;
  }, [q.data?.stages]);

  const dashboard = useMemo<Magic2DashboardData>(() => {
    const cycles = q.data?.cycles ?? [];
    const totalClients = cycles.length;
    const totalStages = totalClients * MAGIC2_STAGES.length;
    const doneStages = (q.data?.stages ?? []).filter((s) => s.completed).length;
    const pendingStages = Math.max(0, totalStages - doneStages);
    const overallPct = totalStages ? Math.round((doneStages / totalStages) * 100) : 0;

    let clients100 = 0;
    for (const c of cycles) {
      const m = byCycleStage.get(c.id);
      if (!m) continue;
      let done = 0;
      for (const st of MAGIC2_STAGES) {
        if (m.get(st.key)?.completed) done += 1;
      }
      if (done === MAGIC2_STAGES.length) clients100 += 1;
    }

    const byStage = MAGIC2_STAGES.reduce((acc, st) => {
      let done = 0;
      for (const c of cycles) {
        const m = byCycleStage.get(c.id);
        if (m?.get(st.key)?.completed) done += 1;
      }
      const pct = totalClients ? Math.round((done / totalClients) * 100) : 0;
      acc[st.key] = { done, total: totalClients, pct };
      return acc;
    }, {} as Record<Magic2StageKey, { done: number; total: number; pct: number }>);

    let completedAt: string | null = null;
    if (totalStages > 0 && overallPct === 100) {
      for (const s of q.data?.stages ?? []) {
        if (s.completed && s.completed_at && (!completedAt || s.completed_at > completedAt)) completedAt = s.completed_at;
      }
    }

    // ciclo fechado: vale o dia de conclusão guardado no fechamento
    if (closure?.concluded_at) completedAt = closure.concluded_at;

    return { totalClients, totalStages, doneStages, pendingStages, overallPct, clients100, completedAt, byStage };
  }, [byCycleStage, closure?.concluded_at, q.data?.cycles, q.data?.stages]);

  return {
    query: q,
    dashboard,
    cycles: q.data?.cycles ?? [],
  };
}
