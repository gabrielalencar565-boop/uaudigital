import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// The capture tables are newer than the generated types
const db = supabase as any;

export type CaptureSettings = {
  agency_id: string;
  enabled: boolean;
  share_token: string;
  weekdays: number[];
  capacity_per_day: number;
  min_lead_days: number;
  open_months: string[];
};

export type CaptureBooking = {
  id: string;
  booking_date: string;
  period: "manha" | "tarde";
  company_name: string;
  contact_name: string | null;
  whatsapp: string;
  location: string | null;
  notes: string | null;
  client_id: string | null;
  status: "pending" | "confirmed" | "refused" | "cancelled";
  task_id: string | null;
  created_at: string;
  decided_at: string | null;
};

export type CaptureBlock = { id: string; block_date: string; reason: string | null };

export const CAPTURE_DEFAULTS = { enabled: false, weekdays: [1, 2, 3, 4, 5], capacity_per_day: 2, min_lead_days: 2, open_months: [] as string[] };

export function captureLink(token: string) {
  return `${window.location.origin}/agendar/${token}`;
}

export function useCaptureSettings() {
  return useQuery({
    queryKey: ["capture_settings"],
    queryFn: async (): Promise<CaptureSettings | null> => {
      const { data, error } = await db.from("capture_settings").select("*").maybeSingle();
      if (error) throw error;
      return data as CaptureSettings | null;
    },
  });
}

/** Creates the agency's settings row the first time, updates it afterwards. */
export function useSaveCaptureSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Omit<CaptureSettings, "agency_id" | "share_token">> & { regenerate_token?: boolean }) => {
      const { regenerate_token, ...rest } = patch;
      const { data: existing, error: readErr } = await db.from("capture_settings").select("agency_id").maybeSingle();
      if (readErr) throw readErr;
      const values: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
      if (regenerate_token) values.share_token = crypto.randomUUID();
      if (existing) {
        const { error } = await db.from("capture_settings").update(values).eq("agency_id", existing.agency_id);
        if (error) throw error;
      } else {
        const { error } = await db.from("capture_settings").insert({ ...CAPTURE_DEFAULTS, ...values });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capture_settings"] }),
  });
}

export function useCaptureBlocks() {
  return useQuery({
    queryKey: ["capture_blocks"],
    queryFn: async (): Promise<CaptureBlock[]> => {
      const { data, error } = await db.from("capture_blocks").select("id, block_date, reason").order("block_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CaptureBlock[];
    },
  });
}

export function useToggleCaptureBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, existingId }: { date: string; existingId?: string }) => {
      if (existingId) {
        const { error } = await db.from("capture_blocks").delete().eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await db.from("capture_blocks").insert({ block_date: date });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capture_blocks"] }),
  });
}

export function useCaptureBookings() {
  return useQuery({
    queryKey: ["capture_bookings"],
    // new requests show up without a reload while the page stays open
    refetchInterval: 60_000,
    queryFn: async (): Promise<CaptureBooking[]> => {
      const { data, error } = await db
        .from("capture_bookings")
        .select("id, booking_date, period, company_name, contact_name, whatsapp, location, notes, client_id, status, task_id, created_at, decided_at")
        .order("booking_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CaptureBooking[];
    },
  });
}

export function useUpdateCaptureBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await db.from("capture_bookings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capture_bookings"] }),
  });
}
