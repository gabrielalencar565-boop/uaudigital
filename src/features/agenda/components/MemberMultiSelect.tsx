import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ProfileRow } from "@/features/data/queries";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

interface MemberMultiSelectProps {
  profiles: ProfileRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  label?: string;
}

export function MemberMultiSelect({
  profiles,
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
        {profiles.map((p) => {
          const selected = selectedIds.includes(p.user_id);
          return (
            <button
              key={p.user_id}
              type="button"
              onClick={() => toggle(p.user_id)}
              disabled={disabled}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 transition",
                selected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={p.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {initials(p.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{p.full_name}</span>
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
