import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, Percent, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFinAllRevenues, useFinAllExpenses } from "../hooks/use-financial-data";
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function FinFluxoCaixaTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const revenuesQ = useFinAllRevenues(year);
  const expensesQ = useFinAllExpenses(year);

  const revenues = revenuesQ.data ?? [];
  const expenses = expensesQ.data ?? [];

  const monthlyData = useMemo(() => {
    let cumulative = 0;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const rev = revenues.filter((r) => r.month === m && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
      const exp = expenses.filter((e) => e.month === m && e.status === "pago").reduce((s, e) => s + Number(e.amount), 0);
      cumulative += rev - exp;
      return { month: MONTHS[i], receita: rev, despesa: exp, saldo: cumulative };
    });
  }, [revenues, expenses]);

  const currentMonth = now.getMonth();
  const currentData = monthlyData[currentMonth];
  const totalReceita = monthlyData.reduce((s, d) => s + d.receita, 0);
  const totalDespesa = monthlyData.reduce((s, d) => s + d.despesa, 0);
  const saldo = totalReceita - totalDespesa;
  const margem = totalReceita > 0 ? ((saldo / totalReceita) * 100).toFixed(1) : "0";

  const negativeMonths = monthlyData.filter((d) => d.saldo < 0);
  const insights = useMemo(() => {
    const arr: string[] = [];
    if (negativeMonths.length > 0) arr.push(`⚠️ Caixa negativo em ${negativeMonths.map((m) => m.month).join(", ")}`);
    const bestMonth = [...monthlyData].sort((a, b) => (b.receita - b.despesa) - (a.receita - a.despesa))[0];
    if (bestMonth && bestMonth.receita > 0) arr.push(`🏆 Melhor mês: ${bestMonth.month} (+R$ ${(bestMonth.receita - bestMonth.despesa).toLocaleString("pt-BR")})`);
    if (parseFloat(margem) > 20) arr.push("✅ Margem saudável acima de 20%");
    else if (parseFloat(margem) > 0) arr.push("⚡ Margem positiva mas abaixo de 20%");
    else arr.push("🔴 Margem negativa — atenção!");
    return arr;
  }, [monthlyData, negativeMonths, margem]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-lg font-semibold">{year}</span>
        <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Receita Total</CardTitle><TrendingUp className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><p className="text-2xl font-bold text-success">R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Despesa Total</CardTitle><TrendingDown className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">R$ {totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Saldo</CardTitle><Wallet className="h-4 w-4" /></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>R$ {Math.abs(saldo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Margem</CardTitle><Percent className="h-4 w-4" /></CardHeader>
          <CardContent><p className="text-2xl font-bold">{margem}%</p></CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {negativeMonths.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-sm font-medium text-destructive">Caixa negativo detectado em {negativeMonths.length} mês(es)</p>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Receita vs Despesa</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Saldo Acumulado</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader><CardTitle className="text-base">Insights</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {insights.map((insight, i) => (
            <p key={i} className="text-sm">{insight}</p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
