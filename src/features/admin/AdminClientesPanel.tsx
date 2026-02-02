import { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Users, Pause, Play, Filter } from "lucide-react";
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
import { useAllClients, useCreateClient, useDeleteClient, useToggleClientActive, type ClientRow } from "@/features/data/queries";
import { ContractMonthsSelector } from "@/features/admin/components/ContractMonthsSelector";

const clientSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export function AdminClientesPanel() {
  const clientsQ = useAllClients();
  const createClient = useCreateClient();
  const toggleActive = useToggleClientActive();
  const deleteClient = useDeleteClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ClientRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);

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
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase
        .from("clients")
        .update({ name: values.name, notes: values.notes || null })
        .eq("id", editClient.id);
      if (error) throw error;
      clientsQ.refetch();
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
                    <TableHead>Observações</TableHead>
                    <TableHead>Desde</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => (
                    <TableRow key={client.id} className={!client.is_active ? "opacity-60" : ""}>
                      <TableCell>
                        <Badge variant={client.is_active ? "success" : "secondary"}>
                          {client.is_active ? "Ativo" : "Pausado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{client.name}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {client.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(client.magic_due_date), "MM/yyyy")}
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
                  ))}
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
