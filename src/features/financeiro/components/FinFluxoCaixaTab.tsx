import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinClients, useFinAllTransactions, useFinOpeningBalances } from "../hooks/use-financial-data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { FinMonthYearSelector } from "./FinMonthYearSelector";
import { FinMetricCard } from "./FinMetricCard";
import { DollarSign, TrendingDown, TrendingUp, Wallet, Users } from "lucide-react";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const EXPENSE_COLORS: Record<string, string> = {
  "Receita Recorrente": "#22c55e",
  "Receita Variável": "#4ade80",
  "Receita Outros": "#86efac",
  "Impostos": "#64748b",
  "Despesas Operacional": "#ef4444",
  "Despesas Administrativas": "#f97316",
  "Despesas Financeiras": "#6b7280",
  "Despesas Comerciais": "#eab308",
  "Despesas Outros": "#94a3b8",
  "Despesas Variáveis": "#8b5cf6",
  "Investimentos": "#3b82f6",
};

export function FinFluxoCaixaTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const clientsQ = useFinClients();
  const transactionsQ = useFinAllTransactions(year);
  const balancesQ = useFinOpeningBalances(year);

  const clients = clientsQ.data?.filter((c) => c.is_active) ?? [];
  const transactions = transactionsQ.data ?? [];
  const balances = balancesQ.data ?? [];

  const monthTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type === "caixa" || t.category === "caixa") return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === month;
    });
  }, [transactions, month]);

  const totalReceita = monthTxs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalDespesa = monthTxs.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const lucro = totalReceita - totalDespesa;
  const ticketMedio = clients.length > 0 ? totalReceita / clients.length : 0;
  const margemLucro = totalReceita > 0 ? (lucro / totalReceita) * 100 : 0;

  const caixaFinal = balances.find(b => b.month === month);
  const caixaAcumulado = caixaFinal ? Number(caixaFinal.amount) : null;
  const prevBalance = balances.find(b => b.month === month - 1);
  const caixaInicial = prevBalance ? Number(prevBalance.amount) : null;

  // Previous month comparison
  const prevMonthTxs = useMemo(() => {
    const pm = month - 1;
    if (pm < 1) return [];
    return transactions.filter((t) => {
      if (t.type === "caixa" || t.category === "caixa") return false;
      return new Date(t.date).getMonth() + 1 === pm;
    });
  }, [transactions, month]);
  const prevReceita = prevMonthTxs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const prevDespesa = prevMonthTxs.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const varReceita = prevReceita > 0 ? ((totalReceita - prevReceita) / prevReceita) * 100 : null;
  const varDespesa = prevDespesa > 0 ? ((totalDespesa - prevDespesa) / prevDespesa) * 100 : null;

  // Category breakdown (donut)
  const categoryData = useMemo(() => {
    const CATEGORY_LABELS: Record<string, string> = {
      receita_recorrente: "Receita Recorrente", receita_variavel: "Receita Variável", receita_outros: "Receita Outros",
      impostos: "Impostos", despesa_operacional: "Despesas Operacional", despesa_administrativa: "Despesas Administrativas",
      despesa_financeira: "Despesas Financeiras", despesa_comercial: "Despesas Comerciais", despesa_outros: "Despesas Outros",
      despesa_variavel: "Despesas Variáveis", investimentos: "Investimentos",
    };
    const cats: Record<string, number> = {};
    monthTxs.filter(t => t.type === "saida").forEach((t) => {
      const label = CATEGORY_LABELS[t.category ?? ""] ?? t.category ?? "Outros";
      cats[label] = (cats[label] || 0) + Number(t.amount);
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value, color: EXPENSE_COLORS[name] ?? "#94a3b8" })).sort((a, b) => b.value - a.value);
  }, [monthTxs]);

  const totalExpDonut = categoryData.reduce((s, d) => s + d.value, 0);

  // Caixa acumulado chart (monthly line)
  const caixaLineData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const bal = balances.find(b => b.month === m);
      const mTxs = transactions.filter(t => t.type !== "caixa" && t.category !== "caixa" && new Date(t.date).getMonth() + 1 === m);
      const rec = mTxs.filter(t => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
      const desp = mTxs.filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
      return { month: MONTH_SHORT[i], caixa: bal ? Number(bal.amount) : null, receita: rec, despesa: desp };
    });
  }, [transactions, balances]);

  const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtVal = (v: number | null) => v != null ? `${v < 0 ? "-" : ""}R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

  return (
    <div className="space-y-6">
      <div className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <FinMonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
      </div>

      {/* KPIs Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <FinMetricCard title="Receita" value={totalReceita} tone="success" variation={varReceita} icon={<TrendingUp className="h-4 w-4" />} />
        <FinMetricCard title="Despesa" value={totalDespesa} tone="danger" variation={varDespesa} icon={<TrendingDown className="h-4 w-4" />} />
        <FinMetricCard
          title="Lucro"
          value={Math.abs(lucro)}
          prefix={lucro < 0 ? "-R$" : "R$"}
          tone={lucro >= 0 ? "success" : "danger"}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <FinMetricCard
          title="Caixa Final"
          value={Math.abs(caixaAcumulado ?? 0)}
          prefix={caixaAcumulado != null ? (caixaAcumulado < 0 ? "-R$" : "R$") : ""}
          tone={caixaAcumulado != null ? (caixaAcumulado >= 0 ? "success" : "danger") : "muted"}
          icon={<Wallet className="h-4 w-4" />}
        >
          {caixaAcumulado == null && <p className="text-[10px] text-muted-foreground mt-1">Não definido</p>}
        </FinMetricCard>
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.15s" }}>
        <Card className="flex flex-col items-center justify-center p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Margem de Lucro</span>
          <ProgressRing
            value={Math.min(Math.abs(margemLucro), 100)}
            size={90}
            stroke={8}
            tone={margemLucro >= 20 ? "success" : margemLucro >= 0 ? "warning" : "danger"}
            label={<span className={`text-xl font-bold ${margemLucro >= 0 ? "" : "text-destructive"}`}>{margemLucro.toFixed(0)}%</span>}
          />
        </Card>
        <FinMetricCard title="Clientes" value={clients.length} prefix="" decimals={0} icon={<Users className="h-4 w-4" />} />
        <FinMetricCard title="Ticket Médio" value={ticketMedio} icon={<DollarSign className="h-4 w-4" />} />
        <FinMetricCard
          title="Caixa Inicial"
          value={Math.abs(caixaInicial ?? 0)}
          prefix={caixaInicial != null ? (caixaInicial < 0 ? "-R$" : "R$") : ""}
          tone={caixaInicial != null ? "default" : "muted"}
          icon={<Wallet className="h-4 w-4" />}
        >
          {caixaInicial == null && <p className="text-[10px] text-muted-foreground mt-1">Não definido</p>}
        </FinMetricCard>
      </div>

      {/* Main chart — Caixa acumulado */}
      <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.2s" }}>
        <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Caixa Acumulado</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={caixaLineData}>
              <defs>
                <linearGradient id="caixaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => v != null ? fmt(v) : "—"} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="caixa" name="Caixa" stroke="hsl(var(--success))" fill="url(#caixaGrad)" strokeWidth={2.5} connectNulls dot={{ r: 4, fill: "hsl(var(--success))" }} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Entradas vs Saídas bar chart */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.25s" }}>
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Entradas vs Saídas</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={caixaLineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmt(v), name]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="#22c55e" radius={[6, 6, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donut — Distribuição de despesas */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.3s" }}>
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Distribuição de Despesas</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={categoryData} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" innerRadius={55} outerRadius={95}
                      paddingAngle={2} strokeWidth={0}
                    >
                      {categoryData.map((d, idx) => <Cell key={idx} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                    {/* Center label */}
                    <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-xs font-medium">Total</text>
                    <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-sm font-bold">{fmt(totalExpDonut)}</text>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {categoryData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-semibold">{totalExpDonut > 0 ? ((d.value / totalExpDonut) * 100).toFixed(0) : 0}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-12">Nenhum dado para o mês selecionado</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
