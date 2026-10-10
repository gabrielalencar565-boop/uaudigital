import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

// The table is newer than the generated types
const db = supabase as any;

export type NotificationKey = "unscheduled_posts" | "task_assigned" | "mention" | "client_reply" | "capture_request";

export type NotificationType = {
  key: NotificationKey;
  title: string;
  description: string;
  /** Default message (mirrors notification_default() in the database). {variables} are filled in when it is sent. */
  defaultTitle: string;
  defaultBody: string;
  variables: { name: string; hint: string }[];
  sample: Record<string, string>;
  adminOnly?: boolean;
};

/** What each switch controls. Every notification reaches the bell, the phone and the computer. */
export const NOTIFICATION_TYPES: NotificationType[] = [
  {
    key: "unscheduled_posts",
    title: "Posts sem agendar no Instagram",
    description: "Lembra quem agenda quando há posts no Cronograma que ainda não foram agendados. Chega às 09h e às 16h, de segunda a sábado.",
    defaultTitle: "Posts sem agendar ⏰",
    defaultBody: "{resumo}",
    variables: [
      { name: "resumo", hint: "20 sem agendar · 6 atrasados" },
      { name: "total", hint: "quantos posts" },
      { name: "atrasados", hint: "quantos atrasados" },
    ],
    sample: { resumo: "20 sem agendar · 6 atrasados", total: "20", atrasados: "6" },
  },
  {
    key: "client_reply",
    title: "Cliente aprovou ou pediu alteração",
    description: "Avisa quem está com a tarefa quando o cliente responde na página de aprovação do Cronograma.",
    defaultTitle: "Cliente {acao}",
    defaultBody: "{texto}",
    variables: [
      { name: "acao", hint: "aprovou ✅ ou pediu alteração ✏️" },
      { name: "texto", hint: "o pedido do cliente (ou o nome da tarefa)" },
      { name: "cliente", hint: "nome do cliente" },
    ],
    sample: { acao: "pediu alteração ✏️", texto: "Quero só mudar a última foto", cliente: "Doce Rio" },
  },
  {
    key: "capture_request",
    title: "Novo pedido de gravação",
    description: "Avisa os administradores quando um cliente pede um dia pelo link da Agenda de Gravação.",
    defaultTitle: "Novo pedido de gravação 🎬",
    defaultBody: "{empresa} — {data} às {hora}",
    variables: [
      { name: "empresa", hint: "nome da empresa" },
      { name: "data", hint: "22/10" },
      { name: "hora", hint: "14:00" },
    ],
    sample: { empresa: "Doce Rio", data: "22/10", hora: "14:00" },
    adminOnly: true,
  },
  {
    key: "mention",
    title: "Menção em comentário",
    description: "Avisa quando alguém chama você com @ numa conversa de tarefa.",
    defaultTitle: "Te chamaram numa conversa 👋",
    defaultBody: "{texto}",
    variables: [
      { name: "autor", hint: "quem mencionou você" },
      { name: "texto", hint: "o comentário" },
    ],
    sample: { texto: "Dá uma olhada nesse post?", autor: "Ana Beatriz" },
  },
  {
    key: "task_assigned",
    title: "Tarefa atribuída a você",
    description: "Avisa quando uma tarefa passa a ser sua.",
    defaultTitle: "Tarefa nova caiu pra você 🎯",
    defaultBody: "{tarefa}",
    variables: [
      { name: "tarefa", hint: "nome da tarefa" },
      { name: "cliente", hint: "nome do cliente" },
    ],
    sample: { tarefa: "[Doce Rio] - Design - Outubro", cliente: "Doce Rio" },
  },
];

/** Fills {variables} the same way the database does (values are cut at 40 characters). */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v.slice(0, 40)), template);
}

/** On/off per type for the agency; everything is on until an admin turns something off. */
export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification_settings"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<NotificationKey, boolean>> => {
      const { data, error } = await db.from("notification_settings").select("key, enabled");
      if (error) throw error;
      const map: Record<NotificationKey, boolean> = { unscheduled_posts: true, task_assigned: true, mention: true, client_reply: true, capture_request: true };
      for (const r of (data ?? []) as { key: NotificationKey; enabled: boolean }[]) map[r.key] = r.enabled;
      return map;
    },
  });
}

export function useSetNotificationEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, enabled }: { key: NotificationKey; enabled: boolean }) => {
      const { data: existing, error: readErr } = await db.from("notification_settings").select("agency_id").eq("key", key).maybeSingle();
      if (readErr) throw readErr;
      if (existing) {
        const { error } = await db.from("notification_settings").update({ enabled, updated_at: new Date().toISOString() }).eq("agency_id", existing.agency_id).eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await db.from("notification_settings").insert({ key, enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification_settings"] });
      qc.invalidateQueries({ queryKey: ["unscheduled_posts_by_client"] });
      qc.invalidateQueries({ queryKey: ["notifications_unscheduled_posts"] });
    },
  });
}

export type NotificationAudience = { audience_all: boolean; allowed_roles: ("admin" | "member")[]; allowed_cargos: string[] };
export type NotificationTemplate = { title: string | null; body: string | null } & NotificationAudience;
export const DEFAULT_AUDIENCE: NotificationAudience = { audience_all: true, allowed_roles: [], allowed_cargos: [] };

/** The agency's own message per type (null = the default one). */
export function useNotificationTemplates() {
  return useQuery({
    queryKey: ["notification_templates"],
    staleTime: 60_000,
    queryFn: async (): Promise<Partial<Record<NotificationKey, NotificationTemplate>>> => {
      const { data, error } = await db.from("notification_settings").select("key, title, body, audience_all, allowed_roles, allowed_cargos");
      if (error) throw error;
      const map: Partial<Record<NotificationKey, NotificationTemplate>> = {};
      for (const r of (data ?? []) as ({ key: NotificationKey } & NotificationTemplate)[]) map[r.key] = { title: r.title, body: r.body, audience_all: r.audience_all, allowed_roles: r.allowed_roles ?? [], allowed_cargos: r.allowed_cargos ?? [] };
      return map;
    },
  });
}

export function useSaveNotificationTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, title, body, audience }: { key: NotificationKey; title: string | null; body: string | null; audience?: NotificationAudience }) => {
      const { data: existing, error: readErr } = await db.from("notification_settings").select("agency_id").eq("key", key).maybeSingle();
      if (readErr) throw readErr;
      // body: null = the default text; "" = no text on purpose (title only)
      const values = { title: title?.trim() || null, body: body === null ? null : body.trim(), ...(audience ?? {}), updated_at: new Date().toISOString() };
      if (existing) {
        const { error } = await db.from("notification_settings").update(values).eq("agency_id", existing.agency_id).eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await db.from("notification_settings").insert({ key, ...values });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification_templates"] });
      qc.invalidateQueries({ queryKey: ["my_notification_audience"] });
    },
  });
}

/** Which types reach the signed-in person, given the roles / cargos the agency selected for each one. */
export function useMyNotificationAudience() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my_notification_audience", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<NotificationKey, boolean>> => {
      const { data, error } = await db.rpc("my_notification_audience");
      if (error) throw error;
      const map: Record<NotificationKey, boolean> = { unscheduled_posts: true, task_assigned: true, mention: true, client_reply: true, capture_request: true };
      for (const r of (data ?? []) as { key: NotificationKey; allowed: boolean }[]) map[r.key] = r.allowed;
      return map;
    },
  });
}

/** Each person's own on/off per type (everything on until they turn something off). */
export function useMyNotificationPrefs() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["my_notification_prefs", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<NotificationKey, boolean>> => {
      const { data, error } = await db.from("user_notification_prefs").select("key, enabled").eq("user_id", user!.id);
      if (error) throw error;
      const map: Record<NotificationKey, boolean> = { unscheduled_posts: true, task_assigned: true, mention: true, client_reply: true, capture_request: true };
      for (const r of (data ?? []) as { key: NotificationKey; enabled: boolean }[]) map[r.key] = r.enabled;
      return map;
    },
  });
}

export function useSetMyNotificationPref() {
  const qc = useQueryClient();
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ key, enabled }: { key: NotificationKey; enabled: boolean }) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await db.from("user_notification_prefs").upsert({ user_id: user.id, key, enabled, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_notification_prefs"] });
      qc.invalidateQueries({ queryKey: ["notifications_unscheduled_posts"] });
    },
  });
}
