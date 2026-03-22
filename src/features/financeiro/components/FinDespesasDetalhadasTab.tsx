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

const CARD_BRANDS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
  { value: "outro", label: "Outro" },
];

const BRAND_GRADIENTS: Record<string, string> = {
  visa: "from-blue-900 to-blue-700",
  mastercard: "from-gray-900 to-gray-700",
  elo: "from-yellow-900 to-yellow-700",
  amex: "from-emerald-900 to-emerald-700",
  hipercard: "from-red-900 to-red-700",
  outro: "from-slate-900 to-slate-800",
};

function CardBrandLogo({ brand, className = "h-8" }: { brand: string; className?: string }) {
  switch (brand) {
    case "visa":
      return (
        <svg viewBox="0 0 780 500" className={className} fill="none">
          <path d="M293.2 348.7l33.4-195.8h53.4l-33.4 195.8h-53.4zM531.3 157.9c-10.6-4-27.2-8.3-47.9-8.3-52.8 0-90 26.6-90.2 64.7-.3 28.2 26.5 43.9 46.8 53.3 20.8 9.6 27.8 15.8 27.7 24.4-.1 13.2-16.6 19.2-32 19.2-21.4 0-32.7-3-50.3-10.2l-6.9-3.1-7.5 43.8c12.5 5.5 35.6 10.2 59.6 10.5 56.2 0 92.6-26.3 93-67 .2-22.3-14-39.3-44.8-53.3-18.7-9.1-30.1-15.1-30-24.3 0-8.1 9.7-16.8 30.6-16.8 17.5-.3 30.1 3.5 40 7.5l4.8 2.2 7.1-42.5zM646.6 152.9h-41.3c-12.8 0-22.4 3.5-28 16.2l-79.4 179.6h56.2l11.2-29.3h68.6l6.5 29.3h49.6l-43.4-195.8zm-66 126.4c4.4-11.3 21.5-54.7 21.5-54.7-.3.5 4.4-11.4 7.1-18.8l3.6 17s10.3 47.2 12.5 57.1h-44.7v-.6zM232.8 152.9l-52.3 133.5-5.6-27.1c-9.7-31.3-40-65.2-73.9-82.2l47.9 171.4h56.6l84.2-195.6h-56.9z" fill="white"/>
          <path d="M124.7 152.9H38.5l-.7 3.8c67.2 16.3 111.7 55.6 130.1 102.8l-18.8-90.5c-3.2-12.4-12.8-15.7-24.4-16.1z" fill="hsl(40, 100%, 60%)"/>
        </svg>
      );
    case "mastercard":
      return (
        <svg viewBox="0 0 780 500" className={className} fill="none">
          <circle cx="330" cy="250" r="130" fill="hsl(0, 80%, 55%)" opacity="0.9"/>
          <circle cx="450" cy="250" r="130" fill="hsl(40, 100%, 55%)" opacity="0.9"/>
          <path d="M390 155c24.5 20.5 42.5 49.5 48.5 83h-97c6-33.5 24-62.5 48.5-83z" fill="hsl(25, 100%, 50%)"/>
          <path d="M390 345c-24.5-20.5-42.5-49.5-48.5-83h97c-6 33.5-24 62.5-48.5 83z" fill="hsl(25, 100%, 50%)"/>
        </svg>
      );
    case "elo":
      return (
        <div className={`${className} flex items-center`}>
          <span className="font-black text-xl tracking-tighter text-yellow-400">elo</span>
        </div>
      );
    case "amex":
      return (
        <div className={`${className} flex items-center`}>
          <span className="font-bold text-xs tracking-wider text-white/90">AMEX</span>
        </div>
      );
    case "hipercard":
      return (
        <div className={`${className} flex items-center`}>
          <span className="font-bold text-xs tracking-wider text-white/90">HIPERCARD</span>
        </div>
      );
    default:
      return <CreditCard className="h-6 w-6 text-white/80" />;
  }
}

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
  const [editingCard, setEditingCard] = useState<FinCreditCard | null>(null);
  const [editing, setEditing] = useState<FinExpense | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const emptyForm = { description: "", category: "administrativa", amount: "", is_recurring: false, installment_total: "", installment_current: "", credit_card_id: "", notes: "", due_day: "10" };
  const [form, setForm] = useState(emptyForm);
  const [cardForm, setCardForm] = useState({ name: "", last_digits: "", closing_day: "1", due_day: "10", brand: "visa" });

  const openNew = (cardId?: string) => { setEditing(null); setForm({ ...emptyForm, credit_card_id: cardId ?? "" }); setDialogOpen(true); };
  const openEdit = (e: FinExpense) => {
    setEditing(e);
    setForm({ description: e.description, category: e.category, amount: String(e.amount), is_recurring: e.is_recurring, installment_total: e.installment_total ? String(e.installment_total) : "", installment_current: e.installment_current ? String(e.installment_current) : "", credit_card_id: e.credit_card_id ?? "", notes: e.notes ?? "", due_day: e.due_day ? String(e.due_day) : "10" });
    setDialogOpen(true);
  };
  const openEditCard = (c: FinCreditCard) => {
    setEditingCard(c);
    setCardForm({ name: c.name, last_digits: c.last_digits || "", closing_day: String(c.closing_day), due_day: String(c.due_day), brand: (c as any).brand || "visa" });
    setCardDialogOpen(true);
  };
  const openNewCard = () => {
    setEditingCard(null);
    setCardForm({ name: "", last_digits: "", closing_day: "1", due_day: "10", brand: "visa" });
    setCardDialogOpen(true);
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
    upsertCard.mutate({ ...(editingCard ? { id: editingCard.id } : {}), name: cardForm.name, last_digits: cardForm.last_digits || null, closing_day: parseInt(cardForm.closing_day) || 1, due_day: parseInt(cardForm.due_day) || 10, brand: cardForm.brand } as any,
      { onSuccess: () => { setCardDialogOpen(false); setEditingCard(null); setCardForm({ name: "", last_digits: "", closing_day: "1", due_day: "10", brand: "visa" }); } });
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
          <Button size="sm" variant="outline" onClick={openNewCard}><CreditCard className="mr-1 h-4 w-4" /> Novo Cartão</Button>
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
            {/* Card Header - Brand gradient style */}
            <button
              onClick={() => toggleCardExpanded(card.id)}
              className={`w-full flex items-center justify-between px-6 py-5 bg-gradient-to-br ${BRAND_GRADIENTS[(card as any).brand ?? "outro"]} text-white`}
              style={{ borderRadius: isExpanded ? "16px 16px 0 0" : "16px" }}
            >
              <div className="flex items-center gap-4">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-white/50 transition-transform" /> : <ChevronRight className="h-4 w-4 text-white/50 transition-transform" />}
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-base">{card.name}</p>
                    <CardBrandLogo brand={(card as any).brand ?? "outro"} className="h-6" />
                  </div>
                  <p className="text-sm text-white/60 font-mono tracking-widest mt-1">
                    •••• •••• •••• {card.last_digits || "****"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-white/50 font-medium">Fatura do mês</p>
                  <p className="text-xl font-bold">R$ {cardTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-white/50 mt-0.5">
                    {cardExpenses.length} itens • Fecha dia {card.closing_day} • Vence dia {card.due_day}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="h-8 text-white hover:bg-white/10 border border-white/20 text-[11px] rounded-lg" onClick={(ev) => { ev.stopPropagation(); openNew(card.id); }}><Plus className="mr-1 h-3 w-3" /> Adicionar</Button>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={cardForm.name} onChange={(e) => setCardForm((p) => ({ ...p, name: e.target.value }))} placeholder="Ex: Nubank" /></div>
              <div className="space-y-2"><Label>Bandeira</Label><Select value={cardForm.brand} onValueChange={(v) => setCardForm((p) => ({ ...p, brand: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CARD_BRANDS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Últimos 4 dígitos</Label><Input value={cardForm.last_digits} onChange={(e) => setCardForm((p) => ({ ...p, last_digits: e.target.value }))} maxLength={4} placeholder="Ex: 1234" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Dia fechamento</Label><Input type="number" value={cardForm.closing_day} onChange={(e) => setCardForm((p) => ({ ...p, closing_day: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Dia vencimento</Label><Input type="number" value={cardForm.due_day} onChange={(e) => setCardForm((p) => ({ ...p, due_day: e.target.value }))} /></div>
            </div>
            {/* Preview */}
            <div className={`rounded-xl p-4 bg-gradient-to-br ${BRAND_GRADIENTS[cardForm.brand]} text-white`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm">{cardForm.name || "Nome do Cartão"}</p>
                  <p className="text-xs text-white/60 font-mono mt-1">•••• •••• •••• {cardForm.last_digits || "****"}</p>
                </div>
                <CardBrandLogo brand={cardForm.brand} className="h-6" />
              </div>
            </div>
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={saveCard} disabled={!cardForm.name}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
