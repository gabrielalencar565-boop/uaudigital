import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { normalizeAvatarUrl } from "@/lib/avatar-url";

export type MyProfileRow = {
  user_id: string;
  full_name: string;
  role_title: string;
  role_titles: string[];
  avatar_url: string | null;
  banner_photo_url: string | null;
  whats_new_dismissed_at: string | null;
};

/**
 * Hook para buscar dados do perfil do usuário logado
 */
export function useMyProfile() {
  const { user } = useSession();

  return useQuery({
    enabled: !!user?.id,
    queryKey: ["my_profile", user?.id],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<MyProfileRow | null> => {
      if (!user) return null;

      // Tenta primeiro buscar do profiles
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, role_title, role_titles, avatar_url, banner_photo_url, whats_new_dismissed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profErr && profile) {
        return {
          ...profile,
          avatar_url: normalizeAvatarUrl(profile.avatar_url) ?? null,
          banner_photo_url: normalizeAvatarUrl(profile.banner_photo_url) ?? null,
        } as MyProfileRow;
      }

      // Fallback para team_members se não existir perfil
      const { data: member, error: memErr } = await supabase
        .from("team_members")
        .select("user_id, display_name, role_title, role_titles, avatar_url, banner_photo_url, whats_new_dismissed_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!memErr && member) {
        return {
          user_id: member.user_id,
          full_name: member.display_name,
          role_title: member.role_title,
          role_titles: member.role_titles ?? [],
          avatar_url: normalizeAvatarUrl(member.avatar_url) ?? null,
          banner_photo_url: normalizeAvatarUrl(member.banner_photo_url) ?? null,
          whats_new_dismissed_at: member.whats_new_dismissed_at,
        } as MyProfileRow;
      }

      // Fallback com dados do auth
      return {
        user_id: user.id,
        full_name: user.email?.split("@")[0] ?? "Usuário",
        role_title: "Colaborador",
        role_titles: [],
        avatar_url: null,
        banner_photo_url: null,
        whats_new_dismissed_at: null,
      };
    },
  });
}
