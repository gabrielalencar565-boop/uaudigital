import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// New tables aren't in the generated Supabase types yet.
const sb = supabase as any;

import type { Audience, MediaInsight, MetricSnapshot } from "../lib/report-metrics";

export type { Audience, MediaInsight, MetricSnapshot };

export function useMetricSnapshots(clientId: string | null) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["instagram_metric_snapshots", clientId],
    queryFn: async (): Promise<MetricSnapshot[]> => {
      const { data, error } = await sb
        .from("instagram_metric_snapshots")
        .select("snapshot_date, followers_count, reach, views, profile_views, profile_link_taps, follower_delta, accounts_engaged, total_interactions")
        .eq("client_id", clientId)
        .order("snapshot_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMediaInsights(clientId: string | null) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["instagram_media_insights", clientId],
    queryFn: async (): Promise<MediaInsight[]> => {
      const { data, error } = await sb
        .from("instagram_media_insights")
        .select("ig_media_id, content_type, posted_at, permalink, thumbnail_url, caption, reach, likes, comments, saves, shares, total_interactions")
        .eq("client_id", clientId)
        .order("posted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export class InsightsError extends Error {
  needsReauthorization: boolean;
  constructor(message: string, needsReauthorization: boolean) {
    super(message);
    this.needsReauthorization = needsReauthorization;
  }
}

async function invokeInsights(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("instagram-insights", { body });
  if (error) {
    // The real reason lives on error.context (the raw Response); error.message is always generic.
    let payload: { error?: string; needs_reauthorization?: boolean } | null = null;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") payload = await context.json().catch(() => null);
    throw new InsightsError(payload?.error ?? error.message, !!payload?.needs_reauthorization);
  }
  return data;
}

export function useSyncInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId }: { clientId: string }) => invokeInsights({ action: "sync", client_id: clientId }),
    onSuccess: (_d, { clientId }) => {
      qc.invalidateQueries({ queryKey: ["instagram_metric_snapshots", clientId] });
      qc.invalidateQueries({ queryKey: ["instagram_media_insights", clientId] });
      toast.success("Dados atualizados.");
    },
    onError: (e) => {
      if (e instanceof InsightsError && e.needsReauthorization) return; // the panel shows the reconnect banner
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar os dados");
    },
  });
}

export function useConnectWithInsights() {
  return useMutation({
    mutationFn: async ({ clientId }: { clientId: string }) => {
      const data = await invokeInsights({ action: "connect_url", client_id: clientId });
      return data.url as string;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao iniciar a conexão"),
  });
}

export function useAudience(clientId: string | null) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["instagram_audience", clientId],
    queryFn: async (): Promise<Audience> => {
      const { data, error } = await sb
        .from("instagram_audience_snapshots")
        .select("gender, age, city, country, city_geo, captured_at")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export type ReportLink = { id: string; token: string; period_days: number; enabled: boolean };

export const reportUrl = (token: string, print = false) =>
  `${window.location.origin}/relatorio/${token}${print ? "?print=1" : ""}`;

export function useReportLink(clientId: string | null) {
  return useQuery({
    enabled: !!clientId,
    queryKey: ["instagram_report_link", clientId],
    queryFn: async (): Promise<ReportLink | null> => {
      const { data, error } = await sb
        .from("instagram_report_links")
        .select("id, token, period_days, enabled")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

// One link per client: creating it again just refreshes the period/enabled state, and "regenerate"
// swaps the token so the previous URL stops working.
export function useSaveReportLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      clientId, periodDays, enabled = true, regenerate = false,
    }: { clientId: string; periodDays: number; enabled?: boolean; regenerate?: boolean }): Promise<ReportLink> => {
      const payload: Record<string, unknown> = { client_id: clientId, period_days: periodDays, enabled };
      if (regenerate) payload.token = crypto.randomUUID();
      const { data, error } = await sb
        .from("instagram_report_links")
        .upsert(payload, { onConflict: "client_id" })
        .select("id, token, period_days, enabled")
        .single();
      if (error) throw error;
      return data as ReportLink;
    },
    onSuccess: (_d, { clientId }) => qc.invalidateQueries({ queryKey: ["instagram_report_link", clientId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar o link do relatório"),
  });
}
