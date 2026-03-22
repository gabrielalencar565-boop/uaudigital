import { useState, useMemo } from "react";
import { CheckCircle2, Circle, DollarSign, TrendingDown, TrendingUp, Receipt, CreditCard, AlertCircle, Clock } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinClients, useFinRevenues, useUpsertFinRevenue, useFinExpenses, useUpsertFinExpense, useFinCreditCards, useFinAllExpenses } from "../hooks/use-financial-data";
import { FinMonthYearSelector } from "./FinMonthYearSelector";
import { FinMetricCard } from "./FinMetricCard";
import { buildEffectiveExpenses } from "../utils/build-effective-expenses";

export function FinReceitasDespesasTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const clientsQ = useFinClients();
  const revenuesQ = useFinRevenues(year, month);
  const expensesQ = useFinExpenses(year, month);
  const allYearExpensesQ = useFinAllExpenses(year);
  const cardsQ = useFinCreditCards();
  const upsertRev = useUpsertFinRevenue();
  const upsertExp = useUpsertFinExpense();

  const clients = (clientsQ.data?.filter((c) => c.is_active) ?? []).sort((a, b) => (a.due_day ?? 10) - (b.due_day ?? 10));
  const revenues = revenuesQ.data ?? [];
  const allExpenses = useMemo(
    () => buildEffectiveExpenses(expensesQ.data ?? [], allYearExpensesQ.data ?? [], month, year),
    [expensesQ.data, allYearExpensesQ.data, month, year],
  );
  const cards = cardsQ.data ?? [];

  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const nonCardExpenses = useMemo(() => allExpenses.filter(e => !e.credit_card_id).sort((a, b) => (a.due_day ?? 10) - (b.due_day ?? 10)), [allExpenses]);
  const cardSummaries = useMemo(() => {
    return cards.map(card => {
      const cardExps = allExpenses.filter(e => e.credit_card_id === card.id);
      const total = cardExps.reduce((s, e) => s + Number(e.amount), 0);
      const allPaid = cardExps.length > 0 && cardExps.every(e => e.status === "pago");
      return { card, total, count: cardExps.length, allPaid, expenses: cardExps };
    }).filter(cs => cs.count > 0);
  }, [cards, allExpenses]);

  const totalDespesas = allExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const revByClient = useMemo(() => new Map(revenues.map((r) => [r.client_id, r])), [revenues]);
  const totalFaturamento = clients.reduce((s, c) => s + Number(c.monthly_value), 0);
  const lucro = totalFaturamento - totalDespesas;
  const ticketMedio = clients.length > 0 ? totalFaturamento / clients.length : 0;
  const margemLucro = totalFaturamento > 0 ? (lucro / totalFaturamento) * 100 : 0;

  const revPaid = clients.filter(c => revByClient.get(c.id)?.status === "pago").length;
  const revTotal = clients.length;
  const revPending = revTotal - revPaid;
  const revOverdue = isCurrentMonth ? clients.filter(c => {
    const rev = revByClient.get(c.id);
    return rev?.status !== "pago" && today > (c.due_day ?? 10);
  }).length : 0;
  const revProgress = revTotal > 0 ? (revPaid / revTotal) * 100 : 0;
  const totalPaidRevenue = clients.filter(c => revByClient.get(c.id)?.status === "pago").reduce((s, c) => s + Number(c.monthly_value), 0);
  const remainingToReceive = totalFaturamento - totalPaidRevenue;

  type ExpenseDisplayItem = { dueDay: number; paid: boolean; isCard: boolean; cardId?: string; expId?: string; description: string; amount: number };
  const allExpenseItems = useMemo<ExpenseDisplayItem[]>(() => {
    const items: ExpenseDisplayItem[] = [];
    cardSummaries.forEach(cs => items.push({ dueDay: cs.card.due_day, paid: cs.allPaid, isCard: true, cardId: cs.card.id, description: cs.card.name, amount: cs.total }));
    nonCardExpenses.forEach(e => items.push({ dueDay: e.due_day ?? 10, paid: e.status === "pago", isCard: false, expId: e.id, description: e.description, amount: Number(e.amount) }));
    return items.sort((a, b) => a.dueDay - b.dueDay);
  }, [cardSummaries, nonCardExpenses]);

  const expPaid = allExpenseItems.filter(i => i.paid).length;
  const expTotal = allExpenseItems.length;
  const expPending = expTotal - expPaid;
  const expOverdue = isCurrentMonth ? allExpenseItems.filter(i => !i.paid && today > i.dueDay).length : 0;
  const expProgress = expTotal > 0 ? (expPaid / expTotal) * 100 : 0;
  const totalPaidExpenses = allExpenseItems.filter(i => i.paid).reduce((s, i) => s + i.amount, 0);
  const remainingToPay = totalDespesas - totalPaidExpenses;

  const getRowStatus = (dueDay: number, paid: boolean) => {
    if (paid) return "paid";
    if (!isCurrentMonth) return "normal";
    if (today > dueDay) return "overdue";
    if (today === dueDay) return "due-today";
    return "normal";
  };
  const getRowClasses = (status: string) => {
    switch (status) {
      case "paid": return "line-through opacity-50";
      case "overdue": return "text-destructive font-semibold";
      case "due-today": return "text-warning font-semibold";
      default: return "";
    }
  };

  const toggleRevStatus = (clientId: string) => {
    const existing = revByClient.get(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    if (existing) {
      const newStatus = existing.status === "pago" ? "pendente" : "pago";
      upsertRev.mutate({ id: existing.id, client_id: clientId, year, month, amount: Number(client.monthly_value), status: newStatus, paid_at: newStatus === "pago" ? new Date().toISOString() : null });
    } else {
      upsertRev.mutate({ client_id: clientId, year, month, amount: Number(client.monthly_value), status: "pago", paid_at: new Date().toISOString() });
    }
  };

  const toggleExpStatus = (exp: typeof allExpenses[0]) => {
    const newStatus = exp.status === "pago" ? "pendente" : "pago";
    upsertExp.mutate({ id: exp.id, description: exp.description, category: exp.category, year, month, amount: Number(exp.amount), status: newStatus, paid_at: newStatus === "pago" ? new Date().toISOString() : null } as any);
  };

  const toggleCardStatus = (cardId: string) => {
    const cs = cardSummaries.find(c => c.card.id === cardId);
    if (!cs) return;
    const newStatus = cs.allPaid ? "pendente" : "pago";
    cs.expenses.forEach(exp => {
      upsertExp.mutate({ id: exp.id, description: exp.description, category: exp.category, year, month, amount: Number(exp.amount), status: newStatus, paid_at: newStatus === "pago" ? new Date().toISOString() : null } as any);
    });
  };

  return (
    <div className="space-y-6">
      <div className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <FinMonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
      </div>

      {/* Dashboard KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <FinMetricCard title="Faturamento" value={totalFaturamento} tone="success" icon={<DollarSign className="h-4 w-4" />} />
        <FinMetricCard title="Despesas" value={totalDespesas} tone="danger" icon={<TrendingDown className="h-4 w-4" />} />
        <FinMetricCard title="Lucro" value={Math.abs(lucro)} tone={lucro >= 0 ? "success" : "danger"} prefix={lucro < 0 ? "-R$" : "R$"} icon={<TrendingUp className="h-4 w-4" />} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.15s" }}>
        <FinMetricCard title="Ticket Médio" value={ticketMedio} icon={<Receipt className="h-4 w-4" />} />
        <Card className="flex flex-col items-center justify-center p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Clientes Pagos</span>
          <ProgressRing
            value={revTotal > 0 ? revProgress : 0}
            size={90}
            stroke={8}
            tone={revProgress >= 100 ? "success" : revProgress >= 50 ? "primary" : "warning"}
            label={<AnimatedNumber value={revPaid} className="text-2xl font-bold" glow={false} />}
          />
        </Card>
        <Card className="flex flex-col items-center justify-center p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Margem de Lucro</span>
          <ProgressRing
            value={Math.min(Math.abs(margemLucro), 100)}
            size={90}
            stroke={8}
            tone={margemLucro >= 20 ? "success" : margemLucro >= 0 ? "warning" : "danger"}
            label={<AnimatedNumber value={Math.round(margemLucro)} suffix="%" className={`text-xl font-bold ${margemLucro >= 0 ? "text-success" : "text-destructive"}`} glow={false} />}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Receitas */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.2s" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Receita Fixa Mensal</CardTitle>
              <Badge variant="outline" className="font-mono">{revPaid}/{revTotal}</Badge>
            </div>
            <div className="flex gap-3 mt-1.5">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Pendentes: {revPending}</span>
              {revOverdue > 0 && <span className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Atrasadas: {revOverdue}</span>}
              <span className="text-[10px] font-semibold">Falta: R$ {remainingToReceive.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <Progress value={revProgress} className="h-1.5 mt-2" />
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Valor</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const rev = revByClient.get(c.id);
                  const paid = rev?.status === "pago";
                  const dueDay = c.due_day ?? 10;
                  const status = getRowStatus(dueDay, paid);
                  const rowClasses = getRowClasses(status);
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                      <td className={`px-4 py-2.5 font-medium ${rowClasses}`}>{c.name}</td>
                      <td className={`px-4 py-2.5 text-center text-muted-foreground ${rowClasses}`}>Dia {dueDay}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${rowClasses}`}>R$ {Number(c.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => toggleRevStatus(c.id)} className="inline-flex items-center justify-center transition-transform hover:scale-110">
                          {paid ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {clients.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum cliente ativo</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.25s" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold uppercase tracking-wider">Despesa Fixa Mensal</CardTitle>
              <Badge variant="outline" className="font-mono">{expPaid}/{expTotal}</Badge>
            </div>
            <div className="flex gap-3 mt-1.5">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Pendentes: {expPending}</span>
              {expOverdue > 0 && <span className="text-[10px] text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Atrasadas: {expOverdue}</span>}
              <span className="text-[10px] font-semibold">Falta: R$ {remainingToPay.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <Progress value={expProgress} className="h-1.5 mt-2" />
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Valor</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {allExpenseItems.map((item) => {
                  const status = getRowStatus(item.dueDay, item.paid);
                  const rowClasses = getRowClasses(status);
                  if (item.isCard) {
                    const cs = cardSummaries.find(c => c.card.id === item.cardId)!;
                    return (
                      <tr key={`card-${cs.card.id}`} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                        <td className={`px-4 py-2.5 font-medium flex items-center gap-2 ${rowClasses}`}>
                          <CreditCard className="h-3.5 w-3.5 text-primary shrink-0" />
                          {cs.card.name}
                          {cs.card.last_digits && <span className="text-[10px] text-muted-foreground">****{cs.card.last_digits}</span>}
                          <Badge variant="secondary" className="text-[9px] ml-1">{cs.count}</Badge>
                        </td>
                        <td className={`px-4 py-2.5 text-center text-muted-foreground ${rowClasses}`}>Dia {cs.card.due_day}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${rowClasses}`}>R$ {cs.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => toggleCardStatus(cs.card.id)} className="inline-flex items-center justify-center transition-transform hover:scale-110">
                            {cs.allPaid ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
                          </button>
                        </td>
                      </tr>
                    );
                  }
                  const exp = nonCardExpenses.find(e => e.id === item.expId)!;
                  return (
                    <tr key={exp.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                      <td className={`px-4 py-2.5 font-medium ${rowClasses}`}>{exp.description}</td>
                      <td className={`px-4 py-2.5 text-center text-muted-foreground ${rowClasses}`}>Dia {exp.due_day ?? 10}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${rowClasses}`}>R$ {Number(exp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => toggleExpStatus(exp)} className="inline-flex items-center justify-center transition-transform hover:scale-110">
                          {exp.status === "pago" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {allExpenseItems.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhuma despesa cadastrada</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
