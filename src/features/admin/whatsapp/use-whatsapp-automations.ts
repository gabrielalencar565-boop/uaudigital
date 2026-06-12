import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WhatsappAutomation = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: "event" | "schedule";
  trigger_key: string;
  schedule_time: string | null;
  schedule_days: number[] | null;
  message_template: string;
  channel: string;
  audience: string;
  filters: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  last_run_slot: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationInput = {
  name: string;
  description?: string | null;
  trigger_type: "event" | "schedule";
  trigger_key: string;
  schedule_time?: string | null;
  schedule_days?: number[] | null;
  message_template: string;
  audience: string;
  enabled: boolean;
};

const KEY = ["whatsapp_automations"] as const;

export function useWhatsappAutomations() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<WhatsappAutomation[]> => {
      const { data, error } = await supabase
        .from("whatsapp_automations" as any)
        .select("*")
        .order("trigger_type", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WhatsappAutomation[];
    },
  });
}

export function useUpsertAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: AutomationInput & { id?: string }) => {
      const payload: any = { ...input };
      if (payload.schedule_time === "") payload.schedule_time = null;
      if (payload.trigger_type === "event") {
        payload.schedule_time = null;
        payload.schedule_days = null;
      }
      const q = supabase.from("whatsapp_automations" as any);
      if (input.id) {
        const { error } = await q.update(payload).eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await q.insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useToggleAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("whatsapp_automations" as any).update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_automations" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
