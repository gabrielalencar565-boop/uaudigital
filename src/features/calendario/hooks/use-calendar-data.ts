import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CalendarPublication, CalendarStatus, PublicationCalendar } from "../calendar-types";

const sb = supabase as any;

export function useCalendarsForClient(clientId: string | null) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["publication_calendars", clientId],
    queryFn: async (): Promise<PublicationCalendar[]> => {
      const { data, error } = await sb
        .from("publication_calendars")
        .select("*")
        .eq("client_id", clientId)
        .order("cycle_start", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCalendarsForCycle(cycleStart: string) {
  return useQuery({
    queryKey: ["publication_calendars_cycle", cycleStart],
    queryFn: async (): Promise<Pick<PublicationCalendar, "id" | "client_id" | "status">[]> => {
      const { data, error } = await sb
        .from("publication_calendars")
        .select("id, client_id, status")
        .eq("cycle_start", cycleStart);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCalendarPublications(calendarId: string | null) {
  return useQuery({
    enabled: !!calendarId,
    queryKey: ["calendar_publications", calendarId],
    queryFn: async (): Promise<CalendarPublication[]> => {
      const { data, error } = await sb
        .from("calendar_publications")
        .select("*")
        .eq("calendar_id", calendarId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTaskAttachmentsMap(taskIds: string[]) {
  return useQuery({
    enabled: taskIds.length > 0,
    queryKey: ["pm_attachments_for_calendar", taskIds],
    queryFn: async () => {
      // Only "final" content goes to the calendar/carousel — production materials
      // (category "material") are internal working files, never client-facing.
      const { data, error } = await sb
        .from("pm_attachments")
        .select("id, task_id, public_url, thumbnail_url, file_type, order_index")
        .in("task_id", taskIds)
        .eq("category", "final")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const map = new Map<string, { id: string; url: string; thumbUrl: string; type: string | null }[]>();
      for (const row of (data ?? []) as { id: string; task_id: string; public_url: string | null; thumbnail_url: string | null; file_type: string | null }[]) {
        if (!row.public_url) continue;
        const prev = map.get(row.task_id) ?? [];
        // url stays full-resolution — PublicationPreviewPanel reads this same map directly
        // for the actual editing/review view. thumbUrl (generated client-side at upload
        // time, see uploadImageThumbnail in use-pm-data.ts) is a small Supabase
        // Storage-hosted JPEG meant only for the grid/list/feed cards below; older rows
        // uploaded before that existed just fall back to the full original there too.
        prev.push({ id: row.id, url: row.public_url, thumbUrl: row.thumbnail_url ?? row.public_url, type: row.file_type });
        map.set(row.task_id, prev);
      }
      return map;
    },
  });
}

// Persists a new drag-and-drop order for a carrossel's pages — order_index defaults to
// 0 for every attachment (never set anywhere else), so writing 0..N-1 here makes it the
// authoritative sort key going forward, ahead of the created_at fallback in
// useTaskAttachmentsMap's query above.
export function useReorderCarouselImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderedIds }: { orderedIds: string[] }) => {
      const results = await Promise.all(
        orderedIds.map((id, index) => sb.from("pm_attachments").update({ order_index: index }).eq("id", id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_attachments_for_calendar"] });
    },
  });
}

// Tasks tagged "Capa" (see useCoverCandidates) are just holding-cells for cover art —
// their own content_type is 'outro' by default, but the calendar cards should badge
// them as "Capa" instead so they're recognizable at a glance among real posts.
export function useCapaTaskIds(taskIds: string[]) {
  return useQuery({
    enabled: taskIds.length > 0,
    queryKey: ["capa_task_ids", taskIds],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await sb.from("pm_tasks").select("id, tags").in("id", taskIds);
      if (error) throw error;
      const capaIds = ((data ?? []) as { id: string; tags: string[] | null }[])
        .filter((t) => (t.tags ?? []).some((tag) => tag.split(":")[0].trim().toLowerCase() === "capa"))
        .map((t) => t.id);
      return new Set(capaIds);
    },
  });
}

// A publication's cover_attachment_id can point at an attachment that belongs to a
// *different* task (e.g. picked from a sibling "Capa" task during the PDF stage — see
// useCoverCandidates below), so it won't be in that task's own useTaskAttachmentsMap
// entry. This fetches those specific attachments directly by id so mediaFor() can still
// resolve and show them as the thumbnail everywhere.
export function useCoverAttachmentsById(ids: string[]) {
  return useQuery({
    enabled: ids.length > 0,
    queryKey: ["cover_attachments_by_id", ids],
    queryFn: async () => {
      const { data, error } = await sb.from("pm_attachments").select("id, public_url, thumbnail_url, file_type").in("id", ids);
      if (error) throw error;
      const map = new Map<string, { id: string; url: string; thumbUrl: string; type: string | null }>();
      for (const row of (data ?? []) as { id: string; public_url: string | null; thumbnail_url: string | null; file_type: string | null }[]) {
        if (!row.public_url) continue;
        map.set(row.id, { id: row.id, url: row.public_url, thumbUrl: row.thumbnail_url ?? row.public_url, type: row.file_type });
      }
      return map;
    },
  });
}

// During the "PDF" production stage, the design team often splits a batch into sibling
// tasks under one parent (one per post + a dedicated one tagged "Capa" holding candidate
// cover art). This surfaces that sibling's image attachments as extra cover options,
// alongside the post's own attachments, when picking a Reel's cover.
export function useCoverCandidates(taskId: string | null) {
  return useQuery({
    enabled: !!taskId,
    queryKey: ["cover_candidates", taskId],
    queryFn: async (): Promise<{ id: string; url: string; type: string | null }[]> => {
      const { data: task } = await sb.from("pm_tasks").select("parent_task_id").eq("id", taskId).maybeSingle();
      if (!task?.parent_task_id) return [];

      const { data: siblings } = await sb
        .from("pm_tasks")
        .select("id, tags")
        .eq("parent_task_id", task.parent_task_id);
      const capaTaskIds = ((siblings ?? []) as { id: string; tags: string[] | null }[])
        .filter((s) => s.id !== taskId && (s.tags ?? []).some((t) => t.split(":")[0].trim().toLowerCase() === "capa"))
        .map((s) => s.id);
      if (capaTaskIds.length === 0) return [];

      const { data: atts } = await sb
        .from("pm_attachments")
        .select("id, public_url, file_type")
        .in("task_id", capaTaskIds)
        .order("created_at", { ascending: true });
      return ((atts ?? []) as { id: string; public_url: string | null; file_type: string | null }[])
        .filter((a) => a.public_url && a.file_type?.startsWith("image/"))
        .map((a) => ({ id: a.id, url: a.public_url as string, type: a.file_type }));
    },
  });
}

// Root tasks of a client that aren't in the Cronograma yet — candidates for the "+ Nova
// publicação" dialog's "Usar tarefa existente" tab. Excludes tasks that already have a
// calendar_publications row, and tasks with active (non-deleted) subtasks, since the
// pm_task_pdf_stage_to_calendar trigger silently skips those (a container task never gets
// its own calendar row) — offering them here would just silently do nothing on confirm.
export function useUnscheduledClientTasks(clientId: string | null) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["unscheduled_client_tasks", clientId],
    queryFn: async (): Promise<
      { id: string; title: string; tags: string[]; posting_date: string | null; stage_current: string; due_date: string | null; assignee_id: string | null }[]
    > => {
      const { data: tasks, error } = await sb
        .from("pm_tasks")
        .select("id, title, tags, posting_date, stage_current, due_date, assignee_id")
        .eq("client_id", clientId)
        .is("parent_task_id", null)
        .is("deleted_at", null)
        .order("title", { ascending: true });
      if (error) throw error;
      const taskIds = (tasks ?? []).map((t: { id: string }) => t.id);
      if (taskIds.length === 0) return [];

      const [{ data: scheduled }, { data: withChildren }] = await Promise.all([
        sb.from("calendar_publications").select("task_id").in("task_id", taskIds),
        sb.from("pm_tasks").select("parent_task_id").in("parent_task_id", taskIds).is("deleted_at", null),
      ]);
      const scheduledIds = new Set((scheduled ?? []).map((r: { task_id: string }) => r.task_id));
      const parentIds = new Set((withChildren ?? []).map((r: { parent_task_id: string }) => r.parent_task_id));

      return (tasks ?? []).filter((t: { id: string }) => !scheduledIds.has(t.id) && !parentIds.has(t.id));
    },
  });
}

// Backs the "Enviar para o cronograma" shortcut in the Gestão task dialog — lets it know
// whether the task already has a calendar_publications row (and its id, to jump straight to
// it) without duplicating the lookup at every call site.
export function useTaskCalendarEntry(taskId: string | null) {
  return useQuery({
    enabled: !!taskId,
    queryKey: ["task_calendar_entry", taskId],
    queryFn: async (): Promise<{ id: string; calendar_id: string } | null> => {
      const { data, error } = await sb
        .from("calendar_publications")
        .select("id, calendar_id")
        .eq("task_id", taskId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateCalendarPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CalendarPublication> & { id: string }) => {
      const { data, error } = await sb.from("calendar_publications").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return {
        data: data as CalendarPublication,
        scheduledChanged: typeof updates.instagram_scheduled === "boolean",
      };
    },
    onSuccess: ({ data, scheduledChanged }) => {
      qc.invalidateQueries({ queryKey: ["calendar_publications", data.calendar_id] });
      // The per-publication "Agendar publicação"/"Cancelar agendamento" actions go through this
      // same generic update — whichever direction instagram_scheduled just flipped,
      // trg_complete_agendamento_on_scheduled / trg_uncomplete_agendamento_on_unscheduled may have
      // completed or reverted the pipeline's agendamento task, so refresh those views too.
      if (scheduledChanged) {
        qc.invalidateQueries({ queryKey: ["pm_tasks"] });
        qc.invalidateQueries({ queryKey: ["pm_task_status_for_calendar"] });
        qc.invalidateQueries({ queryKey: ["magic2"] });
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    },
  });
}

// Bulk "Concluir" action for a whole cycle: marks each underlying task as concluído in
// one stroke — the team clicks once after actually posting everything live instead of
// doing it post by post. The publication's own approval status (aguardando_aprovacao /
// alteracao_solicitada / aprovada) is untouched; it already reflects the client review,
// concluding is purely about closing out the team's task.
export function usePublishCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ calendarId, taskIds }: { calendarId: string; taskIds: string[] }) => {
      if (taskIds.length > 0) {
        const { error: taskError } = await sb.from("pm_tasks").update({ status_global: "concluido" }).in("id", taskIds);
        if (taskError) throw taskError;
      }
      return { calendarId };
    },
    onSuccess: ({ calendarId }) => {
      qc.invalidateQueries({ queryKey: ["calendar_publications", calendarId] });
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_task_status_for_calendar"] });
    },
  });
}

// Reverses usePublishCycle — same tasks, back to backlog. Note this only touches
// pm_tasks.status_global; the Agenda actually reads a separate `tasks.status` snapshot and
// Magic Number reads `magic2_cycle_stages.completed` (both flipped to done by
// pm_sync_stage_completion when the stage was originally completed) — this does NOT reverse
// those, so they can end up showing "concluído" while the Cronograma shows "Concluir" again.
export function useUnpublishCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ calendarId, taskIds }: { calendarId: string; taskIds: string[] }) => {
      if (taskIds.length > 0) {
        const { error: taskError } = await sb.from("pm_tasks").update({ status_global: "backlog" }).in("id", taskIds);
        if (taskError) throw taskError;
      }
      return { calendarId };
    },
    onSuccess: ({ calendarId }) => {
      qc.invalidateQueries({ queryKey: ["calendar_publications", calendarId] });
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_task_status_for_calendar"] });
    },
  });
}

// Bulk "Agendar publicações" action: clears every eligible publication in the cycle at once
// (approved by the client + date/time/legenda already filled in) for the Instagram
// auto-publish cron to pick up — see instagram_scheduled on calendar_publications. Skips
// anything already scheduled or already published; the caller (CalendarioPublicacaoPanel)
// is responsible for pre-filtering to only approved+complete publications before calling this.
//
// A DB trigger (trg_complete_agendamento_on_scheduled) reacts to instagram_scheduled flipping
// true by auto-completing the pipeline's "agendamento" task and syncing Magic Number/Agenda —
// invalidate those too so the UI reflects it without a manual refresh.
export function useScheduleCyclePublications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ calendarId, publicationIds }: { calendarId: string; publicationIds: string[] }) => {
      if (publicationIds.length > 0) {
        const { error } = await sb.from("calendar_publications").update({ instagram_scheduled: true }).in("id", publicationIds);
        if (error) throw error;
      }
      return { calendarId };
    },
    onSuccess: ({ calendarId }) => {
      qc.invalidateQueries({ queryKey: ["calendar_publications", calendarId] });
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_task_status_for_calendar"] });
      qc.invalidateQueries({ queryKey: ["magic2"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

// Reverses useScheduleCyclePublications — same publications, back to instagram_scheduled=false.
// Used when the whole cycle is already "Publicações agendadas" and the team wants to undo it
// in one stroke (same toggle shape as usePublishCycle/useUnpublishCycle above).
//
// A DB trigger (trg_uncomplete_agendamento_on_unscheduled) mirrors trg_complete_agendamento_on_scheduled
// in reverse: reverts the pipeline's agendamento task and un-syncs Magic Number/Agenda — invalidate
// those too.
export function useUnscheduleCyclePublications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ calendarId, publicationIds }: { calendarId: string; publicationIds: string[] }) => {
      if (publicationIds.length > 0) {
        const { error } = await sb.from("calendar_publications").update({ instagram_scheduled: false }).in("id", publicationIds);
        if (error) throw error;
      }
      return { calendarId };
    },
    onSuccess: ({ calendarId }) => {
      qc.invalidateQueries({ queryKey: ["calendar_publications", calendarId] });
      qc.invalidateQueries({ queryKey: ["pm_tasks"] });
      qc.invalidateQueries({ queryKey: ["pm_task_status_for_calendar"] });
      qc.invalidateQueries({ queryKey: ["magic2"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export interface ClientInstagramRisk {
  clientId: string;
  clientName: string;
  notConnectedCount: number;
  failedCount: number;
  unsupportedCount: number;
  tokenExpiresInDays: number | null;
}

const TOKEN_EXPIRY_WARNING_MS = 3 * 24 * 60 * 60 * 1000;

// Scans every client at once (not just the one currently open) for anything that could stop
// a publication the team already scheduled (instagram_scheduled=true, see
// useScheduleCyclePublications) from actually going out — a broken/missing Instagram
// connection, a content type the auto-publish pipeline can't handle (story/outro, see
// instagram-publish's publishToInstagram), a publish attempt that already failed, or a token
// close to expiring. Feeds the warning banner in CalendarioPublicacaoPanel so the team finds
// out *before* the scheduled time comes and nothing goes out, not after.
//
// Takes connection status as a parameter (from useInstagramConnections) instead of querying
// instagram_connections directly — that table has RLS enabled with zero policies (it holds
// the real access_token), so a direct client-side query silently returns nothing and every
// client would misleadingly show up as "not connected". useInstagramConnections already goes
// through the instagram-connect edge function's "status" action, which safely exposes only
// the non-secret columns via the service role.
export function useInstagramRiskSummary(connections: { client_id: string; status: string; token_expires_at: string }[] | undefined) {
  return useQuery({
    queryKey: ["instagram_risk_summary", connections],
    enabled: connections !== undefined,
    queryFn: async (): Promise<ClientInstagramRisk[]> => {
      const { data: pubs, error: pubsErr } = await sb
        .from("calendar_publications")
        .select("id, calendar_id, content_type, instagram_status")
        .eq("instagram_scheduled", true)
        .neq("instagram_status", "published");
      if (pubsErr) throw pubsErr;
      const scheduled = (pubs ?? []) as { id: string; calendar_id: string; content_type: string; instagram_status: string }[];

      const calendarIds = [...new Set(scheduled.map((p) => p.calendar_id))];
      const clientIdByCalendarId = new Map<string, string>();
      if (calendarIds.length > 0) {
        const { data: calendars, error: calErr } = await sb
          .from("publication_calendars")
          .select("id, client_id")
          .in("id", calendarIds);
        if (calErr) throw calErr;
        for (const c of (calendars ?? []) as { id: string; client_id: string }[]) clientIdByCalendarId.set(c.id, c.client_id);
      }

      const clientIds = [...new Set(Array.from(clientIdByCalendarId.values()))];
      if (clientIds.length === 0) return [];

      const { data: clients, error: clientsErr } = await sb.from("clients").select("id, name").in("id", clientIds);
      if (clientsErr) throw clientsErr;
      const clientNameById = new Map<string, string>((clients ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
      type ConnectionRow = { client_id: string; status: string; token_expires_at: string | null };
      const connectionByClient = new Map<string, ConnectionRow>(
        (connections ?? []).map((c) => [c.client_id, c]),
      );

      const now = Date.now();
      const riskByClient = new Map<string, ClientInstagramRisk>();
      const getRisk = (clientId: string) => {
        let r = riskByClient.get(clientId);
        if (!r) {
          r = { clientId, clientName: clientNameById.get(clientId) ?? "Cliente", notConnectedCount: 0, failedCount: 0, unsupportedCount: 0, tokenExpiresInDays: null };
          riskByClient.set(clientId, r);
        }
        return r;
      };

      for (const p of scheduled) {
        const clientId = clientIdByCalendarId.get(p.calendar_id);
        if (!clientId) continue;
        const connection = connectionByClient.get(clientId);

        if (!connection || connection.status !== "active") {
          getRisk(clientId).notConnectedCount++;
          continue; // root cause is the connection — no need to also count it as "failed"
        }
        if (p.content_type === "story" || p.content_type === "outro") {
          getRisk(clientId).unsupportedCount++;
          continue;
        }
        if (p.instagram_status === "failed") {
          getRisk(clientId).failedCount++;
        }
      }

      // Token-expiry risk applies per connected client regardless of whether any of their
      // scheduled publications individually triggered another risk above.
      for (const clientId of clientIds) {
        const connection = connectionByClient.get(clientId);
        if (!connection || connection.status !== "active" || !connection.token_expires_at) continue;
        const msLeft = new Date(connection.token_expires_at).getTime() - now;
        if (msLeft < TOKEN_EXPIRY_WARNING_MS) {
          getRisk(clientId).tokenExpiresInDays = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
        }
      }

      return Array.from(riskByClient.values()).filter(
        (r) => r.notConnectedCount > 0 || r.failedCount > 0 || r.unsupportedCount > 0 || r.tokenExpiresInDays !== null,
      );
    },
    // Risk conditions can change from outside this tab (the cron running, a token expiring) —
    // keep it reasonably fresh without polling too aggressively.
    refetchInterval: 5 * 60 * 1000,
  });
}

// Which of these tasks are already marked concluído — used to render the bulk
// "Concluir" button as done (roxo, with an option to unmark) once every approved
// publication's task has actually been closed out.
export function useTaskCompletionMap(taskIds: string[]) {
  return useQuery({
    enabled: taskIds.length > 0,
    queryKey: ["pm_task_status_for_calendar", taskIds],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await sb.from("pm_tasks").select("id, status_global").in("id", taskIds);
      if (error) throw error;
      const done = new Set<string>();
      for (const row of (data ?? []) as { id: string; status_global: string }[]) {
        if (row.status_global === "concluido") done.add(row.id);
      }
      return done;
    },
  });
}

export function useRemoveCalendarPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, calendarId, taskId }: { id: string; calendarId: string; taskId?: string }) => {
      const { error } = await sb.from("calendar_publications").delete().eq("id", id);
      if (error) throw error;
      return { id, calendarId, taskId };
    },
    onSuccess: ({ calendarId, taskId }) => {
      qc.invalidateQueries({ queryKey: ["calendar_publications", calendarId] });
      // Lets the "Enviar para o Cronograma" shortcut in the Gestão task dialog notice the
      // task is unscheduled again instead of still offering a "Ver no Cronograma" link to
      // the entry that was just deleted here.
      if (taskId) qc.invalidateQueries({ queryKey: ["task_calendar_entry", taskId] });
    },
  });
}

export function useUpdateCalendarStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, clientId }: { id: string; status: CalendarStatus; clientId: string }) => {
      const { error } = await sb.from("publication_calendars").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, clientId };
    },
    onSuccess: ({ clientId }) => {
      qc.invalidateQueries({ queryKey: ["publication_calendars", clientId] });
    },
  });
}

export function useUpdateCalendarShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId, ...updates }: { id: string; clientId: string; share_enabled?: boolean; share_token?: string }) => {
      const { data, error } = await sb.from("publication_calendars").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return { data: data as PublicationCalendar, clientId };
    },
    onSuccess: ({ clientId }) => {
      qc.invalidateQueries({ queryKey: ["publication_calendars", clientId] });
    },
  });
}

