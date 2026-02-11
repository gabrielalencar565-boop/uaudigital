import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  useFinExpenses, useUpsertFinExpense, useDeleteFinExpense,
  useFinCreditCards, useUpsertFinCreditCard,
  type FinExpense, type FinCreditCard
} from "../hooks/use-financial-data";

const CATEGORIES = [
  { value: "administrativa", label: "Administrativa" },
  { value: "operacional", label: "Operacional" },
  { value: "financeira", label: "Financeira" },
  { value: "comercial", label: "Comercial" },
];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function FinDespesasDetalhadasTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const expensesQ = useFinExpenses(year, month);
  const cardsQ = useFinCreditCards();
  const upsertExp = useUpsertFinExpense();
  const deleteExp = useDeleteFinExpense();
  const upsertCard = useUpsertFinCreditCard();

  const expenses = expensesQ.data ?? [];
  const cards = cardsQ.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinExpense | null>(null);

  const emptyForm = { description: "", category: "administrativa", amount: "", status: "pendente", is_recurring: false, installment_total: "", installment_current: "", credit_card_id: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [cardForm, setCardForm] = useState({ name: "", last_digits: "", closing_day: "1", due_day: "10" });

  const prev = () => { if (month === 1) { setMonth(12); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const next = () => { if (month === 12) { setMonth(1); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (e: FinExpense) => {
    setEditing(e);
    setForm({
      description: e.description, category: e.category, amount: String(e.amount), status: e.status,
      is_recurring: e.is_recurring, installment_total: e.installment_total ? String(e.installment_total) : "",
      installment_current: e.installment_current ? String(e.installment_current) : "",
      credit_card_id: e.credit_card_id ?? "", notes: e.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = () => {
    upsertExp.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        description: form.description,
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        year, month, status: form.status,
        is_recurring: form.is_recurring,
        installment_total: form.installment_total ? parseInt(form.installment_total) : null,
        installment_current: form.installment_current ? parseInt(form.installment_current) : null,
        credit_card_id: form.credit_card_id || null,
        notes: form.notes || null,
        paid_at: form.status === "pago" ? new Date().toISOString() : null,
      } as any,
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  const saveCard = () => {
    upsertCard.mutate(
      { name: cardForm.name, last_digits: cardForm.last_digits || null, closing_day: parseInt(cardForm.closing_day) || 1, due_day: parseInt(cardForm.due_day) || 10 } as any,
      { onSuccess: () => { setCardDialogOpen(false); setCardForm({ name: "", last_digits: "", closing_day: "1", due_day: "10" }); } },
    );
  };

  const grouped = useMemo(() => {
    const map = new Map<string, FinExpense[]>();
    CATEGORIES.forEach((c) => map.set(c.value, []));
    expenses.forEach((e) => map.get(e.category)?.push(e));
    return map;
  }, [expenses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="text-lg font-semibold">{MONTHS[month - 1]} {year}</span>
          <Button variant="ghost" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCardDialogOpen(true)}><CreditCard className="mr-1 h-4 w-4" /> Cartões</Button>
          <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Nova Despesa</Button>
        </div>
      </div>

      {CATEGORIES.map((cat) => {
        const items = grouped.get(cat.value) ?? [];
        const total = items.reduce((s, e) => s + Number(e.amount), 0);
        return (
          <Card key={cat.value}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{cat.label}</CardTitle>
                <span className="text-sm font-semibold">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhuma despesa nesta categoria</p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Parcela</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.description}</TableCell>
                          <TableCell className="text-right">R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={e.status === "pago" ? "default" : "secondary"}>{e.status === "pago" ? "Pago" : "Pendente"}</Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {e.installment_total ? `${e.installment_current}/${e.installment_total}` : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteExp.mutate({ id: e.id, year, month })}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
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
        );
      })}

      {/* Cartões drill-down */}
      {cards.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Cartões de Crédito</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {cards.map((card) => {
              const cardExpenses = expenses.filter((e) => e.credit_card_id === card.id);
              const cardTotal = cardExpenses.reduce((s, e) => s + Number(e.amount), 0);
              return (
                <Collapsible key={card.id}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 hover:bg-accent/50">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span className="font-medium">{card.name}</span>
                      {card.last_digits && <span className="text-xs text-muted-foreground">****{card.last_digits}</span>}
                    </div>
                    <span className="text-sm font-semibold">R$ {cardTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 pt-2 space-y-1">
                    {cardExpenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-sm py-1">
                        <span>{e.description}</span>
                        <span className="text-muted-foreground">R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                    {cardExpenses.length === 0 && <p className="text-xs text-muted-foreground py-1">Sem despesas neste cartão</p>}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Expense dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Despesa" : "Nova Despesa"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Descrição *</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cartão</Label>
                <Select value={form.credit_card_id} onValueChange={(v) => setForm((p) => ({ ...p, credit_card_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Parcela atual</Label><Input type="number" value={form.installment_current} onChange={(e) => setForm((p) => ({ ...p, installment_current: e.target.value }))} placeholder="Ex: 3" /></div>
              <div className="space-y-2"><Label>Total de parcelas</Label><Input type="number" value={form.installment_total} onChange={(e) => setForm((p) => ({ ...p, installment_total: e.target.value }))} placeholder="Ex: 12" /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm((p) => ({ ...p, is_recurring: v }))} />
              <Label>Despesa recorrente</Label>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={!form.description || upsertExp.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Cartão de Crédito</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={cardForm.name} onChange={(e) => setCardForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Nubank" /></div>
            <div className="space-y-2"><Label>Últimos 4 dígitos</Label><Input value={cardForm.last_digits} onChange={(e) => setCardForm((p) => ({ ...p, last_digits: e.target.value }))} maxLength={4} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Dia fechamento</Label><Input type="number" value={cardForm.closing_day} onChange={(e) => setCardForm((p) => ({ ...p, closing_day: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Dia vencimento</Label><Input type="number" value={cardForm.due_day} onChange={(e) => setCardForm((p) => ({ ...p, due_day: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveCard} disabled={!cardForm.name}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
