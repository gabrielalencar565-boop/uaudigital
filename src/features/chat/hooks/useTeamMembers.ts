import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeamMemberLite = {
  user_id: string;
  display_name: string;
  role_title: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

export function useTeamMembers() {
  return useQuery({
    queryKey: ["chat", "team-members"],
    staleTime: 60_000,
    queryFn: async (): Promise<TeamMemberLite[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("user_id, display_name, role_title, avatar_url, is_active")
        .eq("is_active", true)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((m) => !!m.user_id) as TeamMemberLite[];
    },
  });
}
