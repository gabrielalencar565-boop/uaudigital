import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Activity, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFinAllRevenues, useFinAllExpenses } from "../hooks/use-financial-data";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function FinVisaoAnualTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const revenuesQ = useFinAllRevenues(year);
  const expensesQ = useFinAllExpenses(year);

  const revenues = revenuesQ.data ?? [];
  const expenses = expensesQ.data ?? [];

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const rev = revenues.filter((r) => r.month === m && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
      const exp = expenses.filter((e) => e.month === m && e.status === "pago").reduce((s, e) => s + Number(e.amount), 0);
      return { month: MONTHS[i], receita: rev, despesa: exp, lucro: rev - exp };
    });
  }, [revenues, expenses]);

  const totalReceita = monthlyData.reduce((s, d) => s + d.receita, 0);
  const totalDespesa = monthlyData.reduce((s, d) => s + d.despesa, 0);
  const lucroAnual = totalReceita - totalDespesa;
  const avgMensal = totalReceita / 12;

  const healthScore = useMemo(() => {
    let score = 0;
    if (lucroAnual > 0) score += 30;
    const positiveMonths = monthlyData.filter((d) => d.lucro > 0).length;
    score += (positiveMonths / 12) * 40;
    const margem = totalReceita > 0 ? (lucroAnual / totalReceita) * 100 : 0;
    if (margem > 20) score += 30;
    else if (margem > 10) score += 20;
    else if (margem > 0) score += 10;
    return Math.round(score);
  }, [monthlyData, lucroAnual, totalReceita]);

  const healthColor = healthScore >= 70 ? "text-success" : healthScore >= 40 ? "text-warning" : "text-destructive";
  const healthLabel = healthScore >= 70 ? "Saudável" : healthScore >= 40 ? "Atenção" : "Crítico";

  const insights = useMemo(() => {
    const arr: string[] = [];
    const bestMonth = [...monthlyData].sort((a, b) => b.lucro - a.lucro)[0];
    const worstMonth = [...monthlyData].sort((a, b) => a.lucro - b.lucro)[0];
    if (bestMonth) arr.push(`🏆 Melhor mês: ${bestMonth.month} (Lucro: R$ ${bestMonth.lucro.toLocaleString("pt-BR")})`);
    if (worstMonth && worstMonth.lucro < 0) arr.push(`⚠️ Pior mês: ${worstMonth.month} (Prejuízo: R$ ${Math.abs(worstMonth.lucro).toLocaleString("pt-BR")})`);
    const growthMonths = monthlyData.filter((d, i) => i > 0 && d.receita > monthlyData[i - 1].receita).length;
    arr.push(`📈 Crescimento de receita em ${growthMonths} meses`);
    arr.push(`💰 Receita média mensal: R$ ${avgMensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
    return arr;
  }, [monthlyData, avgMensal]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-lg font-semibold">{year}</span>
        <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Receita Anual</CardTitle><TrendingUp className="h-4 w-4 text-success" /></CardHeader>
          <CardContent><p className="text-xl font-bold">R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Despesa Anual</CardTitle><TrendingDown className="h-4 w-4 text-destructive" /></CardHeader>
          <CardContent><p className="text-xl font-bold">R$ {totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Lucro Anual</CardTitle><Activity className="h-4 w-4" /></CardHeader>
          <CardContent><p className={`text-xl font-bold ${lucroAnual >= 0 ? "text-success" : "text-destructive"}`}>R$ {Math.abs(lucroAnual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm">Saúde Financeira</CardTitle><Heart className="h-4 w-4" /></CardHeader>
          <CardContent>
            <p className={`text-xl font-bold ${healthColor}`}>{healthScore}%</p>
            <Badge variant="outline" className="mt-1">{healthLabel}</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tendência Mensal</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Comparativo */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comparativo Mês a Mês</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {monthlyData.map((d) => (
              <div key={d.month} className="rounded-lg border p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground">{d.month}</p>
                <p className="text-xs text-success">+{d.receita.toLocaleString("pt-BR")}</p>
                <p className="text-xs text-destructive">-{d.despesa.toLocaleString("pt-BR")}</p>
                <p className={`text-sm font-bold ${d.lucro >= 0 ? "text-success" : "text-destructive"}`}>
                  {d.lucro >= 0 ? "+" : ""}
                  {d.lucro.toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader><CardTitle className="text-base">Insights</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {insights.map((insight, i) => <p key={i} className="text-sm">{insight}</p>)}
        </CardContent>
      </Card>
    </div>
  );
}
