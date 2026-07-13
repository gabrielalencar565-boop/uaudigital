import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Magic2StageKey } from "@/features/magic2/magic2-stages";
import { MAGIC2_STAGES } from "@/features/magic2/magic2-stages";

/**
 * Retorna Map<magic2ClientId, Set<stageKey>> das etapas já agendadas no mês
 * (tarefas com data em pm_tasks, exceto demandas extras / deletadas).
 * A ligação entre magic2_clients e a base de clientes da agenda é feita
 * via magic2_client_links.agenda_client_id.
 */
export function useMagic2ScheduledStages(year: number, month: number) {
  return useQuery({
    queryKey: ["pm_tasks", "magic2_scheduled", year, month],
    queryFn: async (): Promise<Map<string, Set<Magic2StageKey>>> => {
      const from = `${year}-${String(month).padStart(2, "0")}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const validStages = new Set<string>(MAGIC2_STAGES.map((s) => s.key));

      const [linksRes, tasksRes] = await Promise.all([
        supabase
          .from("magic2_client_links")
          .select("magic2_client_id, agenda_client_id"),
        supabase
          .from("pm_tasks")
          .select("client_id, stage_current, due_date")
          .is("deleted_at", null)
          .eq("is_extra_demand", false)
          .gte("due_date", from)
          .lt("due_date", to),
      ]);
      if (linksRes.error) throw linksRes.error;
      if (tasksRes.error) throw tasksRes.error;

      // agenda_client_id -> magic2_client_id (pode haver múltiplos magic2 para um agenda)
      const agendaToMagic = new Map<string, string[]>();
      for (const l of (linksRes.data ?? []) as Array<{
        magic2_client_id: string;
        agenda_client_id: string;
      }>) {
        const arr = agendaToMagic.get(l.agenda_client_id) ?? [];
        arr.push(l.magic2_client_id);
        agendaToMagic.set(l.agenda_client_id, arr);
      }

      const map = new Map<string, Set<Magic2StageKey>>();
      for (const row of (tasksRes.data ?? []) as Array<{
        client_id: string | null;
        stage_current: string | null;
        due_date: string | null;
      }>) {
        if (!row.client_id || !row.stage_current || !row.due_date) continue;
        if (!validStages.has(row.stage_current)) continue;
        const magicIds = agendaToMagic.get(row.client_id);
        if (!magicIds?.length) continue;
        for (const magicId of magicIds) {
          const set = map.get(magicId) ?? new Set<Magic2StageKey>();
          set.add(row.stage_current as Magic2StageKey);
          map.set(magicId, set);
        }
      }
      return map;
    },
    staleTime: 30_000,
  });
}
