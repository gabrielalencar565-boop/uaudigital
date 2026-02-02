import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AppRole } from "@/hooks/use-role";

const AVAILABLE_ROLES: { value: AppRole; label: string; desc: string }[] = [
  { value: "collaborator", label: "Colaborador", desc: "Pode concluir tarefas atribuídas" },
  { value: "planner", label: "Planejador", desc: "Pode criar e editar tarefas" },
  { value: "admin", label: "Administrador", desc: "Acesso total ao sistema" },
];

interface RoleSelectorProps {
  selectedRoles: AppRole[];
  onChange: (roles: AppRole[]) => void;
  disabled?: boolean;
}

export function RoleSelector({ selectedRoles, onChange, disabled }: RoleSelectorProps) {
  const toggle = (role: AppRole, checked: boolean) => {
    if (checked) {
      onChange([...selectedRoles, role]);
    } else {
      onChange(selectedRoles.filter((r) => r !== role));
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">Permissões</Label>
      <div className="space-y-2">
        {AVAILABLE_ROLES.map((role) => (
          <label
            key={role.value}
            className="flex items-start gap-3 rounded-lg border border-border/60 bg-card/20 p-3 transition hover:bg-card/40 cursor-pointer"
          >
            <Checkbox
              checked={selectedRoles.includes(role.value)}
              onCheckedChange={(checked) => toggle(role.value, !!checked)}
              disabled={disabled}
              className="mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <span className="font-medium text-sm">{role.label}</span>
              <p className="text-xs text-muted-foreground">{role.desc}</p>
            </div>
          </label>
        ))}
      </div>
      {selectedRoles.length === 0 && (
        <p className="text-xs text-warning">
          Usuário sem permissões não poderá acessar o sistema
        </p>
      )}
    </div>
  );
}
