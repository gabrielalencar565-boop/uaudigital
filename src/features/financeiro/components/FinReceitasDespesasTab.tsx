import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, DollarSign, TrendingDown, TrendingUp, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useFinClients, useFinRevenues, useUpsertFinRevenue, useFinExpenses, useUpsertFinExpense } from "../hooks/use-financial-data";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const EXPENSE_CATEGORIES = [
  { key: "administrativa", label: "Administrativas" },
  { key: "operacional", label: "Operacionais" },
  { key: "financeira", label: "Financeiras" },
  { key: "comercial", label: "Comerciais" },
];

export function FinReceitasDespesasTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const clientsQ = useFinClients();
  const revenuesQ = useFinRevenues(year, month);
  const expensesQ = useFinExpenses(year, month);
  const upsertRev = useUpsertFinRevenue();
  const upsertExp = useUpsertFinExpense();

  const clients = clientsQ.data?.filter((c) => c.is_active) ?? [];
  const revenues = revenuesQ.data ?? [];
  const expenses = expensesQ.data ?? [];

  const revByClient = useMemo(() => {
    const map = new Map(revenues.map((r) => [r.client_id, r]));
    return map;
  }, [revenues]);

  // Dashboard metrics
  const totalFaturamento = revenues.filter((r) => r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const totalDespesas = expenses.filter((e) => e.status === "pago").reduce((s, e) => s + Number(e.amount), 0);
  const lucro = totalFaturamento - totalDespesas;
  const ticketMedio = clients.length > 0 ? totalFaturamento / clients.length : 0;

  const revPaid = revenues.filter((r) => r.status === "pago").length;
  const revTotal = clients.length;
  const revProgress = revTotal > 0 ? (revPaid / revTotal) * 100 : 0;

  const expPaid = expenses.filter((e) => e.status === "pago").length;
  const expTotal = expenses.length;
  const expProgress = expTotal > 0 ? (expPaid / expTotal) * 100 : 0;

  const toggleRevStatus = (clientId: string) => {
    const existing = revByClient.get(clientId);
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    if (existing) {
      const newStatus = existing.status === "pago" ? "pendente" : "pago";
      upsertRev.mutate({
        id: existing.id,
        client_id: clientId,
        year,
        month,
        amount: Number(client.monthly_value),
        status: newStatus,
        paid_at: newStatus === "pago" ? new Date().toISOString() : null,
      });
    } else {
      upsertRev.mutate({
        client_id: clientId,
        year,
        month,
        amount: Number(client.monthly_value),
        status: "pago",
        paid_at: new Date().toISOString(),
      });
    }
  };

  const toggleExpStatus = (exp: typeof expenses[0]) => {
    const newStatus = exp.status === "pago" ? "pendente" : "pago";
    upsertExp.mutate({
      id: exp.id,
      description: exp.description,
      category: exp.category,
      year,
      month,
      amount: Number(exp.amount),
      status: newStatus,
      paid_at: newStatus === "pago" ? new Date().toISOString() : null,
    } as any);
  };

  const prev = () => { if (month === 1) { setMonth(12); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const next = () => { if (month === 12) { setMonth(1); setYear((y) => y + 1); } else setMonth((m) => m + 1); };

  return (
    <div className="space-y-6">
      {/* Month nav */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={prev}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-lg font-semibold">{MONTHS[month - 1]} {year}</span>
        <Button variant="ghost" size="icon" onClick={next}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* Dashboard KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Faturamento</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">R$ {totalFaturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">R$ {totalDespesas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Lucro</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${lucro >= 0 ? "text-success" : "text-destructive"}`}>R$ {Math.abs(lucro).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Receitas */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Receitas (Clientes)</CardTitle>
              <Badge variant="outline">{revPaid}/{revTotal}</Badge>
            </div>
            <Progress value={revProgress} className="h-2 mt-2" />
          </CardHeader>
          <CardContent className="space-y-2">
            {clients.map((c) => {
              const rev = revByClient.get(c.id);
              const paid = rev?.status === "pago";
              return (
                <button
                  key={c.id}
                  onClick={() => toggleRevStatus(c.id)}
                  className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-accent/50"
                >
                  {paid ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" /> : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                  <span className="flex-1 text-sm font-medium truncate">{c.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">Venc. dia 10</span>
                  <span className="text-sm text-muted-foreground shrink-0">R$ {Number(c.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                </button>
              );
            })}
            {clients.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Nenhum cliente ativo</p>}
          </CardContent>
        </Card>

        {/* Despesas por categoria */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Despesas por Categoria</CardTitle>
              <Badge variant="outline">{expPaid}/{expTotal}</Badge>
            </div>
            <Progress value={expProgress} className="h-2 mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {EXPENSE_CATEGORIES.map((cat) => {
              const catExpenses = expenses.filter((e) => e.category === cat.key);
              if (catExpenses.length === 0) return (
                <div key={cat.key} className="space-y-1">
                  <span className="text-sm font-medium">{cat.label}</span>
                  <p className="text-xs text-muted-foreground">Nenhuma despesa</p>
                </div>
              );
              return (
                <div key={cat.key} className="space-y-2">
                  <span className="text-sm font-medium">{cat.label}</span>
                  {catExpenses.map((exp) => (
                    <button
                      key={exp.id}
                      onClick={() => toggleExpStatus(exp)}
                      className="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:bg-accent/50"
                    >
                      {exp.status === "pago"
                        ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                        : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                      <span className="flex-1 text-sm truncate">{exp.description}</span>
                      <span className="text-xs text-muted-foreground shrink-0">Venc. dia {String(month).padStart(2, "0")}/10</span>
                      <span className="text-sm text-muted-foreground shrink-0">R$ {Number(exp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
