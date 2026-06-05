import { useMemo, useState } from "react";
import { z } from "zod";
import { buildAssigneesForClient, mergeClientAssignees } from "@/lib/role-stage-mapping";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, isValid } from "date-fns";
import { Plus, Pencil, Trash2, Users, Filter, DollarSign, XCircle } from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAllClients, useCreateClient, useDeleteClient, useTeamMembers, type ClientRow } from "@/features/data/queries";
import { useSquads } from "@/features/projetos/hooks/use-squads";
import { ContractMonthsSelector } from "@/features/admin/components/ContractMonthsSelector";

const SERVICE_OPTIONS = [
  "Social Media",
  "Design",
  "Vídeo",
  "Tráfego Pago",
  "Fotografia",
  "Copywriting",
  "Site / Landing Page",
  "Consultoria",
];

const clientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  notes: z.string().max(500).optional().or(z.literal("")),
  monthly_value: z.coerce.number().min(0).default(0),
  contract_start: z.string().optional().or(z.literal("")),
  contract_months: z.coerce.number().int().min(0).max(240).default(12),
  due_day: z.coerce.number().int().min(1).max(31).default(10),
  services: z.array(z.string()).default([]),
  participates_magic: z.boolean().default(true),
  participates_ranking: z.boolean().default(true),
  has_goals: z.boolean().default(false),
  paused_from: z.string().optional().or(z.literal("")),
  resumed_from: z.string().optional().or(z.literal("")),
  ended_at: z.string().optional().or(z.literal("")),
});

type ClientFormValues = z.infer<typeof clientSchema>;

const emptyDefaults: ClientFormValues = {
  name: "",
  notes: "",
  monthly_value: 0,
  contract_start: new Date().toISOString().slice(0, 10),
  contract_months: 12,
  due_day: 10,
  services: [],
  participates_magic: true,
  participates_ranking: true,
  has_goals: false,
  paused_from: "",
  resumed_from: "",
  ended_at: "",
};

function useClientSquads() {
  return useQuery({
    queryKey: ["client_squads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_squads" as any)
        .select("*");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; client_id: string; squad_id: string }[];
    },
  });
}

function useFinancialClientValues() {
  return useQuery({
    queryKey: ["financial_clients", "values"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_clients")
        .select("id, name, monthly_value, contract_start, contract_months, due_day");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; monthly_value: number; contract_start: string; contract_months: number; due_day: number | null }[];
    },
  });
}

function useAllActiveContractMonths() {
  return useQuery({
    queryKey: ["client_contract_months", "all"],
    queryFn: async () => {
      const { data: links, error: linkErr } = await supabase
        .from("magic2_client_links")
        .select("agenda_client_id, magic2_client_id");
      if (linkErr) throw linkErr;
      const ids = (links ?? []).map((l: any) => l.magic2_client_id);
      const result = new Map<string, Array<{ year: number; month: number }>>();
      if (ids.length === 0) return result;
      const { data: cycles, error: cyclesErr } = await supabase
        .from("magic2_cycles")
        .select("client_id, year, month, is_active")
        .in("client_id", ids)
        .eq("is_active", true);
      if (cyclesErr) throw cyclesErr;
      const m2agenda = new Map<string, string>(
        (links ?? []).map((l: any) => [l.magic2_client_id, l.agenda_client_id])
      );
      for (const c of (cycles ?? []) as any[]) {
        const aid = m2agenda.get(c.client_id);
        if (!aid) continue;
        const arr = result.get(aid) ?? [];
        arr.push({ year: c.year, month: c.month });
        result.set(aid, arr);
      }
      return result;
    },
  });
}

async function syncContractMonths(agendaClientId: string, startISO: string | null | undefined, months: number) {
  if (!agendaClientId || !startISO || !months || months <= 0) return;
  const { data: magic2ClientId, error: linkErr } = await supabase
    .rpc("magic2_ensure_client_link", { _agenda_client_id: agendaClientId });
  if (linkErr) throw linkErr;
  if (!magic2ClientId) return;
  const [y, m] = startISO.split("-").map(Number);
  const rows: any[] = [];
  for (let i = 0; i < months; i++) {
    const date = new Date(y, (m - 1) + i, 1);
    const yy = date.getFullYear();
    const mm = date.getMonth() + 1;
    rows.push({
      client_id: magic2ClientId,
      year: yy,
      month: mm,
      due_date: `${yy}-${String(mm).padStart(2, "0")}-27`,
      is_active: true,
    });
  }
  const { error: upErr } = await supabase
    .from("magic2_cycles")
    .upsert(rows, { onConflict: "client_id,year,month" });
  if (upErr) throw upErr;
}


function normalizeClientName(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/^(dra?\.?|sr\.?|sra\.?)\s+/i, "")
    .replace(/\s+/g, " ");
}

export function AdminClientesPanel() {
  const clientsQ = useAllClients();
  const createClient = useCreateClient();
  
  const deleteClient = useDeleteClient();
  const squadsQ = useSquads();
  const clientSquadsQ = useClientSquads();
  const teamMembersQ = useTeamMembers();
  const finValuesQ = useFinancialClientValues();
  const activeMonthsQ = useAllActiveContractMonths();
  const qc = useQueryClient();


  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ClientRow | null>(null);
  const [endContract, setEndContract] = useState<ClientRow | null>(null);
  const [endDate, setEndDate] = useState<string>("");
  const [endReason, setEndReason] = useState<string>("");
  const [endSubmitting, setEndSubmitting] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editSquadIds, setEditSquadIds] = useState<string[]>([]);


  const squads = squadsQ.data ?? [];
  const teamMembers = teamMembersQ.data ?? [];
  const clientSquads = clientSquadsQ.data ?? [];

  const finValueMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of finValuesQ.data ?? []) {
      m.set(f.id, Number(f.monthly_value ?? 0));
      m.set("name:" + normalizeClientName(f.name), Number(f.monthly_value ?? 0));
    }
    return m;
  }, [finValuesQ.data]);

  const finContractMap = useMemo(() => {
    const m = new Map<string, { start: string; months: number; due_day: number | null }>();
    for (const f of finValuesQ.data ?? []) {
      const entry = { start: f.contract_start, months: Number(f.contract_months ?? 0), due_day: f.due_day ?? null };
      m.set(f.id, entry);
      m.set("name:" + normalizeClientName(f.name), entry);
    }
    return m;
  }, [finValuesQ.data]);

  const getFinValue = (client: { id: string; name: string }): number =>
    finValueMap.get(client.id) ?? finValueMap.get("name:" + normalizeClientName(client.name)) ?? 0;

  const getFinContract = (client: { id: string; name: string }) =>
    finContractMap.get(client.id) ?? finContractMap.get("name:" + normalizeClientName(client.name));

  const monthsRemaining = (client: { id: string }): number | null => {
    const list = activeMonthsQ.data?.get(client.id);
    if (!list || list.length === 0) return null;
    const now = new Date();
    const cur = now.getFullYear() * 12 + now.getMonth();
    let count = 0;
    for (const c of list) {
      const idx = c.year * 12 + (c.month - 1);
      if (idx >= cur) count++;
    }
    return count;
  };


  const clientSquadMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const cs of clientSquads) {
      const arr = map.get(cs.client_id) ?? [];
      arr.push(cs.squad_id);
      map.set(cs.client_id, arr);
    }
    return map;
  }, [clientSquads]);

  const squadMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of squads) map.set(s.id, s);
    return map;
  }, [squads]);

  const memberMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of teamMembers) map.set(m.user_id, m);
    return map;
  }, [teamMembers]);

  const clients = useMemo(() => {
    const all = clientsQ.data ?? [];
    if (showInactive) return all;
    return all.filter((c) => c.is_active);
  }, [clientsQ.data, showInactive]);

  const activeCount = useMemo(() => (clientsQ.data ?? []).filter((c) => c.is_active).length, [clientsQ.data]);
  const inactiveCount = useMemo(() => (clientsQ.data ?? []).filter((c) => !c.is_active).length, [clientsQ.data]);

  const createForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: emptyDefaults,
  });

  const editForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: emptyDefaults,
  });

  // Converte 'YYYY-MM' (input type=month) ou 'YYYY-MM-DD' para 'YYYY-MM-01' (date column).
  const monthInputToDate = (s?: string | null): string | null => {
    if (!s) return null;
    if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 7) + "-01";
    return null;
  };

  const handleCreate = async (values: ClientFormValues) => {
    try {
      const now = new Date();
      const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-27`;
      const created: any = await createClient.mutateAsync({
        name: values.name,
        magic_due_date: dueDate,
        notes: values.notes || undefined,
        monthly_value: values.monthly_value || 0,
        contract_start: values.contract_start || new Date().toISOString().slice(0, 10),
        services: values.services ?? [],
        participates_magic: values.participates_magic,
        participates_ranking: values.participates_ranking,
        has_goals: values.has_goals,
      });
      const newId = created?.id ?? created;
      if (newId) {
        await supabase
          .from("clients")
          .update({
            paused_from: monthInputToDate(values.paused_from),
            resumed_from: monthInputToDate(values.resumed_from),
            ended_at: monthInputToDate(values.ended_at),
          } as any)
          .eq("id", newId);
        if (values.contract_months != null) {
          await supabase
            .from("financial_clients")
            .update({ contract_months: values.contract_months } as any)
            .eq("id", newId);
        }
        // Auto-marca os N meses contratados em magic2_cycles
        try {
          await syncContractMonths(
            newId,
            values.contract_start || new Date().toISOString().slice(0, 10),
            values.contract_months ?? 0,
          );
        } catch (syncErr) {
          console.warn("syncContractMonths (create) failed:", syncErr);
        }
      }
      qc.invalidateQueries({ queryKey: ["financial_clients"] });
      qc.invalidateQueries({ queryKey: ["fin-clients"] });
      qc.invalidateQueries({ queryKey: ["client_contract_months"] });
      qc.invalidateQueries({ queryKey: ["magic2"] });
      toast.success("Cliente criado e sincronizado com o Financeiro!");
      setCreateOpen(false);
      createForm.reset(emptyDefaults);

    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar cliente");
    }
  };

  const handleEdit = async (values: ClientFormValues) => {
    if (!editClient) return;
    try {
      const pausedDate = monthInputToDate(values.paused_from);
      const resumedDate = monthInputToDate(values.resumed_from);
      const endedDate = monthInputToDate(values.ended_at);

      // is_active derivado da timeline (status no mês atual).
      const today = new Date();
      const todayY = today.getFullYear();
      const todayM = today.getMonth() + 1;
      const todayTarget = todayY * 12 + (todayM - 1);
      const isPausedNow = (() => {
        if (!pausedDate) return false;
        const [py, pm] = pausedDate.split("-").map(Number);
        if (py * 12 + (pm - 1) > todayTarget) return false;
        if (!resumedDate) return true;
        const [ry, rm] = resumedDate.split("-").map(Number);
        return ry * 12 + (rm - 1) > todayTarget;
      })();
      const isEndedNow = (() => {
        if (!endedDate) return false;
        const [ey, em] = endedDate.split("-").map(Number);
        return ey * 12 + (em - 1) <= todayTarget;
      })();
      const computedActive = !isPausedNow && !isEndedNow;

      const { error } = await supabase
        .from("clients")
        .update({
          name: values.name,
          notes: values.notes || null,
          monthly_value: values.monthly_value || 0,
          contract_start: values.contract_start || null,
          services: values.services ?? [],
          participates_magic: values.participates_magic,
          participates_ranking: values.participates_ranking,
          has_goals: values.has_goals,
          paused_from: pausedDate,
          resumed_from: resumedDate,
          ended_at: endedDate,
          is_active: computedActive,
        } as any)
        .eq("id", editClient.id);
      if (error) throw error;

      // contract_months vive em financial_clients (trigger não espelha esse campo)
      await supabase
        .from("financial_clients")
        .update({ contract_months: values.contract_months ?? 12 } as any)
        .eq("id", editClient.id);

      // Auto-marca os N meses contratados em magic2_cycles a partir de contract_start
      try {
        await syncContractMonths(
          editClient.id,
          values.contract_start || editClient.contract_start || new Date().toISOString().slice(0, 10),
          values.contract_months ?? 0,
        );
      } catch (syncErr) {
        console.warn("syncContractMonths (edit) failed:", syncErr);
      }





      // Sync squads
      const currentSquadIds = clientSquadMap.get(editClient.id) ?? [];
      const toRemove = currentSquadIds.filter((id) => !editSquadIds.includes(id));
      const toAdd = editSquadIds.filter((id) => !currentSquadIds.includes(id));

      for (const squadId of toRemove) {
        await supabase
          .from("client_squads" as any)
          .delete()
          .eq("client_id", editClient.id)
          .eq("squad_id", squadId);
      }
      if (toAdd.length > 0) {
        const rows = toAdd.map((squadId) => ({ client_id: editClient.id, squad_id: squadId }));
        await supabase.from("client_squads" as any).insert(rows as any);
      }

      // Auto-generate stage assignees from squad members
      if (editSquadIds.length > 0) {
        try {
          const { data: squadMembers } = await supabase
            .from("squad_members")
            .select("user_id")
            .in("squad_id", editSquadIds);

          if (squadMembers && squadMembers.length > 0) {
            const memberUserIds = squadMembers.map((sm: any) => sm.user_id);
            const { data: tms } = await supabase
              .from("team_members")
              .select("user_id, role_title")
              .in("user_id", memberUserIds)
              .eq("is_active", true);

            if (tms && tms.length > 0) {
              const perStage = buildAssigneesForClient(
                tms.map((tm: any) => ({ user_id: tm.user_id, role_title: tm.role_title }))
              );
              if (Object.keys(perStage).length > 0) {
                const { data: flows } = await (supabase as any)
                  .from("pm_stage_flows")
                  .select("id, stage_assignees, is_default")
                  .order("is_default", { ascending: false })
                  .limit(1);
                const defaultFlow = flows?.[0];
                if (defaultFlow) {
                  const existing = (defaultFlow.stage_assignees ?? {}) as Record<string, Record<string, any>>;
                  const merged = mergeClientAssignees(existing, editClient.id, perStage);
                  await (supabase as any)
                    .from("pm_stage_flows")
                    .update({ stage_assignees: merged, updated_at: new Date().toISOString() })
                    .eq("id", defaultFlow.id);
                }
              }
            }
          }
        } catch (assigneeErr) {
          console.warn("Auto-assign failed (non-blocking):", assigneeErr);
        }
      }

      clientsQ.refetch();
      qc.invalidateQueries({ queryKey: ["client_squads"] });
      qc.invalidateQueries({ queryKey: ["pm_stage_flows"] });
      qc.invalidateQueries({ queryKey: ["financial_clients"] });
      qc.invalidateQueries({ queryKey: ["client_contract_months"] });
      qc.invalidateQueries({ queryKey: ["magic2"] });
      toast.success("Cliente atualizado e sincronizado!");

      setEditClient(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar cliente");
    }
  };




  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteClient.mutateAsync({ clientId: deleteConfirm.id });
      toast.success("Cliente removido permanentemente");
      setDeleteConfirm(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover cliente");
    }
  };

  const openCreate = () => {
    createForm.reset(emptyDefaults);
    setCreateOpen(true);
  };

  const openEdit = (client: ClientRow) => {
    const fc = getFinContract(client);
    setEditClient(client);
    editForm.reset({
      name: client.name,
      notes: client.notes ?? "",
      monthly_value: getFinValue(client) || Number(client.monthly_value ?? 0),
      contract_start: fc?.start ?? client.contract_start ?? new Date().toISOString().slice(0, 10),
      contract_months: fc?.months ?? 12,
      services: client.services ?? [],
      participates_magic: client.participates_magic ?? true,
      participates_ranking: client.participates_ranking ?? true,
      has_goals: client.has_goals ?? false,
      paused_from: client.paused_from ? client.paused_from.slice(0, 7) : "",
      resumed_from: client.resumed_from ? client.resumed_from.slice(0, 7) : "",
      ended_at: client.ended_at ? client.ended_at.slice(0, 7) : "",
    });
    setEditSquadIds(clientSquadMap.get(client.id) ?? []);
  };

  return (
    <div className="space-y-6">
      <div
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between opacity-0"
        style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0s" }}
      >
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Configurações do Cliente</h2>
          <p className="text-sm text-muted-foreground">
            Cadastro único — sincroniza automaticamente com Financeiro e Magic Number. {activeCount} ativo(s) • {inactiveCount} pausado(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">
              <Filter className="inline h-3 w-3 mr-1" />
              Mostrar pausados
            </Label>
          </div>
          <Button variant="brand" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <Card
        className="opacity-0"
        style={{ animation: "fadeUp 0.6s ease-out forwards", animationDelay: "0.15s" }}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes Cadastrados
          </CardTitle>
          <CardDescription>{clients.length} cliente(s) exibido(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {clientsQ.isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">Carregando clientes...</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                {showInactive ? "Nenhum cliente cadastrado." : "Nenhum cliente ativo."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Mensal</TableHead>
                    <TableHead>Squads</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const squadIds = clientSquadMap.get(client.id) ?? [];
                    const finValue = getFinValue(client);
                    const remaining = monthsRemaining(client);
                    return (
                      <TableRow key={client.id} className={!client.is_active ? "opacity-60" : ""}>
                        <TableCell>
                          {client.ended_at ? (
                            <Badge variant="destructive" className="text-[10px]">
                              Encerrado {new Date(client.ended_at + "T00:00:00").toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" })}
                            </Badge>
                          ) : (
                            <Badge variant="success">Ativo</Badge>
                          )}
                        </TableCell>


                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell className="text-sm tabular-nums">
                          {finValue.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {squadIds.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              squadIds.map((sid) => {
                                const squad = squadMap.get(sid);
                                if (!squad) return null;
                                return (
                                  <Badge key={sid} variant="outline" className="text-xs">
                                    {squad.name}
                                  </Badge>
                                );
                              })
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {remaining === null ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : remaining === 0 ? (
                            <Badge variant="destructive" className="text-xs">Sem meses ativos</Badge>
                          ) : remaining <= 3 ? (
                            <Badge variant="warning" className="text-xs">
                              {remaining} {remaining === 1 ? "mês" : "meses"} restantes
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-xs">
                              {remaining} meses restantes
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(client)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>


                            {!client.ended_at && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEndContract(client);
                                  const now = new Date();
                                  setEndDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
                                  setEndReason("");
                                }}
                                title="Encerrar contrato"
                              >
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(client)}
                              title="Excluir permanentemente"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>

                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog criar/editar — compartilha mesma estrutura */}
      <ClientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Novo Cliente"
        form={createForm}
        onSubmit={handleCreate}
        squads={squads}
        teamMembers={teamMembers}
        submitting={createClient.isPending}
        submitLabel="Criar e sincronizar"
      />

      <ClientFormDialog
        open={!!editClient}
        onOpenChange={(open) => !open && setEditClient(null)}
        title="Editar Cliente"
        form={editForm}
        onSubmit={handleEdit}
        squads={squads}
        teamMembers={teamMembers}
        squadIds={editSquadIds}
        setSquadIds={setEditSquadIds}
        contractMonthsFor={editClient}
        submitLabel="Salvar"
      />

      <Dialog open={!!endContract} onOpenChange={(open) => { if (!open) { setEndContract(null); setEndReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Encerrar contrato</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Encerrar o contrato de <strong>{endContract?.name}</strong>. Meses anteriores ao encerramento permanecem intactos no Financeiro, Metas e Magic Number.
            </p>
            <div className="space-y-1.5">
              <Label>Data de encerramento</Label>
              <Input type="month" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo do encerramento</Label>
              <Textarea
                rows={4}
                placeholder="Descreva o motivo do encerramento do contrato..."
                value={endReason}
                onChange={(e) => setEndReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setEndContract(null); setEndReason(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={endSubmitting || !endDate || !endReason.trim()}
              onClick={async () => {
                if (!endContract) return;
                setEndSubmitting(true);
                try {
                  const endedDate = /^\d{4}-\d{2}$/.test(endDate) ? `${endDate}-01` : endDate;
                  const { error } = await supabase
                    .from("clients")
                    .update({
                      ended_at: endedDate,
                      end_reason: endReason.trim(),
                      is_active: false,
                    } as any)
                    .eq("id", endContract.id);
                  if (error) throw error;
                  await supabase
                    .from("financial_clients")
                    .update({ ended_at: endedDate, end_reason: endReason.trim(), is_active: false } as any)
                    .eq("id", endContract.id);
                  qc.invalidateQueries({ queryKey: ["clients_admin_all"] });
                  qc.invalidateQueries({ queryKey: ["financial_clients"] });
                  qc.invalidateQueries({ queryKey: ["fin-clients"] });
                  toast.success(`Contrato encerrado em ${new Date(endedDate + "T00:00:00").toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}`);
                  setEndContract(null);
                  setEndReason("");
                } catch (e: any) {
                  toast.error(e?.message ?? "Erro ao encerrar contrato");
                } finally {
                  setEndSubmitting(false);
                }
              }}
            >
              {endSubmitting ? "Encerrando..." : "Encerrar contrato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Excluir permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja <strong>excluir permanentemente</strong> o cliente "{deleteConfirm?.name}"?
              <br /><br />
              <strong>Isso removerá todas as tarefas, ciclos e histórico associados.</strong>
              <br /><br />
              💡 Se o cliente apenas encerrou o contrato, prefira <strong>pausar</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteClient.isPending ? "Removendo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Dialog reutilizável (criar e editar)
// ─────────────────────────────────────────────────────────────────

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  form: ReturnType<typeof useForm<ClientFormValues>>;
  onSubmit: (values: ClientFormValues) => void | Promise<void>;
  squads: any[];
  teamMembers: any[];
  squadIds?: string[];
  setSquadIds?: (ids: string[]) => void;
  contractMonthsFor?: ClientRow | null;
  submitting?: boolean;
  submitLabel: string;
};

function ClientFormDialog({
  open,
  onOpenChange,
  title,
  form,
  onSubmit,
  squads,
  teamMembers,
  squadIds,
  setSquadIds,
  contractMonthsFor,
  submitting,
  submitLabel,
}: DialogProps) {
  const services = form.watch("services") ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
          {/* Identificação */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</h3>
            <div className="space-y-1.5">
              <Label>Nome do Cliente *</Label>
              <Input placeholder="Ex.: Empresa XYZ" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
          </section>

          <Separator />

          {/* Contrato */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Contrato
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Valor mensal (R$)</Label>
                <Input type="number" step="0.01" min="0" {...form.register("monthly_value")} />
              </div>
              <div className="space-y-1.5">
                <Label>Início do contrato</Label>
                <Input type="date" {...form.register("contract_start")} />
              </div>
              <div className="space-y-1.5">
                <Label>Duração (meses)</Label>
                <Input type="number" step="1" min="0" max="240" {...form.register("contract_months")} />
              </div>
            </div>
          </section>

          <Separator />



          {/* Operação */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operação</h3>

            {squads.length > 0 && setSquadIds && squadIds !== undefined && (
              <div className="space-y-2">
                <Label>Squads Responsáveis</Label>
                <div className="grid grid-cols-2 gap-2">
                  {squads.map((squad: any) => (
                    <label
                      key={squad.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={squadIds.includes(squad.id)}
                        onCheckedChange={(checked) => {
                          setSquadIds(
                            checked ? [...squadIds, squad.id] : squadIds.filter((id) => id !== squad.id)
                          );
                        }}
                      />
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: squad.color || "hsl(var(--sidebar))" }}
                      />
                      <span className="text-sm">{squad.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Serviços Contratados</Label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_OPTIONS.map((svc) => {
                  const active = services.includes(svc);
                  return (
                    <button
                      key={svc}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? services.filter((s: string) => s !== svc)
                          : [...services, svc];
                        form.setValue("services", next, { shouldDirty: true });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-transparent border-border hover:bg-accent"
                      }`}
                    >
                      {svc}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <Separator />


          {/* Observações */}
          <section className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Informações adicionais sobre o cliente..."
              {...form.register("notes")}
              rows={2}
            />
          </section>

          {/* Meses de contrato (apenas no editar) */}
          {contractMonthsFor && (
            <>
              <Separator />
              <ContractMonthsSelector
                clientId={contractMonthsFor.id}
                clientName={contractMonthsFor.name}
              />
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="brand" disabled={submitting}>
              {submitting ? "Salvando..." : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
