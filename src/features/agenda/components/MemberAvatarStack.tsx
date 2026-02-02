import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

interface Member {
  user_id: string;
  display_name: string;
  avatar_url?: string | null;
}

interface MemberAvatarStackProps {
  members: Member[];
  maxVisible?: number;
  size?: "sm" | "md";
  className?: string;
}

export function MemberAvatarStack({
  members,
  maxVisible = 3,
  size = "sm",
  className,
}: MemberAvatarStackProps) {
  const visible = members.slice(0, maxVisible);
  const remaining = members.length - maxVisible;
  const sizeClass = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (members.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">Sem responsável</span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex -space-x-2", className)}>
          {visible.map((m) => (
            <Avatar
              key={m.user_id}
              className={cn(sizeClass, "border-2 border-background")}
            >
              <AvatarImage src={m.avatar_url ?? undefined} alt={m.display_name} />
              <AvatarFallback className={textSize}>
                {initials(m.display_name)}
              </AvatarFallback>
            </Avatar>
          ))}
          {remaining > 0 && (
            <div
              className={cn(
                sizeClass,
                "flex items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground",
                textSize
              )}
            >
              +{remaining}
            </div>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[200px]">
        <div className="space-y-1">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={m.avatar_url ?? undefined} />
                <AvatarFallback className="text-[8px]">
                  {initials(m.display_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{m.display_name}</span>
            </div>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
