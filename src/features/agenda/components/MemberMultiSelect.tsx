import { UserAvatar } from "@/components/avatar/UserAvatar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TeamMemberRow } from "@/features/data/queries";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

interface MemberMultiSelectProps {
  members: TeamMemberRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label?: string;
}

export function MemberMultiSelect({
  members,
  selectedIds,
  onChange,
  disabled,
  label = "Membros da tarefa",
}: MemberMultiSelectProps) {
  const toggle = (userId: string) => {
    if (disabled) return;
    if (selectedIds.includes(userId)) {
      onChange(selectedIds.filter((id) => id !== userId));
    } else {
      onChange([...selectedIds, userId]);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {members.map((m) => {
          const selected = selectedIds.includes(m.user_id);
          return (
            <button
              key={m.user_id}
              type="button"
              onClick={() => toggle(m.user_id)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 transition",
                selected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <UserAvatar avatarUrl={m.avatar_url} name={m.display_name} className="h-6 w-6" fallbackClassName="text-[10px]" />
              <span className="text-sm">{m.display_name}</span>
            </button>
          );
        })}
      </div>
      {selectedIds.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Selecione ao menos um membro
        </p>
      )}
    </div>
  );
}
