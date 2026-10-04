import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowUp, ArrowDown, Pencil, Check, X, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAllCargos, useCreateCargo, useUpdateCargo, useCargos } from "@/hooks/use-cargos";
import { useFeaturePermissions, type FeaturePermission } from "@/hooks/use-permission";
import { type AppRole } from "@/hooks/use-role";

// "admin" fica de fora da lista editável de propósito — é sempre permitido em usePermission()
// e deixar desmarcar aqui só criaria a falsa impressão de que dá pra tirar o próprio acesso de
// admin a uma tela (inclusive a esta). "planner"/"collaborator" não aparecem mais aqui: ninguém
// é atribuído a esses papéis (substituídos pelos cargos), só "developer" ainda é um papel real.
const EDITABLE_ROLES: { value: Exclude<AppRole, "admin">; label: string }[] = [
  { value: "developer", label: "Desenvolvedor" },
];

// Explica em uma frase o que cada ação/aba realmente libera — vira o tooltip do ícone de
// informação ao lado do título.
const FEATURE_DESCRIPTIONS: Record<string, string> = {
  tab_comercial: "Libera a aba Comercial no menu lateral (funil de leads, propostas).",
  tab_financeiro: "Libera a aba Financeiro no menu lateral (receitas, despesas, lançamentos e metas).",
  action_instagram_connect: "Conectar ou desconectar a conta do Instagram de um cliente no Cronograma.",
  action_client_credentials: "Ver, criar e apagar logins e senhas dos clientes (bloco Acessos em Clientes → Documentos).",
  action_manage_publications: "Criar publicações e calendários de aprovação no Cronograma.",
  action_manage_tags: "Editar ou apagar as tags usadas para classificar tarefas.",
  action_manage_faq: "Criar, editar e apagar perguntas frequentes da Central de Ajuda.",
  action_manage_changelog: "Publicar avisos de novidade no topo do sistema e itens no changelog da Central de Ajuda.",
  action_manage_tasks: "Criar, editar, apagar e arrastar tarefas na Agenda, e corrigir tarefas já concluídas.",
  action_manage_appeals: "Ver e decidir pedidos de recurso de quem discorda de uma penalização em uma tarefa.",
  action_whatsapp_broadcast: "Disparar uma mensagem de WhatsApp em massa para toda a equipe.",
  action_whatsapp_send: "Enviar uma mensagem manual de WhatsApp para uma pessoa específica.",
};

// Lista fechada de cargos (Social Media, Designer, ...) que alimenta os seletores de cargo
// em todo o sistema (Configurações, permissões abaixo, elegibilidade de XP) e o mapeamento
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
    <div className="space-y-8">
      <div className="space-y-4">
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
      </div>

      <CargoPermissoesSection />
    </div>
  );
}

// Escolha de quais papéis (Desenvolvedor) e cargos podem acessar cada aba/ação do sistema —
// antes vivia numa tela "Permissões" à parte; movida pra cá porque a maioria das permissões
// hoje é configurada por cargo, então faz mais sentido ficar junto de onde os cargos em si
// são gerenciados.
function CargoPermissoesSection() {
  const permsQ = useFeaturePermissions();
  const cargosQ = useCargos();
  const qc = useQueryClient();

  const grouped = useMemo(() => {
    const map = new Map<string, FeaturePermission[]>();
    for (const p of permsQ.data ?? []) {
      const list = map.get(p.area) ?? [];
      list.push(p);
      map.set(p.area, list);
    }
    return Array.from(map.entries());
  }, [permsQ.data]);

  const updatePerm = useMutation({
    mutationFn: async ({ key, allowed_roles, allowed_cargos }: { key: string; allowed_roles: AppRole[]; allowed_cargos: string[] }) => {
      const { error } = await supabase.from("feature_permissions").update({ allowed_roles, allowed_cargos }).eq("key", key);
      if (error) throw error;
    },
    onMutate: async ({ key, allowed_roles, allowed_cargos }) => {
      await qc.cancelQueries({ queryKey: ["feature_permissions"] });
      const previous = qc.getQueryData<FeaturePermission[]>(["feature_permissions"]);
      qc.setQueryData<FeaturePermission[]>(["feature_permissions"], (old) =>
        (old ?? []).map((p) => (p.key === key ? { ...p, allowed_roles, allowed_cargos } : p)),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["feature_permissions"], ctx.previous);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar permissão");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["feature_permissions"] }),
  });

  const toggleRole = (perm: FeaturePermission, role: AppRole, checked: boolean) => {
    const next = checked ? [...perm.allowed_roles, role] : perm.allowed_roles.filter((r) => r !== role);
    updatePerm.mutate({ key: perm.key, allowed_roles: next, allowed_cargos: perm.allowed_cargos });
  };

  const toggleCargo = (perm: FeaturePermission, cargo: string, checked: boolean) => {
    const next = checked ? [...perm.allowed_cargos, cargo] : perm.allowed_cargos.filter((c) => c !== cargo);
    updatePerm.mutate({ key: perm.key, allowed_roles: perm.allowed_roles, allowed_cargos: next });
  };

  if (permsQ.isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando permissões...</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold tracking-tight">Permissões</h3>

      {grouped.map(([area, perms]) => (
        <Card key={area}>
          <CardHeader>
            <CardTitle className="text-base">{area}</CardTitle>
            <CardDescription>
              {area === "Abas" && "Controla quem vê essas abas no menu lateral."}
              {area === "Ações" && "Controla quem pode usar essas ações específicas dentro do sistema."}
              {area === "Automações" && "Controla quem pode disparar essas automações."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {perms.map((perm) => (
              <div key={perm.key} className="space-y-2.5 border-b border-border/40 pb-4 last:border-0 last:pb-0">
                <div className="inline-flex items-center gap-1.5 rounded-lg bg-primary/15 px-2.5 py-1 text-sm font-semibold text-primary">
                  {perm.label}
                  {FEATURE_DESCRIPTIONS[perm.key] && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 shrink-0 cursor-help opacity-80" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>{FEATURE_DESCRIPTIONS[perm.key]}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex cursor-not-allowed items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked disabled />
                    Dono da Agência
                  </label>
                  {EDITABLE_ROLES.map((r) => (
                    <label key={r.value} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={perm.allowed_roles.includes(r.value)}
                        onCheckedChange={(checked) => toggleRole(perm, r.value, checked === true)}
                      />
                      {r.label}
                    </label>
                  ))}
                  {(cargosQ.data ?? []).map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={perm.allowed_cargos.includes(c.label)}
                        onCheckedChange={(checked) => toggleCargo(perm, c.label, checked === true)}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
