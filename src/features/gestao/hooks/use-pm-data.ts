import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PmTask, PmComment, PmAttachment, PmProject } from "../pm-types";
import { PM_TEMPLATE_SUBTASKS } from "../pm-constants";

const sb = supabase as any;

// ── Queries ──

/** Fetch only root tasks (no parent) */
export function usePmTasks() {
  return useQuery<PmTask[]>({
    queryKey: ["pm_tasks"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("pm_tasks")
        .select("*")
        .is("parent_task_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Fetch child tasks of a parent */
export function usePmChildTasks(parentId: string | null) {
  return useQuery<PmTask[]>({
    queryKey: ["pm_child_tasks", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("pm_tasks")
        .select("*")
        .eq("parent_task_id", parentId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Fetch all child tasks (for kanban cards progress) */
export function usePmAllChildTasks() {
  return useQuery<PmTask[]>({
    queryKey: ["pm_child_tasks_all"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("pm_tasks")
        .select("*")
        .not("parent_task_id", "is", null)
        .order("created_at", { ascending: true });
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

/** Fetch activity log for a task */
export function usePmActivityLog(taskId: string | null) {
  return useQuery<any[]>({
    queryKey: ["pm_activity_log", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("pm_activity_log")
        .select("*")
        .eq("entity_id", taskId)
        .order("created_at", { ascending: true });
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
      parent_task_id?: string | null;
      useTemplate?: boolean;
      is_extra_demand?: boolean;
      is_draft?: boolean;
      status_global?: string;
      watchers?: string[];
      post_type?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { useTemplate, ...rest } = payload;
      const { data, error } = await sb.from("pm_tasks").insert({
        ...rest,
        created_by: user.id,
        status_global: rest.status_global || "backlog",
      }).select().single();
      if (error) throw error;

      // Activity log
      await sb.from("pm_activity_log").insert({
        entity_type: "task",
        entity_id: data.parent_task_id ?? data.id,
        action: "created",
        metadata: { title: data.title, parent_task_id: data.parent_task_id, child_id: data.parent_task_id ? data.id : undefined },
        created_by: user.id,
      });

      return data as PmTask;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
      qc.invalidateQueries({ queryKey: ["pm_activity_log"] });
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
        // Log to parent task if this is a child
        const logEntityId = data.parent_task_id ?? id;
        await sb.from("pm_activity_log").insert({
          entity_type: "task",
          entity_id: logEntityId,
          action: "updated",
          metadata: { ...updates, task_id: id, title: data.title },
          created_by: user.id,
        });
      }
      return data as PmTask;
    },
    onMutate: async ({ id, ...updates }) => {
      // Optimistic update for instant UI feedback
      await qc.cancelQueries({ queryKey: ["pm_tasks"] });
      await qc.cancelQueries({ queryKey: ["pm_child_tasks"] });
      await qc.cancelQueries({ queryKey: ["pm_child_tasks_all"] });

      const updateInList = (old: PmTask[] | undefined) =>
        old?.map(t => t.id === id ? { ...t, ...updates } as PmTask : t);

      qc.setQueriesData<PmTask[]>({ queryKey: ["pm_tasks"] }, updateInList);
      qc.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks"] }, updateInList);
      qc.setQueriesData<PmTask[]>({ queryKey: ["pm_child_tasks_all"] }, updateInList);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
      qc.invalidateQueries({ queryKey: ["pm_activity_log"] });
    },
  });
}

export function useDeletePmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get task info before deleting
      const { data: taskInfo } = await sb
        .from("pm_tasks")
        .select("title, client_id, due_date, stage_current")
        .eq("id", id)
        .single();

      // Collect ALL affected user IDs from performance snapshots BEFORE soft-deleting
      const { data: affectedRows } = await sb
        .from("tasks")
        .select("assigned_user_id, due_date")
        .like("description", `pm:${id}:%`)
        .is("deleted_at", null);

      const affectedUsers = new Map<string, { year: number; month: number }>();
      (affectedRows ?? []).forEach((r: any) => {
        if (r.assigned_user_id && r.due_date) {
          const d = new Date(r.due_date);
          affectedUsers.set(r.assigned_user_id, { year: d.getFullYear(), month: d.getMonth() + 1 });
        }
      });

      // Soft-delete all performance snapshot tasks linked to this pm_task
      const { error: snapErr } = await sb
        .from("tasks")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
        .like("description", `pm:${id}:%`)
        .is("deleted_at", null);
      if (snapErr) console.error("Error cleaning snapshots:", snapErr);

      // Also delete child pm_tasks first (cascade won't soft-delete snapshots)
      const { data: children } = await sb
        .from("pm_tasks")
        .select("id")
        .eq("parent_task_id", id);
      if (children?.length) {
        for (const child of children) {
          const { data: childAffected } = await sb
            .from("tasks")
            .select("assigned_user_id, due_date")
            .like("description", `pm:${child.id}:%`)
            .is("deleted_at", null);
          (childAffected ?? []).forEach((r: any) => {
            if (r.assigned_user_id && r.due_date) {
              const d = new Date(r.due_date);
              affectedUsers.set(r.assigned_user_id, { year: d.getFullYear(), month: d.getMonth() + 1 });
            }
          });

          await sb
            .from("tasks")
            .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
            .like("description", `pm:${child.id}:%`)
            .is("deleted_at", null);
        }
      }

      // ═══ UNMARK MAGIC NUMBER ═══
      // Reverse what pm_sync_stage_completion did for magic2
      if (taskInfo?.client_id && taskInfo?.due_date) {
        try {
          const dueDate = new Date(taskInfo.due_date);
          const year = dueDate.getFullYear();
          const month = dueDate.getMonth() + 1;

          // Find magic2 client link
          const { data: link } = await sb
            .from("magic2_client_links")
            .select("magic2_client_id")
            .eq("agenda_client_id", taskInfo.client_id)
            .limit(1)
            .maybeSingle();

          if (link?.magic2_client_id) {
            const { data: cycle } = await sb
              .from("magic2_cycles")
              .select("id")
              .eq("client_id", link.magic2_client_id)
              .eq("year", year)
              .eq("month", month)
              .limit(1)
              .maybeSingle();

            if (cycle?.id) {
              // Check if there are OTHER completed tasks for same client/stage/month
              // (excluding the one we're deleting and its children)
              const idsToExclude = [id, ...(children?.map(c => c.id) ?? [])];
              
              // Get all stages that were completed by this task
              const completedStages = new Set<string>();
              (affectedRows ?? []).forEach((r: any) => {
                // description format: pm:{taskId}:{stage}:{userId}
                const desc = r.description as string;
                if (desc) {
                  const parts = desc.split(":");
                  if (parts.length >= 3) completedStages.add(parts[2]);
                }
              });

              // Actually get from tasks table descriptions
              const { data: allSnapshots } = await sb
                .from("tasks")
                .select("description")
                .like("description", `pm:${id}:%`)
                .is("deleted_at", null);
              // Already soft-deleted above, check from affectedRows
              (affectedRows ?? []).forEach((r: any) => {});

              // For each stage this task completed, check if other pm_tasks also completed it
              for (const stage of completedStages) {
                // Check if any other active pm:*:{stage} tasks exist for this client/month
                const { data: otherTasks } = await sb
                  .from("tasks")
                  .select("id")
                  .like("description", `pm:%:${stage}:%`)
                  .is("deleted_at", null)
                  .eq("client_id", taskInfo.client_id)
                  .eq("status", "concluido")
                  .limit(1);

                const hasOther = (otherTasks ?? []).length > 0;
                if (!hasOther) {
                  // Unmark the magic2 stage
                  await sb
                    .from("magic2_cycle_stages")
                    .update({
                      completed: false,
                      completed_at: null,
                      completed_by: null,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("cycle_id", cycle.id)
                    .eq("stage", stage);
                }
              }
            }
          }
        } catch (e) {
          console.error("Error unchecking magic number:", e);
        }
      }

      const { error } = await sb.from("pm_tasks").delete().eq("id", id);
      if (error) throw error;

      // Recompute scores for ALL affected users
      for (const [userId, { year, month }] of affectedUsers) {
        try {
          await supabase.rpc("recompute_all_scores", {
            _user_id: userId,
            _year: year,
            _month: month,
          } as any);
        } catch (e) {
          console.error("Error recomputing scores for user:", userId, e);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
      qc.invalidateQueries({ queryKey: ["magic2"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["performance_scores"] });
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
        task_id: payload.task_id,
        content: payload.content,
        author_id: user.id,
      }).select().single();
      if (error) throw error;

      await sb.from("pm_activity_log").insert({
        entity_type: "comment",
        entity_id: payload.task_id,
        action: "comment_added",
        metadata: { task_id: payload.task_id, content: payload.content },
        created_by: user.id,
      });
      return data as PmComment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_comments"] });
      qc.invalidateQueries({ queryKey: ["pm_activity_log"] });
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
        entity_id: task_id,
        action: "file_added",
        metadata: { task_id, file_name: file.name },
        created_by: user.id,
      });
      return data as PmAttachment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_attachments"] });
      qc.invalidateQueries({ queryKey: ["pm_activity_log"] });
    },
  });
}

// ── Auto-update parent task status when child changes ──
export async function checkAndUpdateParentStatus(taskId: string) {
  const { data: task } = await sb.from("pm_tasks").select("parent_task_id").eq("id", taskId).single();
  if (!task?.parent_task_id) return;

  const { data: siblings } = await sb.from("pm_tasks").select("stage_current").eq("parent_task_id", task.parent_task_id);
  if (!siblings || siblings.length === 0) return;

  const allDone = siblings.every((s: any) => s.stage_current === "entrega");
  if (allDone) {
    await sb.from("pm_tasks").update({ stage_current: "entrega" }).eq("id", task.parent_task_id);
  }
}

// ── Sync stage completion with Magic Number + Performance ──
export function usePmSyncStageCompletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pmTaskId, completedStage, userId, scoringUserIds }: {
      pmTaskId: string;
      completedStage: string;
      userId: string;
      scoringUserIds?: string[];
    }) => {
      const { error } = await supabase.rpc("pm_sync_stage_completion", {
        _pm_task_id: pmTaskId,
        _completed_stage: completedStage,
        _user_id: userId,
        _scoring_user_ids: scoringUserIds ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["magic2"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Keep backward compat exports
export function useUpdatePmSubtask() { return useUpdatePmTask(); }
export function useCreatePmSubtask() { return useCreatePmTask(); }
export function usePmSubtasks(taskId: string | null) { return usePmChildTasks(taskId); }
export function usePmSubtaskComments(id: string | null) { return usePmComments(id); }
export function usePmSubtaskAttachments(id: string | null) { return usePmAttachments(id); }
export function useUploadPmSubtaskAttachment() { return useUploadPmAttachment(); }
