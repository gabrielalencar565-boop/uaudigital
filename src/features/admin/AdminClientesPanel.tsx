import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format, isValid } from "date-fns";
import { Plus, Pencil, Trash2, Users, Pause, Play, Filter } from "lucide-react";
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
import { useAllClients, useCreateClient, useDeleteClient, useToggleClientActive, type ClientRow } from "@/features/data/queries";
import { useSquads } from "@/features/projetos/hooks/use-squads";
import { ContractMonthsSelector } from "@/features/admin/components/ContractMonthsSelector";

const clientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type ClientFormValues = z.infer<typeof clientSchema>;

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

export function AdminClientesPanel() {
  const clientsQ = useAllClients();
  const createClient = useCreateClient();
  const toggleActive = useToggleClientActive();
  const deleteClient = useDeleteClient();
  const squadsQ = useSquads();
  const clientSquadsQ = useClientSquads();
  const qc = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ClientRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editSquadIds, setEditSquadIds] = useState<string[]>([]);

  const squads = squadsQ.data ?? [];
  const clientSquads = clientSquadsQ.data ?? [];

  // Map client_id -> squad_ids
  const clientSquadMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const cs of clientSquads) {
      const arr = map.get(cs.client_id) ?? [];
      arr.push(cs.squad_id);
      map.set(cs.client_id, arr);
    }
    return map;
  }, [clientSquads]);

  // Map squad_id -> squad
  const squadMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const s of squads) map.set(s.id, s);
    return map;
  }, [squads]);

  const clients = useMemo(() => {
    const all = clientsQ.data ?? [];
    if (showInactive) return all;
    return all.filter((c) => c.is_active);
  }, [clientsQ.data, showInactive]);

  const activeCount = useMemo(() => (clientsQ.data ?? []).filter((c) => c.is_active).length, [clientsQ.data]);
  const inactiveCount = useMemo(() => (clientsQ.data ?? []).filter((c) => !c.is_active).length, [clientsQ.data]);

  const createForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", notes: "" },
  });

  const editForm = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", notes: "" },
  });

  const handleCreate = async (values: ClientFormValues) => {
    try {
      const now = new Date();
      const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-27`;
      await createClient.mutateAsync({
        name: values.name,
        magic_due_date: dueDate,
        notes: values.notes || undefined,
      });
      toast.success("Cliente criado com sucesso!");
      setCreateOpen(false);
      createForm.reset();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar cliente");
    }
  };

  const handleEdit = async (values: ClientFormValues) => {
    if (!editClient) return;
    try {
      const { error } = await supabase
        .from("clients")
        .update({ name: values.name, notes: values.notes || null })
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

      clientsQ.refetch();
      qc.invalidateQueries({ queryKey: ["client_squads"] });
      toast.success("Cliente atualizado!");
      setEditClient(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar cliente");
    }
  };

  const handleToggleActive = async (client: ClientRow) => {
    try {
      await toggleActive.mutateAsync({
        clientId: client.id,
        isActive: !client.is_active,
      });
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

  const openEdit = (client: ClientRow) => {
    setEditClient(client);
    editForm.reset({ name: client.name, notes: client.notes ?? "" });
    setEditSquadIds(clientSquadMap.get(client.id) ?? []);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Gerenciar Clientes</h2>
          <p className="text-sm text-muted-foreground">
            {activeCount} ativo(s) • {inactiveCount} pausado(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              id="show-inactive"
              checked={showInactive}
              onCheckedChange={setShowInactive}
            />
            <Label htmlFor="show-inactive" className="text-sm text-muted-foreground cursor-pointer">
              <Filter className="inline h-3 w-3 mr-1" />
              Mostrar pausados
            </Label>
          </div>
          <Button variant="brand" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Cliente
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes Cadastrados
          </CardTitle>
          <CardDescription>
            {clients.length} cliente(s) exibido(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                {showInactive ? "Nenhum cliente cadastrado ainda." : "Nenhum cliente ativo. Ative o filtro para ver pausados."}
              </p>
              {!showInactive && inactiveCount > 0 && (
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setShowInactive(true)}
                >
                  Ver {inactiveCount} pausado(s)
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Squads</TableHead>
                    <TableHead>Observações</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const squadIds = clientSquadMap.get(client.id) ?? [];
                    return (
                      <TableRow key={client.id} className={!client.is_active ? "opacity-60" : ""}>
                        <TableCell>
                          <Badge variant={client.is_active ? "success" : "secondary"}>
                            {client.is_active ? "Ativo" : "Pausado"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {squadIds.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              squadIds.map((sid) => {
                                const squad = squadMap.get(sid);
                                if (!squad) return null;
                                return (
                                  <Badge
                                    key={sid}
                                    variant="outline"
                                    className="text-xs border-sidebar/40 text-sidebar"
                                  >
                                    {squad.name}
                                  </Badge>
                                );
                              })
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">
                          {client.notes || "—"}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {(() => {
                              const d = new Date(client.magic_due_date);
                              return isValid(d) ? format(d, "MM/yyyy") : "—";
                            })()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(client)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleActive(client)}
                              title={client.is_active ? "Pausar contrato" : "Reativar contrato"}
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

      {/* Dialog de criar cliente */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={createForm.handleSubmit(handleCreate)}>
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input
                placeholder="Ex.: Empresa XYZ"
                {...createForm.register("name")}
              />
              {createForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {createForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Informações adicionais sobre o cliente..."
                {...createForm.register("notes")}
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="brand"
                disabled={createClient.isPending}
              >
                {createClient.isPending ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de editar cliente */}
      <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={editForm.handleSubmit(handleEdit)}>
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input
                placeholder="Ex.: Empresa XYZ"
                {...editForm.register("name")}
              />
              {editForm.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {editForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                placeholder="Informações adicionais sobre o cliente..."
                {...editForm.register("notes")}
                rows={3}
              />
            </div>

            {/* Squads */}
            {squads.length > 0 && (
              <div className="space-y-2">
                <Label>Squads Responsáveis</Label>
                <div className="grid grid-cols-2 gap-2">
                  {squads.map((squad) => (
                    <label
                      key={squad.id}
                      className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={editSquadIds.includes(squad.id)}
                        onCheckedChange={(checked) => {
                          setEditSquadIds((prev) =>
                            checked
                              ? [...prev, squad.id]
                              : prev.filter((id) => id !== squad.id)
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

            {/* Meses de contrato */}
            {editClient && (
              <ContractMonthsSelector
                clientId={editClient.id}
                clientName={editClient.name}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditClient(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="brand"
              >
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>⚠️ Excluir permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja <strong>excluir permanentemente</strong> o cliente "{deleteConfirm?.name}"?
              <br /><br />
              <strong>Isso removerá todas as tarefas, ciclos e histórico associados.</strong>
              <br /><br />
              💡 Dica: Se o cliente apenas encerrou o contrato, prefira <strong>pausar</strong> ao invés de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteClient.isPending ? "Removendo..." : "Excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
