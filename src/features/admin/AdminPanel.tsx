import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail, Pencil, Trash2, UserPlus, Users2, KeyRound, Copy, Loader2,
  Settings2, ShieldCheck, ShieldX, Eye, EyeOff, Clock, Check, X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBatchUserRoles, useSetUserRoles } from "@/hooks/use-user-roles";
import { RoleSelector } from "@/features/admin/components/RoleSelector";
import { useAdminUsers, type AdminUserRow } from "@/hooks/use-admin-users";
import { useSquads, useSquadMembers } from "@/features/projetos/hooks/use-squads";
import type { AppRole } from "@/hooks/use-role";

/* ───────── helpers ───────── */

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "border-sidebar text-sidebar" },
  planner: { label: "Planejador", color: "border-warning text-warning" },
  collaborator: { label: "Colaborador", color: "border-border text-foreground" },
};

/* ───────── component ───────── */

export function AdminPanel() {
  const qc = useQueryClient();
  const { user } = useSession();
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Role editing state
  const [editRoleUser, setEditRoleUser] = useState<AdminUserRow | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
  const [editSquadIds, setEditSquadIds] = useState<string[]>([]);

  const usersQ = useAdminUsers();
  const squadsQ = useSquads();
  const squadMembersQ = useSquadMembers();

  const userIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of usersQ.data ?? []) ids.add(r.user_id);
    return Array.from(ids);
  }, [usersQ.data]);

  const rolesQ = useBatchUserRoles(userIds);
  const setUserRoles = useSetUserRoles();
  const [savingAll, setSavingAll] = useState(false);
  const isBusy = setUserRoles.isPending || savingAll;

  // Build map: userId -> squadIds
  const userSquadMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const sm of squadMembersQ.data ?? []) {
      const existing = map.get(sm.user_id) ?? [];
      map.set(sm.user_id, [...existing, sm.squad_id]);
    }
    return map;
  }, [squadMembersQ.data]);

  const openRoleEditor = (r: AdminUserRow) => {
    const currentRoles = rolesQ.data?.get(r.user_id) ?? [];
    setEditRoles(currentRoles);
    setEditSquadIds(userSquadMap.get(r.user_id) ?? []);
    setEditRoleUser(r);
  };

  const handleSaveRoles = async () => {
    if (!editRoleUser) return;
    setSavingAll(true);
    try {
      // Save roles
      await setUserRoles.mutateAsync({
        userId: editRoleUser.user_id,
        roles: editRoles,
      });

      // Save squad memberships: remove from old squads, add to new
      const currentSquads = userSquadMap.get(editRoleUser.user_id) ?? [];
      const toRemove = currentSquads.filter((id) => !editSquadIds.includes(id));
      const toAdd = editSquadIds.filter((id) => !currentSquads.includes(id));

      for (const squadId of toRemove) {
        await supabase
          .from("squad_members")
          .delete()
          .eq("squad_id", squadId)
          .eq("user_id", editRoleUser.user_id);
      }
      for (const squadId of toAdd) {
        await supabase
          .from("squad_members")
          .insert({ squad_id: squadId, user_id: editRoleUser.user_id } as any);
      }

      await qc.invalidateQueries({ queryKey: ["squad_members"] });
      toast.success("Configurações atualizadas!");
      setEditRoleUser(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar");
    } finally {
      setSavingAll(false);
    }
  };

  /* ── mutations ── */

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

  /* ── filtering ── */

  const rows = useMemo(() => {
    let all = usersQ.data ?? [];
    // Only show approved users in main grid
    all = all.filter((r) => r.access_status === "approved");

    const f = filter.trim().toLowerCase();
    if (f) {
      all = all.filter(
        (r) =>
          r.email.toLowerCase().includes(f) ||
          r.display_name.toLowerCase().includes(f)
      );
    }

    if (roleFilter !== "all") {
      all = all.filter((r) => {
        const roles = rolesQ.data?.get(r.user_id) ?? [];
        return roles.includes(roleFilter as AppRole);
      });
    }

    return all;
  }, [usersQ.data, filter, roleFilter, rolesQ.data]);

  const pending = useMemo(
    () => (usersQ.data ?? []).filter((r) => r.access_status === "pending"),
    [usersQ.data]
  );

  /* ── role & squad badges for a user ── */

  const getRoleBadges = (userId: string) => {
    const roles = rolesQ.data?.get(userId) ?? [];
    const squadIds = userSquadMap.get(userId) ?? [];
    const squads = (squadsQ.data ?? []).filter((s: any) => squadIds.includes(s.id));

    if (roles.length === 0 && squads.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5 justify-center">
        {roles.map((role) => {
          const cfg = ROLE_MAP[role];
          if (!cfg) return null;
          return (
            <Badge
              key={role}
              variant="outline"
              className={cn("gap-1 text-xs font-normal", cfg.color)}
            >
              <Users2 className="h-3 w-3" />
              {cfg.label}
            </Badge>
          );
        })}
        {squads.map((s: any) => (
          <Badge
            key={s.id}
            variant="outline"
            className="gap-1 text-xs font-normal border-sidebar text-sidebar"
          >
            <Users2 className="h-3 w-3" />
            {s.name}
          </Badge>
        ))}
      </div>
    );
  };

  /* ── render ── */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <h2 className="text-2xl font-semibold tracking-tight">Gestão de usuários</h2>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <div className="relative flex-1 max-w-md">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Buscar usuários..."
            className="h-10 pl-9"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
        </div>

        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48 h-10">
            <SelectValue placeholder="Todos os cargos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cargos</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="planner">Planejador</SelectItem>
            <SelectItem value="collaborator">Colaborador</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {usersQ.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {usersQ.isError && <p className="text-sm text-destructive">Erro ao carregar usuários.</p>}

      {/* Pending banner */}
      {pending.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-warning" />
            <span className="font-medium text-sm">
              {pending.length} solicitação(ões) pendente(s)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pending.map((r) => (
              <div
                key={r.user_id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2"
              >
                <span className="text-sm font-medium">{r.display_name}</span>
                <span className="text-xs text-muted-foreground">{r.email}</span>
                <Button size="sm" variant="brand" onClick={() => approve.mutate(r)} disabled={isBusy} className="h-7 px-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => reject.mutate(r)} disabled={isBusy} className="h-7 px-2">
                  <ShieldX className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((r) => (
          <UserCard
            key={r.user_id}
            user={r}
            roleBadges={getRoleBadges(r.user_id)}
            onEditRoles={() => openRoleEditor(r)}
            onRevoke={() => revoke.mutate(r)}
            onHide={() => hide.mutate(r)}
            onUnhide={() => unhide.mutate(r)}
            onGenerateResetLink={() => setResetLinkUser(r)}
            isBusy={isBusy}
          />
        ))}
        {rows.length === 0 && !usersQ.isLoading && (
          <p className="col-span-full text-sm text-muted-foreground text-center py-8">
            Nenhum usuário encontrado.
          </p>
        )}
      </div>

      {/* Dialog de link de reset */}
      <ResetLinkDialog user={resetLinkUser} onClose={() => setResetLinkUser(null)} />


      {/* Dialog de edição */}
      <Dialog open={!!editRoleUser} onOpenChange={(open) => !open && setEditRoleUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/20 p-3">
              <Avatar className="h-10 w-10">
                {editRoleUser?.avatar_url && <AvatarImage src={editRoleUser.avatar_url} />}
                <AvatarFallback className="bg-muted text-sm font-medium">
                  {editRoleUser ? getInitials(editRoleUser.display_name) : ""}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{editRoleUser?.display_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{editRoleUser?.email}</p>
              </div>
            </div>

            <RoleSelector
              selectedRoles={editRoles}
              onChange={setEditRoles}
              disabled={savingAll}
            />

            {/* Squad selector */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Squads</Label>
              <div className="space-y-2">
                {(squadsQ.data ?? []).map((squad: any) => (
                  <label
                    key={squad.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/20 p-3 transition hover:bg-card/40 cursor-pointer"
                  >
                    <Checkbox
                      checked={editSquadIds.includes(squad.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEditSquadIds((prev) => [...prev, squad.id]);
                        } else {
                          setEditSquadIds((prev) => prev.filter((id) => id !== squad.id));
                        }
                      }}
                      disabled={savingAll}
                      className="mt-0.5"
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: squad.color }}
                      />
                      <span className="font-medium text-sm">{squad.name}</span>
                    </div>
                  </label>
                ))}
                {(squadsQ.data ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum squad cadastrado.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setEditRoleUser(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={handleSaveRoles}
              disabled={savingAll}
            >
              {savingAll ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────── User Card ───────── */

function UserCard({
  user,
  roleBadges,
  onEditRoles,
  onRevoke,
  onHide,
  onUnhide,
  isBusy,
}: {
  user: AdminUserRow;
  roleBadges: React.ReactNode;
  onEditRoles: () => void;
  onRevoke: () => void;
  onHide: () => void;
  onUnhide: () => void;
  isBusy: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-5 flex flex-col items-center text-center space-y-3 transition-colors hover:border-sidebar/30">
      {/* Avatar */}
      <Avatar className="h-16 w-16">
        {user.avatar_url && <AvatarImage src={user.avatar_url} />}
        <AvatarFallback className="bg-muted text-lg font-semibold">
          {getInitials(user.display_name)}
        </AvatarFallback>
      </Avatar>

      {/* Name & email */}
      <div className="space-y-0.5">
        <p className="font-semibold text-sm">{user.display_name}</p>
        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{user.email}</p>
      </div>

      {/* Role badges */}
      {roleBadges}

      {/* Visibility badge */}
      {!user.is_active && (
        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
          <EyeOff className="h-3 w-3" /> Oculto
        </Badge>
      )}

      <Separator className="my-1" />

      {/* Email button */}
      <a
        href={`mailto:${user.email}`}
        className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
      >
        <Mail className="h-3.5 w-3.5" />
        Email
      </a>

      <Separator className="my-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8 rounded-lg"
          onClick={onEditRoles}
          disabled={isBusy}
          title="Editar permissões"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>

        {user.is_active ? (
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-lg"
            onClick={onHide}
            disabled={isBusy}
            title="Ocultar"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 rounded-lg"
            onClick={onUnhide}
            disabled={isBusy}
            title="Mostrar"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-8 rounded-lg gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={onRevoke}
          disabled={isBusy}
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Excluir
        </Button>
      </div>

      {/* Creation date */}
      <p className="text-[11px] text-muted-foreground pt-1">
        Criado em {formatDate(user.requested_at)}
      </p>
    </div>
  );
}
