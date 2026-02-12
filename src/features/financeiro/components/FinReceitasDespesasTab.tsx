import { useState, useMemo } from "react";
import { CheckCircle2, Circle, DollarSign, TrendingDown, TrendingUp, Receipt, CreditCard, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinClients, useFinRevenues, useUpsertFinRevenue, useFinExpenses, useUpsertFinExpense, useFinCreditCards } from "../hooks/use-financial-data";
import { FinMonthYearSelector } from "./FinMonthYearSelector";

export function FinReceitasDespesasTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const clientsQ = useFinClients();
  const revenuesQ = useFinRevenues(year, month);
  const expensesQ = useFinExpenses(year, month);
  const cardsQ = useFinCreditCards();
  const upsertRev = useUpsertFinRevenue();
  const upsertExp = useUpsertFinExpense();

  const clients = (clientsQ.data?.filter((c) => c.is_active) ?? []).sort((a, b) => (a.due_day ?? 10) - (b.due_day ?? 10));
  const revenues = revenuesQ.data ?? [];
  const allExpenses = expensesQ.data ?? [];
  const cards = cardsQ.data ?? [];

  const today = now.getDate();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  // Separate: non-card expenses shown individually, card expenses grouped per card
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

  const revByClient = useMemo(() => {
    const map = new Map(revenues.map((r) => [r.client_id, r]));
    return map;
  }, [revenues]);

  const totalFaturamento = clients.reduce((s, c) => s + Number(c.monthly_value), 0);
  const lucro = totalFaturamento - totalDespesas;
  const ticketMedio = clients.length > 0 ? totalFaturamento / clients.length : 0;
  const margemLucro = totalFaturamento > 0 ? (lucro / totalFaturamento) * 100 : 0;

  // Revenue stats
  const revPaid = clients.filter(c => revByClient.get(c.id)?.status === "pago").length;
  const revTotal = clients.length;
  const revPending = revTotal - revPaid;
  const revOverdue = isCurrentMonth ? clients.filter(c => {
    const rev = revByClient.get(c.id);
    const paid = rev?.status === "pago";
    const dueDay = c.due_day ?? 10;
    return !paid && today > dueDay;
  }).length : 0;
  const revProgress = revTotal > 0 ? (revPaid / revTotal) * 100 : 0;

  // Remaining to receive
  const totalPaidRevenue = clients.filter(c => revByClient.get(c.id)?.status === "pago").reduce((s, c) => s + Number(c.monthly_value), 0);
  const remainingToReceive = totalFaturamento - totalPaidRevenue;

  // Build combined expense display items for counting
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

  // Remaining expenses to pay
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
      case "paid": return "line-through opacity-60";
      case "overdue": return "text-destructive font-semibold";
      case "due-today": return "text-yellow-600 dark:text-yellow-400 font-semibold";
      default: return "";
    }
  };

  const toggleRevStatus = (clientId: string) => {
    const existing = revByClient.get(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    if (existing) {
      const newStatus = existing.status === "pago" ? "pendente" : "pago";
      upsertRev.mutate({
        id: existing.id, client_id: clientId, year, month,
        amount: Number(client.monthly_value), status: newStatus,
        paid_at: newStatus === "pago" ? new Date().toISOString() : null,
      });
    } else {
      upsertRev.mutate({
        client_id: clientId, year, month,
        amount: Number(client.monthly_value), status: "pago",
        paid_at: new Date().toISOString(),
      });
    }
  };

  const toggleExpStatus = (exp: typeof allExpenses[0]) => {
    const newStatus = exp.status === "pago" ? "pendente" : "pago";
    upsertExp.mutate({
      id: exp.id, description: exp.description, category: exp.category,
      year, month, amount: Number(exp.amount), status: newStatus,
      paid_at: newStatus === "pago" ? new Date().toISOString() : null,
    } as any);
  };

  const toggleCardStatus = (cardId: string) => {
    const cs = cardSummaries.find(c => c.card.id === cardId);
    if (!cs) return;
    const newStatus = cs.allPaid ? "pendente" : "pago";
    cs.expenses.forEach(exp => {
      upsertExp.mutate({
        id: exp.id, description: exp.description, category: exp.category,
        year, month, amount: Number(exp.amount), status: newStatus,
        paid_at: newStatus === "pago" ? new Date().toISOString() : null,
      } as any);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <FinMonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
      </div>

      {/* Dashboard KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">R$ {totalFaturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lucro</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${lucro >= 0 ? "text-success" : "text-destructive"}`}>
              {lucro < 0 ? "-" : ""}R$ {Math.abs(lucro).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card className="flex flex-col items-center justify-center py-4">
          <span className="text-sm font-medium text-muted-foreground mb-2">Clientes Ativos</span>
          <ProgressRing
            value={Math.min(clients.length * 5, 100)}
            size={100}
            stroke={10}
            tone="primary"
            label={<span className="text-3xl font-bold">{clients.length}</span>}
          />
        </Card>
        <Card className="flex flex-col items-center justify-center py-4">
          <span className="text-sm font-medium text-muted-foreground mb-2">Margem de Lucro</span>
          <ProgressRing
            value={Math.min(Math.abs(margemLucro), 100)}
            size={100}
            stroke={10}
            tone={margemLucro >= 20 ? "success" : margemLucro >= 0 ? "warning" : "danger"}
            label={<span className={`text-2xl font-bold ${margemLucro >= 0 ? "text-success" : "text-destructive"}`}>{margemLucro.toFixed(0)}%</span>}
          />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Receitas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold uppercase">Receita Fixa Mensal</CardTitle>
              <Badge variant="outline">{revPaid}/{revTotal}</Badge>
            </div>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pendentes: {revPending}
              </span>
              {revOverdue > 0 && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Atrasadas: {revOverdue}
                </span>
              )}
              <span className="text-xs font-semibold">
                Falta: R$ {remainingToReceive.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Progress value={revProgress} className="h-2 mt-2" />
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-semibold">Nome</th>
                  <th className="px-4 py-2 text-center font-semibold">Data</th>
                  <th className="px-4 py-2 text-right font-semibold">Valor</th>
                  <th className="px-4 py-2 text-center font-semibold">Pagamento</th>
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
                      <td className={`px-4 py-2.5 text-center ${rowClasses}`}>Dia {dueDay}</td>
                      <td className={`px-4 py-2.5 text-right ${rowClasses}`}>R$ {Number(c.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => toggleRevStatus(c.id)} className="inline-flex items-center justify-center">
                          {paid
                            ? <CheckCircle2 className="h-5 w-5 text-success" />
                            : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {clients.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhum cliente ativo</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Despesas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold uppercase">Despesa Fixa Mensal</CardTitle>
              <Badge variant="outline">{expPaid}/{expTotal}</Badge>
            </div>
            <div className="flex gap-3 mt-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> Pendentes: {expPending}
              </span>
              {expOverdue > 0 && (
                <span className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Atrasadas: {expOverdue}
                </span>
              )}
              <span className="text-xs font-semibold">
                Falta: R$ {remainingToPay.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Progress value={expProgress} className="h-2 mt-2" />
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-semibold">Nome</th>
                  <th className="px-4 py-2 text-center font-semibold">Data</th>
                  <th className="px-4 py-2 text-right font-semibold">Valor</th>
                  <th className="px-4 py-2 text-center font-semibold">Pagamento</th>
                </tr>
              </thead>
              <tbody>
                {/* All expense items sorted by due day */}
                {allExpenseItems.map((item) => {
                  const status = getRowStatus(item.dueDay, item.paid);
                  const rowClasses = getRowClasses(status);

                  if (item.isCard) {
                    const cs = cardSummaries.find(c => c.card.id === item.cardId)!;
                    return (
                      <tr key={`card-${cs.card.id}`} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                        <td className={`px-4 py-2.5 font-medium flex items-center gap-2 ${rowClasses}`}>
                          <CreditCard className="h-4 w-4 text-primary shrink-0" />
                          {cs.card.name}
                          {cs.card.last_digits && <span className="text-xs text-muted-foreground">****{cs.card.last_digits}</span>}
                          <Badge variant="secondary" className="text-xs ml-1">{cs.count} itens</Badge>
                        </td>
                        <td className={`px-4 py-2.5 text-center ${rowClasses}`}>Dia {cs.card.due_day}</td>
                        <td className={`px-4 py-2.5 text-right ${rowClasses}`}>R$ {cs.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => toggleCardStatus(cs.card.id)} className="inline-flex items-center justify-center">
                            {cs.allPaid
                              ? <CheckCircle2 className="h-5 w-5 text-success" />
                              : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  const exp = nonCardExpenses.find(e => e.id === item.expId)!;
                  return (
                    <tr key={exp.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                      <td className={`px-4 py-2.5 font-medium ${rowClasses}`}>{exp.description}</td>
                      <td className={`px-4 py-2.5 text-center ${rowClasses}`}>Dia {exp.due_day ?? 10}</td>
                      <td className={`px-4 py-2.5 text-right ${rowClasses}`}>R$ {Number(exp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => toggleExpStatus(exp)} className="inline-flex items-center justify-center">
                          {exp.status === "pago"
                            ? <CheckCircle2 className="h-5 w-5 text-success" />
                            : <Circle className="h-5 w-5 text-destructive hover:text-primary transition-colors" />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {allExpenseItems.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhuma despesa cadastrada</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
