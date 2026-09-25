import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useFeaturePermissions, type FeaturePermission } from "@/hooks/use-permission";
import { type AppRole } from "@/hooks/use-role";
import { ROLE_OPTIONS } from "@/lib/role-options";

// "admin" fica de fora da lista editável de propósito — é sempre permitido em usePermission()
// e deixar desmarcar aqui só criaria a falsa impressão de que dá pra tirar o próprio acesso de
// admin a uma tela (inclusive a esta).
const EDITABLE_ROLES: { value: Exclude<AppRole, "admin">; label: string }[] = [
  { value: "planner", label: "Planner" },
  { value: "collaborator", label: "Colaborador" },
  { value: "developer", label: "Developer" },
];

export function AdminPermissoesPanel() {
  const permsQ = useFeaturePermissions();
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
          Admin sempre tem acesso a tudo. Aqui você escolhe quais outros papéis (do sistema) ou
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
                <div className="text-sm font-medium text-foreground">{perm.label}</div>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <label className="flex cursor-not-allowed items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked disabled />
                    Admin
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
                  {ROLE_OPTIONS.map((c) => (
                    <label key={c.value} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={perm.allowed_cargos.includes(c.value)}
                        onCheckedChange={(checked) => toggleCargo(perm, c.value, checked === true)}
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
