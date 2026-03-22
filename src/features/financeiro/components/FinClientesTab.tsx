import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Building2, TrendingUp, Users, AlertTriangle, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useFinClients, useUpsertFinClient, useDeleteFinClient, type FinClient } from "../hooks/use-financial-data";
import { addMonths, format, differenceInMonths, isBefore } from "date-fns";
import { FinMetricCard } from "./FinMetricCard";

export function FinClientesTab() {
  const clientsQ = useFinClients();
  const upsertMut = useUpsertFinClient();
  const deleteMut = useDeleteFinClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinClient | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ativo");
  const [form, setForm] = useState({ name: "", cnpj: "", monthly_value: "", contract_months: "12", contract_start: format(new Date(), "yyyy-MM-dd"), due_day: "10", notes: "" });

  const clients = clientsQ.data ?? [];

  const getClientStatus = (c: FinClient) => {
    if (!c.is_active) return "encerrado";
    const end = addMonths(new Date(c.contract_start), c.contract_months);
    if (isBefore(end, new Date())) return "expirado";
    return "ativo";
  };

  const filteredClients = clients.filter((c) => {
    if (statusFilter === "all") return true;
    return getClientStatus(c) === statusFilter;
  }).sort((a, b) => (a.due_day ?? 10) - (b.due_day ?? 10));

  const activeClients = clients.filter((c) => c.is_active);
  const mrr = activeClients.reduce((s, c) => s + Number(c.monthly_value), 0);

  const expiringCount = activeClients.filter((c) => {
    const end = addMonths(new Date(c.contract_start), c.contract_months);
    return differenceInMonths(end, new Date()) <= 2 && !isBefore(end, new Date());
  }).length;

  const expiredClients = clients.filter((c) => {
    const end = addMonths(new Date(c.contract_start), c.contract_months);
    return isBefore(end, new Date());
  });
  const encerradoCount = clients.filter((c) => !c.is_active).length;
  const churnRate = clients.length > 0 ? ((expiredClients.length + encerradoCount) / clients.length) * 100 : 0;

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", cnpj: "", monthly_value: "", contract_months: "12", contract_start: format(new Date(), "yyyy-MM-dd"), due_day: "10", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: FinClient) => {
    setEditing(c);
    setForm({
      name: c.name, cnpj: c.cnpj ?? "", monthly_value: String(c.monthly_value),
      contract_months: String(c.contract_months), contract_start: c.contract_start,
      due_day: String((c as any).due_day ?? 10), notes: c.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = () => {
    upsertMut.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        name: form.name, cnpj: form.cnpj || null,
        monthly_value: parseFloat(form.monthly_value) || 0,
        contract_months: parseInt(form.contract_months) || 12,
        contract_start: form.contract_start,
        due_day: parseInt(form.due_day) || 10,
        notes: form.notes || null,
      } as any,
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  const toggleEncerrado = (c: FinClient) => {
    upsertMut.mutate({ id: c.id, name: c.name, is_active: !c.is_active } as any);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; classes: string }> = {
      ativo: { label: "Ativo", classes: "bg-success/10 text-success border-success/20" },
      expirado: { label: "Expirado", classes: "bg-destructive/10 text-destructive border-destructive/20" },
      encerrado: { label: "Encerrado", classes: "bg-muted text-muted-foreground border-border" },
    };
    const s = map[status] ?? map.ativo;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.classes}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <FinMetricCard
          title="MRR"
          value={mrr}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="success"
        />
        <FinMetricCard
          title="Clientes Ativos"
          value={activeClients.length}
          prefix=""
          decimals={0}
          icon={<Users className="h-4 w-4" />}
        />
        <FinMetricCard
          title="Expirando em 2 meses"
          value={expiringCount}
          prefix=""
          decimals={0}
          tone={expiringCount > 0 ? "warning" : "default"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <FinMetricCard
          title="Churn Rate"
          value={churnRate}
          prefix=""
          suffix="%"
          decimals={1}
          tone={churnRate > 10 ? "danger" : "default"}
          icon={<TrendingUp className="h-4 w-4" />}
        >
          <p className="text-[10px] text-muted-foreground mt-1">{expiredClients.length + encerradoCount} encerrado(s)/expirado(s)</p>
        </FinMetricCard>
      </div>

      {/* Table header with filter */}
      <div className="flex items-center justify-between opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <h3 className="text-lg font-semibold">Clientes Financeiros</h3>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><Filter className="mr-1 h-4 w-4" /><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="expirado">Expirados</SelectItem>
              <SelectItem value="encerrado">Encerrados</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Novo</Button>
        </div>
      </div>

      {/* Modern Table */}
      <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.15s" }}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Valor Mensal</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vencimento</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contrato</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c) => {
                  const status = getClientStatus(c);
                  return (
                    <tr key={c.id} className={`border-b last:border-0 transition-colors hover:bg-accent/40 group ${!c.is_active ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{c.name}</p>
                            {c.cnpj && <p className="text-[10px] text-muted-foreground">{c.cnpj}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">R$ {Number(c.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">Dia {(c as any).due_day ?? 10}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{c.contract_months}m</td>
                      <td className="px-4 py-3 text-center">{statusBadge(status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => toggleEncerrado(c)}>
                            {c.is_active ? "Encerrar" : "Reativar"}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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
                      </td>
                    </tr>
                  );
                })}
                {filteredClients.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted-foreground py-12">Nenhum cliente encontrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Valor Mensal (R$)</Label><Input type="number" step="0.01" value={form.monthly_value} onChange={(e) => setForm((p) => ({ ...p, monthly_value: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Duração (meses)</Label><Input type="number" value={form.contract_months} onChange={(e) => setForm((p) => ({ ...p, contract_months: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Início do contrato</Label><DatePicker value={form.contract_start} onChange={(v) => setForm((p) => ({ ...p, contract_start: v }))} className="w-full" /></div>
              <div className="space-y-2"><Label>Dia de vencimento</Label><Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm((p) => ({ ...p, due_day: e.target.value }))} /></div>
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
