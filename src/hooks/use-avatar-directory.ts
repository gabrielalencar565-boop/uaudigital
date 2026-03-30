import { useEffect, useMemo } from "react";

import { useProfiles, useTeamMembers } from "@/features/data/queries";
import { preloadAvatars } from "@/lib/avatar-preloader";
import { mergeAvatarUsers } from "@/lib/avatar-users";

export function useAvatarDirectory(options?: { includeProfiles?: boolean }) {
  const includeProfiles = options?.includeProfiles ?? true;
  const teamQ = useTeamMembers();
  const profilesQ = useProfiles({ enabled: includeProfiles });

  const users = useMemo(
    () => mergeAvatarUsers(teamQ.data ?? [], profilesQ.data ?? []),
    [profilesQ.data, teamQ.data]
  );

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.userId, user] as const)),
    [users]
  );

  useEffect(() => {
    if (!users.length) return;
    void preloadAvatars(users.map((user) => user.avatarUrl));
  }, [users]);

  return {
    users,
    usersById,
    isLoading: teamQ.isLoading || (includeProfiles && profilesQ.isLoading),
    isReady: teamQ.isSuccess && (!includeProfiles || profilesQ.isSuccess),
  };
}