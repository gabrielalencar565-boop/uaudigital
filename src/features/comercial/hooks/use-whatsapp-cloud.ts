import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CloudStatus {
  connected: boolean;
  phone_number_id?: string;
  waba_id?: string | null;
  display_phone?: string | null;
  verified_name?: string | null;
  verify_token?: string;
  connected_at?: string;
  last_error?: string | null;
}

export const WEBHOOK_URL = "https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/whatsapp-cloud-webhook";

/** Mensagem de erro que a função devolveu (a Meta recusou o token, passou das 24h…), em vez do genérico do SDK. */
async function callConnect<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("whatsapp-cloud-connect", { body });
  if (error) {
    let msg = error.message;
    try { const j = await (error as { context?: Response }).context?.json(); if (j?.error) msg = String(j.error); } catch { /* mantém a mensagem do SDK */ }
    throw new Error(msg);
  }
  return data as T;
}

export function useCloudStatus() {
  return useQuery({
    queryKey: ["comercial", "wa_cloud"],
    queryFn: async (): Promise<CloudStatus> => {
      // a função só existe para a conexão da agência; o RPC nunca devolve o token nem o segredo
      const { data, error } = await (supabase as unknown as { rpc: (fn: string) => Promise<{ data: CloudStatus | null; error: Error | null }> }).rpc("whatsapp_cloud_status");
      if (error) throw error;
      return data ?? { connected: false };
    },
    staleTime: 15_000,
  });
}

export function useSaveCloud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { phone_number_id: string; waba_id: string; access_token: string; app_secret: string }) => callConnect<{ ok: boolean; subscribed: boolean | null }>({ action: "save", ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercial", "wa_cloud"] }),
  });
}

export function useDisconnectCloud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callConnect<{ ok: boolean }>({ action: "disconnect" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercial", "wa_cloud"] }),
  });
}

export interface CloudDiagnosis {
  ok: boolean;
  phone: { status: string | null; code_verification_status: string | null; platform_type: string | null; quality_rating: string | null };
  subscribed_apps: string[] | null;
}

export function useCloudDiagnosis() {
  return useMutation({ mutationFn: () => callConnect<CloudDiagnosis>({ action: "status" }) });
}

export function useRequestCloudCode() {
  return useMutation({ mutationFn: (method: "SMS" | "VOICE") => callConnect<{ ok: boolean }>({ action: "request_code", method }) });
}

export function useVerifyCloudCode() {
  return useMutation({ mutationFn: (code: string) => callConnect<{ ok: boolean }>({ action: "verify_code", code }) });
}

export function useRegisterCloudNumber() {
  return useMutation({ mutationFn: (pin: string) => callConnect<{ ok: boolean }>({ action: "register", pin }) });
}

export interface ZapiStatus {
  connected: boolean;
  instance_id?: string;
  webhook_key?: string;
  connected_phone?: string | null;
  connected_at?: string;
  last_error?: string | null;
}

export const ZAPI_WEBHOOK_BASE = "https://bzzubzjbsjwuvchuhklr.supabase.co/functions/v1/whatsapp-zapi-webhook";

export function useZapiStatus() {
  return useQuery({
    queryKey: ["comercial", "wa_zapi"],
    queryFn: async (): Promise<ZapiStatus> => {
      const { data, error } = await (supabase as unknown as { rpc: (fn: string) => Promise<{ data: ZapiStatus | null; error: Error | null }> }).rpc("whatsapp_zapi_status");
      if (error) throw error;
      return data ?? { connected: false };
    },
    staleTime: 15_000,
  });
}

export function useSaveZapi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { instance_id: string; instance_token: string; client_token: string }) => callConnect<{ ok: boolean; connected: boolean }>({ action: "zapi_save", ...v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercial", "wa_zapi"] }),
  });
}

export function useDisconnectZapi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => callConnect<{ ok: boolean }>({ action: "zapi_disconnect" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comercial", "wa_zapi"] }),
  });
}

export interface ZapiLive { ok: boolean; connected: boolean; smartphone_connected: boolean | null; qr: string | null; error: string | null }

export function useZapiLive() {
  return useMutation({ mutationFn: () => callConnect<ZapiLive>({ action: "zapi_status" }) });
}

export function sendWhatsAppAudio(phone: string, audioBase64: string, seconds: number) {
  return callConnect<{ ok: boolean }>({ action: "send_audio", phone, audio: audioBase64, seconds });
}

export function sendWhatsApp(phone: string, text: string) {
  return callConnect<{ ok: boolean }>({ action: "send", phone, text });
}
