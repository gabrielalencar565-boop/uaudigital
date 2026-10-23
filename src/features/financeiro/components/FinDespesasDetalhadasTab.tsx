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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useFinExpenses, useUpsertFinExpense, useDeleteFinExpense,
  useFinCreditCards, useUpsertFinCreditCard, useFinAllExpenses, useSaveRecurringExpense,
  type FinExpense, type FinCreditCard
} from "../hooks/use-financial-data";
import { FinMonthYearSelector } from "./FinMonthYearSelector";
import { buildEffectiveExpenses } from "../utils/build-effective-expenses";

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const monthLabel = (index: number) => `${MONTH_NAMES[((index % 12) + 12) % 12]}/${Math.floor(index / 12)}`;

const CATEGORIES = [
  { value: "administrativa", label: "Administrativa" },
  { value: "operacional", label: "Operacional" },
  { value: "financeira", label: "Financeira" },
  { value: "comercial", label: "Comercial" },
  { value: "investimento", label: "Investimento" },
];

const CATEGORY_COLORS: Record<string, string> = {
  administrativa: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  operacional: "bg-red-500/10 text-red-600 border-red-500/20",
  financeira: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  comercial: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  investimento: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

const CARD_BRANDS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
  { value: "nubank", label: "Nubank" },
  { value: "outro", label: "Outro" },
];

const BRAND_GRADIENTS: Record<string, string> = {
  visa: "from-blue-900 to-blue-700",
  mastercard: "from-gray-900 to-gray-700",
  elo: "from-yellow-900 to-yellow-700",
  amex: "from-emerald-900 to-emerald-700",
  hipercard: "from-red-900 to-red-700",
  nubank: "from-white to-gray-100",
  outro: "from-slate-900 to-slate-800",
};

const BRAND_TEXT_DARK: Record<string, boolean> = {
  nubank: true,
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
    case "nubank":
      return (
        <div className={`${className} flex items-center`}>
          <span className="font-black text-sm tracking-tight text-purple-600">Nu</span>
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
  const saveRecurring = useSaveRecurringExpense();
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
  const emptyForm = { description: "", category: "administrativa", amount: "", kind: "unica" as "unica" | "parcelada" | "recorrente", installment_total: "", first_month: String(month), first_year: String(year), credit_card_id: "", notes: "", due_day: "10" };
  const [form, setForm] = useState(emptyForm);
  const [cardForm, setCardForm] = useState({ name: "", last_digits: "", closing_day: "1", due_day: "10", brand: "visa" });

  // A parcela deste mês e o mês dela dizem em que mês caiu a 1ª parcela (é o que a pessoa lembra quando comprou)
  const firstInstallmentOf = (e: FinExpense) => {
    if (!e.installment_total || !e.installment_current) return { first_month: String(month), first_year: String(year) };
    const idx = e.year * 12 + (e.month - 1) - (e.installment_current - 1);
    return { first_month: String((((idx % 12) + 12) % 12) + 1), first_year: String(Math.floor(idx / 12)) };
  };
  const openNew = (cardId?: string) => { setEditing(null); setForm({ ...emptyForm, credit_card_id: cardId ?? "" }); setDialogOpen(true); };
  const openEdit = (e: FinExpense) => {
    setEditing(e);
    setForm({ description: e.description, category: e.category, amount: String(e.amount), kind: (e.installment_total ? "parcelada" : e.is_recurring ? "recorrente" : "unica") as "unica" | "parcelada" | "recorrente", installment_total: e.installment_total ? String(e.installment_total) : "", ...firstInstallmentOf(e), credit_card_id: e.credit_card_id ?? "", notes: e.notes ?? "", due_day: e.due_day ? String(e.due_day) : "10" });
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

  // Parcelamento: a partir de "total" e do mês da 1ª parcela, descobre o mês onde a despesa fica gravada e qual parcela é
  const installmentPlan = useMemo(() => {
    if (form.kind !== "parcelada") return null;
    const total = parseInt(form.installment_total);
    if (!total || total < 1) return null;
    const firstIndex = parseInt(form.first_year) * 12 + (parseInt(form.first_month) - 1);
    if (Number.isNaN(firstIndex)) return null;
    const viewedIndex = year * 12 + (month - 1);
    const lastIndex = firstIndex + total - 1;
    const ended = lastIndex < viewedIndex;
    const future = firstIndex > viewedIndex;
    // grava no mês que está aberto (ou, se a 1ª parcela ainda vai chegar, no mês dela)
    const anchorIndex = future ? firstIndex : viewedIndex;
    return {
      total, firstIndex, lastIndex, ended, future,
      current: future ? 1 : viewedIndex - firstIndex + 1,
      anchorYear: Math.floor(anchorIndex / 12), anchorMonth: (anchorIndex % 12) + 1,
    };
  }, [form.kind, form.installment_total, form.first_month, form.first_year, year, month]);

  const save = () => {
    const plan = form.kind === "parcelada" ? installmentPlan : null;
    const common = {
      description: form.description, category: form.category, amount: parseFloat(form.amount) || 0,
      credit_card_id: form.credit_card_id && form.credit_card_id !== "none" ? form.credit_card_id : null, notes: form.notes || null, due_day: parseInt(form.due_day) || 10,
    };
    // Recorrente já existente: o reajuste vale deste mês para a frente, os meses anteriores ficam como estavam
    if (editing && editing.is_recurring && !editing.installment_total && form.kind === "recorrente") {
      saveRecurring.mutate({ original: editing, year, month, changes: { ...common, status: "pendente", paid_at: null } },
        { onSuccess: () => { setDialogOpen(false); toast.success("Despesa salva — vale deste mês em diante"); } });
      return;
    }
    // Recorrente nova: vale a partir do mês escolhido
    if (form.kind === "recorrente") {
      upsertExp.mutate({
        ...(editing ? { id: editing.id } : {}), ...common, year: parseInt(form.first_year) || year, month: parseInt(form.first_month) || month,
        status: "pendente", paid_at: null, is_recurring: true, installment_total: null, installment_current: null, starts_at_month: true,
      } as any, { onSuccess: () => setDialogOpen(false) });
      return;
    }
    upsertExp.mutate({
      ...(editing ? { id: editing.id } : {}), ...common,
      year: plan ? plan.anchorYear : year, month: plan ? plan.anchorMonth : month, status: "pendente", is_recurring: false,
      installment_total: plan ? plan.total : null, installment_current: plan ? plan.current : null, starts_at_month: false, paid_at: null,
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
      <div className="flex flex-wrap items-center justify-between gap-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <FinMonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={openNewCard}><CreditCard className="mr-1 h-4 w-4" /> Novo Cartão</Button>
          <Button size="sm" onClick={() => openNew()}><Plus className="mr-1 h-4 w-4" /> Nova Despesa</Button>
        </div>
      </div>

      {/* Credit Cards Grid */}
      {cards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
          {cards.map((card) => {
            const cardExpenses = expenses.filter((e) => e.credit_card_id === card.id);
            const cardTotal = cardExpenses.reduce((s, e) => s + Number(e.amount), 0);
            const brand = (card as any).brand ?? "visa";
            const isDark = BRAND_TEXT_DARK[brand];
            const txtMain = isDark ? "text-gray-900" : "text-white";
            const txtSub = isDark ? "text-gray-500" : "text-white/50";
            const txtNum = isDark ? "text-gray-800" : "text-white/90";
            const txtBtn = isDark ? "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50" : "text-white/70 hover:text-white hover:bg-white/10";
            const circleColor = isDark ? "bg-gray-200/40" : "bg-white/5";
            return (
              <div key={card.id} className="group relative">
                <div
                  className={`relative rounded-xl p-4 bg-gradient-to-br ${BRAND_GRADIENTS[brand]} ${txtMain} flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl overflow-hidden`}
                  style={{ minHeight: 160 }}
                  onClick={() => toggleCardExpanded(card.id)}
                >
                  <div className={`absolute top-0 right-0 w-28 h-28 rounded-full ${circleColor} -translate-y-6 translate-x-6`} />
                  <div className={`absolute bottom-0 left-0 w-20 h-20 rounded-full ${circleColor} translate-y-5 -translate-x-5`} />

                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-5 rounded bg-gradient-to-br from-yellow-300/80 to-yellow-500/80 border border-yellow-400/30" />
                      <div>
                        <p className="font-bold text-sm leading-tight">{card.name}</p>
                        <p className={`text-[9px] ${txtSub} mt-0.5`}>Fecha {card.closing_day} • Vence {card.due_day}</p>
                      </div>
                    </div>
                    <CardBrandLogo brand={brand} className="h-6" />
                  </div>

                  <p className={`font-mono text-sm tracking-[0.2em] ${txtNum} relative z-10 my-2`}>
                    •••• •••• •••• {card.last_digits || "****"}
                  </p>

                  <div className="flex items-end justify-between relative z-10">
                    <div>
                      <p className={`text-[8px] uppercase tracking-wider ${txtSub} font-medium`}>Fatura</p>
                      <p className="text-base font-bold leading-tight">R$ {cardTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      <p className={`text-[9px] ${txtSub}`}>{cardExpenses.length} itens</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className={`h-6 ${txtBtn} text-[9px] px-1.5`} onClick={(ev) => { ev.stopPropagation(); openEditCard(card); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className={`h-6 ${txtBtn} text-[9px] px-1.5`} onClick={(ev) => { ev.stopPropagation(); openNew(card.id); }}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Expanded Card Expenses */}
      {cards.map((card) => {
        const cardExpenses = expenses.filter((e) => e.credit_card_id === card.id);
        const isExpanded = expandedCards.has(card.id);
        if (!isExpanded) return null;
        return (
          <Card key={`exp-${card.id}`} className="p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{card.name}</span>
                <span className="text-xs text-muted-foreground">• {cardExpenses.length} itens</span>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleCardExpanded(card.id)}>Fechar</Button>
            </div>
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
            <div className="space-y-2">
              <Label>Tipo da despesa</Label>
              <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/50 bg-muted/30 p-1">
                {([["unica", "Única"], ["parcelada", "Parcelada"], ["recorrente", "Recorrente"]] as const).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setForm((p) => ({ ...p, kind: k }))}
                    className={cn("rounded-lg px-3 py-1.5 text-sm transition-colors", form.kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {form.kind === "unica" && "Uma conta só, que vale apenas para este mês."}
                {form.kind === "parcelada" && "Compra dividida em parcelas: o app conta sozinho qual parcela cai em cada mês."}
                {form.kind === "recorrente" && "Conta que se repete todo mês (salário, aluguel, internet...)."}
              </p>
            </div>
            {form.kind === "parcelada" && (
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Total de parcelas</Label><Input type="number" min={1} value={form.installment_total} onChange={(e) => setForm((p) => ({ ...p, installment_total: e.target.value }))} placeholder="Ex: 12 (vazio = sem parcelas)" /></div>
                  <div className="space-y-2">
                    <Label>Mês da 1ª parcela</Label>
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <Select value={form.first_month} onValueChange={(v) => setForm((p) => ({ ...p, first_month: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTH_NAMES.map((n, i) => <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent></Select>
                      <Input type="number" className="w-20" value={form.first_year} onChange={(e) => setForm((p) => ({ ...p, first_year: e.target.value }))} />
                    </div>
                  </div>
                </div>
                {installmentPlan && form.installment_total && (() => {
                  const perInstallment = parseFloat(form.amount) || 0;
                  const monthName = monthLabel(year * 12 + (month - 1));
                  const left = installmentPlan.future ? installmentPlan.total : installmentPlan.total - installmentPlan.current + 1; // este mês incluído
                  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                  return installmentPlan.ended ? (
                    <p className="text-xs text-destructive">
                      Com a 1ª parcela em {monthLabel(installmentPlan.firstIndex)}, a última ({installmentPlan.total}/{installmentPlan.total}) foi em {monthLabel(installmentPlan.lastIndex)}, antes de {monthName}. Confira o mês da 1ª parcela.
                    </p>
                  ) : (
                    <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs">
                      <div className="font-medium text-foreground">
                        {installmentPlan.future
                          ? `A 1ª parcela começa em ${monthLabel(installmentPlan.firstIndex)}`
                          : `Em ${monthName} é a parcela ${installmentPlan.current} de ${installmentPlan.total}`}
                      </div>
                      <div className="flex justify-between text-muted-foreground"><span>Já pagas</span><span>{installmentPlan.future ? 0 : installmentPlan.current - 1}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Faltam{installmentPlan.future ? "" : " (com este mês)"}</span><span>{left}{perInstallment > 0 ? ` · ${fmt(left * perInstallment)}` : ""}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Última parcela</span><span>{monthLabel(installmentPlan.lastIndex)}</span></div>
                      {perInstallment > 0 && <div className="flex justify-between text-muted-foreground"><span>Valor total do parcelamento</span><span>{fmt(installmentPlan.total * perInstallment)}</span></div>}
                    </div>
                  );
                })()}
              </div>
            )}
            {form.kind === "recorrente" && (
              editing && editing.is_recurring && !editing.installment_total ? (
                <div className="space-y-1 rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div className="font-medium text-foreground">Reajuste: vale de {monthLabel(year * 12 + (month - 1))} em diante</div>
                  <div>Os meses anteriores continuam com o valor que tinham. Para mudar o valor só a partir de outro mês, abra esse mês e edite lá.</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Vale a partir de</Label>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Select value={form.first_month} onValueChange={(v) => setForm((p) => ({ ...p, first_month: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MONTH_NAMES.map((n, i) => <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent></Select>
                    <Input type="number" className="w-20" value={form.first_year} onChange={(e) => setForm((p) => ({ ...p, first_year: e.target.value }))} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Entra todo mês, de {monthLabel(parseInt(form.first_year) * 12 + (parseInt(form.first_month) - 1))} até o fim do ano. Quando o valor mudar (reajuste), edite a despesa no mês da mudança: o novo valor vale dali em diante.
                  </p>
                </div>
              )
            )}
          </div>
          <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={save} disabled={!form.description || upsertExp.isPending || saveRecurring.isPending || (form.kind === "parcelada" && (!installmentPlan || installmentPlan.ended))}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card dialog */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCard ? "Editar Cartão" : "Novo Cartão de Crédito"}</DialogTitle></DialogHeader>
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
