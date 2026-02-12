import { useState, useMemo } from "react";
import { Target, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinGoals, useUpsertFinGoal, useMrrMovements, useUpsertMrrMovement, useDeleteMrrMovement, type FinGoal } from "../hooks/use-financial-data";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function parseMeta(goal: FinGoal | undefined) {
  return {
    metaFinal: goal ? Number(goal.revenue_goal) : 0,
    mrrInicial: goal ? Number(goal.expense_limit) : 0,
  };
}

export function FinMetasAnualTab() {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const goalsQ = useFinGoals(year);
  const upsertGoal = useUpsertFinGoal();
  const movQ = useMrrMovements(year);
  const upsertMov = useUpsertMrrMovement();
  const deleteMov = useDeleteMrrMovement();

  const goals = goalsQ.data ?? [];
  const movements = movQ.data ?? [];
  const annualGoal = goals.find((g) => g.month === null);
  const { metaFinal, mrrInicial } = parseMeta(annualGoal);

  // ── Meta dialog ──
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaForm, setMetaForm] = useState({ meta_final: "", mrr_inicial: "" });

  const openMetaDialog = () => {
    setMetaForm({
      meta_final: metaFinal ? String(metaFinal) : "",
      mrr_inicial: mrrInicial ? String(mrrInicial) : "",
    });
    setMetaOpen(true);
  };

  const saveMeta = () => {
    upsertGoal.mutate(
      {
        ...(annualGoal ? { id: annualGoal.id } : {}),
        year,
        month: null,
        revenue_goal: parseFloat(metaForm.meta_final) || 0,
        expense_limit: parseFloat(metaForm.mrr_inicial) || 0,
      } as any,
      { onSuccess: () => setMetaOpen(false) },
    );
  };

  // ── Movement dialog ──
  const [movOpen, setMovOpen] = useState(false);
  const [movForm, setMovForm] = useState({ month: String(currentMonth), type: "entrada", amount: "", description: "" });

  const openMovDialog = () => {
    setMovForm({ month: String(currentMonth), type: "entrada", amount: "", description: "" });
    setMovOpen(true);
  };

  const saveMov = () => {
    upsertMov.mutate(
      {
        year,
        month: parseInt(movForm.month),
        type: movForm.type,
        amount: parseFloat(movForm.amount) || 0,
        description: movForm.description || null,
      } as any,
      { onSuccess: () => setMovOpen(false) },
    );
  };

  // ── Calculations ──
  const totalEntradas = movements.filter((m) => m.type === "entrada").reduce((s, m) => s + Number(m.amount), 0);
  const totalSaidas = movements.filter((m) => m.type === "saida").reduce((s, m) => s + Number(m.amount), 0);
  const mrrAtual = mrrInicial + totalEntradas - totalSaidas;

  const faltante = Math.max(metaFinal - mrrAtual, 0);
  const mesesRestantes = Math.max(12 - currentMonth + 1, 1);
  const metaMensal = metaFinal > 0 ? faltante / mesesRestantes : 0;
  const progresso = metaFinal > 0 ? Math.min((mrrAtual / metaFinal) * 100, 100) : 0;

  // ── Timeline data ──
  const timelineData = useMemo(() => {
    let acumulado = mrrInicial;
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const entM = movements.filter((mv) => mv.type === "entrada" && mv.month === m).reduce((s, mv) => s + Number(mv.amount), 0);
      const saiM = movements.filter((mv) => mv.type === "saida" && mv.month === m).reduce((s, mv) => s + Number(mv.amount), 0);
      acumulado += entM - saiM;

      const idealMrr = metaFinal > 0 ? mrrInicial + ((metaFinal - mrrInicial) / 12) * m : 0;
      const diff = acumulado - idealMrr;

      return {
        month: MONTHS_SHORT[i],
        mrrReal: m <= currentMonth ? Math.round(acumulado) : null,
        metaIdeal: Math.round(idealMrr),
        diff: m <= currentMonth ? Math.round(diff) : null,
        isAbove: m <= currentMonth ? acumulado >= idealMrr : null,
      };
    });
  }, [movements, mrrInicial, metaFinal, currentMonth]);

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5" /> Meta Anual — {year}
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openMetaDialog}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar Meta
          </Button>
          <Button size="sm" onClick={openMovDialog}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Nova Movimentação
          </Button>
        </div>
      </div>

      {/* Big ring dashboards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 px-4 flex flex-col items-center">
            <p className="text-sm font-medium text-muted-foreground mb-3">Falta p/ Meta Final</p>
            <ProgressRing value={progresso} size={130} stroke={14} tone="auto" label={
              <div className="text-center">
                <p className="text-lg font-bold">{progresso.toFixed(0)}%</p>
              </div>
            } />
            <p className="text-base font-semibold mt-2">{faltante > 0 ? fmt(faltante) : "✓ Atingida"}</p>
            <p className="text-xs text-muted-foreground">Meta: {fmt(metaFinal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-4 flex flex-col items-center">
            <p className="text-sm font-medium text-muted-foreground mb-3">Crescer/mês</p>
            <ProgressRing value={metaFinal > 0 ? Math.min(((mrrAtual - mrrInicial) / (metaFinal - mrrInicial)) * 100, 100) : 0} size={130} stroke={14} tone="auto" label={
              <div className="text-center">
                <p className="text-lg font-bold">{fmt(metaMensal)}</p>
              </div>
            } />
            <p className="text-base font-semibold mt-2">{mesesRestantes} meses restantes</p>
          </CardContent>
        </Card>
      </div>

      {/* Small KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">MRR Atual</p>
            <p className="text-xl font-bold">{fmt(mrrAtual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Meta Final</p>
            <p className="text-xl font-bold">{fmt(metaFinal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly timeline table */}
      <Card>
        <CardContent className="pt-4 pb-3 px-2">
          <h4 className="text-sm font-semibold mb-3 px-2">Evolução Mensal</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">MRR Real</TableHead>
                <TableHead className="text-right">Meta Ideal</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead className="text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timelineData.map((row, i) => (
                <TableRow key={i} className={i + 1 === currentMonth ? "bg-accent/30" : ""}>
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell className="text-right">{row.mrrReal !== null ? fmt(row.mrrReal) : "—"}</TableCell>
                  <TableCell className="text-right">{fmt(row.metaIdeal)}</TableCell>
                  <TableCell className="text-right">
                    {row.diff !== null ? (
                      <span className={row.diff >= 0 ? "text-green-600" : "text-red-600"}>
                        {row.diff >= 0 ? "+" : ""}{fmt(row.diff)}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.isAbove !== null ? (
                      <Badge variant={row.isAbove ? "default" : "destructive"} className="text-[10px]">
                        {row.isAbove ? "OK" : "Abaixo"}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Timeline chart */}
      <Card>
        <CardContent className="pt-4 pb-3 px-4">
          <h4 className="text-sm font-semibold mb-3">MRR Real vs Meta Ideal</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="metaIdeal" name="Meta Ideal" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[4, 4, 0, 0]} />
              <Bar dataKey="mrrReal" name="MRR Real" radius={[4, 4, 0, 0]}>
                {timelineData.map((entry, i) => (
                  <Cell key={i} fill={entry.isAbove === false ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                ))}
              </Bar>
              {metaFinal > 0 && <ReferenceLine y={metaFinal} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: "Meta Final", position: "insideTopRight", fontSize: 11 }} />}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* All movements table */}
      <Card>
        <CardContent className="pt-4 pb-3 px-2">
          <h4 className="text-sm font-semibold mb-3 px-2">Todas as Movimentações — {year}</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhuma movimentação registrada
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{MONTHS_SHORT[m.month - 1]}/{year}</TableCell>
                    <TableCell>
                      <Badge variant={m.type === "entrada" ? "default" : "destructive"} className="text-[10px]">
                        {m.type === "entrada" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.description ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(m.amount))}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMov.mutate({ id: m.id, year })}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit meta dialog */}
      <Dialog open={metaOpen} onOpenChange={setMetaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Meta MRR — {year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Meta Final de MRR (R$)</Label>
              <Input type="number" step="0.01" value={metaForm.meta_final} onChange={(e) => setMetaForm((p) => ({ ...p, meta_final: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>MRR Inicial (R$) <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input type="number" step="0.01" value={metaForm.mrr_inicial} onChange={(e) => setMetaForm((p) => ({ ...p, mrr_inicial: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveMeta} disabled={upsertGoal.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New movement dialog */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Movimentação de MRR</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mês</Label>
                <Select value={movForm.month} onValueChange={(v) => setMovForm((p) => ({ ...p, month: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_SHORT.map((m, i) => (
                      <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={movForm.type} onValueChange={(v) => setMovForm((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={movForm.amount} onChange={(e) => setMovForm((p) => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descrição <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input value={movForm.description} onChange={(e) => setMovForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveMov} disabled={upsertMov.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
