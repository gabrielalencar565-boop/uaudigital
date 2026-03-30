import { useEffect } from "react";

import { useProfiles, useTeamMembers } from "@/features/data/queries";
import { preloadAvatars } from "@/lib/avatar-preloader";

export function AvatarBootstrap() {
  const teamQ = useTeamMembers();
  const profilesQ = useProfiles();
  const isReady = teamQ.isSuccess || profilesQ.isSuccess;

  useEffect(() => {
    if (!isReady) return;

    void preloadAvatars([
      ...(teamQ.data ?? []).map((member) => member.avatar_url),
      ...(profilesQ.data ?? []).map((profile) => profile.avatar_url),
    ]);
  }, [isReady, teamQ.data, profilesQ.data]);

  return null;
}
