import { useEffect, useMemo, useState } from "react";

import { useProfiles, useTeamMembers } from "@/features/data/queries";
import { areAvatarsSettled, preloadAvatars } from "@/lib/avatar-preloader";
import { mergeAvatarUsers } from "@/lib/avatar-users";

export function useAvatarDirectory(options?: { includeProfiles?: boolean }) {
  const includeProfiles = options?.includeProfiles ?? true;
  const teamQ = useTeamMembers();
  const profilesQ = useProfiles({ enabled: includeProfiles });

  const users = useMemo(
    () => mergeAvatarUsers(teamQ.data ?? [], profilesQ.data ?? []),
    [profilesQ.data, teamQ.data]
  );
  const avatarUrls = useMemo(() => users.map((user) => user.avatarUrl), [users]);
  const [isPrimed, setIsPrimed] = useState(true);

  const usersById = useMemo(
    () => new Map(users.map((user) => [user.userId, user] as const)),
    [users]
  );

  useEffect(() => {
    if (!users.length) {
      setIsPrimed(true);
      return;
    }

    if (areAvatarsSettled(avatarUrls)) {
      setIsPrimed(true);
      return;
    }

    let cancelled = false;
    setIsPrimed(false);

    void preloadAvatars(avatarUrls).then(() => {
      if (!cancelled) setIsPrimed(true);
    });

    return () => {
      cancelled = true;
    };
  }, [avatarUrls, users.length]);

  return {
    users,
    usersById,
    isPrimed,
    isLoading: teamQ.isLoading || (includeProfiles && profilesQ.isLoading),
    isReady: teamQ.isSuccess && (!includeProfiles || profilesQ.isSuccess) && isPrimed,
  };
}