import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PmTask, PmSubtask, PmComment, PmAttachment, PmProject } from "../pm-types";
import { PM_TEMPLATE_SUBTASKS } from "../pm-constants";

const sb = supabase as any;

// ── Queries ──

export function usePmTasks() {
  return useQuery<PmTask[]>({
    queryKey: ["pm_tasks"],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePmSubtasks(taskId: string | null) {
  return useQuery<PmSubtask[]>({
    queryKey: ["pm_subtasks", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await sb.from("pm_subtasks").select("*").eq("task_id", taskId).order("order_index");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePmComments(taskId: string | null) {
  return useQuery<PmComment[]>({
    queryKey: ["pm_comments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await sb.from("pm_comments").select("*").eq("task_id", taskId).order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePmAttachments(taskId: string | null) {
  return useQuery<PmAttachment[]>({
    queryKey: ["pm_attachments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await sb.from("pm_attachments").select("*").eq("task_id", taskId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePmProjects() {
  return useQuery<PmProject[]>({
    queryKey: ["pm_projects"],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Mutations ──

export function useCreatePmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      client_id: string;
      title: string;
      description?: string;
      priority?: string;
      stage_current?: string;
      due_date?: string;
      assignee_id?: string;
      project_id?: string;
      tags?: string[];
      useTemplate?: boolean;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { useTemplate, ...rest } = payload;
      const { data, error } = await sb.from("pm_tasks").insert({
        ...rest,
        created_by: user.id,
        status_global: "backlog",
      }).select().single();
      if (error) throw error;

      // Create template subtasks
      if (useTemplate !== false) {
        const subtasks = PM_TEMPLATE_SUBTASKS.map((t) => ({
          task_id: data.id,
          title: t.title,
          stage: t.stage,
          order_index: t.order_index,
          is_required: t.is_required,
        }));
        await sb.from("pm_subtasks").insert(subtasks);
      }

      // Activity log
      await sb.from("pm_activity_log").insert({
        entity_type: "task",
        entity_id: data.id,
        action: "created",
        metadata: { title: data.title },
        created_by: user.id,
      });

      return data as PmTask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
    },
  });
}

export function useUpdatePmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PmTask> & { id: string }) => {
      const { data, error } = await sb.from("pm_tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await sb.from("pm_activity_log").insert({
          entity_type: "task",
          entity_id: id,
          action: "updated",
          metadata: updates,
          created_by: user.id,
        });
      }
      return data as PmTask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
    },
  });
}

export function useDeletePmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("pm_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
    },
  });
}

export function useUpdatePmSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PmSubtask> & { id: string }) => {
      const { data, error } = await sb.from("pm_subtasks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as PmSubtask;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["pm_subtasks"] });
      // Auto-update parent task status
      checkAndUpdateParentStatus(vars.id);
    },
  });
}

export function useCreatePmSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<PmSubtask, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await sb.from("pm_subtasks").insert(payload).select().single();
      if (error) throw error;
      return data as PmSubtask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_subtasks"] });
    },
  });
}

export function useAddPmComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { task_id: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await sb.from("pm_comments").insert({
        ...payload,
        author_id: user.id,
      }).select().single();
      if (error) throw error;

      await sb.from("pm_activity_log").insert({
        entity_type: "comment",
        entity_id: data.id,
        action: "comment_added",
        metadata: { task_id: payload.task_id },
        created_by: user.id,
      });
      return data as PmComment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_comments"] });
    },
  });
}

export function useUploadPmAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ task_id, file }: { task_id: string; file: File }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${task_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pm-attachments").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from("pm-attachments").getPublicUrl(path);

      const { data, error } = await sb.from("pm_attachments").insert({
        task_id,
        uploaded_by: user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: path,
        public_url: urlData.publicUrl,
      }).select().single();
      if (error) throw error;

      await sb.from("pm_activity_log").insert({
        entity_type: "attachment",
        entity_id: data.id,
        action: "file_added",
        metadata: { task_id, file_name: file.name },
        created_by: user.id,
      });
      return data as PmAttachment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_attachments"] });
    },
  });
}

// ── Auto-update parent task status ──
async function checkAndUpdateParentStatus(subtaskId: string) {
  const { data: subtask } = await sb.from("pm_subtasks").select("task_id").eq("id", subtaskId).single();
  if (!subtask) return;

  const { data: allSubs } = await sb.from("pm_subtasks").select("status").eq("task_id", subtask.task_id);
  if (!allSubs || allSubs.length === 0) return;

  const allDone = allSubs.every((s: any) => s.status === "concluido");
  const hasBlocked = allSubs.some((s: any) => s.status === "bloqueado");

  let newStatus: string | null = null;
  if (allDone) newStatus = "concluido";
  else if (hasBlocked) newStatus = "em_andamento";

  if (newStatus) {
    await sb.from("pm_tasks").update({ status_global: newStatus }).eq("id", subtask.task_id);
  }
}
