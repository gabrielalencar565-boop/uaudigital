import { useState, useMemo } from "react";
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/metrics/ProgressRing";
import { useFinGoals, useMrrMovements, useUpsertMrrMovement, useDeleteMrrMovement, useUpsertFinGoal, type FinGoal } from "../hooks/use-financial-data";

const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function parseMeta(goal: FinGoal | undefined) {
  return {
    metaFinal: goal ? Number(goal.revenue_goal) : 0,
    mrrInicial: goal ? Number(goal.expense_limit) : 0,
  };
}

export function FinMetasMensalTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const currentMonth = now.getMonth() + 1;

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const goalsQ = useFinGoals(year);
  const movQ = useMrrMovements(year);
  const upsertMov = useUpsertMrrMovement();
  const deleteMov = useDeleteMrrMovement();
  const upsertGoal = useUpsertFinGoal();

  const goals = goalsQ.data ?? [];
  const movements = movQ.data ?? [];
  const annualGoal = goals.find((g) => g.month === null);
  const { metaFinal, mrrInicial } = parseMeta(annualGoal);

  // ── Edit MRR Inicial (January) ──
  const [editInicialOpen, setEditInicialOpen] = useState(false);
  const [editInicialValue, setEditInicialValue] = useState("");

  const openEditInicial = () => {
    setEditInicialValue(String(mrrInicial));
    setEditInicialOpen(true);
  };

  const saveInicial = () => {
    const newVal = parseFloat(editInicialValue) || 0;
    upsertGoal.mutate(
      {
        id: annualGoal?.id,
        year,
        month: null,
        revenue_goal: metaFinal,
        expense_limit: newVal,
        notes: annualGoal?.notes ?? null,
      } as any,
      { onSuccess: () => setEditInicialOpen(false) },
    );
  };

  // MRR accumulated up to END of previous month
  const mrrInicioMes = useMemo(() => {
    let acc = mrrInicial;
    for (let m = 1; m < selectedMonth; m++) {
      const ent = movements.filter((mv) => mv.type === "entrada" && mv.month === m).reduce((s, mv) => s + Number(mv.amount), 0);
      const sai = movements.filter((mv) => mv.type === "saida" && mv.month === m).reduce((s, mv) => s + Number(mv.amount), 0);
      acc += ent - sai;
    }
    return acc;
  }, [movements, mrrInicial, selectedMonth]);

  // Month-specific movements
  const monthMovements = movements.filter((m) => m.month === selectedMonth);
  const entradasMes = monthMovements.filter((m) => m.type === "entrada").reduce((s, m) => s + Number(m.amount), 0);
  const saidasMes = monthMovements.filter((m) => m.type === "saida").reduce((s, m) => s + Number(m.amount), 0);
  const variacaoMes = entradasMes - saidasMes;

  const mrrAtual = mrrInicioMes + entradasMes - saidasMes;

  const mesesRestantes = 12 - selectedMonth + 1;
  const faltaTotal = Math.max(metaFinal - mrrInicioMes, 0);
  const metaCrescimentoMes = metaFinal > 0 && mesesRestantes > 0 ? faltaTotal / mesesRestantes : 0;

  const progressoMes = metaCrescimentoMes > 0 ? Math.min((variacaoMes / metaCrescimentoMes) * 100, 100) : 0;
  const atingiuMeta = variacaoMes >= metaCrescimentoMes && metaCrescimentoMes > 0;
  const faltaParaMetaMes = Math.max(metaCrescimentoMes - variacaoMes, 0);
  const faltaParaMetaFinal = Math.max(metaFinal - mrrAtual, 0);
  const progressoMetaFinal = metaFinal > 0 ? Math.min((mrrAtual / metaFinal) * 100, 100) : 0;

  // ── Movement dialog (create + edit) ──
  const [movOpen, setMovOpen] = useState(false);
  const [editingMovId, setEditingMovId] = useState<string | null>(null);
  const [movForm, setMovForm] = useState({ type: "entrada", amount: "", description: "" });

  const openMovDialog = () => {
    setEditingMovId(null);
    setMovForm({ type: "entrada", amount: "", description: "" });
    setMovOpen(true);
  };

  const openEditMov = (m: any) => {
    setEditingMovId(m.id);
    setMovForm({ type: m.type, amount: String(m.amount), description: m.description ?? "" });
    setMovOpen(true);
  };

  const saveMov = () => {
    upsertMov.mutate(
      {
        ...(editingMovId ? { id: editingMovId } : {}),
        year,
        month: selectedMonth,
        type: movForm.type,
        amount: parseFloat(movForm.amount) || 0,
        description: movForm.description || null,
      } as any,
      { onSuccess: () => setMovOpen(false) },
    );
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Month and Year navigator */}
      <div className="flex items-center gap-3 flex-wrap opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
          if (selectedMonth <= 1) { setSelectedMonth(12); setYear((y) => y - 1); }
          else setSelectedMonth((p) => p - 1);
        }}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {MONTHS_FULL[selectedMonth - 1]}
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
          if (selectedMonth >= 12) { setSelectedMonth(1); setYear((y) => y + 1); }
          else setSelectedMonth((p) => p + 1);
        }}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        <span className="text-muted-foreground">|</span>

        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold">{year}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {(selectedMonth !== currentMonth || year !== now.getFullYear()) && (
          <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => { setSelectedMonth(currentMonth); setYear(now.getFullYear()); }}>
            Mês atual
          </Button>
        )}
      </div>

      {/* January: editable MRR Inicial */}
      {selectedMonth === 1 && (
        <Card>
          <CardContent className="pt-4 pb-3 px-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">MRR Inicial (base Janeiro)</p>
              <p className="text-xl font-bold">{fmt(mrrInicial)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={openEditInicial}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Big ring dashboards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 px-4 flex flex-col items-center">
            <p className="text-sm font-medium text-muted-foreground mb-3">Meta do Mês</p>
            <ProgressRing value={progressoMes} size={130} stroke={14} tone="auto" label={
              <div className="text-center">
                <p className="text-lg font-bold">{progressoMes.toFixed(0)}%</p>
              </div>
            } />
            <p className="text-base font-semibold mt-2">
              {faltaParaMetaMes > 0 ? `Falta ${fmt(faltaParaMetaMes)}` : "✓ Atingida"}
            </p>
            <p className="text-xs text-muted-foreground">Meta: +{fmt(metaCrescimentoMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 px-4 flex flex-col items-center">
            <p className="text-sm font-medium text-muted-foreground mb-3">Falta p/ Meta Final</p>
            <ProgressRing value={progressoMetaFinal} size={130} stroke={14} tone="auto" label={
              <div className="text-center">
                <p className="text-lg font-bold">{progressoMetaFinal.toFixed(0)}%</p>
              </div>
            } />
            <p className="text-base font-semibold mt-2">{faltaParaMetaFinal > 0 ? fmt(faltaParaMetaFinal) : "✓ Atingida"}</p>
            <p className="text-xs text-muted-foreground">Meta Final: {fmt(metaFinal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Small KPI Cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">MRR Atual</p>
            <p className="text-lg font-bold">{fmt(mrrAtual)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <ArrowUpCircle className="h-3 w-3 text-green-500" /> Ganho no mês
            </p>
            <p className="text-lg font-bold text-green-600">{fmt(entradasMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <ArrowDownCircle className="h-3 w-3 text-red-500" /> Perdido no mês
            </p>
            <p className="text-lg font-bold text-red-600">{fmt(saidasMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Variação Líquida</p>
            <p className={`text-lg font-bold ${variacaoMes >= 0 ? "text-green-600" : "text-red-600"}`}>
              {variacaoMes >= 0 ? "+" : ""}{fmt(variacaoMes)}
            </p>
          </CardContent>
        </Card>
      </div>




      {/* Month movements */}
      <Card>
        <CardContent className="pt-4 pb-3 px-2">
          <div className="flex items-center justify-between px-2 mb-3">
            <h4 className="text-sm font-semibold">Movimentações — {MONTHS_FULL[selectedMonth - 1]}</h4>
            <Button size="sm" onClick={openMovDialog}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Nova
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhuma movimentação neste mês
                  </TableCell>
                </TableRow>
              ) : (
                monthMovements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${m.type === "entrada" ? "border-green-500 text-green-600 bg-green-500/10" : "border-red-500 text-red-600 bg-red-500/10"}`}
                      >
                        {m.type === "entrada" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell>{m.description ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(m.amount))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMov(m)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMov.mutate({ id: m.id, year })}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Movement dialog (create + edit) */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMovId ? "Editar" : "Nova"} Movimentação — {MONTHS_FULL[selectedMonth - 1]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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

      {/* Edit MRR Inicial dialog */}
      <Dialog open={editInicialOpen} onOpenChange={setEditInicialOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar MRR Inicial</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>MRR Inicial (R$)</Label>
            <Input type="number" step="0.01" value={editInicialValue} onChange={(e) => setEditInicialValue(e.target.value)} />
            <p className="text-xs text-muted-foreground">Esse valor será a base para o cálculo de todos os meses.</p>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={saveInicial} disabled={upsertGoal.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
