import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PmTask, PmComment, PmAttachment, PmProject } from "../pm-types";
import { PM_TEMPLATE_SUBTASKS } from "../pm-constants";

const sb = supabase as any;

// ── Queries ──

// Colunas leves usadas em listagens (Kanban, Cronograma, agrupamentos).
// Omite campos pesados como `description` (média 2KB, máx 557KB) que só são
// necessários ao abrir o detalhe da tarefa — ali usamos queries específicas.
const PM_TASK_LIST_COLUMNS = "id,project_id,client_id,title,priority,status_global,stage_current,start_date,due_date,created_by,assignee_id,watchers,tags,created_at,updated_at,parent_task_id,cover_url,is_extra_demand,is_draft,post_type,posting_date,posting_time,deleted_at,deleted_by,origin_task_id,periodic_stage_key";

/** Fetch only root tasks (no parent) — SELECT * (description usada em widgets) */
export function usePmTasks() {
  return useQuery<PmTask[]>({
    queryKey: ["pm_tasks"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("pm_tasks")
        .select("*")
        .is("parent_task_id", null)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Fetch child tasks of a parent — versão completa (usado no dialog) */
export function usePmChildTasks(parentId: string | null) {
  return useQuery<PmTask[]>({
    queryKey: ["pm_child_tasks", parentId],
    enabled: !!parentId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("pm_tasks")
        .select("*")
        .eq("parent_task_id", parentId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Fetch all child tasks (kanban progress) — colunas leves */
export function usePmAllChildTasks() {
  return useQuery<PmTask[]>({
    queryKey: ["pm_child_tasks_all"],
    queryFn: async () => {
      const pageSize = 1000;
      const allRows: PmTask[] = [];

      for (let from = 0; ; from += pageSize) {
        const { data, error } = await sb
          .from("pm_tasks")
          .select(PM_TASK_LIST_COLUMNS)
          .not("parent_task_id", "is", null)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const rows = (data ?? []) as PmTask[];
        allRows.push(...rows);
        if (rows.length < pageSize) break;
      }

      return allRows;
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
      origin_task_id?: string | null;
      useTemplate?: boolean;
      is_extra_demand?: boolean;
      is_draft?: boolean;
      status_global?: string;
      watchers?: string[];
      post_type?: string;
      posting_time?: string;
      periodic_stage_key?: string | null;
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

      // Activity log (fire-and-forget)
      sb.from("pm_activity_log").insert({
        entity_type: "task",
        entity_id: data.parent_task_id ?? data.id,
        action: "created",
        metadata: { title: data.title, parent_task_id: data.parent_task_id, child_id: data.parent_task_id ? data.id : undefined },
        created_by: user.id,
      }).then(() => {}, () => {});

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

  const invalidatePerformanceQueries = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["deadline_report_tasks"] });
    qc.invalidateQueries({ queryKey: ["performance_scores"] });
    qc.invalidateQueries({ queryKey: ["performance_scores_metas"] });
    qc.invalidateQueries({ queryKey: ["performance_scores_annual"] });
    qc.invalidateQueries({ queryKey: ["performance_scores_annual_widget"] });
    qc.invalidateQueries({ queryKey: ["performance_scores_team_avg"] });
    qc.invalidateQueries({ queryKey: ["my_monthly_rank"] });
    qc.invalidateQueries({ queryKey: ["my_annual_rank"] });
  };

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PmTask> & { id: string }) => {
      const { data, error } = await sb.from("pm_tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;

        // ── Fire-and-forget background work (non-blocking) ──
      const bgWork = async () => {
        const shouldRecalcTagPoints = Object.prototype.hasOwnProperty.call(updates, "tags") && !data.parent_task_id;
        if (shouldRecalcTagPoints) {
          try {
            await supabase.rpc("pm_recalc_tag_points", { _pm_task_id: id } as any);
          } catch (e) { console.error("Error recalculating tag points:", e); }
        }

        // Forward-sync: propagate shared content fields to downstream tasks.
        // post_type is branch identity (DSG/VDO/PLAN), not shared content; syncing it by
        // origin_task_id makes parallel Design/Vídeo flows overwrite each other.
        const SYNCED_FIELDS = ["description", "tags", "project_id", "is_extra_demand", "caption", "cover_url", "priority"] as const;
        const hasSyncedField = SYNCED_FIELDS.some(f => Object.prototype.hasOwnProperty.call(updates, f));

        if (hasSyncedField && !data.parent_task_id) {
          const syncPayload: Record<string, any> = {};
          for (const f of SYNCED_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(updates, f)) {
              syncPayload[f] = (updates as any)[f];
            }
          }

          const originId = data.origin_task_id ?? data.id;
          const { data: downstream } = await sb
            .from("pm_tasks")
            .select("id, created_at")
            .or(`origin_task_id.eq.${originId},id.eq.${originId}`)
            .is("parent_task_id", null)
            .is("deleted_at", null)
            .gt("created_at", data.created_at)
            .neq("id", id);

          if (downstream?.length) {
            const downstreamIds = downstream.map((d: any) => d.id);
            // Build child sync payload once
            const childSyncPayload: Record<string, any> = {};
            for (const f of ["tags", "is_extra_demand"] as const) {
              if (Object.prototype.hasOwnProperty.call(updates, f)) {
                childSyncPayload[f] = (updates as any)[f];
              }
            }

            // Run all downstream updates in parallel
            await Promise.all([
              sb.from("pm_tasks").update(syncPayload).in("id", downstreamIds),
              ...(Object.keys(childSyncPayload).length > 0
                ? downstreamIds.map((did: string) =>
                    sb.from("pm_tasks").update(childSyncPayload).eq("parent_task_id", did).is("deleted_at", null)
                  )
                : []),
              ...(Object.prototype.hasOwnProperty.call(updates, "tags")
                ? downstreamIds.map((did: string) => {
                    const p = supabase.rpc("pm_recalc_tag_points", { _pm_task_id: did } as any) as any;
                    return p.then ? p.catch(console.error) : Promise.resolve();
                  })
                : []),
            ]);
          }
        }

        // ── Sync due_date to scoring snapshots & recompute ──
        if (Object.prototype.hasOwnProperty.call(updates, "due_date")) {
          try {
            const newDueDate = updates.due_date as string | null;
            // Find all snapshot rows for this PM task (and its children)
            const pmIds = [id];
            const { data: children } = await sb.from("pm_tasks").select("id").eq("parent_task_id", id).is("deleted_at", null);
            if (children?.length) pmIds.push(...children.map((c: any) => c.id));

            // Collect affected users from old snapshots before updating
            const oldSnapshots: { assigned_user_id: string; due_date: string }[] = [];
            for (const pid of pmIds) {
              const { data: snaps } = await sb.from("tasks")
                .select("assigned_user_id, due_date")
                .like("description", `pm:${pid}:%`)
                .is("deleted_at", null);
              if (snaps) oldSnapshots.push(...snaps);
            }

            // Update snapshot due_dates
            if (newDueDate) {
              for (const pid of pmIds) {
                await sb.from("tasks")
                  .update({ due_date: newDueDate })
                  .like("description", `pm:${pid}:%`)
                  .is("deleted_at", null);
              }
            }

            // Collect all affected periods (old + new) and user ids
            const periods = new Map<string, { year: number; month: number }>();
            const userIds = new Set<string>();
            for (const snap of oldSnapshots) {
              if (snap.assigned_user_id && snap.due_date) {
                userIds.add(snap.assigned_user_id);
                const d = new Date(`${snap.due_date}T00:00:00`);
                const k = `${d.getFullYear()}-${d.getMonth() + 1}`;
                periods.set(k, { year: d.getFullYear(), month: d.getMonth() + 1 });
              }
            }
            if (newDueDate) {
              const nd = new Date(`${newDueDate}T00:00:00`);
              const k = `${nd.getFullYear()}-${nd.getMonth() + 1}`;
              periods.set(k, { year: nd.getFullYear(), month: nd.getMonth() + 1 });
            }

            // Recompute scores for all affected users in all affected months
            await Promise.all(
              Array.from(userIds).flatMap(uid =>
                Array.from(periods.values()).map(({ year, month }) =>
                  supabase.rpc("recompute_metas_prazos", { _user_id: uid, _year: year, _month: month }).then(null, console.error)
                )
              )
            );
          } catch (e) { console.error("Error syncing due_date to snapshots:", e); }
        }

        // Activity log (fire-and-forget)
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const logEntityId = data.parent_task_id ?? id;
            await sb.from("pm_activity_log").insert({
              entity_type: "task",
              entity_id: logEntityId,
              action: "updated",
              metadata: { ...updates, task_id: id, _ref_title: data.title },
              created_by: user.id,
            });
          }
        } catch (_) {}
      };

      // Don't await background work - let it run async
      bgWork().catch(console.error);

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
    onSuccess: (_data, variables) => {
      if (Object.prototype.hasOwnProperty.call(variables, "tags") || Object.prototype.hasOwnProperty.call(variables, "due_date")) {
        invalidatePerformanceQueries();
      }
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

      // Run initial reads in parallel
      const [taskInfoRes, affectedRes, childrenRes] = await Promise.all([
        sb.from("pm_tasks").select("title, client_id, due_date, stage_current").eq("id", id).single(),
        sb.from("tasks").select("assigned_user_id, due_date, description").like("description", `pm:${id}:%`).is("deleted_at", null),
        sb.from("pm_tasks").select("id").eq("parent_task_id", id),
      ]);

      const taskInfo = taskInfoRes.data;
      const affectedRows = affectedRes.data ?? [];
      const children = childrenRes.data ?? [];

      // SOFT-DELETE the pm_task (and its children)
      const now = new Date().toISOString();
      const softDeleteUpdates = { deleted_at: now, deleted_by: user?.id ?? null };
      
      const { error } = await sb.from("pm_tasks").update(softDeleteUpdates).eq("id", id);
      if (error) throw error;
      
      // Soft-delete children too
      if (children.length) {
        await sb.from("pm_tasks").update(softDeleteUpdates).eq("parent_task_id", id);
      }

      // Everything below is cleanup — soft-delete scoring snapshots
      const affectedUsers = new Map<string, { year: number; month: number }>();
      affectedRows.forEach((r: any) => {
        if (r.assigned_user_id && r.due_date) {
          const d = new Date(r.due_date);
          affectedUsers.set(r.assigned_user_id, { year: d.getFullYear(), month: d.getMonth() + 1 });
        }
      });

      // Soft-delete parent snapshots + child snapshots in parallel
      const softDeleteOps: Promise<any>[] = [
        sb.from("tasks").update({ deleted_at: now, deleted_by: user?.id ?? null }).like("description", `pm:${id}:%`).is("deleted_at", null),
      ];

      if (children.length) {
        const childOps = children.map(async (child: any) => {
          const { data: childAffected } = await sb.from("tasks").select("assigned_user_id, due_date").like("description", `pm:${child.id}:%`).is("deleted_at", null);
          (childAffected ?? []).forEach((r: any) => {
            if (r.assigned_user_id && r.due_date) {
              const d = new Date(r.due_date);
              affectedUsers.set(r.assigned_user_id, { year: d.getFullYear(), month: d.getMonth() + 1 });
            }
          });
          return sb.from("tasks").update({ deleted_at: now, deleted_by: user?.id ?? null }).like("description", `pm:${child.id}:%`).is("deleted_at", null);
        });
        softDeleteOps.push(...childOps);
      }

      await Promise.all(softDeleteOps);

      // Unmark Magic Number (fire-and-forget style)
      if (taskInfo?.client_id && taskInfo?.due_date) {
        try {
          const dueDate = new Date(taskInfo.due_date);
          const year = dueDate.getFullYear();
          const month = dueDate.getMonth() + 1;

          const { data: link } = await sb.from("magic2_client_links").select("magic2_client_id").eq("agenda_client_id", taskInfo.client_id).limit(1).maybeSingle();
          if (link?.magic2_client_id) {
            const { data: cycle } = await sb.from("magic2_cycles").select("id").eq("client_id", link.magic2_client_id).eq("year", year).eq("month", month).limit(1).maybeSingle();
            if (cycle?.id) {
              const completedStages = new Set<string>();
              affectedRows.forEach((r: any) => {
                const desc = r.description as string;
                if (desc) {
                  const parts = desc.split(":");
                  if (parts.length >= 3) completedStages.add(parts[2]);
                }
              });

              await Promise.all(
                Array.from(completedStages).map(async (stage) => {
                  const { data: otherTasks } = await sb.from("tasks").select("id").like("description", `pm:%:${stage}:%`).is("deleted_at", null).eq("client_id", taskInfo.client_id).eq("status", "concluido").limit(1);
                  if (!(otherTasks ?? []).length) {
                    await sb.from("magic2_cycle_stages").update({ completed: false, completed_at: null, completed_by: null, updated_at: new Date().toISOString() }).eq("cycle_id", cycle.id).eq("stage", stage);
                  }
                })
              );
            }
          }
        } catch (e) {
          console.error("Error unchecking magic number:", e);
        }
      }

      // Recompute scores
      await Promise.all(
        Array.from(affectedUsers).map(async ([userId, { year, month }]) => {
          try {
            await supabase.rpc("recompute_all_scores", { _user_id: userId, _year: year, _month: month } as any);
          } catch (e) {
            console.error("Error recomputing scores:", userId, e);
          }
        })
      );
    },
    onMutate: async (id) => {
      // Optimistic removal from cache
      await qc.cancelQueries({ queryKey: ["pm_tasks"] });
      await qc.cancelQueries({ queryKey: ["pm_child_tasks_all"] });
      const prevTasks = qc.getQueryData<PmTask[]>(["pm_tasks"]);
      const prevChildren = qc.getQueryData<PmTask[]>(["pm_child_tasks_all"]);
      if (prevTasks) qc.setQueryData(["pm_tasks"], prevTasks.filter(t => t.id !== id));
      if (prevChildren) qc.setQueryData(["pm_child_tasks_all"], prevChildren.filter(t => t.parent_task_id !== id));
      return { prevTasks, prevChildren };
    },
    onError: (_err, _id, ctx: any) => {
      if (ctx?.prevTasks) qc.setQueryData(["pm_tasks"], ctx.prevTasks);
      if (ctx?.prevChildren) qc.setQueryData(["pm_child_tasks_all"], ctx.prevChildren);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
      qc.invalidateQueries({ queryKey: ["magic2"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["performance_scores"] });
      qc.invalidateQueries({ queryKey: ["deleted_pm_tasks"] });
    },
  });
}

/** Fetch soft-deleted PM tasks for trash panel */
export function useDeletedPmTasks() {
  return useQuery<PmTask[]>({
    queryKey: ["deleted_pm_tasks"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("pm_tasks")
        .select("*")
        .not("deleted_at", "is", null)
        .is("parent_task_id", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Restore a soft-deleted PM task */
export function useRestorePmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Restore the PM task and its children
      const { error } = await sb.from("pm_tasks").update({ deleted_at: null, deleted_by: null }).eq("id", id);
      if (error) throw error;
      await sb.from("pm_tasks").update({ deleted_at: null, deleted_by: null }).eq("parent_task_id", id);

      // Restore scoring snapshots
      const now = new Date().toISOString();
      await sb.from("tasks").update({ deleted_at: null, deleted_by: null }).like("description", `pm:${id}:%`);
      
      // Also restore children snapshots
      const { data: children } = await sb.from("pm_tasks").select("id").eq("parent_task_id", id);
      if (children?.length) {
        await Promise.all(
          children.map((c: any) => sb.from("tasks").update({ deleted_at: null, deleted_by: null }).like("description", `pm:${c.id}:%`))
        );
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_child_tasks_all"] });
      qc.invalidateQueries({ queryKey: ["deleted_pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["deleted_tasks"] });
      qc.invalidateQueries({ queryKey: ["magic2"] });
    },
  });
}

/** Permanently delete a soft-deleted PM task */
export function usePermanentlyDeletePmTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Get children first
      const { data: children } = await sb.from("pm_tasks").select("id").eq("parent_task_id", id);
      const allIds = [id, ...(children ?? []).map((c: any) => c.id)];

      // Delete scoring snapshots
      await Promise.all(allIds.map(taskId =>
        sb.from("tasks").delete().like("description", `pm:${taskId}:%`)
      ));

      // Delete PM task and children (hard delete)
      if (children?.length) {
        await sb.from("pm_tasks").delete().eq("parent_task_id", id);
      }
      const { error } = await sb.from("pm_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deleted_pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
    },
  });
}

export function useAddPmComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      task_id: string;
      content: string;
      image_url?: string;
      image_description?: string;
      link_url?: string;
      link_title?: string;
      link_image?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await sb.from("pm_comments").insert({
        task_id: payload.task_id,
        content: payload.content,
        author_id: user.id,
        image_url: payload.image_url ?? null,
        image_description: payload.image_description ?? null,
        link_url: payload.link_url ?? null,
        link_title: payload.link_title ?? null,
        link_image: payload.link_image ?? null,
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
