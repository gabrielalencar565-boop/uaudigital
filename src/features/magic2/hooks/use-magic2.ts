import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Magic2StageKey } from "@/features/magic2/magic2-stages";

function dateOnly(year: number, month: number, day: number) {
  // DATE no backend: YYYY-MM-DD
  return format(new Date(year, month - 1, day), "yyyy-MM-dd");
}

export type Magic2ClientRow = { id: string; name: string };

export type Magic2CycleRow = {
  id: string;
  client_id: string;
  year: number;
  month: number;
  due_date: string;
  is_active: boolean;
  magic2_clients?: Magic2ClientRow | null;
};

export type Magic2StageRow = {
  id: string;
  cycle_id: string;
  stage: Magic2StageKey;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
};

export function useMagic2Month(year: number, month: number) {
  return useQuery({
    queryKey: ["magic2", "month", { year, month }],
    queryFn: async () => {
      const cyclesRes = await supabase
        .from("magic2_cycles")
        .select("id, client_id, year, month, due_date, is_active, magic2_clients ( id, name )")
        .eq("year", year)
        .eq("month", month)
        .order("created_at", { ascending: true });
      if (cyclesRes.error) throw cyclesRes.error;

      const cycles = (cyclesRes.data ?? []) as Magic2CycleRow[];
      const activeCycles = cycles.filter((c) => c.is_active);
      const cycleIds = activeCycles.map((c) => c.id);

      const stagesRes = cycleIds.length
        ? await supabase
            .from("magic2_cycle_stages")
            .select("id, cycle_id, stage, completed, completed_at, completed_by")
            .in("cycle_id", cycleIds)
        : { data: [] as any[], error: null as any };
      if ((stagesRes as any).error) throw (stagesRes as any).error;

      const stages = ((stagesRes as any).data ?? []) as Magic2StageRow[];
      return { cycles: activeCycles, stages };
    },
  });
}

export function useCreateMagic2Client() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      year,
      startMonth,
    }: {
      name: string;
      year: number;
      startMonth: number;
    }) => {
      const insClient = await supabase.from("magic2_clients").insert({ name }).select("id").single();
      if (insClient.error) throw insClient.error;
      const clientId = insClient.data.id as string;

      const months = Array.from({ length: 12 - startMonth + 1 }, (_, i) => startMonth + i);
      const cyclesPayload = months.map((m) => ({
        client_id: clientId,
        year,
        month: m,
        due_date: dateOnly(year, m, 27),
        is_active: true,
      }));

      const insCycles = await supabase.from("magic2_cycles").insert(cyclesPayload).select("id, month");
      if (insCycles.error) throw insCycles.error;
      const cycles = insCycles.data ?? [];

      // Inicializa as 7 etapas em todos os ciclos
      const { MAGIC2_STAGES } = await import("@/features/magic2/magic2-stages");
      const stagesPayload = cycles.flatMap((c: any) =>
        MAGIC2_STAGES.map((s) => ({
          cycle_id: c.id as string,
          stage: s.key,
          completed: false,
        })),
      );
      if (stagesPayload.length) {
        const insStages = await supabase.from("magic2_cycle_stages").insert(stagesPayload);
        if (insStages.error) throw insStages.error;
      }

      return { clientId };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["magic2"] });
    },
  });
}

export function useToggleMagic2Stage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stageId,
      nextCompleted,
      userId,
    }: {
      stageId: string;
      nextCompleted: boolean;
      userId: string;
    }) => {
      const payload = nextCompleted
        ? { completed: true, completed_at: new Date().toISOString(), completed_by: userId }
        : { completed: false, completed_at: null, completed_by: null };

      const res = await supabase.from("magic2_cycle_stages").update(payload).eq("id", stageId);
      if (res.error) throw res.error;
      return { stageId, nextCompleted, userId };
    },
    // Optimistic update: atualiza a UI instantaneamente antes da resposta do servidor
    onMutate: async (vars) => {
      // Cancela queries em andamento para não sobrescrever o optimistic update
      await qc.cancelQueries({ queryKey: ["magic2"] });

      // Snapshot do estado anterior
      const previousData = qc.getQueriesData({ queryKey: ["magic2", "month"] });

      // Atualiza otimisticamente todas as queries do mês
      qc.setQueriesData<{ cycles: Magic2CycleRow[]; stages: Magic2StageRow[] } | undefined>(
        { queryKey: ["magic2", "month"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            stages: old.stages.map((s) =>
              s.id === vars.stageId
                ? {
                    ...s,
                    completed: vars.nextCompleted,
                    completed_at: vars.nextCompleted ? new Date().toISOString() : null,
                    completed_by: vars.nextCompleted ? vars.userId : null,
                  }
                : s
            ),
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      // Rollback em caso de erro
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          qc.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: async () => {
      // Revalida após a mutação (sucesso ou erro) para garantir consistência
      await qc.invalidateQueries({ queryKey: ["magic2"] });
    },
  });
}

// Hook para criar stage on-demand (quando não existe) e já marcar como concluído
export function useCreateAndToggleMagic2Stage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      cycleId,
      stage,
      completed,
      userId,
    }: {
      cycleId: string;
      stage: Magic2StageKey;
      completed: boolean;
      userId: string;
    }) => {
      const payload = {
        cycle_id: cycleId,
        stage,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        completed_by: completed ? userId : null,
      };

      const res = await supabase.from("magic2_cycle_stages").insert(payload).select("id").single();
      if (res.error) throw res.error;
      return { stageId: res.data.id, cycleId, stage, completed, userId };
    },
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["magic2"] });
      const previousData = qc.getQueriesData({ queryKey: ["magic2", "month"] });

      // Adiciona otimisticamente a nova stage
      qc.setQueriesData<{ cycles: Magic2CycleRow[]; stages: Magic2StageRow[] } | undefined>(
        { queryKey: ["magic2", "month"] },
        (old) => {
          if (!old) return old;
          const tempId = `temp-${vars.cycleId}-${vars.stage}`;
          return {
            ...old,
            stages: [
              ...old.stages,
              {
                id: tempId,
                cycle_id: vars.cycleId,
                stage: vars.stage,
                completed: vars.completed,
                completed_at: vars.completed ? new Date().toISOString() : null,
                completed_by: vars.completed ? vars.userId : null,
              },
            ],
          };
        }
      );

      return { previousData };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          qc.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ["magic2"] });
    },
  });
}

export function useDeactivateMagic2ClientFromMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId,
      year,
      fromMonth,
    }: {
      clientId: string;
      year: number;
      fromMonth: number;
    }) => {
      const res = await supabase
        .from("magic2_cycles")
        .update({ is_active: false })
        .eq("client_id", clientId)
        .eq("year", year)
        .gte("month", fromMonth);
      if (res.error) throw res.error;
      return { clientId, year, fromMonth };
    },
    onSuccess: async () => {
      // invalida mês atual e qualquer cache de magic2
      const qk = qc
        .getQueryCache()
        .findAll({ queryKey: ["magic2"] })
        .map((q) => q.queryKey);
      await Promise.all(qk.map((key) => qc.invalidateQueries({ queryKey: key })));
    },
  });
}

export function useMagic2InactiveAgendaClients(year: number, month: number) {
  return useQuery({
    queryKey: ["magic2", "inactive-agenda-clients", { year, month }],
    queryFn: async () => {
      const normalizeName = (v: string) =>
        v
          .trim()
          .toLocaleLowerCase("pt-BR")
          .normalize("NFD")
          .replace(/\p{Diacritic}+/gu, "")
          .replace(/\s+/g, " ");

      const extractAgendaClientIds = (linksRaw: any): string[] => {
        // PostgREST pode retornar relacionamento 1:1 como objeto (ou null),
        // e em alguns casos como array. Normalizamos para array de ids.
        if (!linksRaw) return [];
        if (Array.isArray(linksRaw)) {
          return linksRaw
            .map((l) => l?.agenda_client_id)
            .filter(Boolean)
            .map(String);
        }
        const single = linksRaw?.agenda_client_id;
        return single ? [String(single)] : [];
      };

      // Busca ciclos do mês + link para cliente da Agenda
      const res = await supabase
        .from("magic2_cycles")
        .select("is_active, magic2_clients ( id, name, magic2_client_links ( agenda_client_id ) )")
        .eq("year", year)
        .eq("month", month);
      if (res.error) throw res.error;

      const inactiveAgendaIds = new Set<string>();
      const inactiveNames = new Set<string>();
      for (const row of res.data ?? []) {
        if ((row as any).is_active !== false) continue;
        const name = String((row as any).magic2_clients?.name ?? "").trim();
        if (name) inactiveNames.add(normalizeName(name));

        const linksRaw = (row as any).magic2_clients?.magic2_client_links;
        for (const agendaId of extractAgendaClientIds(linksRaw)) {
          inactiveAgendaIds.add(agendaId);
        }
      }

      return { inactiveAgendaIds, inactiveNames };
    },
  });
}

export function useSyncMagic2Year() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ year }: { year: number }) => {
      const res = await supabase.rpc("magic2_seed_year", { _year: year });
      if (res.error) throw res.error;
      return { year };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["magic2"] });
    },
  });
}
