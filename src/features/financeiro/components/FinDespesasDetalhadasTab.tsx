import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, CreditCard, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  useFinExpenses, useUpsertFinExpense, useDeleteFinExpense,
  useFinCreditCards, useUpsertFinCreditCard, useFinAllExpenses,
  type FinExpense, type FinCreditCard
} from "../hooks/use-financial-data";
import { FinMonthYearSelector } from "./FinMonthYearSelector";
import { buildEffectiveExpenses } from "../utils/build-effective-expenses";

const CATEGORIES = [
  { value: "administrativa", label: "Administrativa" },
  { value: "operacional", label: "Operacional" },
  { value: "financeira", label: "Financeira" },
  { value: "comercial", label: "Comercial" },
];

export function FinDespesasDetalhadasTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const expensesQ = useFinExpenses(year, month);
  const allYearExpensesQ = useFinAllExpenses(year);
  const cardsQ = useFinCreditCards();
  const upsertExp = useUpsertFinExpense();
  const deleteExp = useDeleteFinExpense();
  const upsertCard = useUpsertFinCreditCard();

  const storedExpenses = expensesQ.data ?? [];
  const allYearExpenses = allYearExpensesQ.data ?? [];
  const cards = cardsQ.data ?? [];

  const expenses = useMemo(
    () => buildEffectiveExpenses(storedExpenses, allYearExpenses, month, year),
    [storedExpenses, allYearExpenses, month, year],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinExpense | null>(null);
  const [preselectedCardId, setPreselectedCardId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const emptyForm = { description: "", category: "administrativa", amount: "", is_recurring: false, installment_total: "", installment_current: "", credit_card_id: "", notes: "", due_day: "10" };
  const [form, setForm] = useState(emptyForm);
  const [cardForm, setCardForm] = useState({ name: "", last_digits: "", closing_day: "1", due_day: "10" });

  const openNew = (cardId?: string) => {
    setEditing(null);
    setForm({ ...emptyForm, credit_card_id: cardId ?? "" });
    setPreselectedCardId(cardId ?? null);
    setDialogOpen(true);
  };

  const openEdit = (e: FinExpense) => {
    setEditing(e);
    setForm({
      description: e.description, category: e.category, amount: String(e.amount),
      is_recurring: e.is_recurring, installment_total: e.installment_total ? String(e.installment_total) : "",
      installment_current: e.installment_current ? String(e.installment_current) : "",
      credit_card_id: e.credit_card_id ?? "", notes: e.notes ?? "",
      due_day: e.due_day ? String(e.due_day) : "10",
    });
    setPreselectedCardId(null);
    setDialogOpen(true);
  };

  const save = () => {
    upsertExp.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        description: form.description,
        category: form.category,
        amount: parseFloat(form.amount) || 0,
        year, month, status: "pendente",
        is_recurring: form.is_recurring,
        installment_total: form.installment_total ? parseInt(form.installment_total) : null,
        installment_current: form.installment_current ? parseInt(form.installment_current) : null,
        credit_card_id: form.credit_card_id && form.credit_card_id !== "none" ? form.credit_card_id : null,
        notes: form.notes || null,
        due_day: parseInt(form.due_day) || 10,
        paid_at: null,
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

  const toggleCardExpanded = (cardId: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  // Non-card expenses grouped by category
  const nonCardExpenses = useMemo(() => expenses.filter(e => !e.credit_card_id), [expenses]);
  const grouped = useMemo(() => {
    const map = new Map<string, FinExpense[]>();
    CATEGORIES.forEach((c) => map.set(c.value, []));
    nonCardExpenses.forEach((e) => map.get(e.category)?.push(e));
    // Sort each category by due_day
    map.forEach((items, key) => map.set(key, items.sort((a, b) => (a.due_day ?? 10) - (b.due_day ?? 10))));
    return map;
  }, [nonCardExpenses]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <FinMonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCardDialogOpen(true)}><CreditCard className="mr-1 h-4 w-4" /> Novo Cartão</Button>
          <Button size="sm" onClick={() => openNew()}><Plus className="mr-1 h-4 w-4" /> Nova Despesa</Button>
        </div>
      </div>

      {/* Credit Cards */}
      {cards.map((card) => {
        const cardExpenses = expenses.filter((e) => e.credit_card_id === card.id);
        const cardTotal = cardExpenses.reduce((s, e) => s + Number(e.amount), 0);
        const isExpanded = expandedCards.has(card.id);
        return (
          <Card key={card.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button onClick={() => toggleCardExpanded(card.id)} className="flex items-center gap-2 text-left">
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{card.name}</CardTitle>
                  {card.last_digits && <span className="text-xs text-muted-foreground">****{card.last_digits}</span>}
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">R$ {cardTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  <Button size="sm" variant="outline" onClick={() => openNew(card.id)}>
                    <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{cardExpenses.length} itens • Fecha dia {card.closing_day} • Vence dia {card.due_day}</p>
            </CardHeader>
            {isExpanded && (
              <CardContent className="pt-0">
                {cardExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhum item neste cartão</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-center">Parcela</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead className="w-20" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cardExpenses.map((e) => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">
                              {e.description}
                              {e.is_recurring && !e.installment_total && <Badge variant="secondary" className="ml-2 text-xs">Recorrente</Badge>}
                            </TableCell>
                            <TableCell className="text-center text-sm text-muted-foreground">
                              {e.installment_total ? `${e.installment_current}/${e.installment_total}` : "—"}
                            </TableCell>
                            <TableCell className="text-right">R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
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
            )}
          </Card>
        );
      })}

      {/* Non-card expenses by category */}
      {CATEGORIES.map((cat) => {
        const items = grouped.get(cat.value) ?? [];
        const total = items.reduce((s, e) => s + Number(e.amount), 0);
        if (items.length === 0) return null;
        return (
          <Card key={cat.value}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{cat.label}</CardTitle>
                <span className="text-sm font-semibold">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-center">Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Parcela</TableHead>
                      <TableHead className="w-20" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          {e.description}
                          {e.is_recurring && !e.installment_total && <Badge variant="secondary" className="ml-2 text-xs">Recorrente</Badge>}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground">Dia {e.due_day ?? 10}</TableCell>
                        <TableCell className="text-right">R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
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
            </CardContent>
          </Card>
        );
      })}

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
                <Label>Cartão</Label>
                <Select value={form.credit_card_id} onValueChange={(v) => setForm((p) => ({ ...p, credit_card_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Dia vencimento</Label><Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm((p) => ({ ...p, due_day: e.target.value }))} placeholder="Ex: 10" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Parcela atual</Label><Input type="number" value={form.installment_current} onChange={(e) => setForm((p) => ({ ...p, installment_current: e.target.value }))} placeholder="Ex: 3" /></div>
              <div className="space-y-2"><Label>Total de parcelas</Label><Input type="number" value={form.installment_total} onChange={(e) => setForm((p) => ({ ...p, installment_total: e.target.value }))} placeholder="Ex: 12" /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm((p) => ({ ...p, is_recurring: v }))} />
              <Label>Despesa recorrente (assinatura)</Label>
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
