import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Magic2StageKey } from "@/features/magic2/magic2-stages";
import { MAGIC2_STAGES } from "@/features/magic2/magic2-stages";

/**
 * Retorna, para o mês/ano informados, um mapa: clientId -> Set<stageKey>
 * indicando as etapas do fluxo Magic2 que já possuem uma tarefa agendada
 * (com data e horário) no mês. Considera somente tarefas NÃO extras
 * (is_extra_demand = false) e não deletadas, seguindo o que aparece na
 * aba Tarefas → Agenda.
 */
export function useMagic2ScheduledStages(year: number, month: number) {
  return useQuery({
    queryKey: ["pm_tasks", "magic2_scheduled", year, month],
    queryFn: async (): Promise<Map<string, Set<Magic2StageKey>>> => {
      // Faixa do mês (America/Sao_Paulo, tratada como string YYYY-MM-DD)
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const validStages = new Set<string>(MAGIC2_STAGES.map((s) => s.key));

      const { data, error } = await supabase
        .from("pm_tasks")
        .select("client_id, stage_current, due_date, posting_date, posting_time, is_extra_demand, deleted_at")
        .is("deleted_at", null)
        .eq("is_extra_demand", false)
        .gte("due_date", from)
        .lt("due_date", to);

      if (error) throw error;

      const map = new Map<string, Set<Magic2StageKey>>();
      for (const row of (data ?? []) as Array<{
        client_id: string | null;
        stage_current: string | null;
        due_date: string | null;
      }>) {
        if (!row.client_id || !row.stage_current || !row.due_date) continue;
        if (!validStages.has(row.stage_current)) continue;
        const set = map.get(row.client_id) ?? new Set<Magic2StageKey>();
        set.add(row.stage_current as Magic2StageKey);
        map.set(row.client_id, set);
      }
      return map;
    },
    staleTime: 30_000,
  });
}
