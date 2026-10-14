import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CONTACT_NOTE_KINDS, type Activity, type ClientTask, type ComercialClient, type Lead, type Stage } from "../lib/rules";

// As tabelas comercial_* ainda não estão nos tipos gerados do Supabase.
const sb = supabase as any;

const LIVE = { staleTime: 15_000, refetchInterval: 30_000, refetchOnWindowFocus: true } as const;

export interface TeamMember {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role_title: string | null;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  kind: string;
  text: string;
  created_by: string | null;
  created_at: string;
}

// ───────────── leituras ─────────────

/** Etapas do funil. Na primeira vez de uma agência (sem nenhuma) o banco cria as etapas padrão. */
export function useStages() {
  return useQuery({
    queryKey: ["comercial", "stages"],
    queryFn: async (): Promise<Stage[]> => {
      const read = async () => {
        const { data, error } = await sb.from("comercial_stages").select("id, name, type, probability, position").order("position");
        if (error) throw error;
        return (data ?? []) as Stage[];
      };
      let stages = await read();
      if (stages.length === 0) {
        const { error } = await sb.rpc("comercial_seed_defaults");
        if (error) throw error;
        stages = await read();
      }
      return stages;
    },
    staleTime: 60_000,
  });
}

export function useLeads() {
  return useQuery({
    queryKey: ["comercial", "leads"],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await sb.from("comercial_leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Lead[]).map((l) => ({ ...l, value: Number(l.value) || 0, setup: Number(l.setup) || 0 }));
    },
    ...LIVE,
  });
}

export function useActivities() {
  return useQuery({
    queryKey: ["comercial", "activities"],
    queryFn: async (): Promise<Activity[]> => {
      const { data, error } = await sb.from("comercial_activities").select("id, lead_id, owner_id, type, title, due_date, done, done_at").order("due_date");
      if (error) throw error;
      return (data ?? []) as Activity[];
    },
    ...LIVE,
  });
}

/** Leads em que alguém já registrou um contato (WhatsApp, reunião, ligação…): serve para "sem primeiro contato". */
export function useContactedLeadIds() {
  return useQuery({
    queryKey: ["comercial", "contacted"],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await sb.from("comercial_lead_notes").select("lead_id").in("kind", CONTACT_NOTE_KINDS).limit(5000);
      if (error) throw error;
      return new Set(((data ?? []) as { lead_id: string }[]).map((r) => r.lead_id));
    },
    ...LIVE,
  });
}

export function useLeadNotes(leadId: string | null) {
  return useQuery({
    queryKey: ["comercial", "notes", leadId],
    enabled: !!leadId,
    queryFn: async (): Promise<LeadNote[]> => {
      const { data, error } = await sb.from("comercial_lead_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadNote[];
    },
    refetchInterval: 30_000,
  });
}

/** Conversas de leads e clientes que esperam resposta (grupos e conversas da equipe não entram), para o contador do menu Conversas. */
export function useUnreadChats() {
  return useQuery({
    queryKey: ["comercial", "unread_chats"],
    queryFn: async (): Promise<number> => {
      const { count, error } = await sb
        .from("whatsapp_contacts")
        .select("id", { count: "exact", head: true })
        .gt("unread_count", 0)
        .in("origin", ["lead", "desconhecido", "cliente"]);
      if (error) throw error;
      return count ?? 0;
    },
    ...LIVE,
  });
}

export function useComercialClients() {
  return useQuery({
    queryKey: ["comercial", "clients"],
    queryFn: async (): Promise<ComercialClient[]> => {
      const { data, error } = await sb.from("comercial_clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as ComercialClient[]).map((c) => ({ ...c, value: Number(c.value) || 0, setup: Number(c.setup) || 0 }));
    },
    ...LIVE,
  });
}

export function useClientTasks() {
  return useQuery({
    queryKey: ["comercial", "client_tasks"],
    queryFn: async (): Promise<ClientTask[]> => {
      const { data, error } = await sb.from("comercial_onboarding_tasks").select("*").order("position");
      if (error) throw error;
      return (data ?? []) as ClientTask[];
    },
    ...LIVE,
  });
}

export function useTeam() {
  return useQuery({
    queryKey: ["comercial", "team"],
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, display_name, avatar_url, role_title, is_active")
        .eq("is_active", true)
        .order("display_name");
      if (error) throw error;
      return ((data ?? []) as any[]).filter((m) => !!m.user_id) as TeamMember[];
    },
    staleTime: 5 * 60_000,
  });
}

// ───────────── escritas ─────────────

function useInvalidate() {
  const qc = useQueryClient();
  return (...parts: string[]) => parts.forEach((p) => qc.invalidateQueries({ queryKey: ["comercial", p] }));
}

const fail = (e: Error) => toast.error(e.message || "Não foi possível salvar.");

export type NewLeadInput = Partial<Omit<Lead, "id" | "created_at" | "stage_changed_at" | "closed_at">> & { name: string; stage_id: string };

/** Cria o lead e já agenda a primeira ação (primeira abordagem ou resposta), como no protótipo. */
export function useCreateLead() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ lead, firstAction }: { lead: NewLeadInput; firstAction: { type: string; title: string; due_date: string } | null }) => {
      const { data, error } = await sb.from("comercial_leads").insert(lead).select("id").single();
      if (error) throw error;
      if (firstAction) {
        const { error: e2 } = await sb.from("comercial_activities").insert({ lead_id: data.id, owner_id: lead.owner_id ?? null, ...firstAction });
        if (e2) throw e2;
      }
      return data.id as string;
    },
    onSuccess: () => inv("leads", "activities", "contacted"),
    onError: fail,
  });
}

export function useUpdateLead() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Lead> }) => {
      const { error } = await sb.from("comercial_leads").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => inv("leads", "activities", "notes", "contacted"),
    onError: fail,
  });
}

export function useDeleteLead() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("comercial_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("leads", "activities", "clients", "client_tasks", "contacted"),
    onError: fail,
  });
}

export interface WinInput {
  leadId: string;
  stageId: string;
  value: number;
  setup: number;
  months: number;
  start: string;
  videos: number;
  artes: number;
  approver: string;
  services: string[];
  squad: { atendimento_id: string; social_media_id: string; trafego_id: string };
}

export function useWinLead() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (w: WinInput) => {
      const { data, error } = await sb.rpc("comercial_win_lead", {
        p_lead: w.leadId, p_stage: w.stageId, p_value: w.value, p_setup: w.setup, p_months: w.months, p_start: w.start,
        p_videos: w.videos, p_artes: w.artes, p_approver: w.approver, p_services: w.services, p_squad: w.squad,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => inv("leads", "activities", "notes", "clients", "client_tasks", "contacted"),
    onError: fail,
  });
}

export function useCreateActivity() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (a: { lead_id: string; owner_id: string | null; type: string; title: string; due_date: string }) => {
      const { error } = await sb.from("comercial_activities").insert(a);
      if (error) throw error;
    },
    onSuccess: () => inv("activities"),
    onError: fail,
  });
}

export function useSetActivityDone() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await sb.from("comercial_activities").update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("activities", "notes", "contacted"),
    onError: fail,
  });
}

export function useAddNote() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ leadId, kind, text }: { leadId: string; kind: string; text: string }) => {
      const { error } = await sb.from("comercial_lead_notes").insert({ lead_id: leadId, kind, text });
      if (error) throw error;
    },
    onSuccess: () => inv("notes", "contacted"),
    onError: fail,
  });
}

// ── etapas ──

export function useSaveStage() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Stage, "name" | "probability">> }) => {
      const { error } = await sb.from("comercial_stages").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("stages"),
    onError: fail,
  });
}

export function useCreateStage() {
  const inv = useInvalidate();
  return useMutation({
    /** A etapa nova entra logo antes de "Ganho"; as de baixo descem uma posição. */
    mutationFn: async ({ name, stages }: { name: string; stages: Stage[] }) => {
      const firstClosed = [...stages].sort((a, b) => a.position - b.position).find((s) => s.type !== "open");
      const at = firstClosed ? firstClosed.position : stages.length;
      const prev = [...stages].filter((s) => s.type === "open").sort((a, b) => b.position - a.position)[0];
      for (const s of stages.filter((x) => x.position >= at)) {
        const { error } = await sb.from("comercial_stages").update({ position: s.position + 1 }).eq("id", s.id);
        if (error) throw error;
      }
      const { error } = await sb.from("comercial_stages").insert({ name, type: "open", probability: Math.min(90, (prev?.probability ?? 0) + 10), position: at });
      if (error) throw error;
    },
    onSuccess: () => inv("stages"),
    onError: fail,
  });
}

/** Troca a posição de duas etapas abertas. */
export function useSwapStages() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ a, b }: { a: Stage; b: Stage }) => {
      const r1 = await sb.from("comercial_stages").update({ position: b.position }).eq("id", a.id);
      if (r1.error) throw r1.error;
      const r2 = await sb.from("comercial_stages").update({ position: a.position }).eq("id", b.id);
      if (r2.error) throw r2.error;
    },
    onSuccess: () => inv("stages"),
    onError: fail,
  });
}

export function useDeleteStage() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ stageId, moveTo }: { stageId: string; moveTo: string | null }) => {
      const { error } = await sb.rpc("comercial_delete_stage", { p_stage: stageId, p_move_to: moveTo });
      if (error) throw error;
    },
    onSuccess: () => inv("stages", "leads", "notes"),
    onError: fail,
  });
}

// ── onboarding ──

export function useUpdateClient() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ComercialClient> }) => {
      const { error } = await sb.from("comercial_clients").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("clients"),
    onError: fail,
  });
}

export function useUpdateClientTask() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<ClientTask, "done" | "owner_id">> }) => {
      const { error } = await sb.from("comercial_onboarding_tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => inv("client_tasks"),
    onError: fail,
  });
}
