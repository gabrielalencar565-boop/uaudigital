import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { MAGIC_STAGES, STAGES, type StageKey } from "@/lib/uau";

function dueDate27(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-27`;
}

export type ClientRow = {
  id: string;
  name: string;
  magic_due_date: string;
  notes: string | null;
  is_active: boolean;
};

export type ClientStageRow = {
  id: string;
  client_id: string;
  stage: StageKey;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
};

export type TaskStatus = "pendente" | "em_andamento" | "concluido";

export type TaskRow = {
  id: string;
  client_id: string;
  stage: StageKey;
  assigned_user_id: string;
  due_date: string;
  due_at: string | null;
  status: TaskStatus;
  title: string | null;
  description: string | null;
  created_by: string;
  completed_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type ProfileRow = {
  user_id: string;
  full_name: string;
  role_title: string;
  avatar_url: string | null;
};

export type TeamMemberRow = {
  user_id: string;
  display_name: string;
  role_title: string;
  avatar_url: string | null;
  is_active: boolean;
};

export type PerfRow = {
  id: string;
  user_id: string;
  year: number;
  month: number;
  aprendizado_continuo: number;
  padrao_qualidade_uau: number;
  metas_prazos: number;
  ambiente_organizado: number;
  comprometimento: number;
};

export function perfTotal(p: PerfRow) {
  return (
    p.aprendizado_continuo +
    p.padrao_qualidade_uau +
    p.metas_prazos +
    p.ambiente_organizado +
    p.comprometimento
  );
}

export function useProfiles(options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryKey: ["profiles"],
    queryFn: async (): Promise<ProfileRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, role_title, avatar_url")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
}

export function useTeamMembers() {
  return useQuery({
    queryKey: ["team_members"],
    queryFn: async (): Promise<TeamMemberRow[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, display_name, role_title, avatar_url, is_active")
        .eq("is_active", true)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamMemberRow[];
    },
  });
}

export type AppSettingsRow = {
  id: number;
  logo_url: string | null;
  logo_shape: "circle" | "square";
  updated_at: string;
  updated_by: string | null;
};

export function useAppSettings() {
  return useQuery({
    queryKey: ["app_settings"],
    queryFn: async (): Promise<AppSettingsRow | null> => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("id, logo_url, logo_shape, updated_at, updated_by")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as AppSettingsRow | null;
    },
  });
}

export function useUpdateAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { logo_url?: string | null; logo_shape?: "circle" | "square" }) => {
      const { data, error } = await supabase
        .from("app_settings")
        .update(updates)
        .eq("id", 1)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
  });
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, magic_due_date, notes, is_active")
        .eq("is_active", true)
        .order("magic_due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });
}

// Hook para admin ver TODOS os clientes (ativos e inativos)
export function useAllClients() {
  return useQuery({
    queryKey: ["clients_all"],
    queryFn: async (): Promise<ClientRow[]> => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, magic_due_date, notes, is_active")
        .order("is_active", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ClientRow[];
    },
  });
}

export function useToggleClientActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("clients")
        .update({ is_active: input.isActive })
        .eq("id", input.clientId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["clients"] }),
        qc.invalidateQueries({ queryKey: ["clients_all"] }),
      ]);
    },
  });
}

export function useClientStages(clientId?: string) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["client_stages", clientId],
    queryFn: async (): Promise<ClientStageRow[]> => {
      const { data, error } = await supabase
        .from("client_stages")
        .select("id, client_id, stage, completed, completed_at, completed_by")
        .eq("client_id", clientId!);
      if (error) throw error;
      return (data ?? []) as ClientStageRow[];
    },
  });
}

export function useTasks(params?: {
  month?: string;
  start?: string;
  end?: string;
  assignedUserId?: string;
  clientId?: string;
}) {
  const { month, start, end, assignedUserId, clientId } = params ?? {};
  return useQuery({
    queryKey: ["tasks", { month, start, end, assignedUserId, clientId }],
    queryFn: async (): Promise<TaskRow[]> => {
      let q = supabase
        .from("tasks")
        .select("id, client_id, stage, assigned_user_id, due_date, due_at, status, title, description, created_by, completed_at, deleted_at, deleted_by")
        .is("deleted_at", null); // Filtra apenas tarefas ativas
      if (assignedUserId) q = q.eq("assigned_user_id", assignedUserId);
      if (clientId) q = q.eq("client_id", clientId);
      if (start && end) {
        q = q.gte("due_date", start).lte("due_date", end);
      } else if (month) {
        // month format: YYYY-MM
        const [y, m] = month.split("-");
        const year = Number(y);
        const monthIndex = Number(m) - 1;

        // Evita datas inválidas (ex.: fevereiro não tem dia 31), que podem retornar 400 e quebrar a UI.
        if (Number.isFinite(year) && Number.isFinite(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
          const startDate = new Date(year, monthIndex, 1);
          const endDate = endOfMonth(startDate);
          const startStr = format(startDate, "yyyy-MM-dd");
          const endStr = format(endDate, "yyyy-MM-dd");
          q = q.gte("due_date", startStr).lte("due_date", endStr);
        } else {
          // Fallback seguro: se o formato vier inesperado, não aplica filtro de mês (melhor do que crash)
        }
      }
      const { data, error } = await q.order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });
}

export function usePerformance(year: number) {
  return useQuery({
    queryKey: ["performance_scores", year],
    queryFn: async (): Promise<PerfRow[]> => {
      const { data, error } = await supabase
        .from("performance_scores")
        .select(
          "id, user_id, year, month, aprendizado_continuo, padrao_qualidade_uau, metas_prazos, ambiente_organizado, comprometimento",
        )
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as PerfRow[];
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; magic_due_date: string; notes?: string }) => {
      // Verificar se cliente já existe com nome similar
      const { data: exists, error: checkErr } = await supabase.rpc("check_client_exists", {
        _name: input.name,
      });
      if (checkErr) throw checkErr;
      if (exists) {
        throw new Error(`Já existe um cliente com o nome "${input.name.trim()}"`);
      }

      const { data, error } = await supabase
        .from("clients")
        .insert({ name: input.name.trim(), magic_due_date: input.magic_due_date, notes: input.notes ?? null })
        .select("id")
        .maybeSingle();
      if (error) {
        // Tratamento mais amigável para erro de constraint
        if (error.message?.includes("clients_name_unique_idx") || error.code === "23505") {
          throw new Error(`Já existe um cliente com o nome "${input.name.trim()}"`);
        }
        throw error;
      }
      const clientId = data?.id as string | undefined;
      if (!clientId) throw new Error("Falha ao criar cliente");

      // Mantém o legado (client_stages) por compatibilidade com outras telas
      const stages = STAGES.map((s) => ({ client_id: clientId, stage: s.key, completed: false }));
      const { error: stErr } = await supabase.from("client_stages").insert(stages);
      if (stErr) throw stErr;

      // Novo: participação por mês.
      // Ao criar no mês selecionado, o cliente passa a existir a partir daquele mês até Dez (pode ser removido a partir de um mês futuro).
      // Observação: magic_due_date vem como YYYY-MM-DD.
      const yearFromDue = Number(String(input.magic_due_date).slice(0, 4));
      const year = Number.isFinite(yearFromDue) && yearFromDue > 1970 ? yearFromDue : new Date().getFullYear();

      const monthFromDue = Number(String(input.magic_due_date).slice(5, 7));
      const startMonth = Number.isFinite(monthFromDue) && monthFromDue >= 1 && monthFromDue <= 12 ? monthFromDue : 1;

      const cyclesPayload = Array.from({ length: 12 - startMonth + 1 }, (_, i) => {
        const month = startMonth + i;
        return {
          client_id: clientId,
          year,
          month,
          due_date: dueDate27(year, month),
          is_active: true,
        };
      });

      const { data: cycles, error: cycErr } = await supabase
        .from("client_cycles")
        .insert(cyclesPayload)
        .select("id");
      if (cycErr) throw cycErr;

       const cycleIds = (cycles ?? []).map((c: any) => c.id as string);
       if (cycleIds.length) {
         // IMPORTANTE: o Dashboard do Magic Number lê EXCLUSIVAMENTE de client_cycle_stages
         // e considera apenas as 7 etapas do MAGIC_STAGES.
         const cycleStagesPayload = cycleIds.flatMap((cycleId) =>
           MAGIC_STAGES.map((s) => ({ cycle_id: cycleId, stage: s.key, completed: false })),
         );
        const { error: csErr } = await supabase.from("client_cycle_stages").insert(cycleStagesPayload);
        if (csErr) throw csErr;
      }
      return clientId;
    },
    onSuccess: async (_clientId, vars) => {
      const year = Number(String(vars.magic_due_date).slice(0, 4));
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["clients"] }),
        qc.invalidateQueries({ queryKey: ["clients_all"] }),
        // Atualiza Checklist/Dashboard imediatamente
        ...(Number.isFinite(year)
          ? [
              qc.invalidateQueries({ queryKey: ["client_cycles", year] }),
              qc.invalidateQueries({ queryKey: ["client_cycle_stages", { year }] }),
            ]
          : [
              qc.invalidateQueries({ queryKey: ["client_cycles"] }),
              qc.invalidateQueries({ queryKey: ["client_cycle_stages"] }),
            ]),
      ]);
    },
  });
}

export function useDeactivateClientFromMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; year: number; fromMonth: number }) => {
      const { error } = await supabase
        .from("client_cycles")
        .update({ is_active: false })
        .eq("client_id", input.clientId)
        .eq("year", input.year)
        .gte("month", input.fromMonth);
      if (error) throw error;
    },
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["client_cycles"] }),
        qc.invalidateQueries({ queryKey: ["client_cycles", vars.year] }),
        qc.invalidateQueries({ queryKey: ["client_cycle_stages", { year: vars.year }] }),
      ]);
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<TaskRow, "id" | "status"> & { status?: TaskStatus }): Promise<{ id: string }> => {
      const { data, error } = await supabase.from("tasks").insert({
        client_id: input.client_id,
        stage: input.stage,
        assigned_user_id: input.assigned_user_id,
        due_date: input.due_date,
        due_at: input.due_at ?? null,
        status: input.status ?? "pendente",
        title: input.title ?? null,
        description: input.description ?? null,
        created_by: input.created_by,
      }).select("id").single();
      if (error) throw error;
      return { id: data.id };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; userId: string }) => {
      // Soft delete: apenas marca deleted_at
      const { error } = await supabase
        .from("tasks")
        .update({ 
          deleted_at: new Date().toISOString(),
          deleted_by: input.userId
        })
        .eq("id", input.taskId);
      if (error) throw error;
      // O trigger task_soft_delete_uncheck_magic cuidará de desmarcar as etapas do Magic Number
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["deleted_tasks"] }),
        qc.invalidateQueries({ queryKey: ["performance_scores"] }),
        qc.invalidateQueries({ queryKey: ["client_cycle_stages"] }),
        qc.invalidateQueries({ queryKey: ["magic2"] }),
      ]);
    },
  });
}

// =====================================================
// LIXEIRA DE TAREFAS
// =====================================================

export type DeletedTaskRow = TaskRow & {
  client_name?: string;
};

export function useDeletedTasks() {
  return useQuery({
    queryKey: ["deleted_tasks"],
    queryFn: async (): Promise<DeletedTaskRow[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, client_id, stage, assigned_user_id, due_date, due_at, status, title, description, created_by, completed_at, deleted_at, deleted_by")
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DeletedTaskRow[];
    },
  });
}

export function useRestoreTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ 
          deleted_at: null,
          deleted_by: null
        })
        .eq("id", input.taskId);
      if (error) throw error;
      // O trigger task_restore_check_magic cuidará de remarcar as etapas do Magic Number (se concluída)
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["deleted_tasks"] }),
        qc.invalidateQueries({ queryKey: ["client_cycle_stages"] }),
        qc.invalidateQueries({ queryKey: ["magic2"] }),
      ]);
    },
  });
}

export function usePermanentlyDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string }) => {
      // Remove overrides antes
      const { error: ovErr } = await supabase.from("task_deadline_overrides").delete().eq("task_id", input.taskId);
      if (ovErr) throw ovErr;

      // Remove assignees antes
      const { error: asErr } = await supabase.from("task_assignees").delete().eq("task_id", input.taskId);
      if (asErr) throw asErr;

      const { error } = await supabase.from("tasks").delete().eq("id", input.taskId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["deleted_tasks"] });
    },
  });
}

export function useEmptyTrash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // Busca todas as tarefas deletadas
      const { data: deletedTasks, error: fetchErr } = await supabase
        .from("tasks")
        .select("id")
        .not("deleted_at", "is", null);
      if (fetchErr) throw fetchErr;

      const taskIds = (deletedTasks ?? []).map((t: any) => t.id);
      if (taskIds.length === 0) return;

      // Remove overrides
      const { error: ovErr } = await supabase.from("task_deadline_overrides").delete().in("task_id", taskIds);
      if (ovErr) throw ovErr;

      // Remove assignees
      const { error: asErr } = await supabase.from("task_assignees").delete().in("task_id", taskIds);
      if (asErr) throw asErr;

      // Remove todas as tarefas na lixeira
      const { error } = await supabase.from("tasks").delete().not("deleted_at", "is", null);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["deleted_tasks"] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string }) => {
      // Delete dependent data first to avoid FK issues (and keep DB clean)
      const { data: cycles, error: cycErr } = await supabase
        .from("client_cycles")
        .select("id")
        .eq("client_id", input.clientId);
      if (cycErr) throw cycErr;

      const cycleIds = (cycles ?? []).map((c: any) => c.id as string);
      if (cycleIds.length) {
        const { error: csErr } = await supabase.from("client_cycle_stages").delete().in("cycle_id", cycleIds);
        if (csErr) throw csErr;
      }

      const { error: delCyclesErr } = await supabase.from("client_cycles").delete().eq("client_id", input.clientId);
      if (delCyclesErr) throw delCyclesErr;

      const { error: delStagesErr } = await supabase.from("client_stages").delete().eq("client_id", input.clientId);
      if (delStagesErr) throw delStagesErr;

      const { error: delTasksErr } = await supabase.from("tasks").delete().eq("client_id", input.clientId);
      if (delTasksErr) throw delTasksErr;

      const { error: delClientErr } = await supabase.from("clients").delete().eq("id", input.clientId);
      if (delClientErr) throw delClientErr;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["clients"] }),
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["client_stages"] }),
        qc.invalidateQueries({ queryKey: ["client_cycles"] }),
        qc.invalidateQueries({ queryKey: ["client_cycle_stages"] }),
      ]);
    },
  });
}

export function useSetTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { taskId: string; status: TaskStatus; userId: string }) => {
      const { data: task, error: tErr } = await supabase
        .from("tasks")
        .select("client_id, stage, due_date")
        .eq("id", input.taskId)
        .maybeSingle();
      if (tErr) throw tErr;
      if (!task) throw new Error("Tarefa não encontrada");

      const { error } = await supabase.from("tasks").update({ status: input.status }).eq("id", input.taskId);
      if (error) throw error;

      // Magic Number v2 (magic2): somente estágios suportados pela tabela magic2_cycle_stages
      const MAGIC2_STAGE_KEYS = new Set([
        "captacao",
        "edicao_videos",
        "planejamento",
        "design",
        "pdf",
        "alteracoes",
        "agendamento",
      ]);
      const taskStage = String(task.stage);

      // Regras de sincronização (Magic Number):
      // - Checklist (client_cycle_stages) é a fonte do Dashboard.
      // - Ao concluir UMA tarefa da etapa no mês -> marca a etapa como concluída.
      // - Ao desmarcar tarefa -> verifica se ainda há outras concluídas; se não, desmarca a etapa.
      const [y, m] = String(task.due_date).split("-");
      const year = Number(y);
      const month = Number(m);
      if (year && month) {
        const isCompleting = input.status === "concluido";

        const syncMagic2 = async (nextCompleted: boolean) => {
          if (!MAGIC2_STAGE_KEYS.has(taskStage)) return;

          // Garante o link (agenda_client_id -> magic2_client_id)
          const { data: magic2ClientId, error: linkErr } = await supabase.rpc("magic2_ensure_client_link", {
            _agenda_client_id: task.client_id,
          });
          if (linkErr) throw linkErr;
          if (!magic2ClientId) return;

          const { data: cycleRow, error: cycErr } = await supabase
            .from("magic2_cycles")
            .select("id")
            .eq("client_id", magic2ClientId)
            .eq("year", year)
            .eq("month", month)
            .maybeSingle();
          if (cycErr) throw cycErr;
          if (!cycleRow?.id) return;

          // Atualiza a etapa do ciclo
          const payload = nextCompleted
            ? { completed: true, completed_at: new Date().toISOString(), completed_by: input.userId }
            : { completed: false, completed_at: null, completed_by: null };

          const { error: stErr } = await supabase
            .from("magic2_cycle_stages")
            .update(payload)
            .eq("cycle_id", cycleRow.id)
            // Tipagem do client exige o enum magic2_stage_type; aqui garantimos via whitelist acima.
            .eq("stage", taskStage as any);
          if (stErr) throw stErr;
        };

        if (isCompleting) {
          // Legado (client_stages): só marca (não desmarca)
          const { error: stErr } = await supabase
            .from("client_stages")
            .update({ completed: true, completed_at: new Date().toISOString(), completed_by: input.userId })
            .eq("client_id", task.client_id)
            .eq("stage", task.stage);
          if (stErr) throw stErr;

          // Magic Number mensal: upsert do ciclo + etapa (marca)
          const due_date = `${year}-${String(month).padStart(2, "0")}-27`;
          const { data: existingCycle, error: cErr } = await supabase
            .from("client_cycles")
            .select("id")
            .eq("client_id", task.client_id)
            .eq("year", year)
            .eq("month", month)
            .maybeSingle();
          if (cErr) throw cErr;

          let cycleId = existingCycle?.id as string | undefined;
          if (!cycleId) {
            const { data: newCycle, error: insErr } = await supabase
              .from("client_cycles")
              .insert({ client_id: task.client_id, year, month, due_date })
              .select("id")
              .single();
            if (insErr) throw insErr;
            cycleId = newCycle.id as string;
          }

          const patch = { completed: true, completed_at: new Date().toISOString(), completed_by: input.userId };

          const { data: stageRow, error: sSelErr } = await supabase
            .from("client_cycle_stages")
            .select("id")
            .eq("cycle_id", cycleId)
            .eq("stage", task.stage)
            .maybeSingle();
          if (sSelErr) throw sSelErr;

          if (!stageRow?.id) {
            const { error: sInsErr } = await supabase.from("client_cycle_stages").insert({ cycle_id: cycleId, stage: task.stage, ...patch });
            if (sInsErr) throw sInsErr;
          } else {
            const { error: sUpdErr } = await supabase.from("client_cycle_stages").update(patch).eq("id", stageRow.id);
            if (sUpdErr) throw sUpdErr;
          }

          // Magic Number v2
          await syncMagic2(true);
        } else {
          // Desmarcando tarefa: verificar se ainda há outras tarefas concluídas para a mesma etapa/cliente/mês
          const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
          // Calcular último dia do mês corretamente (usando Date para obter o último dia)
          const lastDay = new Date(year, month, 0).getDate();
          const endOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
          
          const { data: otherCompleted, error: ocErr } = await supabase
            .from("tasks")
            .select("id")
            .eq("client_id", task.client_id)
            .eq("stage", task.stage)
            .eq("status", "concluido")
            .neq("id", input.taskId)
            .gte("due_date", startOfMonth)
            .lte("due_date", endOfMonth)
            .limit(1);
          if (ocErr) throw ocErr;

          // Se não há outras tarefas concluídas, desmarcar a etapa no Magic Number
          if (!otherCompleted || otherCompleted.length === 0) {
            const { data: existingCycle, error: cErr } = await supabase
              .from("client_cycles")
              .select("id")
              .eq("client_id", task.client_id)
              .eq("year", year)
              .eq("month", month)
              .maybeSingle();
            if (cErr) throw cErr;

            if (existingCycle?.id) {
              const { error: sUpdErr } = await supabase
                .from("client_cycle_stages")
                .update({ completed: false, completed_at: null, completed_by: null })
                .eq("cycle_id", existingCycle.id)
                .eq("stage", task.stage);
              if (sUpdErr) throw sUpdErr;
            }

            // Legado (client_stages): também desmarcar
            const { error: stErr } = await supabase
              .from("client_stages")
              .update({ completed: false, completed_at: null, completed_by: null })
              .eq("client_id", task.client_id)
              .eq("stage", task.stage);
            if (stErr) throw stErr;

            // Magic Number v2
            await syncMagic2(false);
          }
        }
      }

      // Retorna a chave do mês para invalidarmos o Dashboard exatamente.
      return {
        year: Number.isFinite(year) ? year : null,
      };
    },
    onSuccess: async (result) => {
      const year = result?.year ?? null;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["client_stages"] }),
        // mantém invalidação ampla
        qc.invalidateQueries({ queryKey: ["client_cycles"] }),
        qc.invalidateQueries({ queryKey: ["client_cycle_stages"] }),
        // e também invalida as chaves exatas usadas no MagicPanel/MagicChecklistTable
        ...(year
          ? [
              qc.invalidateQueries({ queryKey: ["client_cycles", year] }),
              qc.invalidateQueries({ queryKey: ["client_cycle_stages", { year }] }),
            ]
          : []),
      ]);
    },
  });
}

export function useToggleChecklistStageTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { clientId: string; stage: StageKey; year: number; month: number }) => {
      const { data, error } = await supabase.rpc("toggle_stage_tasks_checklist", {
        _client_id: input.clientId,
        _stage: input.stage,
        _year: input.year,
        _month: input.month,
      });
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
    onSuccess: async (_data, vars) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["client_stages"] }),
        // invalidar chaves exatas usadas pelos hooks
        qc.invalidateQueries({ queryKey: ["client_cycles", vars.year] }),
        qc.invalidateQueries({ queryKey: ["client_cycle_stages", { year: vars.year }] }),
      ]);
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      updates: Partial<Omit<TaskRow, "id" | "created_by" | "completed_at">>;
    }) => {
      const { error } = await supabase
        .from("tasks")
        .update(input.updates)
        .eq("id", input.taskId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
