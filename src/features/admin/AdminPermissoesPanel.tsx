import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFeaturePermissions, type FeaturePermission } from "@/hooks/use-permission";
import { type AppRole } from "@/hooks/use-role";
import { useCargos } from "@/hooks/use-cargos";

// "admin" fica de fora da lista editável de propósito — é sempre permitido em usePermission()
// e deixar desmarcar aqui só criaria a falsa impressão de que dá pra tirar o próprio acesso de
// admin a uma tela (inclusive a esta). "planner"/"collaborator" não aparecem mais aqui: ninguém
// é atribuído a esses papéis (substituídos pelos cargos), só "developer" ainda é um papel real.
const EDITABLE_ROLES: { value: Exclude<AppRole, "admin">; label: string }[] = [
  { value: "developer", label: "Desenvolvedor" },
];

// Explica em uma frase o que cada ação/aba realmente libera — vira o tooltip do ícone de
// informação ao lado do título. Mesmo padrão já usado aqui pras descrições de área (abaixo).
const FEATURE_DESCRIPTIONS: Record<string, string> = {
  tab_comercial: "Libera a aba Comercial no menu lateral (funil de leads, propostas).",
  tab_financeiro: "Libera a aba Financeiro no menu lateral (receitas, despesas, lançamentos e metas).",
  action_instagram_connect: "Conectar ou desconectar a conta do Instagram de um cliente no Cronograma.",
  action_manage_publications: "Criar publicações e calendários de aprovação no Cronograma.",
  action_manage_tags: "Editar ou apagar as tags usadas para classificar tarefas.",
  action_manage_faq: "Criar, editar e apagar perguntas frequentes da Central de Ajuda.",
  action_manage_changelog: "Publicar avisos de novidade no topo do sistema e itens no changelog da Central de Ajuda.",
  action_manage_tasks: "Criar, editar, apagar e arrastar tarefas na Agenda, e corrigir tarefas já concluídas.",
  action_manage_appeals: "Ver e decidir pedidos de recurso de quem discorda de uma penalização em uma tarefa.",
  action_whatsapp_broadcast: "Disparar uma mensagem de WhatsApp em massa para toda a equipe.",
  action_whatsapp_send: "Enviar uma mensagem manual de WhatsApp para uma pessoa específica.",
};

export function AdminPermissoesPanel() {
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
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Dono da Agência sempre tem acesso a tudo. Aqui você escolhe quais outros papéis (do sistema) ou
          cargos (da equipe) também podem acessar cada aba/ação abaixo. Isso não cobre tudo que
          existe no sistema ainda — só o que já foi migrado para este painel.
        </p>
      </div>

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
