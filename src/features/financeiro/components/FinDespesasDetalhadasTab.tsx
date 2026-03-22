import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, CreditCard, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const CATEGORY_COLORS: Record<string, string> = {
  administrativa: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  operacional: "bg-red-500/10 text-red-600 border-red-500/20",
  financeira: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  comercial: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
};

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

  const expenses = useMemo(
    () => buildEffectiveExpenses(expensesQ.data ?? [], allYearExpensesQ.data ?? [], month, year),
    [expensesQ.data, allYearExpensesQ.data, month, year],
  );
  const cards = cardsQ.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FinExpense | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const emptyForm = { description: "", category: "administrativa", amount: "", is_recurring: false, installment_total: "", installment_current: "", credit_card_id: "", notes: "", due_day: "10" };
  const [form, setForm] = useState(emptyForm);
  const [cardForm, setCardForm] = useState({ name: "", last_digits: "", closing_day: "1", due_day: "10" });

  const openNew = (cardId?: string) => { setEditing(null); setForm({ ...emptyForm, credit_card_id: cardId ?? "" }); setDialogOpen(true); };
  const openEdit = (e: FinExpense) => {
    setEditing(e);
    setForm({ description: e.description, category: e.category, amount: String(e.amount), is_recurring: e.is_recurring, installment_total: e.installment_total ? String(e.installment_total) : "", installment_current: e.installment_current ? String(e.installment_current) : "", credit_card_id: e.credit_card_id ?? "", notes: e.notes ?? "", due_day: e.due_day ? String(e.due_day) : "10" });
    setDialogOpen(true);
  };

  const save = () => {
    upsertExp.mutate({
      ...(editing ? { id: editing.id } : {}), description: form.description, category: form.category, amount: parseFloat(form.amount) || 0,
      year, month, status: "pendente", is_recurring: form.is_recurring, installment_total: form.installment_total ? parseInt(form.installment_total) : null,
      installment_current: form.installment_current ? parseInt(form.installment_current) : null,
      credit_card_id: form.credit_card_id && form.credit_card_id !== "none" ? form.credit_card_id : null, notes: form.notes || null, due_day: parseInt(form.due_day) || 10, paid_at: null,
    } as any, { onSuccess: () => setDialogOpen(false) });
  };

  const saveCard = () => {
    upsertCard.mutate({ name: cardForm.name, last_digits: cardForm.last_digits || null, closing_day: parseInt(cardForm.closing_day) || 1, due_day: parseInt(cardForm.due_day) || 10 } as any,
      { onSuccess: () => { setCardDialogOpen(false); setCardForm({ name: "", last_digits: "", closing_day: "1", due_day: "10" }); } });
  };

  const toggleCardExpanded = (cardId: string) => {
    setExpandedCards(prev => { const next = new Set(prev); if (next.has(cardId)) next.delete(cardId); else next.add(cardId); return next; });
  };

  const nonCardExpenses = useMemo(() => expenses.filter(e => !e.credit_card_id), [expenses]);
  const grouped = useMemo(() => {
    const map = new Map<string, FinExpense[]>();
    CATEGORIES.forEach((c) => map.set(c.value, []));
    nonCardExpenses.forEach((e) => map.get(e.category)?.push(e));
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
          <Card key={card.id} className="overflow-hidden transition-all duration-200 hover:shadow-lg opacity-0 p-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
            {/* Card Header - Dark gradient style */}
            <button
              onClick={() => toggleCardExpanded(card.id)}
              className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-800 dark:to-slate-700 text-white rounded-t-2xl"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400 transition-transform" /> : <ChevronRight className="h-4 w-4 text-slate-400 transition-transform" />}
                <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm">{card.name}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-2">
                    {card.last_digits && <span>•••• {card.last_digits}</span>}
                    <span>Fecha dia {card.closing_day}</span>
                    <span>•</span>
                    <span>Vence dia {card.due_day}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Fatura</p>
                  <p className="text-lg font-bold">R$ {cardTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </div>
                <Badge variant="secondary" className="bg-white/10 text-white border-0 text-[10px]">{cardExpenses.length} itens</Badge>
                <Button size="sm" variant="ghost" className="h-7 text-white hover:bg-white/10 border border-white/20 text-[11px]" onClick={(ev) => { ev.stopPropagation(); openNew(card.id); }}><Plus className="mr-1 h-3 w-3" /> Adicionar</Button>
              </div>
            </button>

            {/* Card Expenses List */}
            {isExpanded && (
              <div className="divide-y divide-border">
                {cardExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhum item neste cartão</p>
                ) : (
                  cardExpenses.map((e) => (
                    <div key={e.id} className="flex items-center justify-between py-3 px-5 hover:bg-accent/30 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-primary/60" />
                        <span className="font-medium text-sm">{e.description}</span>
                        {e.is_recurring && !e.installment_total && <Badge variant="secondary" className="text-[9px]">Recorrente</Badge>}
                        {e.installment_total && (
                          <Badge variant="outline" className="text-[9px] font-mono">{e.installment_current}/{e.installment_total}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm tabular-nums">R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(e)}><Pencil className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteExp.mutate({ id: e.id, year, month })}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        );
      })}

      {/* Non-card expenses by category */}
      {CATEGORIES.map((cat) => {
        const items = grouped.get(cat.value) ?? [];
        const total = items.reduce((s, e) => s + Number(e.amount), 0);
        if (items.length === 0) return null;
        const colorClasses = CATEGORY_COLORS[cat.value] ?? "";
        return (
          <Card key={cat.value} className="transition-all duration-200 hover:shadow-md opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.15s" }}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colorClasses}`}>{cat.label}</span>
                  <span className="text-xs text-muted-foreground">{items.length} itens</span>
                </div>
                <span className="text-lg font-bold">R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-1">
                {items.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/30 transition-colors group">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{e.description}</span>
                      {e.is_recurring && !e.installment_total && <Badge variant="secondary" className="text-[9px]">Recorrente</Badge>}
                      {e.installment_total && <span className="text-[10px] text-muted-foreground">{e.installment_current}/{e.installment_total}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Dia {e.due_day ?? 10}</span>
                      <span className="font-semibold text-sm">R$ {Number(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(e)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteExp.mutate({ id: e.id, year, month })}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
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
              <div className="space-y-2"><Label>Categoria</Label><Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Cartão</Label><Select value={form.credit_card_id} onValueChange={(v) => setForm((p) => ({ ...p, credit_card_id: v }))}><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{cards.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Dia vencimento</Label><Input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm((p) => ({ ...p, due_day: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Parcela atual</Label><Input type="number" value={form.installment_current} onChange={(e) => setForm((p) => ({ ...p, installment_current: e.target.value }))} placeholder="Ex: 3" /></div>
              <div className="space-y-2"><Label>Total de parcelas</Label><Input type="number" value={form.installment_total} onChange={(e) => setForm((p) => ({ ...p, installment_total: e.target.value }))} placeholder="Ex: 12" /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_recurring} onCheckedChange={(v) => setForm((p) => ({ ...p, is_recurring: v }))} /><Label>Despesa recorrente</Label></div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={save} disabled={!form.description || upsertExp.isPending}>Salvar</Button></DialogFooter>
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
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={saveCard} disabled={!cardForm.name}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
