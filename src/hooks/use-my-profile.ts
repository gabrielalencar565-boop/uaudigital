import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export type MyProfileRow = {
  user_id: string;
  full_name: string;
  role_title: string;
  avatar_url: string | null;
};

/**
 * Hook para buscar dados do perfil do usuário logado
 */
export function useMyProfile() {
  const { user } = useSession();

  return useQuery({
    enabled: !!user?.id,
    queryKey: ["my_profile", user?.id],
    queryFn: async (): Promise<MyProfileRow | null> => {
      if (!user) return null;

      // Tenta primeiro buscar do profiles
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, role_title, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profErr && profile) {
        return profile as MyProfileRow;
      }

      // Fallback para team_members se não existir perfil
      const { data: member, error: memErr } = await supabase
        .from("team_members")
        .select("user_id, display_name, role_title, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!memErr && member) {
        return {
          user_id: member.user_id,
          full_name: member.display_name,
          role_title: member.role_title,
          avatar_url: member.avatar_url,
        } as MyProfileRow;
      }

      // Fallback com dados do auth
      return {
        user_id: user.id,
        full_name: user.email?.split("@")[0] ?? "Usuário",
        role_title: "Colaborador",
        avatar_url: null,
      };
    },
  });
}
