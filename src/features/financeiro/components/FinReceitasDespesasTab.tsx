import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, DollarSign, TrendingDown, TrendingUp, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinClients, useFinRevenues, useUpsertFinRevenue, useFinExpenses, useUpsertFinExpense } from "../hooks/use-financial-data";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

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

  const totalFaturamento = revenues.filter((r) => r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
  const totalDespesas = expenses.filter((e) => e.status === "pago").reduce((s, e) => s + Number(e.amount), 0);
  const lucro = totalFaturamento - totalDespesas;
  const ticketMedio = clients.length > 0 ? totalFaturamento / clients.length : 0;
  const margemLucro = totalFaturamento > 0 ? (lucro / totalFaturamento) * 100 : 0;

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

      {/* Dashboard KPIs + Rings */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="grid gap-4 sm:grid-cols-2">
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

        {/* Ring indicators */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-center gap-2">
            <ProgressRing
              value={Math.abs(margemLucro)}
              size={120}
              stroke={12}
              tone={margemLucro >= 20 ? "success" : margemLucro >= 0 ? "warning" : "danger"}
              label={<span className={`text-xl font-bold ${margemLucro >= 0 ? "text-success" : "text-destructive"}`}>{margemLucro.toFixed(0)}%</span>}
            />
            <span className="text-sm font-medium text-muted-foreground">Margem de lucro</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ProgressRing
              value={Math.min(clients.length * 5, 100)}
              size={120}
              stroke={12}
              tone="primary"
              label={<span className="text-2xl font-bold">{clients.length}</span>}
            />
            <span className="text-sm font-medium text-muted-foreground">Clientes ativos</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Faturamento Fixo Mensal */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold uppercase">Faturamento Fixo Mensal</CardTitle>
              <Badge variant="outline">{revPaid}/{revTotal}</Badge>
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
                  const contractStart = new Date(c.contract_start);
                  const dueDay = contractStart.getDate();
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium">{c.name}</td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground">Dia {dueDay}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">R$ {Number(c.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
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

        {/* Despesa Fixa Mensal */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold uppercase">Despesa Fixa Mensal</CardTitle>
              <Badge variant="outline">{expPaid}/{expTotal}</Badge>
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
                {expenses.map((exp) => (
                  <tr key={exp.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{exp.description}</td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{exp.installment_current ?? "-"}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">R$ {Number(exp.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => toggleExpStatus(exp)} className="inline-flex items-center justify-center">
                        {exp.status === "pago"
                          ? <CheckCircle2 className="h-5 w-5 text-success" />
                          : <Circle className="h-5 w-5 text-destructive hover:text-primary transition-colors" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
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
