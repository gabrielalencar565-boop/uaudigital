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

export function sendWhatsApp(phone: string, text: string) {
  return callConnect<{ ok: boolean }>({ action: "send", phone, text });
}
