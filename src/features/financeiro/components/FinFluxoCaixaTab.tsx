import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { Input } from "@/components/ui/input";
import { useFinClients, useFinAllTransactions, useFinOpeningBalances, useUpsertOpeningBalance } from "../hooks/use-financial-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { FinMonthYearSelector } from "./FinMonthYearSelector";

export function FinFluxoCaixaTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const clientsQ = useFinClients();
  const transactionsQ = useFinAllTransactions(year);
  const openingQ = useFinOpeningBalances(year);
  const upsertOpening = useUpsertOpeningBalance();

  const clients = clientsQ.data?.filter((c) => c.is_active) ?? [];
  const transactions = transactionsQ.data ?? [];
  const openingBalances = openingQ.data ?? [];

  // Opening balance for the selected month
  const openingRecord = openingBalances.find((b) => b.month === month);
  const caixaInicial = openingRecord ? Number(openingRecord.amount) : 0;

  // Filter transactions for the month (exclude "caixa" category)
  const monthTxs = useMemo(() => {
    return transactions.filter((t) => {
      if (t.category === "caixa") return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === month;
    });
  }, [transactions, month]);

  const totalReceita = monthTxs.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalDespesa = monthTxs.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const resultado = totalReceita - totalDespesa;
  const caixaFinal = caixaInicial + resultado;
  const ticketMedio = clients.length > 0 ? totalReceita / clients.length : 0;
  const margemLucro = totalReceita > 0 ? (resultado / totalReceita) * 100 : 0;

  // Category breakdown (exclude "caixa")
  const categoryData = useMemo(() => {
    const CATEGORY_LABELS: Record<string, string> = {
      receita_recorrente: "Receita Recorrente",
      receita_variavel: "Receita Variável",
      receita_outros: "Receita Outros",
      impostos: "Impostos",
      despesa_operacional: "Despesas Operacional",
      despesa_administrativa: "Despesas Administrativas",
      despesa_financeira: "Despesas Financeiras",
      despesa_comercial: "Despesas Comerciais",
      despesa_outros: "Despesas Outros",
      despesa_variavel: "Despesas Variáveis",
      investimentos: "Investimentos",
    };
    const cats: Record<string, number> = {};
    monthTxs.forEach((t) => {
      const label = CATEGORY_LABELS[t.category ?? ""] ?? t.category ?? "Outros";
      cats[label] = (cats[label] || 0) + Number(t.amount);
    });
    return Object.entries(cats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthTxs]);

  const [editingOpening, setEditingOpening] = useState(false);
  const [openingVal, setOpeningVal] = useState("");

  const handleSaveOpening = () => {
    const amt = parseFloat(openingVal) || 0;
    upsertOpening.mutate({
      year,
      month,
      amount: amt,
      ...(openingRecord ? { id: openingRecord.id } : {}),
    });
    setEditingOpening(false);
  };

  return (
    <div className="space-y-6">
      <div className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <FinMonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
      </div>

      {/* KPIs Row 1 */}
      <div className="grid gap-4 sm:grid-cols-2 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Receita</CardTitle></CardHeader>
          <CardContent><p className="text-4xl font-bold">R$ {totalReceita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Despesa</CardTitle></CardHeader>
          <CardContent><p className="text-4xl font-bold">R$ {totalDespesa.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
      </div>

      {/* KPIs Row 2: Lucro + Caixa Final */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Lucro</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${resultado >= 0 ? "text-success" : "text-destructive"}`}>
              {resultado < 0 ? "-" : ""}R$ {Math.abs(resultado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Caixa</CardTitle></CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${caixaFinal >= 0 ? "text-success" : "text-destructive"}`}>
              {caixaFinal < 0 ? "-" : ""}R$ {Math.abs(caixaFinal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Caixa inicial + Entradas − Saídas</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs Row 3 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex flex-col items-center justify-center py-4">
          <CardTitle className="text-sm font-medium uppercase mb-3">Margem de Lucro</CardTitle>
          <ProgressRing
            value={Math.min(Math.abs(margemLucro), 100)}
            size={120}
            stroke={12}
            tone={margemLucro >= 20 ? "success" : margemLucro >= 0 ? "warning" : "danger"}
            label={<span className={`text-2xl font-bold ${margemLucro >= 0 ? "" : "text-destructive"}`}>{margemLucro.toFixed(0)}%</span>}
          />
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Clientes</CardTitle></CardHeader>
          <CardContent><p className="text-4xl font-bold">{clients.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium uppercase">Ticket Médio</CardTitle></CardHeader>
          <CardContent><p className="text-4xl font-bold">R$ {ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium uppercase flex items-center gap-2">
              Caixa Inicial
              {!editingOpening && (
                <button
                  onClick={() => { setOpeningVal(String(caixaInicial)); setEditingOpening(true); }}
                  className="text-xs text-primary hover:underline font-normal"
                >
                  editar
                </button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingOpening ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.01"
                  value={openingVal}
                  onChange={(e) => setOpeningVal(e.target.value)}
                  className="h-9 w-40"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveOpening(); if (e.key === "Escape") setEditingOpening(false); }}
                />
                <button onClick={handleSaveOpening} className="text-sm text-primary hover:underline">Salvar</button>
                <button onClick={() => setEditingOpening(false)} className="text-sm text-muted-foreground hover:underline">Cancelar</button>
              </div>
            ) : (
              <p className="text-4xl font-bold">
                {caixaInicial < 0 ? "-" : ""}R$ {Math.abs(caixaInicial).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Horizontal Bar Chart by Category */}
      <Card>
        <CardHeader><CardTitle className="text-base">Fluxo por Categoria</CardTitle></CardHeader>
        <CardContent>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(200, categoryData.length * 50)}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" tickFormatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                <YAxis type="category" dataKey="name" className="text-xs" width={140} />
                <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                <Bar dataKey="value" name="Valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum dado para o mês selecionado</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}