import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useCargos } from "@/hooks/use-cargos";

interface CargoMultiSelectProps {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  label?: string;
}

// Uma pessoa pode acumular mais de um cargo (ex: Editor de Vídeo + Diretor de Vídeo) --
// mesmo padrão visual de checkbox já usado em RoleSelector.tsx e na seleção de squads do
// AdminPanel.tsx, mas pra cargos (lista fechada vinda de useCargos()).
export function CargoMultiSelect({ selected, onChange, disabled, label = "Cargo" }: CargoMultiSelectProps) {
  const cargosQ = useCargos();

  const toggle = (label: string, checked: boolean) => {
    if (checked) {
      onChange([...selected, label]);
    } else {
      onChange(selected.filter((c) => c !== label));
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="space-y-2">
        {(cargosQ.data ?? []).map((cargo) => (
          <label
            key={cargo.id}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/20 p-3 transition hover:bg-card/40 cursor-pointer"
          >
            <Checkbox
              checked={selected.includes(cargo.label)}
              onCheckedChange={(checked) => toggle(cargo.label, !!checked)}
              disabled={disabled}
            />
            <span className="font-medium text-sm">{cargo.label}</span>
          </label>
        ))}
        {(cargosQ.data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum cargo cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
