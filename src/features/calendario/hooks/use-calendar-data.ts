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
      const { data, error } = await sb
        .from("pm_attachments")
        .select("task_id, public_url, file_type, order_index")
        .in("task_id", taskIds)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      const map = new Map<string, { url: string; type: string | null }[]>();
      for (const row of (data ?? []) as { task_id: string; public_url: string | null; file_type: string | null }[]) {
        if (!row.public_url) continue;
        const prev = map.get(row.task_id) ?? [];
        prev.push({ url: row.public_url, type: row.file_type });
        map.set(row.task_id, prev);
      }
      return map;
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

