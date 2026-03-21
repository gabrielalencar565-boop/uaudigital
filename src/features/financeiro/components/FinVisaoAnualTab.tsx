import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinClients, useFinGoals, useFinAllTransactions } from "../hooks/use-financial-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FinMonthYearSelector } from "./FinMonthYearSelector";

const MONTH_LABELS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function FinVisaoAnualTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const clientsQ = useFinClients();
  const goalsQ = useFinGoals(year);
  const transactionsQ = useFinAllTransactions(year);

  const clients = clientsQ.data?.filter((c) => c.is_active) ?? [];
  const goals = goalsQ.data ?? [];
  const transactions = transactionsQ.data ?? [];

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthTxs = transactions.filter((t) => {
        const d = new Date(t.date);
        return d.getMonth() + 1 === m;
      });
      const nonCaixa = monthTxs.filter((t) => t.type !== "caixa" && t.category !== "caixa");
      const rev = nonCaixa.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
      const exp = nonCaixa.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
      const lucro = rev - exp;
      // Caixa = use "caixa" record if exists
      const caixaRecords = monthTxs.filter((t) => t.type === "caixa" || t.category === "caixa");
      const caixa = caixaRecords.length > 0 ? Number(caixaRecords[caixaRecords.length - 1].amount) : null;
      return { month: MONTH_LABELS[i], short: MONTH_SHORT[i], receita: rev, despesa: exp, lucro, caixaRecord: caixa };
    });
  }, [transactions]);

  // Build cumulative caixa: use caixa records when available, otherwise accumulate
  const monthlyWithCaixa = useMemo(() => {
    let cumCaixa = 0;
    return monthlyData.map((d) => {
      if (d.caixaRecord !== null) {
        cumCaixa = d.caixaRecord;
      } else {
        cumCaixa += d.lucro;
      }
      return { ...d, caixa: cumCaixa };
    });
  }, [monthlyData]);

  const totalReceita = monthlyData.reduce((s, d) => s + d.receita, 0);
  const totalDespesa = monthlyData.reduce((s, d) => s + d.despesa, 0);
  const lucroAnual = totalReceita - totalDespesa;
  const caixaAnual = monthlyWithCaixa[11]?.caixa ?? 0;
  const margemLucro = totalReceita > 0 ? (lucroAnual / totalReceita) * 100 : 0;
  const ticketMedio = clients.length > 0 ? totalReceita / 12 / clients.length : 0;
  const avgClients = clients.length;

  // Health score
  const healthScore = useMemo(() => {
    let score = 0;
    if (lucroAnual > 0) score += 30;
    const positiveMonths = monthlyData.filter((d) => d.lucro > 0).length;
    score += (positiveMonths / 12) * 40;
    if (margemLucro > 20) score += 30;
    else if (margemLucro > 10) score += 20;
    else if (margemLucro > 0) score += 10;
    return Math.round(score);
  }, [monthlyData, lucroAnual, margemLucro]);

  // Quarterly data
  const quarterlyData = useMemo(() => {
    return [0, 1, 2, 3].map((q) => {
      const months = monthlyWithCaixa.slice(q * 3, q * 3 + 3);
      const rec = months.reduce((s, m) => s + m.receita, 0);
      const desp = months.reduce((s, m) => s + m.despesa, 0);
      const luc = rec - desp;
      const caixa = months[2]?.caixa ?? 0;
      return { label: `${q + 1}º TRI`, receita: rec, despesa: desp, lucro: luc, caixa };
    });
  }, [monthlyWithCaixa]);

  // Annual goal
  const annualGoal = goals.find((g) => g.month === null);
  const metaReceita = annualGoal ? Number(annualGoal.revenue_goal) : 0;
  const progressoMeta = metaReceita > 0 ? (totalReceita / metaReceita) * 100 : 0;

  const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtSign = (v: number) => `${v < 0 ? "-" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <FinMonthYearSelector month={1} year={year} onMonthChange={() => {}} onYearChange={setYear} yearOnly />
      </div>

      {/* Annual summary header - removed Ano widget, 5 cols */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <Card className="text-center">
          <CardHeader className="pb-1"><CardTitle className="text-xs uppercase">Receita Anual</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(totalReceita)}</p></CardContent>
        </Card>
        <Card className="text-center">
          <CardHeader className="pb-1"><CardTitle className="text-xs uppercase">Despesa Anual</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{fmt(totalDespesa)}</p></CardContent>
        </Card>
        <Card className="text-center">
          <CardHeader className="pb-1"><CardTitle className="text-xs uppercase">Lucro Anual</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${lucroAnual >= 0 ? "text-success" : "text-destructive"}`}>{fmtSign(lucroAnual)}</p></CardContent>
        </Card>
        <Card className="text-center">
          <CardHeader className="pb-1"><CardTitle className="text-xs uppercase">Caixa</CardTitle></CardHeader>
          <CardContent><p className={`text-2xl font-bold ${caixaAnual >= 0 ? "text-success" : "text-destructive"}`}>{fmtSign(caixaAnual)}</p></CardContent>
        </Card>
        <Card className="text-center">
          <CardHeader className="pb-1"><CardTitle className="text-xs uppercase">Saúde do Caixa</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{(healthScore / 10).toFixed(1)}</p></CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly table */}
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-bold">Mês</th>
                  <th className="px-3 py-2 text-right font-bold">Receita</th>
                  <th className="px-3 py-2 text-right font-bold">Despesa</th>
                  <th className="px-3 py-2 text-right font-bold">Lucro</th>
                  <th className="px-3 py-2 text-right font-bold">Caixa</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((d, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="px-3 py-2 font-semibold uppercase text-xs">{d.month}</td>
                    <td className="px-3 py-2 text-right">{fmt(d.receita)}</td>
                    <td className="px-3 py-2 text-right">{fmt(d.despesa)}</td>
                    <td className={`px-3 py-2 text-right ${d.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmtSign(d.lucro)}</td>
                    <td className={`px-3 py-2 text-right ${d.caixa >= 0 ? "text-success" : "text-destructive"}`}>{fmtSign(d.caixa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Quarterly table */}
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-bold">Trimestre</th>
                  <th className="px-3 py-2 text-right font-bold">Receita</th>
                  <th className="px-3 py-2 text-right font-bold">Despesa</th>
                  <th className="px-3 py-2 text-right font-bold">Lucro</th>
                  <th className="px-3 py-2 text-right font-bold">Caixa</th>
                </tr>
              </thead>
              <tbody>
                {quarterlyData.map((q, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-accent/30">
                    <td className="px-3 py-2 font-bold text-lg">{q.label}</td>
                    <td className="px-3 py-2 text-right">{fmt(q.receita)}</td>
                    <td className="px-3 py-2 text-right">{fmt(q.despesa)}</td>
                    <td className={`px-3 py-2 text-right ${q.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmtSign(q.lucro)}</td>
                    <td className={`px-3 py-2 text-right ${q.caixa >= 0 ? "text-success" : "text-destructive"}`}>{fmtSign(q.caixa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly bar chart */}
        <Card>
          <CardHeader><CardTitle className="text-base uppercase text-center">Gráfico de Acompanhamento Mensal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="short" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary) / 0.4)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right side KPIs */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Margem Ring */}
            <Card className="flex flex-col items-center justify-center py-4">
              <CardTitle className="text-xs font-medium uppercase mb-2">Margem de Lucro</CardTitle>
              <ProgressRing
                value={Math.min(Math.abs(margemLucro), 100)}
                size={110}
                stroke={12}
                tone={margemLucro >= 20 ? "success" : margemLucro >= 0 ? "warning" : "danger"}
                label={<span className={`text-2xl font-bold ${margemLucro >= 0 ? "" : "text-destructive"}`}>{margemLucro.toFixed(1)}%</span>}
              />
            </Card>
            <Card className="text-center">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase">Clientes</CardTitle></CardHeader>
              <CardContent><p className="text-4xl font-bold">{avgClients}</p></CardContent>
            </Card>
            <Card className="text-center">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase">Ticket Médio</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{fmt(ticketMedio)}</p></CardContent>
            </Card>
          </div>

          {/* Meta */}
          {metaReceita > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-center">Meta de Receita Anual</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-3xl font-bold text-center">{fmt(metaReceita)}</p>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="uppercase font-medium text-xs">Progresso</span>
                    <span className="font-bold">{progressoMeta.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(progressoMeta, 100)} className="h-3" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
