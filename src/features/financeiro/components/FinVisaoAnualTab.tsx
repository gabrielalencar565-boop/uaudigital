import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinClients, useFinGoals, useFinAllTransactions, useFinOpeningBalances, useFinAllRevenues } from "../hooks/use-financial-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";
import { FinMonthYearSelector } from "./FinMonthYearSelector";
import { FinAnnualCharts } from "./FinAnnualCharts";
import { FinMetricCard } from "./FinMetricCard";
import { DollarSign, TrendingDown, TrendingUp, Wallet, Activity, Users, Target } from "lucide-react";

const MONTH_LABELS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function FinVisaoAnualTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const clientsQ = useFinClients();
  const goalsQ = useFinGoals(year);
  const transactionsQ = useFinAllTransactions(year);
  const balancesQ = useFinOpeningBalances(year);
  const revenuesQ = useFinAllRevenues(year);

  const clients = clientsQ.data?.filter((c) => c.is_active) ?? [];
  const goals = goalsQ.data ?? [];
  const transactions = transactionsQ.data ?? [];
  const balances = balancesQ.data ?? [];
  const revenues = revenuesQ.data ?? [];

  const monthlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthTxs = transactions.filter((t) => {
        if (t.type === "caixa" || t.category === "caixa") return false;
        return new Date(t.date).getMonth() + 1 === m;
      });
      const rev = monthTxs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
      const exp = monthTxs.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
      const bal = balances.find(b => b.month === m);
      return { month: MONTH_LABELS[i], short: MONTH_SHORT[i], receita: rev, despesa: exp, lucro: rev - exp, caixa: bal ? Number(bal.amount) : null };
    });
  }, [transactions, balances]);

  const totalReceita = monthlyData.reduce((s, d) => s + d.receita, 0);
  const totalDespesa = monthlyData.reduce((s, d) => s + d.despesa, 0);
  const lucroAnual = totalReceita - totalDespesa;
  const lastCaixa = [...monthlyData].reverse().find(d => d.caixa !== null);
  const caixaAnual = lastCaixa?.caixa ?? null;
  // Margem média do ano (média das margens mensais que tiveram receita)
  const margemLucro = useMemo(() => {
    const margensMensais = monthlyData.filter(d => d.receita > 0).map(d => ((d.receita - d.despesa) / d.receita) * 100);
    return margensMensais.length > 0 ? margensMensais.reduce((s, v) => s + v, 0) / margensMensais.length : 0;
  }, [monthlyData]);

  // Clientes acumulativo
  const monthlyClientCounts = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const uniqueClients = new Set(revenues.filter(r => r.month === m).map(r => r.client_id));
      return uniqueClients.size;
    });
  }, [revenues]);

  const totalClientesAno = useMemo(() => {
    const allUniqueClients = new Set(revenues.map(r => r.client_id));
    return allUniqueClients.size;
  }, [revenues]);

  // Ticket médio = média dos tickets mensais (receita do mês / clientes do mês)
  const ticketMedioData = useMemo(() => {
    return monthlyData.map((d, i) => {
      const clientCount = monthlyClientCounts[i];
      const ticket = clientCount > 0 ? d.receita / clientCount : 0;
      return { ...d, ticket };
    });
  }, [monthlyData, monthlyClientCounts]);

  const ticketMedio = useMemo(() => {
    const mesesComClientes = ticketMedioData.filter(d => d.ticket > 0);
    return mesesComClientes.length > 0 ? mesesComClientes.reduce((s, d) => s + d.ticket, 0) / mesesComClientes.length : 0;
  }, [ticketMedioData]);

  const healthScore = useMemo(() => {
    let score = 0;
    if (lucroAnual > 0) score += 30;
    const positiveMonths = monthlyData.filter((d) => d.lucro > 0).length;
    score += (positiveMonths / 12) * 40;
    if (margemLucro > 20) score += 30; else if (margemLucro > 10) score += 20; else if (margemLucro > 0) score += 10;
    return Math.round(score);
  }, [monthlyData, lucroAnual, margemLucro]);

  const quarterlyData = useMemo(() => {
    return [0, 1, 2, 3].map((q) => {
      const months = monthlyData.slice(q * 3, q * 3 + 3);
      const rec = months.reduce((s, m) => s + m.receita, 0);
      const desp = months.reduce((s, m) => s + m.despesa, 0);
      const lastWithCaixa = [...months].reverse().find(m => m.caixa !== null);
      return { label: `${q + 1}º TRI`, receita: rec, despesa: desp, lucro: rec - desp, caixa: lastWithCaixa?.caixa ?? null };
    });
  }, [monthlyData]);

  const annualGoal = goals.find((g) => g.month === null);
  const metaReceita = annualGoal ? Number(annualGoal.revenue_goal) : 0;
  const progressoMeta = metaReceita > 0 ? (totalReceita / metaReceita) * 100 : 0;

  // Receita mensal (progresso durante o ano, não acumulada)
  const receitaMensal = useMemo(() => {
    return monthlyData.map(d => ({ ...d, receitaMes: d.receita }));
  }, [monthlyData]);

  const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtSign = (v: number) => `${v < 0 ? "-" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtCaixa = (v: number | null) => v != null ? fmtSign(v) : "—";

  const GradientBarGreen = (props: any) => {
    const { x, y, width, height, index } = props;
    const id = `anBG-${index}`;
    return (
      <g>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={1} />
            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={`url(#${id})`} />
      </g>
    );
  };

  const GradientBarRed = (props: any) => {
    const { x, y, width, height, index } = props;
    const id = `anBR-${index}`;
    return (
      <g>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.9} />
            <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
          </linearGradient>
        </defs>
        <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={`url(#${id})`} />
      </g>
    );
  };

  return (
    <div className="space-y-6">
      <div className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <FinMonthYearSelector month={1} year={year} onMonthChange={() => {}} onYearChange={setYear} yearOnly />
      </div>

      {/* Annual KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <FinMetricCard title="Receita Anual" value={totalReceita} tone="success" icon={<TrendingUp className="h-4 w-4" />} />
        <FinMetricCard title="Despesa Anual" value={totalDespesa} tone="danger" icon={<TrendingDown className="h-4 w-4" />} />
        <FinMetricCard title="Lucro Anual" value={Math.abs(lucroAnual)} prefix={lucroAnual < 0 ? "-R$" : "R$"} tone={lucroAnual >= 0 ? "success" : "danger"} icon={<DollarSign className="h-4 w-4" />} />
        <FinMetricCard
          title="Caixa"
          value={Math.abs(caixaAnual ?? 0)}
          prefix={caixaAnual != null ? (caixaAnual < 0 ? "-R$" : "R$") : ""}
          tone={caixaAnual != null ? (caixaAnual >= 0 ? "success" : "danger") : "muted"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <FinMetricCard
          title="Saúde do Caixa"
          value={healthScore / 10}
          prefix=""
          decimals={1}
          tone={healthScore >= 70 ? "success" : healthScore >= 40 ? "warning" : "danger"}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly table */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.15s" }}>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mês</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Receita</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Despesa</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lucro</th>
                  <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Caixa</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((d, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                    <td className="px-3 py-2 font-semibold text-xs">{d.short}</td>
                    <td className="px-3 py-2 text-right text-xs">{fmt(d.receita)}</td>
                    <td className="px-3 py-2 text-right text-xs">{fmt(d.despesa)}</td>
                    <td className={`px-3 py-2 text-right text-xs font-semibold ${d.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmtSign(d.lucro)}</td>
                    <td className={`px-3 py-2 text-right text-xs ${d.caixa != null ? (d.caixa >= 0 ? "text-success" : "text-destructive") : "text-muted-foreground"}`}>{fmtCaixa(d.caixa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Quarterly + KPIs */}
        <div className="space-y-4">
          <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.15s" }}>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Trimestre</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Receita</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Despesa</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lucro</th>
                    <th className="px-3 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Caixa</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterlyData.map((q, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-accent/30 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-sm">{q.label}</td>
                      <td className="px-3 py-2.5 text-right text-xs">{fmt(q.receita)}</td>
                      <td className="px-3 py-2.5 text-right text-xs">{fmt(q.despesa)}</td>
                      <td className={`px-3 py-2.5 text-right text-xs font-semibold ${q.lucro >= 0 ? "text-success" : "text-destructive"}`}>{fmtSign(q.lucro)}</td>
                      <td className={`px-3 py-2.5 text-right text-xs ${q.caixa != null ? (q.caixa >= 0 ? "text-success" : "text-destructive") : "text-muted-foreground"}`}>{fmtCaixa(q.caixa)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="flex flex-col items-center justify-center p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Margem</span>
              <ProgressRing value={Math.min(Math.abs(margemLucro), 100)} size={80} stroke={7}
                tone={margemLucro >= 20 ? "success" : margemLucro >= 0 ? "warning" : "danger"}
                label={<span className={`text-lg font-bold ${margemLucro >= 0 ? "" : "text-destructive"}`}>{margemLucro.toFixed(1)}%</span>} />
            </Card>
            <FinMetricCard title="Clientes no Ano" value={totalClientesAno} prefix="" decimals={0} icon={<Users className="h-4 w-4" />} />
            <FinMetricCard title="Ticket Médio" value={ticketMedio} icon={<DollarSign className="h-4 w-4" />} />
          </div>

          {metaReceita > 0 && (
            <Card className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center"><Target className="h-4 w-4 text-muted-foreground" /></div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Meta de Receita Anual</p>
                    <p className="text-lg font-bold">{fmt(metaReceita)}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Realizado: {fmt(totalReceita)}</span>
                    <span className="font-bold">{progressoMeta.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(progressoMeta, 100)} className="h-2" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Entradas vs Saídas — gradient bar chart */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.2s" }}>
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Entradas vs Saídas</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="short" className="text-xs" axisLine={false} tickLine={false} />
                <YAxis className="text-xs" axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3, radius: 6 }} />
                <Bar dataKey="receita" name="Receita" shape={<GradientBarGreen />} barSize={18} />
                <Bar dataKey="despesa" name="Despesa" shape={<GradientBarRed />} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Progresso da Receita */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.25s" }}>
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Progresso da Receita</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={receitaMensal}>
                <defs>
                  <linearGradient id="recMesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="short" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="receitaMes" name="Receita" stroke="hsl(var(--success))" fill="url(#recMesGrad)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--success))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lucro por mês */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.3s" }}>
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Lucro por Mês</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="short" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtSign(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="lucro" name="Lucro" radius={[6, 6, 0, 0]}>
                  {monthlyData.map((d, i) => (
                    <Cell key={i} fill={d.lucro >= 0 ? "#22c55e" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Progresso de Ticket Médio */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.35s" }}>
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Progresso de Ticket Médio</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={ticketMedioData}>
                <defs>
                  <linearGradient id="ticketGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="short" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="ticket" name="Ticket Médio" stroke="hsl(var(--primary))" fill="url(#ticketGrad)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--primary))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Annual charts */}
      <FinAnnualCharts transactions={transactions as any} />
    </div>
  );
}
