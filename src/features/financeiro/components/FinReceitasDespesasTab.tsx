import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Circle } from "lucide-react";
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
                  <span className="text-sm text-muted-foreground">R$ {Number(c.monthly_value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
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
              const catPaid = catExpenses.filter((e) => e.status === "pago").length;
              const catTotal = catExpenses.reduce((s, e) => s + Number(e.amount), 0);
              return (
                <div key={cat.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{cat.label}</span>
                    <span className="text-xs text-muted-foreground">{catPaid}/{catExpenses.length} • R$ {catTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                  {catExpenses.length > 0 ? (
                    <Progress value={catExpenses.length > 0 ? (catPaid / catExpenses.length) * 100 : 0} className="h-1.5" />
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma despesa</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
