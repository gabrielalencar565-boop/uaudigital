import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinClients, useFinAllTransactions, useFinAllRevenues } from "../hooks/use-financial-data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
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

const DONUT_COLORS = ["#8b5cf6", "#a78bfa", "#c4b5fd", "#7c3aed", "#6d28d9", "#5b21b6", "#ddd6fe", "#ede9fe"];

interface FinFluxoCaixaProps {
  externalMonth?: number;
  externalYear?: number;
}

export function FinFluxoCaixaTab({ externalMonth, externalYear }: FinFluxoCaixaProps = {}) {
  const now = new Date();
  const [internalYear, setYear] = useState(now.getFullYear());
  const [internalMonth, setMonth] = useState(now.getMonth() + 1);
  const year = externalYear ?? internalYear;
  const month = externalMonth ?? internalMonth;
  const hasExternal = externalMonth !== undefined;

  const clientsQ = useFinClients();
  const transactionsQ = useFinAllTransactions(year);
  const revenuesQ = useFinAllRevenues(year);

  const clients = clientsQ.data?.filter((c) => c.is_active) ?? [];
  const allTransactions = transactionsQ.data ?? [];
  const revenues = revenuesQ.data ?? [];

  // Separate caixa (balance) transactions from normal ones
  const transactions = allTransactions;

  const monthTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type === "caixa" || t.category === "caixa") return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === month;
    });
  }, [transactions, month]);

  // Caixa inicial = transaction with category "caixa" and description containing "inicial" in current month
  const caixaInicialTx = useMemo(() => {
    return transactions.find((t) => {
      if (t.category !== "caixa" && t.type !== "caixa") return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === month && t.description?.toLowerCase().includes("inicial");
    });
  }, [transactions, month]);

  // Caixa final = transaction with category "caixa" without "inicial" in current month
  const caixaFinalTx = useMemo(() => {
    return transactions.find((t) => {
      if (t.category !== "caixa" && t.type !== "caixa") return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === month && !t.description?.toLowerCase().includes("inicial");
    });
  }, [transactions, month]);

  const caixaInicial = caixaInicialTx ? Number(caixaInicialTx.amount) : null;
  const caixaAcumulado = caixaFinalTx ? Number(caixaFinalTx.amount) : null;


  // Clientes = unique descriptions from "entrada" transactions in this month
  const clientesRecorrentes = useMemo(() => {
    return new Set(monthTxs.filter(t => t.type === "entrada").map(t => t.description)).size;
  }, [monthTxs]);

  // Previous month for comparison
  const prevMonthTxs = useMemo(() => {
    const pm = month - 1;
    if (pm < 1) return [];
    return transactions.filter((t) => {
      if (t.type === "caixa" || t.category === "caixa") return false;
      return new Date(t.date).getMonth() + 1 === pm;
    });
  }, [transactions, month]);

  const prevClientesRecorrentes = useMemo(() => {
    return new Set(prevMonthTxs.filter(t => t.type === "entrada").map(t => t.description)).size;
  }, [prevMonthTxs]);

  const varClientesAbs = clientesRecorrentes - prevClientesRecorrentes;

  const receitaTransacoes = monthTxs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalDespesa = monthTxs.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);

  // Caixa inicial (carried from previous month) is added to revenue
  const caixaAnterior = caixaInicial ?? 0;
  const totalReceita = receitaTransacoes + caixaAnterior;

  const lucro = totalReceita - totalDespesa;
  const margemLucro = totalReceita > 0 ? (lucro / totalReceita) * 100 : 0;

  // Previous month financial comparison
  const prevReceitaTransacoes = prevMonthTxs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  // Find caixa inicial of previous month from transactions
  const prevCaixaInicialTx = useMemo(() => {
    const pm = month - 1;
    if (pm < 1) return null;
    return transactions.find((t) => {
      if (t.type !== "caixa" && t.category !== "caixa") return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === pm && t.description?.toLowerCase().includes("inicial");
    }) ?? null;
  }, [transactions, month]);
  const prevCaixaAnterior = prevCaixaInicialTx ? Number(prevCaixaInicialTx.amount) : 0;
  const prevReceita = prevReceitaTransacoes + prevCaixaAnterior;
  const prevDespesa = prevMonthTxs.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const prevLucro = prevReceita - prevDespesa;
  const varReceita = prevReceita > 0 ? ((totalReceita - prevReceita) / prevReceita) * 100 : null;
  const varDespesa = prevDespesa > 0 ? ((totalDespesa - prevDespesa) / prevDespesa) * 100 : null;
  const varLucro = prevLucro !== 0 ? ((lucro - prevLucro) / Math.abs(prevLucro)) * 100 : null;

  const ticketMedio = clientesRecorrentes > 0 ? totalReceita / clientesRecorrentes : 0;
  const prevTicketMedio = prevClientesRecorrentes > 0 ? prevReceita / prevClientesRecorrentes : 0;
  const varTicketMedio = prevTicketMedio > 0 ? ((ticketMedio - prevTicketMedio) / prevTicketMedio) * 100 : null;

  // Revenue distribution donut - by description
  const revenueData = useMemo(() => {
    const map: Record<string, number> = {};
    monthTxs.filter(t => t.type === "entrada").forEach((t) => {
      const label = t.description || "Outros";
      map[label] = (map[label] || 0) + Number(t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTxs]);
  const totalRevDonut = revenueData.reduce((s, d) => s + d.value, 0);
  const REVENUE_DONUT_COLORS = ["#22c55e", "#4ade80", "#86efac", "#16a34a", "#15803d", "#166534", "#bbf7d0", "#dcfce7"];

  // Category breakdown (donut) - expense only
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
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTxs]);

  const totalExpDonut = categoryData.reduce((s, d) => s + d.value, 0);

  // Entradas vs Saídas — monthly bar data
  const barData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mTxs = transactions.filter(t => new Date(t.date).getMonth() + 1 === m);
      const rec = mTxs.filter(t => t.type === "entrada" || t.description?.toLowerCase().includes("caixa inicial")).reduce((s, t) => s + Number(t.amount), 0);
      const desp = mTxs.filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
      return { month: MONTH_SHORT[i], receita: rec, despesa: desp };
    });
  }, [transactions]);

  const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  // Custom bar shape with gradient
  const GradientBar = (props: any) => {
    const { x, y, width, height, index } = props;
    const id = `barGrad-${index}`;
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
    const id = `barGradR-${index}`;
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
      {!hasExternal && (
        <div className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
          <FinMonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        </div>
      )}

      {/* KPIs Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <FinMetricCard title="Receita" value={totalReceita} tone="success" variation={varReceita} icon={<TrendingUp className="h-4 w-4" />} />
        <FinMetricCard title="Despesa" value={totalDespesa} tone="danger" variation={varDespesa} icon={<TrendingDown className="h-4 w-4" />} />
        <FinMetricCard
          title="Lucro"
          value={Math.abs(lucro)}
          prefix={lucro < 0 ? "-R$" : "R$"}
          tone={lucro >= 0 ? "success" : "danger"}
          variation={varLucro}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.15s" }}>
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
        <FinMetricCard title="Clientes" value={clientesRecorrentes} prefix="" decimals={0} variation={varClientesAbs !== 0 ? varClientesAbs : null} variationAbsolute icon={<Users className="h-4 w-4" />} />
        <FinMetricCard title="Ticket Médio" value={ticketMedio} variation={varTicketMedio} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Entradas vs Saídas — gradient bar chart */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.2s" }}>
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Entradas vs Saídas</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" className="text-xs" axisLine={false} tickLine={false} />
                <YAxis className="text-xs" axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number, name: string) => [fmt(v), name]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3, radius: 6 }}
                />
                <Bar dataKey="receita" name="Receita" shape={<GradientBar />} barSize={18} />
                <Bar dataKey="despesa" name="Despesa" shape={<GradientBarRed />} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Donut — Distribuição de despesas (modern style) */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.25s" }}>
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Distribuição de Despesas</CardTitle></CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <ResponsiveContainer width={240} height={240}>
                    <PieChart>
                      <Pie
                        data={categoryData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={65} outerRadius={105}
                        paddingAngle={3} strokeWidth={0}
                        cornerRadius={8}
                      >
                        {categoryData.map((_, idx) => (
                          <Cell key={idx} fill={DONUT_COLORS[idx % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
                    <span className="text-lg font-bold">{fmt(totalExpDonut)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-4">
                  {categoryData.map((d, idx) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[idx % DONUT_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-bold">{totalExpDonut > 0 ? ((d.value / totalExpDonut) * 100).toFixed(0) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-12">Nenhum dado para o mês selecionado</p>
            )}
          </CardContent>
        </Card>

        {/* Donut — Distribuição de Receita */}
        <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.3s" }}>
          <CardHeader><CardTitle className="text-sm font-bold uppercase tracking-wider text-center">Distribuição de Receita</CardTitle></CardHeader>
          <CardContent>
            {revenueData.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="relative">
                  <ResponsiveContainer width={240} height={240}>
                    <PieChart>
                      <Pie
                        data={revenueData} dataKey="value" nameKey="name"
                        cx="50%" cy="50%" innerRadius={65} outerRadius={105}
                        paddingAngle={3} strokeWidth={0}
                        cornerRadius={8}
                      >
                        {revenueData.map((_, idx) => (
                          <Cell key={idx} fill={REVENUE_DONUT_COLORS[idx % REVENUE_DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</span>
                    <span className="text-lg font-bold">{fmt(totalRevDonut)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center mt-4">
                  {revenueData.map((d, idx) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-[11px]">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REVENUE_DONUT_COLORS[idx % REVENUE_DONUT_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-bold">{totalRevDonut > 0 ? ((d.value / totalRevDonut) * 100).toFixed(0) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-12">Nenhum dado para o mês selecionado</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
