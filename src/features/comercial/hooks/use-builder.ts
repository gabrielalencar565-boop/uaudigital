import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ComercialAutomation, ComercialForm, FormDest, FormField, FormResponse, SavedTemplate, Step, Trigger } from "../lib/builder";

// As tabelas comercial_* ainda não estão nos tipos gerados do Supabase.
const sb = supabase as any;
const LIVE = { staleTime: 15_000, refetchOnWindowFocus: true } as const;
const fail = (e: Error) => toast.error(e.message || "Não foi possível salvar.");

export function useForms() {
  return useQuery({
    queryKey: ["comercial", "forms"],
    queryFn: async (): Promise<ComercialForm[]> => {
      const { data, error } = await sb.from("comercial_forms").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ComercialForm[];
    },
    ...LIVE,
  });
}

export function useFormResponses() {
  return useQuery({
    queryKey: ["comercial", "form_responses"],
    queryFn: async (): Promise<FormResponse[]> => {
      const { data, error } = await sb.from("comercial_form_responses").select("id, form_id, lead_id, answers, submitted_at").order("submitted_at", { ascending: false }).limit(2000);
      if (error) throw error;
      return (data ?? []) as FormResponse[];
    },
    refetchInterval: 30_000,
    ...LIVE,
  });
}

export function useAutomations() {
  return useQuery({
    queryKey: ["comercial", "automations"],
    queryFn: async (): Promise<ComercialAutomation[]> => {
      const { data, error } = await sb.from("comercial_automations").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ComercialAutomation[];
    },
    refetchInterval: 30_000,
    ...LIVE,
  });
}

export function useMyTemplates() {
  return useQuery({
    queryKey: ["comercial", "templates"],
    queryFn: async (): Promise<SavedTemplate[]> => {
      const { data, error } = await sb.from("comercial_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SavedTemplate[];
    },
    ...LIVE,
  });
}

function useInv() {
  const qc = useQueryClient();
  return (...parts: string[]) => parts.forEach((p) => qc.invalidateQueries({ queryKey: ["comercial", p] }));
}

export interface NewForm { key: string; name: string; description: string; fields: FormField[]; active: boolean; dest: FormDest; thanks?: string; slug: string }

export function useCreateForm() {
  const inv = useInv();
  return useMutation({
    mutationFn: async (f: NewForm): Promise<ComercialForm> => {
      const { data, error } = await sb.from("comercial_forms").insert(f).select("*").single();
      if (error) throw error;
      return data as ComercialForm;
    },
    onSuccess: () => inv("forms"),
    onError: fail,
  });
}

export function useUpdateForm() {
  const inv = useInv();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<ComercialForm, "name" | "description" | "fields" | "active" | "dest" | "thanks">> }) => {
      const { error } = await sb.from("comercial_forms").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("forms"),
    onError: fail,
  });
}

export function useDeleteForm() {
  const inv = useInv();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("comercial_forms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("forms", "form_responses"),
    onError: fail,
  });
}

export function useCreateAutomation() {
  const inv = useInv();
  return useMutation({
    mutationFn: async (a: { name: string; trigger: Trigger; steps: Step[]; active?: boolean }): Promise<ComercialAutomation> => {
      const { data, error } = await sb.from("comercial_automations").insert({ active: false, ...a }).select("*").single();
      if (error) throw error;
      return data as ComercialAutomation;
    },
    onSuccess: () => inv("automations"),
    onError: fail,
  });
}

export function useUpdateAutomation() {
  const inv = useInv();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<ComercialAutomation, "name" | "active" | "trigger" | "steps">> }) => {
      const { error } = await sb.from("comercial_automations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("automations"),
    onError: fail,
  });
}

export function useDeleteAutomation() {
  const inv = useInv();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("comercial_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("automations"),
    onError: fail,
  });
}

export function useSaveTemplate() {
  const inv = useInv();
  return useMutation({
    mutationFn: async (t: { kind: "auto" | "form"; name: string; description: string; payload: Record<string, unknown> }) => {
      const { error } = await sb.from("comercial_templates").insert(t);
      if (error) throw error;
    },
    onSuccess: () => inv("templates"),
    onError: fail,
  });
}

export function useDeleteTemplate() {
  const inv = useInv();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("comercial_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("templates"),
    onError: fail,
  });
}
