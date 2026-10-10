import { Fragment, useMemo, useState } from "react";
import { normalizeAvatarUrl } from "@/lib/avatar-url";
import { ChevronDown, Layers, RefreshCw, Save, Search, Users } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PM_ACTIVE_STAGES } from "../pm-constants";
import { cn } from "@/lib/utils";
import { byName } from "@/lib/sort";
import { toast } from "sonner";
import { useCargos } from "@/hooks/use-cargos";
import { autoAssignStagesForClient, buildCandidatesForClient, sortForAssignment, stagesByRole } from "@/lib/role-stage-mapping";
import { useClientSquads, useSquadMembers, useSquads } from "@/features/projetos/hooks/use-squads";
import type { StageAssignees } from "./PmStageFlowConfig";
import { useStageFlows } from "./PmStageFlowConfig";
import { useStageRoles } from "../hooks/use-stage-roles";

const sb = supabase as any;

function initials(n: string) {
  return n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// Reviews and alterations are virtual stages, one per origin, each with its own cargo (see resolveAssigneeStageKey in PmStageFlowConfig.tsx).
const REVIEW_LABELS: Record<string, string> = {
  revisao_pauta: "Revisão do Planejamento",
  revisao_design: "Revisão do Design",
  revisao_video: "Revisão do Vídeo",
  alteracao_pauta: "Alteração do Planejamento",
  alteracao_design: "Alteração do Design",
  alteracao_video: "Alteração do Vídeo",
};
// The three kinds of alteration follow the person of their cargo; they only count on their own when someone set them apart
const ALTERATION_KEYS = new Set(["alteracao_pauta", "alteracao_design", "alteracao_video"]);
// Never assigned per client: the final stage, the generic review (only its three virtual versions are) and "alteracoes"
// (it goes back to whoever actually held the previous stage).
const NOT_ASSIGNED_PER_CLIENT = new Set(["entrega", "revisao", "alteracoes"]);

const stageLabelOf = (key: string) => REVIEW_LABELS[key] ?? PM_ACTIVE_STAGES.find((s) => s.key === key)?.label ?? key;

type Member = { user_id: string; display_name: string; avatar_url: string | null; role_titles: string[] };

const firstOf = (raw: unknown): string | null | undefined => (Array.isArray(raw) ? (raw[0] ?? null) : (raw as string | null | undefined));

/** Editable picker, used for the per-stage exceptions: the people who have the cargo come first. */
function PersonSelect({
  value, members, cargo, onChange,
}: {
  value: string | null | undefined;
  members: Member[];
  cargo?: string;
  onChange: (v: string | null | undefined) => void;
}) {
  const member = value ? members.find((m) => m.user_id === value) : null;
  const withCargo = cargo ? members.filter((m) => m.role_titles.includes(cargo)) : [];
  const others = members.filter((m) => !withCargo.includes(m));
  const item = (m: Member) => (
    <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
      <span className="flex items-center gap-2">
        <Avatar className="h-5 w-5"><AvatarImage src={m.avatar_url ?? undefined} /><AvatarFallback className="text-[7px]">{initials(m.display_name)}</AvatarFallback></Avatar>
        {m.display_name}
      </span>
    </SelectItem>
  );
  return (
    <Select
      value={value === undefined ? "__unset__" : (value ?? "__none__")}
      onValueChange={(v) => onChange(v === "__unset__" ? undefined : v === "__none__" ? null : v)}
    >
      <SelectTrigger className="h-8 w-auto max-w-[62%] justify-end gap-1.5 rounded-lg border-transparent bg-transparent px-2 text-sm shadow-none hover:bg-muted/60 data-[state=open]:bg-muted/60 [&>svg:last-child]:opacity-0 hover:[&>svg:last-child]:opacity-60 data-[state=open]:[&>svg:last-child]:opacity-60">
        <SelectValue>
          {value === undefined ? (
            <span className="text-muted-foreground/60">—</span>
          ) : value === null ? (
            <span className="text-muted-foreground">Sem pessoa fixa</span>
          ) : member ? (
            <span className="flex items-center gap-2">
              <Avatar className="h-5 w-5"><AvatarImage src={member.avatar_url ?? undefined} /><AvatarFallback className="text-[7px]">{initials(member.display_name)}</AvatarFallback></Avatar>
              <span className="truncate">{member.display_name.split(" ")[0]}</span>
            </span>
          ) : <span className="text-muted-foreground">—</span>}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__unset__" className="text-xs text-muted-foreground">Sem configuração</SelectItem>
        <SelectItem value="__none__" className="text-xs text-muted-foreground">Sem pessoa fixa</SelectItem>
        {withCargo.length > 0 && <SelectGroup><SelectLabel className="text-[10px] uppercase tracking-wider">{cargo}</SelectLabel>{withCargo.map(item)}</SelectGroup>}
        {others.length > 0 && <SelectGroup><SelectLabel className="text-[10px] uppercase tracking-wider">{withCargo.length > 0 ? "Outras pessoas" : "Equipe"}</SelectLabel>{others.map(item)}</SelectGroup>}
      </SelectContent>
    </Select>
  );
}

// What a table cell shows. "squad": the squad's choice is applied. "manual": someone set it apart from the squad.
// "set": the client has no squad, so there is nothing to compare with.
// "pending": the squad points to someone but it was never applied. "mixed": the stages of the cargo have different people.
type CellState = "squad" | "set" | "manual" | "pending" | "mixed" | "none" | "nobody";

function CargoCell({
  state, person, expected, candidates, members, cargo, onChange,
}: {
  state: CellState;
  person: Member | null;
  expected: Member | null;
  candidates: string[];
  members: Member[];
  cargo: string;
  onChange: (v: string | null | undefined) => void;
}) {
  const shown = state === "pending" ? expected : person;
  const title =
    state === "manual" ? (expected ? `Definido à mão. O squad indica ${expected.display_name}.` : "Definido à mão. O squad não tem ninguém com esse cargo.")
    : state === "pending" ? `O squad indica ${expected?.display_name}, mas ainda não foi aplicado. Use Sincronizar.`
    : state === "set" ? "Definido à mão (o cliente não tem squad)"
    : state === "squad" ? "Definido pelo squad"
    : undefined;
  const fromSquad = members.filter((m) => candidates.includes(m.user_id)).sort((a, b) => candidates.indexOf(a.user_id) - candidates.indexOf(b.user_id));
  const withCargo = members.filter((m) => m.role_titles.includes(cargo) && !candidates.includes(m.user_id));
  const others = members.filter((m) => !fromSquad.includes(m) && !withCargo.includes(m));
  const item = (m: Member) => (
    <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
      <span className="flex items-center gap-2">
        <Avatar className="h-6 w-6"><AvatarImage src={m.avatar_url ?? undefined} className="object-cover" /><AvatarFallback className="text-[8px]">{initials(m.display_name)}</AvatarFallback></Avatar>
        {m.display_name}
      </span>
    </SelectItem>
  );
  const value = state === "mixed" ? "__mixed__" : state === "nobody" ? "__none__" : state === "pending" || state === "none" ? "__unset__" : (person?.user_id ?? "__unset__");
  return (
    <Select value={value} onValueChange={(v) => onChange(v === "__unset__" ? undefined : v === "__none__" ? null : v)}>
      <SelectTrigger
        title={title}
        className="h-11 w-full justify-between gap-2 rounded-lg border-transparent bg-transparent px-2 text-sm shadow-none hover:bg-muted/60 data-[state=open]:bg-muted/60 [&>svg:last-child]:opacity-0 hover:[&>svg:last-child]:opacity-60 data-[state=open]:[&>svg:last-child]:opacity-60"
      >
        <SelectValue>
          {state === "mixed" ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><Layers className="h-4 w-4" /> Por etapa</span>
          ) : state === "nobody" ? (
            <span className="text-xs text-muted-foreground">Sem pessoa fixa</span>
          ) : !shown ? (
            <span className="text-muted-foreground/30">—</span>
          ) : (
            <span className={cn("flex min-w-0 items-center gap-2.5", state === "pending" && "opacity-60")}>
              <span className="relative shrink-0">
                <Avatar className="h-8 w-8"><AvatarImage src={shown.avatar_url ?? undefined} className="object-cover" /><AvatarFallback className="text-[10px]">{initials(shown.display_name)}</AvatarFallback></Avatar>
                {(state === "manual" || state === "pending") && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-card" />}
              </span>
              <span className={cn("truncate text-sm", state === "pending" && "italic")}>{shown.display_name}</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__unset__" className="text-xs text-muted-foreground">Sem configuração</SelectItem>
        <SelectItem value="__none__" className="text-xs text-muted-foreground">Sem pessoa fixa</SelectItem>
        {fromSquad.length > 0 && <SelectGroup><SelectLabel className="text-[10px] uppercase tracking-wider">Do squad</SelectLabel>{fromSquad.map(item)}</SelectGroup>}
        {withCargo.length > 0 && <SelectGroup><SelectLabel className="text-[10px] uppercase tracking-wider">{cargo}</SelectLabel>{withCargo.map(item)}</SelectGroup>}
        {others.length > 0 && <SelectGroup><SelectLabel className="text-[10px] uppercase tracking-wider">Outras pessoas</SelectLabel>{others.map(item)}</SelectGroup>}
      </SelectContent>
    </Select>
  );
}

export function PmAssigneeFlowConfig() {
  const qc = useQueryClient();
  const flowsQ = useStageFlows();
  const rolesQ = useStageRoles();
  const cargosQ = useCargos();
  const squadsQ = useSquads();
  const clientSquadsQ = useClientSquads();
  const squadMembersQ = useSquadMembers();
  const defaultFlow = useMemo(() => {
    const flows = flowsQ.data ?? [];
    return flows.find((f) => f.is_default) ?? flows[0];
  }, [flowsQ.data]);

  const [localAssignees, setLocalAssignees] = useState<StageAssignees | null>(null);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const assignees: StageAssignees = useMemo(() => {
    if (localAssignees) return localAssignees;
    return (defaultFlow?.stage_assignees ?? {}) as StageAssignees;
  }, [localAssignees, defaultFlow]);

  const clientsQ = useQuery({
    queryKey: ["pm_clients_active_team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, logo_url")
        .eq("is_active", true)
        .eq("is_freelancer_sentinel", false);
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; logo_url: string | null }[];
    },
  });

  const membersQ = useQuery({
    queryKey: ["team_members_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("user_id, display_name, avatar_url, role_titles").eq("is_active", true);
      if (error) throw error;
      return (data ?? []).map((tm: any) => ({ ...tm, role_titles: tm.role_titles ?? [], avatar_url: normalizeAvatarUrl(tm.avatar_url) ?? null })) as Member[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (stageAssignees: StageAssignees) => {
      if (!defaultFlow) throw new Error("Nenhum fluxo padrão encontrado");
      const { error } = await sb.from("pm_stage_flows").update({
        stage_assignees: stageAssignees,
        updated_at: new Date().toISOString(),
      }).eq("id", defaultFlow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pm_stage_flows"] });
      setDirty(false);
      toast.success("Equipes salvas!");
    },
    onError: () => toast.error("Erro ao salvar as equipes"),
  });

  // Which stages each cargo answers for, from the flow settings. Reviews and stages without a cargo are handled apart.
  const stageRoles = rolesQ.data ?? {};
  const { cargoBlocks, loose } = useMemo(() => {
    const known = new Set<string>([...PM_ACTIVE_STAGES.map((s) => s.key), ...Object.keys(REVIEW_LABELS)]);
    const assignable = [...known].filter((k) => !NOT_ASSIGNED_PER_CLIENT.has(k));
    const byRole = stagesByRole(Object.fromEntries(Object.entries(rolesQ.data ?? {}).filter(([k]) => assignable.includes(k))));
    const order = new Map((cargosQ.data ?? []).map((c, i) => [c.label, i]));
    const blocks = Object.entries(byRole)
      .map(([cargo, keys]) => ({ cargo, keys: keys.sort((a, b) => assignable.indexOf(a) - assignable.indexOf(b)) }))
      .sort((a, b) => (order.get(a.cargo) ?? 99) - (order.get(b.cargo) ?? 99));
    const withCargo = new Set(blocks.flatMap((b) => b.keys));
    return { cargoBlocks: blocks, loose: assignable.filter((k) => !withCargo.has(k)) };
  }, [rolesQ.data, cargosQ.data]);

  const setStages = (keys: string[], clientId: string, userId: string | null | undefined) => {
    setLocalAssignees((prev) => {
      const copy: StageAssignees = { ...(prev ?? assignees) };
      for (const sk of keys) {
        const stageMap: Record<string, any> = { ...(copy[sk] ?? {}) };
        if (userId === undefined) {
          delete stageMap[clientId];
        } else {
          const current = stageMap[clientId];
          // keep the watchers when the stage had a list [assignee, ...watchers]
          stageMap[clientId] = Array.isArray(current) && userId !== null ? [userId, ...current.slice(1)] : userId;
        }
        if (Object.keys(stageMap).length === 0) delete copy[sk];
        else copy[sk] = stageMap;
      }
      return copy;
    });
    setDirty(true);
  };

  const handleSave = () => {
    if (localAssignees) saveMutation.mutate(localAssignees);
  };

  const members = useMemo(() => [...(membersQ.data ?? [])].sort(byName((m) => m.display_name)), [membersQ.data]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.user_id, m])), [members]);

  // The squads of each client, and who each squad would put on every stage (the same rule used when a client is saved)
  const squadById = useMemo(() => new Map((squadsQ.data ?? []).map((s: any) => [s.id, s as { id: string; name: string; color: string }])), [squadsQ.data]);
  const squadIdsByClient = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const cs of clientSquadsQ.data ?? []) map.set(cs.client_id, [...(map.get(cs.client_id) ?? []), cs.squad_id]);
    return map;
  }, [clientSquadsQ.data]);
  const roleToStages = useMemo(() => stagesByRole(stageRoles), [stageRoles]);
  // Everyone the squads put on each stage of each client, in the order the real assignment uses (first to join the squad first)
  const candidatesByClient = useMemo(() => {
    const out = new Map<string, Record<string, string[]>>();
    for (const [clientId, squadIds] of squadIdsByClient) {
      const joinedAt = new Map<string, string>();
      for (const sm of (squadMembersQ.data ?? []) as any[]) {
        if (!squadIds.includes(sm.squad_id)) continue;
        const prev = joinedAt.get(sm.user_id);
        if (!prev || sm.created_at < prev) joinedAt.set(sm.user_id, sm.created_at);
      }
      const people = sortForAssignment(
        members.filter((m) => joinedAt.has(m.user_id)).map((m) => ({ user_id: m.user_id, display_name: m.display_name, role_titles: m.role_titles, joined_at: joinedAt.get(m.user_id) })),
      );
      out.set(clientId, buildCandidatesForClient(people, roleToStages));
    }
    return out;
  }, [squadIdsByClient, squadMembersQ.data, members, roleToStages]);

  const clients = useMemo(
    () => [...(clientsQ.data ?? [])].filter((c) => !search.trim() || c.name.toLowerCase().includes(search.trim().toLowerCase())).sort(byName((c) => c.name)),
    [clientsQ.data, search],
  );

  // The person of a cargo in a client's team and where it comes from
  const cellOf = (keys: string[], clientId: string): { state: CellState; person: Member | null; expected: Member | null; candidates: string[] } => {
    const considered = keys.filter((k) => !ALTERATION_KEYS.has(k) || assignees[k]?.[clientId] !== undefined);
    const values = (considered.length ? considered : keys).map((k) => firstOf(assignees[k]?.[clientId]));
    const same = values.every((v) => v === values[0]);
    const candidates = candidatesByClient.get(clientId)?.[keys[0]] ?? [];
    const expected = candidates[0] ? memberById.get(candidates[0]) ?? null : null;
    if (!same) return { state: "mixed", person: null, expected, candidates };
    const v = values[0];
    if (v === undefined) return { state: expected ? "pending" : "none", person: null, expected, candidates };
    if (v === null) return { state: "nobody", person: null, expected, candidates };
    const person = memberById.get(v) ?? null;
    if ((squadIdsByClient.get(clientId)?.length ?? 0) === 0) return { state: "set", person, expected, candidates };
    // with two people of the same cargo in the squad, either one is "the squad's"
    return { state: candidates.includes(v) ? "squad" : "manual", person, expected, candidates };
  };

  const differsFromSquad = (clientId: string) =>
    (squadIdsByClient.get(clientId)?.length ?? 0) > 0 &&
    cargoBlocks.some((b) => {
      const { state, expected } = cellOf(b.keys, clientId);
      // only where the squad has someone for the cargo: a person set where the squad has nobody is not something to "fix"
      return !!expected && state !== "squad";
    });

  const syncClients = async (clientIds: string[]) => {
    if (dirty) { toast.error("Salve ou descarte as alterações antes de sincronizar com os squads."); return; }
    setSyncing(clientIds.length === 1 ? clientIds[0] : "__all__");
    try {
      for (const id of clientIds) await autoAssignStagesForClient(sb, id, squadIdsByClient.get(id) ?? []);
      await qc.invalidateQueries({ queryKey: ["pm_stage_flows"] });
      setLocalAssignees(null);
      toast.success(clientIds.length === 1 ? "Equipe sincronizada com o squad" : `${clientIds.length} clientes sincronizados com seus squads`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível sincronizar");
    } finally {
      setSyncing(null);
    }
  };

  if (!defaultFlow) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        Crie um fluxo de etapas padrão primeiro para configurar os responsáveis.
      </div>
    );
  }

  const outOfSync = clients.filter((c) => differsFromSquad(c.id));
  const allStageKeys = [...cargoBlocks.flatMap((b) => b.keys), ...loose];
  const colCount = cargoBlocks.length + loose.length + 4;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          Responsáveis por Cliente
        </h3>
        <div className="flex items-center gap-2">
          {outOfSync.length > 0 && (
            <Button size="sm" variant="outline" className="gap-1.5 rounded-full" disabled={!!syncing} onClick={() => setConfirmAll(true)}>
              <RefreshCw className={cn("h-3.5 w-3.5", syncing === "__all__" && "animate-spin")} /> Sincronizar com os squads
              <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">{outOfSync.length}</span>
            </Button>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente" className="h-9 w-48 rounded-full pl-9 text-sm" />
          </div>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending} className="gap-1.5 rounded-full">
              <Save className="h-4 w-4" /> Salvar
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/30 bg-card/30">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[220px] border-b border-border/30 bg-card px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                <th className="min-w-[130px] border-b border-border/30 bg-card/60 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Squad</th>
                {cargoBlocks.map((b) => (
                  <th key={b.cargo} title={b.keys.map(stageLabelOf).join(" · ")} className="min-w-[170px] border-b border-border/30 bg-card/60 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {b.cargo}
                  </th>
                ))}
                {loose.map((k) => (
                  <th key={k} className="min-w-[170px] border-b border-border/30 bg-card/60 px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stageLabelOf(k)}</th>
                ))}
                <th className="w-20 border-b border-border/30 bg-card/60" />
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const expanded = !!open[client.id];
                const squadIds = squadIdsByClient.get(client.id) ?? [];
                const diverges = differsFromSquad(client.id);
                return (
                  <Fragment key={client.id}>
                    <tr className="group transition-colors hover:bg-accent/20">
                      <td className="sticky left-0 z-10 border-b border-border/20 bg-card px-4 py-1.5 group-hover:bg-accent/20">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground ring-1 ring-border/60">
                            {client.logo_url ? <img src={client.logo_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : client.name.trim().charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 truncate text-sm font-medium">{client.name}</span>
                        </div>
                      </td>
                      <td className="border-b border-border/20 px-3 py-1">
                        {squadIds.length === 0 ? (
                          <span className="text-xs text-muted-foreground/50" title="Escolha o squad em Clientes → (cliente) → Configurações">Sem squad</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {squadIds.map((id) => {
                              const sq = squadById.get(id);
                              return sq ? (
                                <span key={id} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: sq.color }} />
                                  {sq.name}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </td>
                      {cargoBlocks.map((b) => {
                        const { state, person, expected, candidates } = cellOf(b.keys, client.id);
                        return (
                          <td key={b.cargo} className="border-b border-border/20 px-1.5 py-1">
                            <CargoCell state={state} person={person} expected={expected} candidates={candidates} members={members} cargo={b.cargo} onChange={(v) => setStages(b.keys, client.id, v)} />
                          </td>
                        );
                      })}
                      {loose.map((k) => (
                        <td key={k} className="border-b border-border/20 px-1.5 py-1">
                          <PersonSelect value={firstOf(assignees[k]?.[client.id])} members={members} onChange={(v) => setStages([k], client.id, v)} />
                        </td>
                      ))}
                      <td className="border-b border-border/20 px-1 text-right">
                        <span className="inline-flex items-center">
                          {diverges && (
                            <button type="button" aria-label="Sincronizar com o squad" title="Sincronizar com o squad" disabled={!!syncing} onClick={() => syncClients([client.id])} className="rounded-full p-1.5 text-amber-500 transition hover:bg-amber-500/10">
                              <RefreshCw className={cn("h-4 w-4", syncing === client.id && "animate-spin")} />
                            </button>
                          )}
                          <button type="button" aria-label="Ajustar por etapa" title="Ajustar por etapa" onClick={() => setOpen((o) => ({ ...o, [client.id]: !o[client.id] }))} className="rounded-full p-1.5 text-muted-foreground/50 transition hover:bg-muted hover:text-foreground">
                            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                          </button>
                        </span>
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={colCount} className="border-b border-border/20 bg-muted/20 px-4 py-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Exceções por etapa · {client.name}</p>
                          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                            {allStageKeys.map((k) => (
                              <div key={k} className="flex items-center justify-between gap-3">
                                <span className="truncate text-xs text-muted-foreground">{stageLabelOf(k)}</span>
                                <PersonSelect value={firstOf(assignees[k]?.[client.id])} members={members} cargo={stageRoles[k] ?? undefined} onChange={(v) => setStages([k], client.id, v)} />
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        O squad de cada cliente se escolhe em Clientes → (cliente) → Configurações e define a equipe; clique numa pessoa para trocar. Um ponto laranja marca quem foi definido à mão ou ainda não foi aplicado.
      </p>

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sincronizar {outOfSync.length} {outOfSync.length === 1 ? "cliente" : "clientes"} com os squads?</AlertDialogTitle>
            <AlertDialogDescription>
              A equipe de cada um volta a ser a que o squad indica, e o que foi definido à mão nas etapas dos cargos do squad é substituído. As tarefas que já estão com alguém não mudam; vale para as próximas etapas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => syncClients(outOfSync.map((c) => c.id))}>Sincronizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
