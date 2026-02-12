import { useState, useMemo } from "react";
import { Target, Plus, Trash2, ArrowUpCircle, ArrowDownCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useFinGoals, useMrrMovements, useUpsertMrrMovement, useDeleteMrrMovement, type FinGoal } from "../hooks/use-financial-data";

const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function parseMeta(goal: FinGoal | undefined) {
  return {
    metaFinal: goal ? Number(goal.revenue_goal) : 0,
    mrrInicial: goal ? Number(goal.expense_limit) : 0,
  };
}

export function FinMetasMensalTab() {
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const goalsQ = useFinGoals(year);
  const movQ = useMrrMovements(year);
  const upsertMov = useUpsertMrrMovement();
  const deleteMov = useDeleteMrrMovement();

  const goals = goalsQ.data ?? [];
  const movements = movQ.data ?? [];
  const annualGoal = goals.find((g) => g.month === null);
  const { metaFinal, mrrInicial } = parseMeta(annualGoal);

  // Monthly ideal target (linear from initial to final over 12 months)
  const metaMes = metaFinal > 0 ? mrrInicial + ((metaFinal - mrrInicial) / 12) * selectedMonth : 0;

  // MRR accumulated up to selected month
  const mrrAcumulado = useMemo(() => {
    let acc = mrrInicial;
    for (let m = 1; m <= selectedMonth; m++) {
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

  const faltaParaMeta = Math.max(metaMes - mrrAcumulado, 0);
  const progressoMes = metaMes > 0 ? Math.min((mrrAcumulado / metaMes) * 100, 100) : 0;
  const atingiuMeta = mrrAcumulado >= metaMes && metaMes > 0;

  // ── Movement dialog ──
  const [movOpen, setMovOpen] = useState(false);
  const [movForm, setMovForm] = useState({ type: "entrada", amount: "", description: "" });

  const openMovDialog = () => {
    setMovForm({ type: "entrada", amount: "", description: "" });
    setMovOpen(true);
  };

  const saveMov = () => {
    upsertMov.mutate(
      {
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
      {/* Month navigator */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth((p) => Math.max(p - 1, 1))} disabled={selectedMonth <= 1}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold">
          {MONTHS_FULL[selectedMonth - 1]} {year}
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedMonth((p) => Math.min(p + 1, 12))} disabled={selectedMonth >= 12}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {selectedMonth !== currentMonth && (
          <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => setSelectedMonth(currentMonth)}>
            Mês atual
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">MRR Acumulado</p>
            <p className="text-xl font-bold">{fmt(mrrAcumulado)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Meta do Mês</p>
            <p className="text-xl font-bold">{fmt(metaMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Falta para a Meta</p>
            <p className="text-xl font-bold">{faltaParaMeta > 0 ? fmt(faltaParaMeta) : "✓ Atingida"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <ArrowUpCircle className="h-3 w-3 text-green-500" /> Ganho no mês
            </p>
            <p className="text-xl font-bold text-green-600">{fmt(entradasMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
              <ArrowDownCircle className="h-3 w-3 text-red-500" /> Perdido no mês
            </p>
            <p className="text-xl font-bold text-red-600">{fmt(saidasMes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Variação Líquida</p>
            <p className={`text-xl font-bold ${variacaoMes >= 0 ? "text-green-600" : "text-red-600"}`}>
              {variacaoMes >= 0 ? "+" : ""}{fmt(variacaoMes)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress bar */}
      {metaMes > 0 && (
        <Card>
          <CardContent className="pt-4 pb-3 px-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progresso até a Meta de {MONTHS_FULL[selectedMonth - 1]}</span>
              <Badge variant={atingiuMeta ? "default" : "secondary"} className="text-xs">
                {progressoMes.toFixed(1)}%
              </Badge>
            </div>
            <Progress value={progressoMes} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmt(mrrAcumulado)}</span>
              <span>{fmt(metaMes)}</span>
            </div>
          </CardContent>
        </Card>
      )}

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
                <TableHead className="w-10"></TableHead>
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

      {/* New movement dialog */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Movimentação — {MONTHS_FULL[selectedMonth - 1]}</DialogTitle>
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
    </div>
  );
}
