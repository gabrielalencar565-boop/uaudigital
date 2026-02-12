import { useState, useMemo } from "react";
import { Target, TrendingUp, Pencil, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useFinGoals, useUpsertFinGoal, type FinGoal } from "../hooks/use-financial-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// We store MRR data in the annual goal row (month=null):
// revenue_goal = MRR Atual
// expense_limit = Meta Julho
// notes = Meta Dezembro (as string number)

function parseMrrGoal(goal: FinGoal | undefined) {
  return {
    mrrAtual: goal ? Number(goal.revenue_goal) : 0,
    metaJulho: goal ? Number(goal.expense_limit) : 0,
    metaDezembro: goal?.notes ? Number(goal.notes) : 0,
  };
}

export function FinMetasTab() {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  const goalsQ = useFinGoals(year);
  const upsertGoal = useUpsertFinGoal();
  const goals = goalsQ.data ?? [];
  const annualGoal = goals.find((g) => g.month === null);

  const { mrrAtual, metaJulho, metaDezembro } = parseMrrGoal(annualGoal);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ mrr_atual: "", meta_julho: "", meta_dezembro: "" });

  const openDialog = () => {
    setForm({
      mrr_atual: mrrAtual ? String(mrrAtual) : "",
      meta_julho: metaJulho ? String(metaJulho) : "",
      meta_dezembro: metaDezembro ? String(metaDezembro) : "",
    });
    setDialogOpen(true);
  };

  const saveGoal = () => {
    upsertGoal.mutate(
      {
        ...(annualGoal ? { id: annualGoal.id } : {}),
        year,
        month: null,
        revenue_goal: parseFloat(form.mrr_atual) || 0,
        expense_limit: parseFloat(form.meta_julho) || 0,
        notes: String(parseFloat(form.meta_dezembro) || 0),
      } as any,
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  // Calculations
  const mesesAteJulho = Math.max(7 - currentMonth, 1);
  const crescMensalJulho = metaJulho > 0 ? (metaJulho - mrrAtual) / mesesAteJulho : 0;
  const crescMensalDezembro = metaDezembro > 0 && metaJulho > 0 ? (metaDezembro - metaJulho) / 5 : 0;
  const progressoJulho = metaJulho > 0 ? Math.min((mrrAtual / metaJulho) * 100, 100) : 0;
  const progressoDezembro = metaDezembro > 0 ? Math.min((mrrAtual / metaDezembro) * 100, 100) : 0;

  // Timeline data: ideal MRR per month
  const timelineData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      let idealMrr = 0;
      if (metaJulho > 0 && m <= 7) {
        // Linear interpolation from current to July
        const startMonth = currentMonth;
        if (m < startMonth) {
          idealMrr = 0;
        } else {
          const progress = (m - startMonth) / Math.max(7 - startMonth, 1);
          idealMrr = mrrAtual + (metaJulho - mrrAtual) * progress;
        }
      } else if (metaDezembro > 0 && m > 7) {
        // Linear interpolation from July to December
        const progress = (m - 7) / 5;
        idealMrr = metaJulho + (metaDezembro - metaJulho) * progress;
      }
      return {
        month: MONTHS_SHORT[i],
        mrrIdeal: Math.round(idealMrr),
        isCurrent: m === currentMonth,
      };
    });
  }, [mrrAtual, metaJulho, metaDezembro, currentMonth]);

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5" /> Metas MRR — {year}
        </h3>
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar Metas
        </Button>
      </div>

      {/* Editable values summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">MRR Atual</p>
            <p className="text-xl font-bold">{fmt(mrrAtual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Meta Julho</p>
            <p className="text-xl font-bold">{fmt(metaJulho)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Meta Dezembro</p>
            <p className="text-xl font-bold">{fmt(metaDezembro)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Calculated KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Crescimento mensal até Julho</p>
            </div>
            <p className="text-2xl font-bold">{fmt(crescMensalJulho)}</p>
            <p className="text-xs text-muted-foreground">{mesesAteJulho} meses restantes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Crescimento mensal Jul → Dez</p>
            </div>
            <p className="text-2xl font-bold">{fmt(crescMensalDezembro)}</p>
            <p className="text-xs text-muted-foreground">5 meses (Ago–Dez)</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progresso → Julho</span>
              <span className="font-bold">{progressoJulho.toFixed(1)}%</span>
            </div>
            <Progress value={progressoJulho} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmt(mrrAtual)}</span>
              <span>{fmt(metaJulho)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progresso → Dezembro</span>
              <span className="font-bold">{progressoDezembro.toFixed(1)}%</span>
            </div>
            <Progress value={progressoDezembro} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmt(mrrAtual)}</span>
              <span>{fmt(metaDezembro)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="h-4 w-4" /> Linha do Tempo — MRR Ideal por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend />
              <Bar dataKey="mrrIdeal" name="MRR Ideal" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              {mrrAtual > 0 && <ReferenceLine y={mrrAtual} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "MRR Atual", position: "insideTopRight", fontSize: 11 }} />}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Metas MRR — {year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>MRR Atual (R$)</Label>
              <Input type="number" step="0.01" value={form.mrr_atual} onChange={(e) => setForm((p) => ({ ...p, mrr_atual: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Meta de MRR para Julho (R$)</Label>
              <Input type="number" step="0.01" value={form.meta_julho} onChange={(e) => setForm((p) => ({ ...p, meta_julho: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Meta de MRR para Dezembro (R$)</Label>
              <Input type="number" step="0.01" value={form.meta_dezembro} onChange={(e) => setForm((p) => ({ ...p, meta_dezembro: e.target.value }))} />
            </div>
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
