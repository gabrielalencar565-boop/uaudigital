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
        .select("id, task_id, public_url, file_type, order_index")
        .in("task_id", taskIds)
        .eq("category", "final")
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const map = new Map<string, { id: string; url: string; type: string | null }[]>();
      for (const row of (data ?? []) as { id: string; task_id: string; public_url: string | null; file_type: string | null }[]) {
        if (!row.public_url) continue;
        const prev = map.get(row.task_id) ?? [];
        prev.push({ id: row.id, url: row.public_url, type: row.file_type });
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
      const { data, error } = await sb.from("pm_attachments").select("id, public_url, file_type").in("id", ids);
      if (error) throw error;
      const map = new Map<string, { id: string; url: string; type: string | null }>();
      for (const row of (data ?? []) as { id: string; public_url: string | null; file_type: string | null }[]) {
        if (!row.public_url) continue;
        map.set(row.id, { id: row.id, url: row.public_url, type: row.file_type });
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

export function useUpdateCalendarPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CalendarPublication> & { id: string }) => {
      const { data, error } = await sb.from("calendar_publications").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as CalendarPublication;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["calendar_publications", data.calendar_id] });
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

// Reverses usePublishCycle — same tasks, back to backlog. Since the Agenda reads this
// same status_global column directly, unmarking here immediately unmarks it there too;
// no separate sync needed.
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

// Which of these tasks are already marked concluído — used to render the bulk
// "Concluir" button as done (green, with an option to unmark) once every approved
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
    mutationFn: async ({ id, calendarId }: { id: string; calendarId: string }) => {
      const { error } = await sb.from("calendar_publications").delete().eq("id", id);
      if (error) throw error;
      return { id, calendarId };
    },
    onSuccess: ({ calendarId }) => {
      qc.invalidateQueries({ queryKey: ["calendar_publications", calendarId] });
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

