import type { ProfileRow, TeamMemberRow } from "@/features/data/queries";

export type AvatarUser = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  roleTitle: string | null;
  birthDate: string | null;
  isActive: boolean;
};

export function getAvatarInitials(name: string | null | undefined): string {
  if (!name) return "";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function toAvatarUserFromTeamMember(member: TeamMemberRow): AvatarUser {
  return {
    userId: member.user_id,
    displayName: member.display_name,
    avatarUrl: member.avatar_url ?? null,
    roleTitle: member.role_title ?? null,
    birthDate: member.birth_date ?? null,
    isActive: member.is_active,
  };
}

export function mergeAvatarUsers(teamMembers: TeamMemberRow[], profiles: ProfileRow[]): AvatarUser[] {
  const merged = new Map<string, AvatarUser>();

  teamMembers.forEach((member) => {
    merged.set(member.user_id, toAvatarUserFromTeamMember(member));
  });

  profiles.forEach((profile) => {
    const existing = merged.get(profile.user_id);

    merged.set(profile.user_id, {
      userId: profile.user_id,
      displayName: existing?.displayName || profile.full_name,
      avatarUrl: existing?.avatarUrl ?? profile.avatar_url ?? null,
      roleTitle: existing?.roleTitle ?? profile.role_title ?? null,
      birthDate: existing?.birthDate ?? null,
      isActive: existing?.isActive ?? true,
    });
  });

  return Array.from(merged.values()).sort((a, b) => a.displayName.localeCompare(b.displayName, "pt-BR"));
}