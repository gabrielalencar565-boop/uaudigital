import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinAllRevenues, useFinAllExpenses, useFinClients, useFinRevenues, useFinExpenses, useFinAllTransactions } from "../hooks/use-financial-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FinMonthYearSelector } from "./FinMonthYearSelector";

export function FinFluxoCaixaTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const revenuesQ = useFinRevenues(year, month);
  const expensesQ = useFinExpenses(year, month);
  const clientsQ = useFinClients();
  const transactionsQ = useFinAllTransactions(year);

  const revenues = revenuesQ.data ?? [];
  const expenses = expensesQ.data ?? [];
  const clients = clientsQ.data?.filter((c) => c.is_active) ?? [];
  const transactions = transactionsQ.data ?? [];

  const totalReceita = revenues.filter((r) => r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const totalDespesa = expenses.filter((e) => e.status === "pago").reduce((s, e) => s + Number(e.amount), 0);
  const lucro = totalReceita - totalDespesa;
  const ticketMedio = clients.length > 0 ? totalReceita / clients.length : 0;
  const margemLucro = totalReceita > 0 ? (lucro / totalReceita) * 100 : 0;

  // Caixa = saldo acumulado até o mês selecionado
  const caixaAcumulado = useMemo(() => {
    const monthTxs = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() + 1 <= month;
    });
    return monthTxs.reduce((s, t) => s + (t.type === "entrada" ? Number(t.amount) : -Number(t.amount)), 0);
  }, [transactions, month]);

  // Caixa inicial (transações antes do mês atual)
  const caixaInicial = useMemo(() => {
    const beforeTxs = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() + 1 < month;
    });
    return beforeTxs.reduce((s, t) => s + (t.type === "entrada" ? Number(t.amount) : -Number(t.amount)), 0);
  }, [transactions, month]);

  // Category breakdown for horizontal bar chart
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    // Receita recorrente from revenues
    const receitaRecorrente = revenues.filter((r) => r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
    if (receitaRecorrente > 0) cats["Receita Recorrente"] = receitaRecorrente;

    // Expenses by category
    const catMap: Record<string, string> = {
      operacional: "Despesas Operacionais",
      administrativa: "Despesas Administrativas",
      financeira: "Despesas Financeiras",
      comercial: "Despesas Comerciais",
    };
    expenses.filter((e) => e.status === "pago").forEach((e) => {
      const label = catMap[e.category] || e.category;
      cats[label] = (cats[label] || 0) + Number(e.amount);
    });

    if (caixaInicial !== 0) cats["Caixa"] = Math.abs(caixaInicial);

    return Object.entries(cats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [revenues, expenses, caixaInicial]);

  return (
    <div className="space-y-6">
      <FinMonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />

      {/* KPIs Row 1 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Receita</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Despesa</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">R$ {totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
      </div>

      {/* KPIs Row 2 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Lucro</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${lucro >= 0 ? "text-success" : "text-destructive"}`}>
              {lucro < 0 ? "-" : ""}R$ {Math.abs(lucro).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Caixa</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${caixaAcumulado >= 0 ? "text-success" : "text-destructive"}`}>
              {caixaAcumulado < 0 ? "-" : ""}R$ {Math.abs(caixaAcumulado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Row 3 - Margem Ring + Clientes + Ticket + Caixa Inicial */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col items-center justify-center py-4">
          <CardTitle className="text-sm font-medium uppercase mb-3">Margem de Lucro</CardTitle>
          <ProgressRing
            value={Math.min(Math.abs(margemLucro), 100)}
            size={120}
            stroke={12}
            tone={margemLucro >= 20 ? "success" : margemLucro >= 0 ? "warning" : "danger"}
            label={<span className={`text-xl font-bold ${margemLucro >= 0 ? "" : "text-destructive"}`}>{margemLucro.toFixed(0)}%</span>}
          />
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Clientes</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{clients.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Ticket Médio</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Caixa Inicial</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">R$ {Math.abs(caixaInicial).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Horizontal Bar Chart by Category */}
      <Card>
        <CardHeader><CardTitle className="text-base">Fluxo por Categoria</CardTitle></CardHeader>
        <CardContent>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, categoryData.length * 50)}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" tickFormatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                <YAxis type="category" dataKey="name" className="text-xs" width={140} />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Bar dataKey="value" name="Valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum dado para o mês selecionado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
