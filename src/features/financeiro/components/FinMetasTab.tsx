import { useState, useMemo } from "react";
import { Target, Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useFinGoals, useUpsertFinGoal, useFinAllRevenues, useFinAllExpenses, type FinGoal } from "../hooks/use-financial-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { FinMonthYearSelector } from "./FinMonthYearSelector";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function FinMetasTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const goalsQ = useFinGoals(year);
  const revenuesQ = useFinAllRevenues(year);
  const expensesQ = useFinAllExpenses(year);
  const upsertGoal = useUpsertFinGoal();

  const goals = goalsQ.data ?? [];
  const revenues = revenuesQ.data ?? [];
  const expenses = expensesQ.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [form, setForm] = useState({ revenue_goal: "", expense_limit: "" });

  const annualGoal = goals.find((g) => g.month === null);
  const monthlyGoals = useMemo(() => {
    const map = new Map<number, FinGoal>();
    goals.filter((g) => g.month !== null).forEach((g) => map.set(g.month!, g));
    return map;
  }, [goals]);

  const chartData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const rev = revenues.filter((r) => r.month === m && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
      const goal = monthlyGoals.get(m);
      return { month: MONTHS[i], realizado: rev, meta: goal ? Number(goal.revenue_goal) : 0 };
    });
  }, [revenues, monthlyGoals]);

  const totalRealizado = chartData.reduce((s, d) => s + d.realizado, 0);
  const totalMeta = annualGoal ? Number(annualGoal.revenue_goal) : chartData.reduce((s, d) => s + d.meta, 0);
  const progressPct = totalMeta > 0 ? Math.min((totalRealizado / totalMeta) * 100, 100) : 0;

  const openGoalDialog = (month: number | null) => {
    const existing = month === null ? annualGoal : monthlyGoals.get(month);
    setEditingMonth(month);
    setForm({
      revenue_goal: existing ? String(existing.revenue_goal) : "",
      expense_limit: existing ? String(existing.expense_limit) : "",
    });
    setDialogOpen(true);
  };

  const saveGoal = () => {
    const existing = editingMonth === null ? annualGoal : monthlyGoals.get(editingMonth!);
    upsertGoal.mutate(
      {
        ...(existing ? { id: existing.id } : {}),
        year,
        month: editingMonth,
        revenue_goal: parseFloat(form.revenue_goal) || 0,
        expense_limit: parseFloat(form.expense_limit) || 0,
      } as any,
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  return (
    <div className="space-y-6">
      <FinMonthYearSelector month={1} year={year} onMonthChange={() => {}} onYearChange={setYear} yearOnly />

      {/* Annual goal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Target className="h-5 w-5" /> Meta Anual</CardTitle>
            <Button size="sm" variant="outline" onClick={() => openGoalDialog(null)}>
              {annualGoal ? <><Pencil className="mr-1 h-3.5 w-3.5" /> Editar</> : <><Plus className="mr-1 h-3.5 w-3.5" /> Definir</>}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Realizado: R$ {totalRealizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            <span>Meta: R$ {totalMeta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
          </div>
          <Progress value={progressPct} className="h-3" />
          <p className="text-center text-sm font-medium">{progressPct.toFixed(1)}% da meta</p>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Meta vs Realizado</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
              <Legend />
              <Bar dataKey="meta" name="Meta" fill="hsl(var(--muted-foreground) / 0.3)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly progress */}
      <Card>
        <CardHeader><CardTitle className="text-base">Progresso Mensal</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const goal = monthlyGoals.get(m);
            const rev = revenues.filter((r) => r.month === m && r.status === "pago").reduce((s, r) => s + Number(r.amount), 0);
            const metaVal = goal ? Number(goal.revenue_goal) : 0;
            const pct = metaVal > 0 ? Math.min((rev / metaVal) * 100, 100) : 0;
            return (
              <div key={m} className="flex items-center gap-3">
                <span className="w-8 text-sm font-medium text-muted-foreground">{MONTHS[i]}</span>
                <div className="flex-1">
                  <Progress value={pct} className="h-2" />
                </div>
                <span className="w-16 text-right text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openGoalDialog(m)}>
                  {goal ? <Pencil className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Goal dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMonth === null ? "Meta Anual" : `Meta — ${MONTHS[(editingMonth ?? 1) - 1]}`}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Meta de Receita (R$)</Label><Input type="number" step="0.01" value={form.revenue_goal} onChange={(e) => setForm((p) => ({ ...p, revenue_goal: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Limite de Despesas (R$)</Label><Input type="number" step="0.01" value={form.expense_limit} onChange={(e) => setForm((p) => ({ ...p, expense_limit: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveGoal} disabled={upsertGoal.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
