import { useState } from "react";
import { Briefcase, Plus, ArrowUp, ArrowDown, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useAllCargos, useCreateCargo, useUpdateCargo } from "@/hooks/use-cargos";

// Lista fechada de cargos (Social Media, Designer, ...) que alimenta os seletores de cargo
// em todo o sistema (Configurações, tela de Permissões, elegibilidade de XP) e o mapeamento
// cargo → etapa usado pra auto-preencher responsáveis por cliente (role-stage-mapping.ts).
// Renomear um cargo aqui não atualiza quem já está com o nome antigo salvo — a pessoa
// precisa reabrir Configurações e escolher o novo nome.
export function AdminCargosPanel() {
  const cargosQ = useAllCargos();
  const createCargo = useCreateCargo();
  const updateCargo = useUpdateCargo();

  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  const cargos = [...(cargosQ.data ?? [])].sort((a, b) => a.order_index - b.order_index);

  const handleCreate = () => {
    const label = newLabel.trim();
    if (!label) return;
    const nextOrder = cargos.length > 0 ? Math.max(...cargos.map((c) => c.order_index)) + 1 : 1;
    createCargo.mutate(
      { label, orderIndex: nextOrder },
      {
        onSuccess: () => {
          toast.success("Cargo criado!");
          setNewLabel("");
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao criar cargo"),
      },
    );
  };

  const startEdit = (id: string, label: string) => {
    setEditingId(id);
    setEditingLabel(label);
  };

  const saveEdit = () => {
    if (!editingId || !editingLabel.trim()) return;
    updateCargo.mutate(
      { id: editingId, label: editingLabel.trim() },
      {
        onSuccess: () => setEditingId(null),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao renomear cargo"),
      },
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = cargos[index + direction];
    const current = cargos[index];
    if (!target) return;
    // Troca as duas order_index — o menor valor sempre aparece primeiro na lista.
    updateCargo.mutate({ id: current.id, orderIndex: target.order_index });
    updateCargo.mutate({ id: target.id, orderIndex: current.order_index });
  };

  const toggleActive = (id: string, isActive: boolean) => {
    updateCargo.mutate(
      { id, isActive },
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar cargo") },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
        <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Cargos usados em todo o sistema — na tela de Permissões, na elegibilidade de XP e
          no cargo escolhido em Configurações. Desativar um cargo tira ele das listas de
          escolha, mas não muda quem já está com esse cargo salvo.
        </p>
      </div>

      <Card>
        <CardContent className="divide-y divide-border/30 p-0">
          {cargos.map((cargo, i) => (
            <div key={cargo.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-muted-foreground transition hover:text-foreground disabled:opacity-20"
                  aria-label="Mover pra cima"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === cargos.length - 1}
                  className="text-muted-foreground transition hover:text-foreground disabled:opacity-20"
                  aria-label="Mover pra baixo"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {editingId === cargo.id ? (
                <div className="flex flex-1 items-center gap-2">
                  <Input
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    className="h-8 text-sm"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                    <Check className="h-4 w-4 text-success" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(cargo.id, cargo.label)}
                  className={"group flex flex-1 items-center gap-2 text-left text-sm font-medium transition hover:text-primary" + (cargo.is_active ? "" : " text-muted-foreground/50 line-through")}
                >
                  {cargo.label}
                  <Pencil className="h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
                </button>
              )}

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">{cargo.is_active ? "Ativo" : "Inativo"}</span>
                <Switch checked={cargo.is_active} onCheckedChange={(v) => toggleActive(cargo.id, v)} />
              </div>
            </div>
          ))}

          {cargos.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum cargo cadastrado ainda.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Nome do novo cargo"
          className="max-w-xs"
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <Button onClick={handleCreate} disabled={!newLabel.trim() || createCargo.isPending} className="gap-1.5">
          <Plus className="h-4 w-4" /> Adicionar cargo
        </Button>
      </div>
    </div>
  );
}
