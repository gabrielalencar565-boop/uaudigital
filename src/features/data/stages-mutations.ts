import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StageKey } from "@/lib/uau";
import type { ClientCycleRow, ClientCycleStageRow } from "@/features/data/stages-queries";

export function useSetStageCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; stage: StageKey; completed: boolean; userId: string }) => {
      const patch = input.completed
        ? { completed: true, completed_at: new Date().toISOString(), completed_by: input.userId }
        : { completed: false, completed_at: null, completed_by: null };

      const { error } = await supabase
        .from("client_stages")
        .update(patch)
        .eq("client_id", input.clientId)
        .eq("stage", input.stage);

      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["client_stages"] });
    },
  });
}

export function useSetMonthlyStageCompletion() {
  const qc = useQueryClient();
  return useMutation({
    onMutate: async (input) => {
      // Otimista: atualiza a célula específica (cliente + mês + etapa) imediatamente.
      const stagesKey = ["client_cycle_stages", { year: input.year }] as const;
      const cyclesKey = ["client_cycles", input.year] as const;
      await Promise.all([
        qc.cancelQueries({ queryKey: stagesKey }),
        qc.cancelQueries({ queryKey: cyclesKey }),
      ]);

      const prevStages = qc.getQueryData<ClientCycleStageRow[]>(stagesKey);
      const prevCycles = qc.getQueryData<ClientCycleRow[]>(cyclesKey);

      const cycleId = prevCycles?.find((c) => c.client_id === input.clientId && c.month === input.month)?.id;
      if (cycleId) {
        qc.setQueryData<ClientCycleStageRow[]>(stagesKey, (old) => {
          const base = old ?? [];
          const idx = base.findIndex((r) => r.cycle_id === cycleId && r.stage === input.stage);
          if (idx < 0) return base;

          const copy = [...base];
          copy[idx] = {
            ...copy[idx],
            completed: input.completed,
            completed_at: input.completed ? new Date().toISOString() : null,
            completed_by: input.completed ? input.userId : null,
          };
          return copy;
        });
      }

      return { prevStages, prevCycles, stagesKey, cyclesKey };
    },
    mutationFn: async (input: {
      clientId: string;
      year: number;
      month: number;
      stage: StageKey;
      completed: boolean;
      userId: string;
    }) => {
      // Garantir que exista um ciclo para (cliente, ano, mês).
      const { data: existingCycle, error: cErr } = await supabase
        .from("client_cycles")
        .select("id")
        .eq("client_id", input.clientId)
        .eq("year", input.year)
        .eq("month", input.month)
        .maybeSingle();
      if (cErr) throw cErr;

      let cycleId = existingCycle?.id as string | undefined;
      if (!cycleId) {
        const due_date = `${input.year}-${String(input.month).padStart(2, "0")}-27`;
        const { data: newCycle, error: insErr } = await supabase
          .from("client_cycles")
          .insert({ client_id: input.clientId, year: input.year, month: input.month, due_date })
          .select("id")
          .single();
        if (insErr) throw insErr;
        cycleId = newCycle.id as string;
      }

      const patch = input.completed
        ? { completed: true, completed_at: new Date().toISOString(), completed_by: input.userId }
        : { completed: false, completed_at: null, completed_by: null };

      // Garantir que exista a linha da etapa do ciclo; se não existir, cria.
      const { data: stageRow, error: sSelErr } = await supabase
        .from("client_cycle_stages")
        .select("id")
        .eq("cycle_id", cycleId)
        .eq("stage", input.stage)
        .maybeSingle();
      if (sSelErr) throw sSelErr;

      if (!stageRow?.id) {
        const { error: sInsErr } = await supabase
          .from("client_cycle_stages")
          .insert({ cycle_id: cycleId, stage: input.stage, ...patch });
        if (sInsErr) throw sInsErr;
      } else {
        const { error: sUpdErr } = await supabase
          .from("client_cycle_stages")
          .update(patch)
          .eq("id", stageRow.id);
        if (sUpdErr) throw sUpdErr;
      }
    },
    onError: (_err, _vars, ctx) => {
      if (!ctx) return;
      if (ctx.prevStages) qc.setQueryData(ctx.stagesKey, ctx.prevStages);
      if (ctx.prevCycles) qc.setQueryData(ctx.cyclesKey, ctx.prevCycles);
    },
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["client_cycle_stages"] }),
        qc.invalidateQueries({ queryKey: ["client_cycles", vars.year] }),
      ]);
    },
  });
}
