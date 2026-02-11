import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, TrendingUp, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useFinClients, useUpsertFinClient, useDeleteFinClient, type FinClient } from "../hooks/use-financial-data";
import { addMonths, format, differenceInMonths, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

export function FinClientesTab() {
  const clientsQ = useFinClients();
  const upsertMut = useUpsertFinClient();
  const deleteMut = useDeleteFinClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinClient | null>(null);
  const [form, setForm] = useState({ name: "", cnpj: "", monthly_value: "", contract_months: "12", contract_start: format(new Date(), "yyyy-MM-dd"), notes: "" });

  const clients = clientsQ.data ?? [];
  const activeClients = clients.filter((c) => c.is_active);
  const mrr = activeClients.reduce((s, c) => s + Number(c.monthly_value), 0);

  const expiringCount = activeClients.filter((c) => {
    const end = addMonths(new Date(c.contract_start), c.contract_months);
    return differenceInMonths(end, new Date()) <= 2 && !isBefore(end, new Date());
  }).length;

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", cnpj: "", monthly_value: "", contract_months: "12", contract_start: format(new Date(), "yyyy-MM-dd"), notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: FinClient) => {
    setEditing(c);
    setForm({
      name: c.name,
      cnpj: c.cnpj ?? "",
      monthly_value: String(c.monthly_value),
      contract_months: String(c.contract_months),
      contract_start: c.contract_start,
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = () => {
    upsertMut.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        name: form.name,
        cnpj: form.cnpj || null,
        monthly_value: parseFloat(form.monthly_value) || 0,
        contract_months: parseInt(form.contract_months) || 12,
        contract_start: form.contract_start,
        notes: form.notes || null,
      } as any,
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {mrr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeClients.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expirando em 2 meses</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{expiringCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Clientes Financeiros</h3>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Novo</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead className="text-right">Valor Mensal</TableHead>
              <TableHead className="text-center">Contrato</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((c) => {
              const end = addMonths(new Date(c.contract_start), c.contract_months);
              const expired = isBefore(end, new Date());
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.cnpj || "—"}</TableCell>
                  <TableCell className="text-right">R$ {Number(c.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell className="text-center text-sm">{c.contract_months} meses</TableCell>
                  <TableCell className="text-center">
                    {expired ? <Badge variant="destructive">Expirado</Badge> : c.is_active ? <Badge variant="default">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir {c.name}?</AlertDialogTitle>
                            <AlertDialogDescription>Todas as receitas e despesas vinculadas serão removidas.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMut.mutate(c.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {clients.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum cliente cadastrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Mensal (R$)</Label>
                <Input type="number" step="0.01" value={form.monthly_value} onChange={(e) => setForm((p) => ({ ...p, monthly_value: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Duração (meses)</Label>
                <Input type="number" value={form.contract_months} onChange={(e) => setForm((p) => ({ ...p, contract_months: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Início do contrato</Label>
              <Input type="date" value={form.contract_start} onChange={(e) => setForm((p) => ({ ...p, contract_start: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={!form.name || upsertMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
