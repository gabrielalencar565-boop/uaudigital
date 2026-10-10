import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Camera, Check, CircleDashed, Instagram, Plug, RefreshCw, Shield, Trash2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/use-permission";
import { useRole } from "@/hooks/use-role";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { autoAssignStagesForClient, buildCandidatesForClient, sortForAssignment, stagesByRole } from "@/lib/role-stage-mapping";
import { useStageRoles } from "@/features/gestao/hooks/use-stage-roles";
import { useStageFlows } from "@/features/gestao/components/PmStageFlowConfig";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClientSquads, useSquadMembers, useSquads } from "@/features/projetos/hooks/use-squads";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useConnectInstagram, useDisconnectInstagram, useInstagramConnections } from "@/features/calendario/hooks/use-instagram";
import { useConnectWithInsights } from "@/features/resultados/hooks/use-resultados";
import { brandGradientCss } from "@/lib/brand-gradient";
import { useClients, useTeamMembers } from "@/features/data/queries";
import { toGridThumbUrl } from "@/features/calendario/components/CalendarioPublicacaoPanel";
import { useUpdateClientPhoto } from "../hooks/use-client-data";

function Card({ icon: Icon, title, description, children }: { icon: typeof Instagram; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  );
}

function PhotoCard({ clientId }: { clientId: string }) {
  const clientsQ = useClients();
  const client = (clientsQ.data ?? []).find((c) => c.id === clientId);
  const update = useUpdateClientPhoto(clientId);
  const inputRef = useRef<HTMLInputElement>(null);
  const logo = client?.logo_url ?? null;

  const pick = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A foto passa de 5 MB."); return; }
    update.mutate(file);
  };

  return (
    <Card icon={Camera} title="Foto do cliente">
      <div className="flex items-center gap-4">
        <span className="shrink-0 rounded-full p-[2.5px]" style={{ background: brandGradientCss(135) }}>
          <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-card text-xl font-bold ring-2 ring-card">
            {logo ? <img src={toGridThumbUrl(logo)} alt="" className="h-full w-full object-cover" /> : (client?.name.trim().charAt(0).toUpperCase() ?? "?")}
          </span>
        </span>
        <div className="space-y-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full" disabled={update.isPending} onClick={() => inputRef.current?.click()}>
              {update.isPending ? "Enviando…" : logo ? "Trocar foto" : "Adicionar foto"}
            </Button>
            {logo && (
              <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground hover:text-destructive" disabled={update.isPending} onClick={() => update.mutate(null)}>
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">JPG ou PNG quadrado, até 5 MB.</p>
        </div>
      </div>
    </Card>
  );
}

type Ambiguity = { cargo: string; stages: string[]; people: { user_id: string; display_name: string; avatar_url: string | null }[] };

function SquadCard({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { user } = useSession();
  const { isAdmin } = useRole(user?.id);
  const squadsQ = useSquads();
  const clientSquadsQ = useClientSquads();
  const squadMembersQ = useSquadMembers();
  const teamQ = useTeamMembers();
  const rolesQ = useStageRoles();
  const flowsQ = useStageFlows();
  const clientsQ = useClients();
  const clientName = (clientsQ.data ?? []).find((c) => c.id === clientId)?.name ?? "este cliente";

  const saved = useMemo(
    () => (clientSquadsQ.data ?? []).filter((cs: any) => cs.client_id === clientId).map((cs: any) => cs.squad_id as string),
    [clientSquadsQ.data, clientId],
  );
  const [selected, setSelected] = useState<string[]>(saved);
  const [saving, setSaving] = useState(false);
  const [choosing, setChoosing] = useState<Ambiguity[] | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  // follow the saved squads whenever they load or change from outside
  useEffect(() => { setSelected(saved); }, [saved.join("|")]);

  const same = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
  const dirty = !same(selected, saved);
  const countBySquad = useMemo(() => {
    const map = new Map<string, number>();
    for (const sm of squadMembersQ.data ?? []) map.set(sm.squad_id, (map.get(sm.squad_id) ?? 0) + 1);
    return map;
  }, [squadMembersQ.data]);

  const toggle = (id: string) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // Cargos for which the chosen squads have more than one person: the admin picks who takes this client
  const findAmbiguities = (): Ambiguity[] => {
    const joinedAt = new Map<string, string>();
    for (const sm of (squadMembersQ.data ?? []) as any[]) {
      if (!selected.includes(sm.squad_id)) continue;
      const prev = joinedAt.get(sm.user_id);
      if (!prev || sm.created_at < prev) joinedAt.set(sm.user_id, sm.created_at);
    }
    const team = (teamQ.data ?? []).filter((m) => joinedAt.has(m.user_id));
    const ordered = sortForAssignment(team.map((m) => ({ ...m, joined_at: joinedAt.get(m.user_id) ?? null })));
    const roleToStages = stagesByRole(rolesQ.data ?? {});
    const candidates = buildCandidatesForClient(ordered.map((m) => ({ user_id: m.user_id, role_titles: m.role_titles ?? [] })), roleToStages);
    const byId = new Map(ordered.map((m) => [m.user_id, m]));
    const out: Ambiguity[] = [];
    for (const [cargo, stages] of Object.entries(roleToStages)) {
      const ids = candidates[stages[0]] ?? [];
      if (ids.length < 2) continue;
      out.push({ cargo, stages, people: ids.map((id) => ({ user_id: id, display_name: byId.get(id)!.display_name, avatar_url: byId.get(id)!.avatar_url ?? null })) });
    }
    return out;
  };

  const defaultPicks = (ambiguities: Ambiguity[]) => {
    const flow = (flowsQ.data ?? []).find((f) => f.is_default) ?? (flowsQ.data ?? [])[0];
    const assignees = (flow?.stage_assignees ?? {}) as Record<string, Record<string, any>>;
    const out: Record<string, string> = {};
    for (const a of ambiguities) {
      const raw = assignees[a.stages[0]]?.[clientId];
      const current = Array.isArray(raw) ? raw[0] : raw;
      out[a.cargo] = a.people.some((p) => p.user_id === current) ? current : a.people[0].user_id;
    }
    return out;
  };

  const persist = async (choicesByCargo: Record<string, string>) => {
    setSaving(true);
    try {
      const toRemove = saved.filter((id) => !selected.includes(id));
      const toAdd = selected.filter((id) => !saved.includes(id));
      for (const squadId of toRemove) {
        const { error } = await supabase.from("client_squads" as any).delete().eq("client_id", clientId).eq("squad_id", squadId);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const { error } = await supabase.from("client_squads" as any).insert(toAdd.map((squadId) => ({ client_id: clientId, squad_id: squadId })) as any);
        if (error) throw error;
      }
      // the squad defines the client's team (each person by their cargo); a cargo with two people takes the one chosen
      const roleToStages = stagesByRole(rolesQ.data ?? {});
      const choices: Record<string, string> = {};
      for (const [cargo, userId] of Object.entries(choicesByCargo)) for (const stage of roleToStages[cargo] ?? []) choices[stage] = userId;
      try {
        await autoAssignStagesForClient(supabase, clientId, selected, choices);
      } catch (e) {
        console.warn("Auto-assign failed (non-blocking):", e);
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["client_squads"] }),
        qc.invalidateQueries({ queryKey: ["pm_stage_flows"] }),
        qc.invalidateQueries({ queryKey: ["magic2"] }),
      ]);
      setChoosing(null);
      toast.success("Squad atualizado. A equipe do cliente foi preenchida.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o squad");
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    const ambiguities = findAmbiguities();
    if (ambiguities.length === 0) { void persist({}); return; }
    setPicks(defaultPicks(ambiguities));
    setChoosing(ambiguities);
  };

  const squads = squadsQ.data ?? [];
  return (
    <Card icon={Shield} title="Squad responsável" description="O squad define a equipe do cliente: cada pessoa assume as etapas do seu cargo.">
      {squads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/50 px-3 py-6 text-center text-xs text-muted-foreground">Nenhum squad cadastrado.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {squads.map((sq: any) => {
            const on = selected.includes(sq.id);
            return (
              <button
                key={sq.id}
                type="button"
                disabled={!isAdmin || saving}
                onClick={() => toggle(sq.id)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-default",
                  on ? "border-primary/60 bg-primary/5" : "border-border/50",
                  isAdmin && !on && "hover:bg-accent/30",
                )}
              >
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: sq.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{sq.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{countBySquad.get(sq.id) ?? 0} {(countBySquad.get(sq.id) ?? 0) === 1 ? "pessoa" : "pessoas"}</span>
                </span>
                {on ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground/40" />}
              </button>
            );
          })}
        </div>
      )}
      {!isAdmin ? (
        <p className="text-xs text-muted-foreground">Só administradores mudam o squad do cliente.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Button className="rounded-full" size="sm" disabled={!dirty || saving} onClick={save}>{saving ? "Salvando…" : "Salvar squad"}</Button>
          {dirty && !saving && <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={() => setSelected(saved)}>Descartar</Button>}
        </div>
      )}

      <Dialog open={!!choosing} onOpenChange={(o) => { if (!o && !saving) setChoosing(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quem assume {clientName}?</DialogTitle>
            <DialogDescription>O squad tem mais de uma pessoa nestes cargos. Escolha quem fica com este cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {(choosing ?? []).map((a) => (
              <section key={a.cargo} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{a.cargo}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {a.people.map((p) => {
                    const on = picks[a.cargo] === p.user_id;
                    return (
                      <button
                        key={p.user_id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPicks((cur) => ({ ...cur, [a.cargo]: p.user_id }))}
                        className={cn("flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition", on ? "border-primary/60 bg-primary/5" : "border-border/50 hover:bg-accent/30")}
                      >
                        <Avatar className="h-10 w-10"><AvatarImage src={p.avatar_url ?? undefined} className="object-cover" /><AvatarFallback className="text-xs">{p.display_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</AvatarFallback></Avatar>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.display_name}</span>
                        <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary" : "border-muted-foreground/40")}>
                          {on && <span className="h-2 w-2 rounded-full bg-primary" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setChoosing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={() => persist(picks)} disabled={saving}>{saving ? "Salvando…" : "Salvar squad"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InstagramCard({ clientId }: { clientId: string }) {
  const canManage = usePermission("action_instagram_connect");
  const connectionsQ = useInstagramConnections(clientId);
  const connect = useConnectInstagram();
  const connectInsights = useConnectWithInsights();
  const disconnect = useDisconnectInstagram();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const conn = (connectionsQ.data ?? []).find((c) => c.client_id === clientId) ?? null;
  const active = conn?.status === "active";
  const expires = conn?.token_expires_at ? parseISO(conn.token_expires_at) : null;
  const expired = !!expires && isPast(expires);

  const go = (url: string) => { window.location.href = url; };
  const startConnect = () => connect.mutate({ clientId }, { onSuccess: go });
  const startInsights = () => connectInsights.mutate({ clientId }, { onSuccess: go });

  const status = active && !expired
    ? { label: "Conectado", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }
    : conn && conn.status !== "revoked"
      ? { label: expired ? "Token expirado" : "Com problema", className: "bg-destructive/15 text-destructive" }
      : { label: "Não conectado", className: "bg-muted text-muted-foreground" };

  return (
    <Card icon={Instagram} title="Instagram">
      <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{conn?.instagram_username ? `@${conn.instagram_username}` : "Nenhuma conta conectada"}</p>
          {conn?.facebook_page_name && <p className="truncate text-xs text-muted-foreground">Página: {conn.facebook_page_name}</p>}
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", status.className)}>{status.label}</span>
      </div>

      {conn && (
        <div className="divide-y divide-border/40">
          <Row label="Tipo de login">{conn.auth_provider === "instagram_login" ? "Instagram" : "Facebook"}</Row>
          {expires && (
            <Row label={expired ? "Expirou" : "Renova em"}>
              {expired ? format(expires, "dd/MM/yyyy") : formatDistanceToNowStrict(expires, { locale: ptBR })}
            </Row>
          )}
        </div>
      )}

      {conn?.last_error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span className="min-w-0 break-words">{conn.last_error}</span>
        </div>
      )}

      {!canManage ? (
        <p className="text-xs text-muted-foreground">Você não tem permissão para conectar contas. Peça a um administrador.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!active || expired ? (
            <Button className="gap-1.5 rounded-full" disabled={connect.isPending} onClick={startConnect}>
              <Plug className="h-4 w-4" /> {conn ? "Reconectar Instagram" : "Conectar Instagram"}
            </Button>
          ) : (
            <>
              <Button variant="outline" className="gap-1.5 rounded-full" disabled={connectInsights.isPending} onClick={startInsights}>
                <RefreshCw className="h-4 w-4" /> Reconectar com métricas
              </Button>
              <Button variant="ghost" className="gap-1.5 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDisconnect(true)}>
                <Unplug className="h-4 w-4" /> Desconectar
              </Button>
            </>
          )}
        </div>
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar o Instagram?</AlertDialogTitle>
            <AlertDialogDescription>O cliente deixará de publicar automaticamente no Instagram até ser conectado de novo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate({ clientId })}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function ClienteConfiguracoes({ clientId }: { clientId: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PhotoCard clientId={clientId} />
      <SquadCard clientId={clientId} />
      <InstagramCard clientId={clientId} />
    </div>
  );
}
