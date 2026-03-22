import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const DONUT_COLORS = ["#8b5cf6", "#a78bfa", "#c4b5fd", "#7c3aed", "#6d28d9", "#5b21b6", "#ddd6fe", "#ede9fe"];

const CATEGORY_LABELS: Record<string, string> = {
  receita_recorrente: "Receita Recorrente", receita_variavel: "Receita Variável", receita_outros: "Receita Outros",
  impostos: "Impostos", despesa_operacional: "Despesas Operacional", despesa_administrativa: "Despesas Administrativas",
  despesa_financeira: "Despesas Financeiras", despesa_comercial: "Despesas Comerciais", despesa_outros: "Despesas Outros",
  despesa_variavel: "Despesas Variáveis", investimentos: "Investimentos",
};

type Transaction = { id: string; type: string; category: string | null; amount: number; date: string; description: string };
interface Props { transactions: Transaction[] }

const fmt = (v: number) => `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export function FinAnnualCharts({ transactions }: Props) {
  const nonCaixa = useMemo(() => transactions.filter((t) => t.type !== "caixa" && t.category !== "caixa"), [transactions]);

  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    nonCaixa.filter(t => t.type === "saida").forEach((t) => {
      const label = CATEGORY_LABELS[t.category ?? ""] ?? t.category ?? "Outros";
      cats[label] = (cats[label] || 0) + Number(t.amount);
    });
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [nonCaixa]);

  const totalExpDonut = categoryData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid gap-6">
      {/* Donut — same style as Fluxo de Caixa */}
      <Card className="opacity-0 max-w-lg mx-auto w-full" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.35s" }}>
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
            <p className="text-center text-sm text-muted-foreground py-12">Nenhum dado para o ano selecionado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
