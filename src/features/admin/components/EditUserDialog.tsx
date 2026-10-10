import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarDays, Check, CircleDashed, Eye, EyeOff, KeyRound, ListChecks, ShieldCheck, Trash2, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useCargos } from "@/hooks/use-cargos";
import type { AdminUserRow } from "@/hooks/use-admin-users";
import type { AppRole } from "@/hooks/use-role";

type Squad = { id: string; name: string; color: string };

export interface EditUserDialogProps {
  user: AdminUserRow | null;
  roles: AppRole[];
  onRolesChange: (roles: AppRole[]) => void;
  cargos: string[];
  onCargosChange: (cargos: string[]) => void;
  squadIds: string[];
  onSquadIdsChange: (ids: string[]) => void;
  squads: Squad[];
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
  onResetPassword: () => void;
  onToggleVisible: () => void;
  onDelete: () => void;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function formatDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

// Workload of the person, so whoever changes their access sees what they carry right now (open / late / done in 30 days).
function useWorkload(userId: string | undefined) {
  return useQuery({
    enabled: !!userId,
    queryKey: ["admin_user_workload", userId],
    staleTime: 60_000,
    queryFn: async () => {
      const base = () => (supabase as any).from("pm_tasks").select("id", { count: "exact", head: true }).eq("assignee_id", userId).is("deleted_at", null).eq("is_draft", false);
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [open, late, done] = await Promise.all([
        base().neq("status_global", "concluido"),
        base().neq("status_global", "concluido").lt("due_date", today),
        base().eq("status_global", "concluido").gte("updated_at", since),
      ]);
      return { open: open.count ?? 0, late: late.count ?? 0, done: done.count ?? 0 };
    },
  });
}

export function EditUserDialog(p: EditUserDialogProps) {
  const cargosQ = useCargos();
  const workloadQ = useWorkload(p.user?.user_id);
  const isAdmin = p.roles.includes("admin");

  const toggleCargo = (label: string) =>
    p.onCargosChange(p.cargos.includes(label) ? p.cargos.filter((c) => c !== label) : [...p.cargos, label]);
  const toggleSquad = (id: string) =>
    p.onSquadIdsChange(p.squadIds.includes(id) ? p.squadIds.filter((s) => s !== id) : [...p.squadIds, id]);

  const wl = workloadQ.data;
  const stats = useMemo(
    () => [
      { label: "Em aberto", value: wl?.open, icon: ListChecks, tone: "text-foreground" },
      { label: "Atrasadas", value: wl?.late, icon: AlertTriangle, tone: wl && wl.late > 0 ? "text-destructive" : "text-foreground" },
      { label: "Feitas em 30 dias", value: wl?.done, icon: Check, tone: "text-emerald-500" },
    ],
    [wl],
  );

  if (!p.user) return null;
  const u = p.user;

  return (
    <Dialog open={!!p.user} onOpenChange={(open) => !open && p.onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Editar {u.display_name}</DialogTitle>
          <DialogDescription>Permissão, cargos e squads de {u.display_name}</DialogDescription>
        </DialogHeader>

        {/* Who */}
        <div className="relative overflow-hidden border-b border-border/40 px-6 pb-5 pt-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,hsl(var(--primary)/0.18),transparent_60%)]" />
          <div className="relative flex flex-wrap items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-primary/40 ring-offset-2 ring-offset-background">
              {u.avatar_url && <AvatarImage src={u.avatar_url} />}
              <AvatarFallback className="bg-muted text-lg font-semibold">{initials(u.display_name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-bold tracking-tight">{u.display_name}</h2>
              <p className="truncate text-sm text-muted-foreground">{u.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", isAdmin ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                  {isAdmin ? <ShieldCheck className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
                  {isAdmin ? "Administrador" : "Membro"}
                </span>
                {!u.is_active && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    <EyeOff className="h-3 w-3" /> Oculto da equipe
                  </span>
                )}
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  <CalendarDays className="h-3 w-3" /> Na agência desde {formatDate(u.requested_at)}
                </span>
              </div>
            </div>
          </div>

          <div className="relative mt-5 grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/40 bg-background/40 px-3 py-2.5">
                <p className={cn("text-xl font-bold tabular-nums leading-none", s.tone)}>{s.value ?? "–"}</p>
                <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <s.icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.label}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* What they can do */}
        <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
          <section className="space-y-5">
            <div className="space-y-2.5">
              <SectionTitle>Permissão</SectionTitle>
              <div className="grid gap-2">
                <PermissionOption
                  selected={!isAdmin}
                  disabled={p.saving}
                  onSelect={() => p.onRolesChange(p.roles.filter((r) => r !== "admin"))}
                  icon={<UserRound className="h-4 w-4" />}
                  title="Membro"
                  hint="Trabalha nas demandas e vê o que o cargo dá acesso."
                />
                <PermissionOption
                  selected={isAdmin}
                  disabled={p.saving}
                  onSelect={() => p.onRolesChange(p.roles.includes("admin") ? p.roles : [...p.roles, "admin"])}
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Administrador"
                  hint="Acesso total: usuários, financeiro e configurações da agência."
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <SectionTitle>Cargos</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {(cargosQ.data ?? []).map((c) => (
                  <Chip key={c.id} selected={p.cargos.includes(c.label)} disabled={p.saving} onClick={() => toggleCargo(c.label)}>
                    {c.label}
                  </Chip>
                ))}
                {(cargosQ.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhum cargo cadastrado ainda.</p>}
              </div>
              <p className="text-[11px] text-muted-foreground">Pode acumular mais de um, como Editor e Diretor de Vídeo.</p>
            </div>
          </section>

          <section className="space-y-2.5">
            <SectionTitle>Squads</SectionTitle>
            {p.squads.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/50 px-3 py-6 text-center text-xs text-muted-foreground">Nenhum squad cadastrado.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
                {p.squads.map((sq) => {
                  const on = p.squadIds.includes(sq.id);
                  return (
                    <button
                      key={sq.id}
                      type="button"
                      disabled={p.saving}
                      onClick={() => toggleSquad(sq.id)}
                      aria-pressed={on}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
                        on ? "border-primary/60 bg-primary/5" : "border-border/50 hover:bg-accent/30",
                      )}
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: sq.color }} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{sq.name}</span>
                      {on ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Actions */}
        <DialogFooter className="flex-col gap-3 border-t border-border/40 bg-muted/20 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={p.onResetPassword}>
              <KeyRound className="h-3.5 w-3.5" /> Resetar senha
            </Button>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={p.onToggleVisible}>
              {u.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {u.is_active ? "Ocultar da equipe" : "Mostrar na equipe"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={p.onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={p.onClose}>Cancelar</Button>
            <Button type="button" variant="brand" onClick={p.onSave} disabled={p.saving || !p.dirty}>
              {p.saving ? "Salvando..." : p.dirty ? "Salvar alterações" : "Sem alterações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

function PermissionOption({ selected, disabled, onSelect, icon, title, hint }: { selected: boolean; disabled: boolean; onSelect: () => void; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition",
        selected ? "border-primary/60 bg-primary/5" : "border-border/50 hover:bg-accent/30",
      )}
    >
      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className={cn("mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary" : "border-muted-foreground/40")}>
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
    </button>
  );
}

function Chip({ selected, disabled, onClick, children }: { selected: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        selected ? "border-primary/60 bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:bg-accent/30 hover:text-foreground",
      )}
    >
      {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      {children}
    </button>
  );
}
