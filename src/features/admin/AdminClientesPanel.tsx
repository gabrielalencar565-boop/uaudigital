import { useMemo, useState } from "react";
import { z } from "zod";
import { buildAssigneesForClient, mergeClientAssignees } from "@/lib/role-stage-mapping";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { format, isValid } from "date-fns";
import { Plus, Pencil, Trash2, Users, Pause, Play, Filter, DollarSign, Sparkles, Trophy, Target } from "lucide-react";
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
import { useAllClients, useCreateClient, useDeleteClient, useToggleClientActive, useTeamMembers, type ClientRow } from "@/features/data/queries";
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
  services: z.array(z.string()).default([]),
  participates_magic: z.boolean().default(true),
  participates_ranking: z.boolean().default(true),
  has_goals: z.boolean().default(false),
});

type ClientFormValues = z.infer<typeof clientSchema>;

const emptyDefaults: ClientFormValues = {
  name: "",
  notes: "",
  monthly_value: 0,
  contract_start: new Date().toISOString().slice(0, 10),
  services: [],
  participates_magic: true,
  participates_ranking: true,
  has_goals: false,
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
        .select("id, monthly_value");
      if (error) throw error;
      return (data ?? []) as { id: string; monthly_value: number }[];
    },
  });
}

export function AdminClientesPanel() {
  const clientsQ = useAllClients();
  const createClient = useCreateClient();
  const toggleActive = useToggleClientActive();
  const deleteClient = useDeleteClient();
  const squadsQ = useSquads();
  const clientSquadsQ = useClientSquads();
  const teamMembersQ = useTeamMembers();
  const finValuesQ = useFinancialClientValues();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ClientRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editSquadIds, setEditSquadIds] = useState<string[]>([]);

  const squads = squadsQ.data ?? [];
  const teamMembers = teamMembersQ.data ?? [];
  const clientSquads = clientSquadsQ.data ?? [];

  const finValueMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of finValuesQ.data ?? []) m.set(f.id, Number(f.monthly_value ?? 0));
    return m;
  }, [finValuesQ.data]);

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

  const handleCreate = async (values: ClientFormValues) => {
    try {
      const now = new Date();
      const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-27`;
      await createClient.mutateAsync({
        name: values.name,
        magic_due_date: dueDate,
        notes: values.notes || undefined,
        contract_start: values.contract_start || new Date().toISOString().slice(0, 10),
        services: values.services ?? [],
        participates_magic: values.participates_magic,
        participates_ranking: values.participates_ranking,
        has_goals: values.has_goals,
      });
      toast.success("Cliente criado e sincronizado com os módulos!");
      setCreateOpen(false);
      createForm.reset(emptyDefaults);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar cliente");
    }
  };

  const handleEdit = async (values: ClientFormValues) => {
    if (!editClient) return;
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          name: values.name,
          notes: values.notes || null,
          contract_start: values.contract_start || null,
          services: values.services ?? [],
          participates_magic: values.participates_magic,
          participates_ranking: values.participates_ranking,
          has_goals: values.has_goals,
        } as any)
        .eq("id", editClient.id);
      if (error) throw error;

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
      toast.success("Cliente atualizado e sincronizado!");
      setEditClient(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar cliente");
    }
  };

  const handleToggleActive = async (client: ClientRow) => {
    try {
      await toggleActive.mutateAsync({ clientId: client.id, isActive: !client.is_active });
      toast.success(client.is_active ? "Contrato pausado" : "Contrato reativado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao alterar status");
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
    setEditClient(client);
    editForm.reset({
      name: client.name,
      notes: client.notes ?? "",
      contract_start: client.contract_start ?? new Date().toISOString().slice(0, 10),
      services: client.services ?? [],
      participates_magic: client.participates_magic ?? true,
      participates_ranking: client.participates_ranking ?? true,
      has_goals: client.has_goals ?? false,
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
                    <TableHead>Módulos</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const squadIds = clientSquadMap.get(client.id) ?? [];
                    const finValue = finValueMap.get(client.id) ?? 0;
                    return (
                      <TableRow key={client.id} className={!client.is_active ? "opacity-60" : ""}>
                        <TableCell>
                          <Badge variant={client.is_active ? "success" : "secondary"}>
                            {client.is_active ? "Ativo" : "Pausado"}
                          </Badge>
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
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {client.participates_magic && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Sparkles className="h-3 w-3" /> Magic
                              </Badge>
                            )}
                            {client.participates_ranking && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Trophy className="h-3 w-3" /> Ranking
                              </Badge>
                            )}
                            {client.has_goals && (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Target className="h-3 w-3" /> Metas
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(client)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(client)}
                              title={client.is_active ? "Pausar" : "Reativar"}
                              disabled={toggleActive.isPending}
                            >
                              {client.is_active ? (
                                <Pause className="h-4 w-4 text-warning" />
                              ) : (
                                <Play className="h-4 w-4 text-success" />
                              )}
                            </Button>
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
              <p className="text-[11px] text-muted-foreground">
                O <strong>Squad responsável</strong> (definido em "Operação") determina automaticamente o fluxo de tarefas conforme a função de cada membro.
              </p>
            </div>
          </section>

          <Separator />

          {/* Contrato */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Contrato
            </h3>
            <div className="space-y-1.5">
              <Label>Início do contrato</Label>
              <Input type="date" {...form.register("contract_start")} />
              <p className="text-[11px] text-muted-foreground">
                O <strong>valor mensal</strong> é gerenciado no módulo <strong>Financeiro</strong>.
              </p>
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

          {/* Módulos */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Módulos Ativos</h3>
            <div className="space-y-2">
              <Controller
                control={form.control}
                name="participates_magic"
                render={({ field }) => (
                  <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 cursor-pointer hover:bg-accent/40">
                    <span className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Participa do Magic Number
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
              <Controller
                control={form.control}
                name="participates_ranking"
                render={({ field }) => (
                  <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 cursor-pointer hover:bg-accent/40">
                    <span className="flex items-center gap-2 text-sm">
                      <Trophy className="h-4 w-4 text-primary" />
                      Aparece no Ranking
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
              <Controller
                control={form.control}
                name="has_goals"
                render={({ field }) => (
                  <label className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5 cursor-pointer hover:bg-accent/40">
                    <span className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-primary" />
                      Possui Metas próprias
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
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
