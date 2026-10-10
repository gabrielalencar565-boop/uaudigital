import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail, Pencil, Trash2, UserPlus, Users2, KeyRound, Copy, Loader2,
  Settings2, ShieldCheck, ShieldX, Eye, EyeOff, Clock, Check, X, ArrowUpRight,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBatchUserRoles, useSetUserRoles } from "@/hooks/use-user-roles";
import { useAdminUsers, type AdminUserRow } from "@/hooks/use-admin-users";
import { useSquads, useSquadMembers } from "@/features/projetos/hooks/use-squads";
import type { AppRole } from "@/hooks/use-role";
import { InviteDialog, PendingInvites } from "@/features/admin/AgencyInvites";
import { brandGradientCss } from "@/lib/brand-gradient";
import { byName } from "@/lib/sort";
import { EditUserDialog } from "@/features/admin/components/EditUserDialog";

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
};

/* ───────── component ───────── */

export function AdminPanel() {
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const { user } = useSession();
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Role editing state
  const [editRoleUser, setEditRoleUser] = useState<AdminUserRow | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
  const [editSquadIds, setEditSquadIds] = useState<string[]>([]);
  const [editRoleTitles, setEditRoleTitles] = useState<string[]>([]);
  const [resetLinkUser, setResetLinkUser] = useState<AdminUserRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AdminUserRow | null>(null);

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
    setEditRoleTitles(r.role_titles ?? []);
    setEditRoleUser(r);
  };

  // Save stays disabled until something actually changed
  const editDirty = useMemo(() => {
    if (!editRoleUser) return false;
    const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
    return (
      !same(editRoles, rolesQ.data?.get(editRoleUser.user_id) ?? []) ||
      !same(editRoleTitles, editRoleUser.role_titles ?? []) ||
      !same(editSquadIds, userSquadMap.get(editRoleUser.user_id) ?? [])
    );
  }, [editRoleUser, editRoles, editRoleTitles, editSquadIds, rolesQ.data, userSquadMap]);

  const handleSaveRoles = async () => {
    if (!editRoleUser) return;
    setSavingAll(true);
    try {
      // Save roles
      await setUserRoles.mutateAsync({
        userId: editRoleUser.user_id,
        roles: editRoles,
      });

      // Save cargos (mesmas duas tabelas que ConfiguracoesPanel.tsx mantém em sincronia;
      // role_title -- a versão em texto, "Social Media, Designer" -- é sincronizada
      // automaticamente por trigger a partir de role_titles, não precisa gravar à parte)
      const currentTitles = editRoleUser.role_titles ?? [];
      const titlesChanged =
        currentTitles.length !== editRoleTitles.length ||
        [...currentTitles].sort().join("|") !== [...editRoleTitles].sort().join("|");
      if (titlesChanged) {
        const prof = await supabase
          .from("profiles")
          .update({ role_titles: editRoleTitles })
          .eq("user_id", editRoleUser.user_id);
        if (prof.error) throw prof.error;
        const tm = await supabase
          .from("team_members")
          .update({ role_titles: editRoleTitles })
          .eq("user_id", editRoleUser.user_id);
        if (tm.error) throw tm.error;
        await qc.invalidateQueries({ queryKey: ["admin_users"] });
      }

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
      const { data, error } = await supabase
        .from("access_requests")
        .update({ status: "approved", decided_at: new Date().toISOString(), decided_by: user.id })
        .eq("id", req.access_request_id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Não foi possível aprovar: sem permissão para esta solicitação.");
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
      const { data, error } = await supabase
        .from("access_requests")
        .update({ status: "rejected", decided_at: new Date().toISOString(), decided_by: user.id })
        .eq("id", req.access_request_id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Não foi possível recusar: sem permissão para esta solicitação.");
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
        .eq("id", req.access_request_id)
        .select("id");
      if (up.error) throw up.error;
      if (!up.data?.length) throw new Error("Não foi possível revogar: sem permissão para esta solicitação.");
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

    return [...all].sort(byName((r) => r.display_name));
  }, [usersQ.data, filter, roleFilter, rolesQ.data]);

  const pending = useMemo(
    () => (usersQ.data ?? []).filter((r) => r.access_status === "pending"),
    [usersQ.data]
  );

  /* ── what the user card shows: admin or not, and the squads ── */

  const getCardInfo = (userId: string) => {
    const roles = rolesQ.data?.get(userId) ?? [];
    const squadIds = userSquadMap.get(userId) ?? [];
    return {
      isAdmin: roles.includes("admin"),
      squads: (squadsQ.data ?? []).filter((sq: any) => squadIds.includes(sq.id)) as { id: string; name: string; color: string }[],
    };
  };

  /* ── render ── */

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
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
          </SelectContent>
        </Select>

        <Button variant="brand" className="h-10 sm:ml-auto" onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Convidar
        </Button>
      </div>

      <PendingInvites />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

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
        {rows.map((r) => {
          const info = getCardInfo(r.user_id);
          return <UserCard key={r.user_id} user={r} isAdmin={info.isAdmin} squads={info.squads} onEdit={() => openRoleEditor(r)} />;
        })}
        {rows.length === 0 && !usersQ.isLoading && (
          <p className="col-span-full text-sm text-muted-foreground text-center py-8">
            Nenhum usuário encontrado.
          </p>
        )}
      </div>

      {/* Dialog de link de reset */}
      <ResetLinkDialog user={resetLinkUser} onClose={() => setResetLinkUser(null)} />

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {revokeTarget?.display_name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso revoga o acesso dessa pessoa ao sistema — remove os papéis dela e desativa
              seu cadastro. Não apaga o histórico (tarefas, pontuação, etc.). Pra ela voltar a
              acessar, alguém precisa aprovar uma nova solicitação de acesso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (revokeTarget) revoke.mutate(revokeTarget);
                setRevokeTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {/* Dialog de edição */}
      <EditUserDialog
        user={editRoleUser}
        roles={editRoles}
        onRolesChange={setEditRoles}
        cargos={editRoleTitles}
        onCargosChange={setEditRoleTitles}
        squadIds={editSquadIds}
        onSquadIdsChange={setEditSquadIds}
        squads={(squadsQ.data ?? []) as any[]}
        dirty={editDirty}
        saving={savingAll}
        onSave={handleSaveRoles}
        onClose={() => setEditRoleUser(null)}
        onResetPassword={() => { const u = editRoleUser; setEditRoleUser(null); if (u) setResetLinkUser(u); }}
        onDelete={() => { const u = editRoleUser; setEditRoleUser(null); if (u) setRevokeTarget(u); }}
        onToggleVisible={() => {
          const u = editRoleUser;
          if (!u) return;
          (u.is_active ? hide : unhide).mutate(u, { onSuccess: () => setEditRoleUser((cur) => (cur ? { ...cur, is_active: !u.is_active } : cur)) });
        }}
      />
    </div>
  );
}

/* ───────── User Card ───────── */

// Same family as the client cards (Clientes): avatar in the brand ring, arrow in the corner, quiet text. Everything you can
// do to the person (reset the password, hide, delete) lives inside the edit window that this card opens.
function UserCard({
  user,
  isAdmin,
  squads,
  onEdit,
}: {
  user: AdminUserRow;
  isAdmin: boolean;
  squads: { id: string; name: string; color: string }[];
  onEdit: () => void;
}) {
  const cargo = (user.role_titles?.length ? user.role_titles.join(" · ") : user.role_title) || "Sem cargo";
  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "group relative flex flex-col items-start gap-4 rounded-3xl border border-border/40 bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-elevated",
        !user.is_active && "opacity-60 hover:opacity-100",
      )}
    >
      <div className="flex w-full items-start justify-between">
        <span className="rounded-full p-[2.5px]" style={{ background: brandGradientCss(135) }}>
          <Avatar className="h-14 w-14 ring-2 ring-card">
            {user.avatar_url && <AvatarImage src={user.avatar_url} className="object-cover" />}
            <AvatarFallback className="bg-muted text-base font-semibold">{getInitials(user.display_name)}</AvatarFallback>
          </Avatar>
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border/50 text-muted-foreground transition-all group-hover:border-violet-500/50 group-hover:bg-violet-500/10 group-hover:text-violet-500">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="flex min-w-0 max-w-full flex-col gap-0.5">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-base font-semibold leading-tight">{user.display_name}</span>
          {isAdmin && <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Administrador" />}
        </span>
        <span className="truncate text-xs text-muted-foreground">{cargo}</span>
        <span className="truncate text-[11px] text-muted-foreground/60">{user.email}</span>
      </div>

      {(squads.length > 0 || !user.is_active) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {squads.map((sq) => (
            <span key={sq.id} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: sq.color }} />
              {sq.name}
            </span>
          ))}
          {!user.is_active && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
              <EyeOff className="h-3 w-3" /> Oculto
            </span>
          )}
        </div>
      )}
    </button>
  );
}

/* ───────── Reset Link Dialog ───────── */

function ResetLinkDialog({
  user,
  onClose,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  // Reset state when user changes
  const currentUserId = user?.user_id ?? null;
  useMemo(() => {
    setLink(null);
    setLoading(false);
  }, [currentUserId]);

  const generate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-generate-recovery-link", {
        body: {
          email: user.email,
          redirect_to: `${window.location.origin}/auth?mode=reset`,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const action = (data as any)?.action_link as string | undefined;
      if (!action) throw new Error("Link não retornado");
      setLink(action);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar link");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Resetar senha
          </DialogTitle>
        </DialogHeader>

        {user && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-card/30 p-3">
              <p className="text-sm font-medium">{user.display_name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>

            {!link ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Vou gerar um link de redefinição de senha válido por <strong>1 hora</strong>.
                  Você copia e envia pro usuário (WhatsApp, Slack, etc.). Ele abre o link, define
                  a nova senha e entra normalmente.
                </p>
                <Button onClick={generate} disabled={loading} variant="brand" className="w-full">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" /> Gerar link de reset
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Link gerado (válido por 1h)
                  </Label>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs break-all font-mono">
                    {link}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={copy} variant="brand" className="flex-1 gap-2">
                    <Copy className="h-4 w-4" /> Copiar link
                  </Button>
                  <Button onClick={generate} variant="outline" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar novo"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground text-center">
                  É single-use: depois que o usuário usar, o link expira.
                </p>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
