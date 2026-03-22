import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const EXPENSE_CATEGORIES: Record<string, { label: string; color: string }> = {
  operacionais: { label: "Operacionais", color: "#ef4444" },
  administrativas: { label: "Administrativas", color: "#f97316" },
  comerciais: { label: "Comerciais", color: "#eab308" },
  financeiras: { label: "Financeiras", color: "#6b7280" },
  variaveis: { label: "Variáveis", color: "#8b5cf6" },
  impostos: { label: "Impostos", color: "#64748b" },
};

const CATEGORY_MAP: Record<string, string> = {
  "despesas operacionais": "operacionais",
  "despesas administrativas": "administrativas",
  "despesas comerciais": "comerciais",
  "despesas financeiras": "financeiras",
  "despesas variáveis": "variaveis",
  "despesas variaveis": "variaveis",
  impostos: "impostos",
  operacionais: "operacionais",
  administrativas: "administrativas",
  comerciais: "comerciais",
  financeiras: "financeiras",
  variaveis: "variaveis",
};

type Transaction = {
  id: string;
  type: string;
  category: string | null;
  amount: number;
  date: string;
  description: string;
};

interface Props {
  transactions: Transaction[];
}

const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

function mapCategory(cat: string | null): string | null {
  if (!cat) return null;
  const key = cat.toLowerCase().trim();
  return CATEGORY_MAP[key] ?? null;
}

export function FinAnnualCharts({ transactions }: Props) {
  const nonCaixa = useMemo(
    () => transactions.filter((t) => t.type !== "caixa" && t.category !== "caixa"),
    [transactions]
  );

  // 1. Donut — expense distribution by category
  const donutData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of nonCaixa) {
      if (t.type !== "saida") continue;
      const cat = mapCategory(t.category);
      if (!cat) continue;
      map[cat] = (map[cat] || 0) + Number(t.amount);
    }
    return Object.entries(map)
      .map(([key, value]) => ({
        name: EXPENSE_CATEGORIES[key]?.label ?? key,
        value,
        color: EXPENSE_CATEGORIES[key]?.color ?? "#94a3b8",
      }))
      .sort((a, b) => b.value - a.value);
  }, [nonCaixa]);

  const totalExpenses = donutData.reduce((s, d) => s + d.value, 0);

  // 2 & 3. Monthly data by category
  const monthlyByCategory = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const monthTxs = nonCaixa.filter((t) => new Date(t.date).getMonth() + 1 === m);
      const receita = monthTxs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
      const despesa = monthTxs.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);

      const cats: Record<string, number> = {};
      for (const key of Object.keys(EXPENSE_CATEGORIES)) cats[key] = 0;
      for (const t of monthTxs) {
        if (t.type !== "saida") continue;
        const cat = mapCategory(t.category);
        if (cat) cats[cat] += Number(t.amount);
      }

      return { short: MONTH_SHORT[i], receita, despesa, lucro: receita - despesa, ...cats };
    });
  }, [nonCaixa]);

  const renderDonutLabel = ({ name, percent }: { name: string; percent: number }) =>
    percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 1. Donut */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base uppercase text-center">Distribuição de Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          {donutData.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sem dados de despesas categorizadas</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  label={renderDonutLabel}
                  labelLine={false}
                >
                  {donutData.map((d, idx) => (
                    <Cell key={idx} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => fmt(value)}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
          {donutData.length > 0 && (
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {donutData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-medium">{totalExpenses > 0 ? ((d.value / totalExpenses) * 100).toFixed(1) : 0}%</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Receita vs Despesa — grouped bars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base uppercase text-center">Receita vs Despesa por Mês</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyByCategory}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="short" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [fmt(value), name]}
                labelFormatter={(label) => label}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                itemSorter={() => 0}
              />
              <Legend />
              <Bar dataKey="receita" name="Receita" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 3. Stacked area — expense categories over time */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base uppercase text-center">Composição de Despesas ao Longo do Tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={monthlyByCategory}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="short" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [fmt(value), name]}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              />
              <Legend />
              {Object.entries(EXPENSE_CATEGORIES).map(([key, cfg]) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={cfg.label}
                  stackId="1"
                  stroke={cfg.color}
                  fill={cfg.color}
                  fillOpacity={0.6}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
