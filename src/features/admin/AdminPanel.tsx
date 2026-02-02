import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, EyeOff, Eye, ShieldCheck, ShieldX, UserMinus, Clock, X, Settings2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBatchUserRoles, useSetUserRoles } from "@/hooks/use-user-roles";
import { RoleSelector } from "@/features/admin/components/RoleSelector";
import { useAdminUsers, type AdminUserRow } from "@/hooks/use-admin-users";
import type { AppRole } from "@/hooks/use-role";

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function StatusBadge({ status }: { status: AdminUserRow["access_status"] }) {
  if (!status) return null;
  const config = {
    pending: { label: "Pendente", variant: "warning" as const, icon: Clock },
    approved: { label: "Aprovado", variant: "success" as const, icon: Check },
    rejected: { label: "Removido", variant: "destructive" as const, icon: X },
  };
  const { label, variant, icon: Icon } = config[status];
  return (
    <Badge variant={variant} className="gap-1 text-xs">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function VisibilityBadge({ visible }: { visible: boolean }) {
  return visible ? (
    <Badge variant="secondary" className="gap-1 text-xs">
      <Eye className="h-3 w-3" /> Visível
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
      <EyeOff className="h-3 w-3" /> Oculto
    </Badge>
  );
}

export function AdminPanel() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const { user } = useSession();
  
  // Role editing state
  const [editRoleUser, setEditRoleUser] = useState<AdminUserRow | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);

  // Usar nova RPC que filtra usuários válidos automaticamente
  const usersQ = useAdminUsers();

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of usersQ.data ?? []) ids.add(r.user_id);
    return Array.from(ids);
  }, [usersQ.data]);

  // Batch fetch roles for all users
  const rolesQ = useBatchUserRoles(userIds);
  const setUserRoles = useSetUserRoles();

  const isBusy = useMemo(() => setUserRoles.isPending, [setUserRoles.isPending]);
  
  const openRoleEditor = (r: AdminUserRow) => {
    const currentRoles = rolesQ.data?.get(r.user_id) ?? [];
    setEditRoles(currentRoles);
    setEditRoleUser(r);
  };
  
  const handleSaveRoles = async () => {
    if (!editRoleUser) return;
    try {
      await setUserRoles.mutateAsync({
        userId: editRoleUser.user_id,
        roles: editRoles,
      });
      toast.success("Permissões atualizadas!");
      setEditRoleUser(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar permissões");
    }
  };
  
  const getRoleBadges = (userId: string) => {
    const roles = rolesQ.data?.get(userId) ?? [];
    if (roles.length === 0) return <span className="text-xs text-muted-foreground">Sem permissões</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {roles.includes("admin") && <Badge variant="destructive" className="text-[10px] px-1.5">Admin</Badge>}
        {roles.includes("planner") && <Badge variant="warning" className="text-[10px] px-1.5">Planejador</Badge>}
        {roles.includes("collaborator") && <Badge variant="secondary" className="text-[10px] px-1.5">Colaborador</Badge>}
      </div>
    );
  };

  const approve = useMutation({
    mutationFn: async (req: AdminUserRow) => {
      if (!user) throw new Error("Não autenticado");
      if (!req.access_request_id) throw new Error("Solicitação não encontrada");
      const { error } = await supabase
        .from("access_requests")
        .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: user.id })
        .eq("id", req.access_request_id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("Acesso aprovado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao aprovar"),
  });

  const reject = useMutation({
    mutationFn: async (req: AdminUserRow) => {
      if (!user) throw new Error("Não autenticado");
      if (!req.access_request_id) throw new Error("Solicitação não encontrada");
      const { error } = await supabase
        .from("access_requests")
        .update({ status: "rejected", decided_at: new Date().toISOString(), decided_by: user.id })
        .eq("id", req.access_request_id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("Acesso recusado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao recusar"),
  });

  const revoke = useMutation({
    mutationFn: async (req: AdminUserRow) => {
      if (!user) throw new Error("Não autenticado");
      if (!req.access_request_id) throw new Error("Solicitação não encontrada");
      const up = await supabase
        .from("access_requests")
        .update({ status: "rejected", decided_at: new Date().toISOString(), decided_by: user.id })
        .eq("id", req.access_request_id);
      if (up.error) throw up.error;
      const delRoles = await supabase.from("user_roles").delete().eq("user_id", req.user_id);
      if (delRoles.error) throw delRoles.error;
      const tm = await supabase.from("team_members").update({ is_active: false }).eq("user_id", req.user_id);
      if (tm.error) throw tm.error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin_users"] }),
        qc.invalidateQueries({ queryKey: ["team_members"] }),
      ]);
      toast.success("Acesso revogado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao revogar"),
  });

  const hide = useMutation({
    mutationFn: async (req: AdminUserRow) => {
      if (!user) throw new Error("Não autenticado");
      const tm = await supabase.from("team_members").update({ is_active: false }).eq("user_id", req.user_id);
      if (tm.error) throw tm.error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin_users"] });
      await qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success("Usuário ocultado");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao ocultar"),
  });

  const unhide = useMutation({
    mutationFn: async (req: AdminUserRow) => {
      if (!user) throw new Error("Não autenticado");
      const tm = await supabase.from("team_members").update({ is_active: true }).eq("user_id", req.user_id);
      if (tm.error) throw tm.error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin_users"] });
      await qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success("Usuário reexibido");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao reexibir"),
  });

  const rows = useMemo(() => {
    const all = usersQ.data ?? [];
    const f = filter.trim().toLowerCase();
    if (!f) return all;
    return all.filter((r) => 
      r.email.toLowerCase().includes(f) || 
      r.display_name.toLowerCase().includes(f) ||
      r.user_id.toLowerCase().includes(f)
    );
  }, [usersQ.data, filter]);

  const pending = rows.filter((r) => r.access_status === "pending");
  const approved = rows.filter((r) => r.access_status === "approved");
  const rejected = rows.filter((r) => r.access_status === "rejected");

  const UserRow = ({ r, actions, showRoles }: { r: AdminUserRow; actions: React.ReactNode; showRoles?: boolean }) => (
    <div
      className={cn(
        "rounded-lg border border-border/60 p-3",
        r.access_status === "pending" && "bg-warning/5 border-warning/30",
        r.access_status === "approved" && "bg-card/30",
        r.access_status === "rejected" && "bg-muted/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1 flex-1">
          <p className="truncate text-sm font-medium">{r.display_name}</p>
          <p className="truncate text-xs text-muted-foreground">{r.email}</p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={r.access_status} />
            {r.access_status === "approved" && <VisibilityBadge visible={r.is_active} />}
            <span className="text-xs text-muted-foreground">{formatDate(r.requested_at)}</span>
          </div>
          {showRoles && r.access_status === "approved" && (
            <div className="pt-1">{getRoleBadges(r.user_id)}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 shrink-0">{actions}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Usuários</h2>
        <p className="text-sm text-muted-foreground">Gerencie acessos da equipe.</p>
      </div>

      <div className="max-w-sm">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por email ou nome..."
          className="h-9"
        />
      </div>

      {usersQ.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {usersQ.isError && <p className="text-sm text-destructive">Erro ao carregar usuários.</p>}

      {/* Pendentes */}
      {pending.length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              Pendentes ({pending.length})
            </CardTitle>
            <CardDescription>Aguardando aprovação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.map((r) => (
              <UserRow
                key={r.user_id}
                r={r}
                actions={
                  <>
                    <Button size="sm" variant="brand" onClick={() => approve.mutate(r)} disabled={isBusy}>
                      <ShieldCheck className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reject.mutate(r)} disabled={isBusy}>
                      <ShieldX className="h-4 w-4" />
                    </Button>
                  </>
                }
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Aprovados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            Ativos ({approved.length})
          </CardTitle>
          <CardDescription>Membros com acesso ao sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {approved.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário aprovado.</p>
          ) : (
            approved.map((r) => (
              <UserRow
                key={r.user_id}
                r={r}
                showRoles
                actions={
                  <>
                    <Button size="sm" variant="ghost" onClick={() => openRoleEditor(r)} disabled={isBusy} title="Editar permissões">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    {r.is_active ? (
                      <Button size="sm" variant="ghost" onClick={() => hide.mutate(r)} disabled={isBusy} title="Ocultar">
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => unhide.mutate(r)} disabled={isBusy} title="Mostrar">
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => revoke.mutate(r)} disabled={isBusy} title="Remover">
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </>
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição de roles */}
      <Dialog open={!!editRoleUser} onOpenChange={(open) => !open && setEditRoleUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Permissões</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-card/20 p-3">
              <p className="text-sm font-medium">{editRoleUser?.display_name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{editRoleUser?.email}</p>
            </div>
            
            <RoleSelector
              selectedRoles={editRoles}
              onChange={setEditRoles}
              disabled={setUserRoles.isPending}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditRoleUser(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={handleSaveRoles}
              disabled={setUserRoles.isPending}
            >
              {setUserRoles.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Removidos */}
      {rejected.length > 0 && (
        <Card className="opacity-70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <X className="h-4 w-4 text-muted-foreground" />
              Removidos ({rejected.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rejected.slice(0, 10).map((r) => (
              <UserRow
                key={r.user_id}
                r={r}
                actions={
                  <Button size="sm" variant="outline" onClick={() => approve.mutate(r)} disabled={isBusy}>
                    <ShieldCheck className="h-4 w-4" />
                  </Button>
                }
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
