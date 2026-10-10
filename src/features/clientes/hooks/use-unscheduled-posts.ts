import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type UnscheduledPosts = { client_id: string; total: number; overdue: number; due_today: number; awaiting_approval: number; first_date: string };

/**
 * Per client: posts in the Cronograma (from a week ago to a week ahead) that were never scheduled on Instagram.
 * Only clients with an active Instagram connection show up, since those are the only ones the app can schedule for.
 */
export function useUnscheduledPosts() {
  return useQuery({
    queryKey: ["unscheduled_posts_by_client"],
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async (): Promise<Map<string, UnscheduledPosts>> => {
      const { data, error } = await (supabase as any).rpc("unscheduled_post_by_client");
      if (error) throw error;
      return new Map(((data ?? []) as UnscheduledPosts[]).map((r) => [r.client_id, r]));
    },
  });
}

/** "2 atrasados · 1 para hoje · 3 aguardando aprovação" */
export function describeUnscheduled(u: UnscheduledPosts): string {
  const parts: string[] = [];
  if (u.overdue > 0) parts.push(`${u.overdue} ${u.overdue > 1 ? "atrasados" : "atrasado"}`);
  if (u.due_today > 0) parts.push(`${u.due_today} para hoje`);
  if (u.awaiting_approval > 0) parts.push(`${u.awaiting_approval} aguardando aprovação`);
  return parts.join(" · ");
}
