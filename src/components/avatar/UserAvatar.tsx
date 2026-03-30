import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { AvatarUser } from "@/lib/avatar-users";
import { getAvatarInitials } from "@/lib/avatar-users";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  avatarUrl?: string | null;
  name?: string | null;
  user?: Pick<AvatarUser, "avatarUrl" | "displayName"> | null;
  className?: string;
  fallbackClassName?: string;
  alt?: string;
  loading?: boolean;
};

export function UserAvatar({
  avatarUrl,
  name,
  user,
  className,
  fallbackClassName,
  alt,
  loading = false,
}: UserAvatarProps) {
  const resolvedName = name ?? user?.displayName ?? "";
  const resolvedAvatarUrl = avatarUrl ?? user?.avatarUrl ?? undefined;

  return (
    <Avatar className={className}>
      {!loading ? <AvatarImage src={resolvedAvatarUrl ?? undefined} alt={alt ?? resolvedName} /> : null}
      <AvatarFallback className={cn(loading && "animate-pulse", fallbackClassName)}>
        {loading ? null : getAvatarInitials(resolvedName)}
      </AvatarFallback>
    </Avatar>
  );
}