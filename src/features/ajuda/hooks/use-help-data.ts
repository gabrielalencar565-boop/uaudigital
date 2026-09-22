import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

const sb = supabase as any;

export interface ChangelogEntry {
  id: string;
  category: string;
  title: string;
  description: string;
  cta_label: string | null;
  cta_target_tab: string | null;
  cta_target_selector: string | null;
  publish_as_banner: boolean;
  published_at: string;
  created_by: string | null;
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  order_index: number;
}

export type ProblemReportStatus = "aberto" | "em_andamento" | "resolvido";

export interface ProblemReport {
  id: string;
  user_id: string;
  description: string;
  page_context: string | null;
  attachment_url: string | null;
  element_info: any;
  status: ProblemReportStatus;
  created_at: string;
}

// ── Changelog ──

export function useChangelogEntries() {
  return useQuery({
    queryKey: ["help_changelog_entries"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("help_changelog_entries")
        .select("*")
        .order("published_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ChangelogEntry[];
    },
  });
}

export function useCreateChangelogEntry() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      category: string;
      title: string;
      description: string;
      cta_label?: string | null;
      cta_target_tab?: string | null;
      cta_target_selector?: string | null;
      publish_as_banner?: boolean;
    }) => {
      const { data, error } = await sb.from("help_changelog_entries").insert({ ...entry, created_by: user?.id }).select().single();
      if (error) throw error;
      return data as ChangelogEntry;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["help_changelog_entries"] }),
  });
}

export function useDeleteChangelogEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("help_changelog_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["help_changelog_entries"] }),
  });
}

// ── FAQ ──

export function useFaqItems() {
  return useQuery({
    queryKey: ["help_faq_items"],
    queryFn: async () => {
      const { data, error } = await sb.from("help_faq_items").select("*").order("order_index", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FaqItem[];
    },
  });
}

export function useCreateFaqItem() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: { category: string; question: string; answer: string; order_index?: number }) => {
      const { error } = await sb.from("help_faq_items").insert({ ...item, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["help_faq_items"] }),
  });
}

export function useDeleteFaqItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("help_faq_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["help_faq_items"] }),
  });
}

// ── Problem reports ──

export function useMyProblemReports() {
  const { user } = useSession();
  return useQuery({
    queryKey: ["problem_reports_mine", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await sb
        .from("problem_reports")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProblemReport[];
    },
  });
}

// RLS already scopes this to every row when the viewer has the developer role — no
// need to filter client-side, a non-developer would just get their own rows back.
export function useAllProblemReports() {
  return useQuery({
    queryKey: ["problem_reports_all"],
    queryFn: async () => {
      const { data, error } = await sb
        .from("problem_reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProblemReport[];
    },
  });
}

export function useUpdateProblemReportStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProblemReportStatus }) => {
      const { error } = await sb.from("problem_reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["problem_reports_all"] });
      queryClient.invalidateQueries({ queryKey: ["problem_reports_mine"] });
    },
  });
}
