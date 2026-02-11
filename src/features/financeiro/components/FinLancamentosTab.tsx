import { useState, useRef, useMemo } from "react";
import { Plus, Upload, ArrowUpCircle, ArrowDownCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useFinTransactions, useUpsertFinTransaction, useBulkInsertTransactions, type FinTransaction } from "../hooks/use-financial-data";
import { format } from "date-fns";
import { FinMonthYearSelector } from "./FinMonthYearSelector";

type CSVRow = { date: string; description: string; amount: number; type: "entrada" | "saida" };

export function FinLancamentosTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const txQ = useFinTransactions(year, month);
  const upsertTx = useUpsertFinTransaction();
  const bulkInsert = useBulkInsertTransactions();

  const transactions = txQ.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const TRANSACTION_CATEGORIES = [
    { value: "receita_recorrente", label: "Receita Recorrente" },
    { value: "receita_variavel", label: "Receita Variável" },
    { value: "receita_outros", label: "Receita Outros" },
    { value: "impostos", label: "Impostos" },
    { value: "despesa_operacional", label: "Despesas Operacional" },
    { value: "despesa_administrativa", label: "Despesas Administrativas" },
    { value: "despesa_financeira", label: "Despesas Financeiras" },
    { value: "despesa_comercial", label: "Despesas Comerciais" },
    { value: "despesa_outros", label: "Despesas Outros" },
    { value: "despesa_variavel", label: "Despesas Variáveis" },
    { value: "investimentos", label: "Investimentos" },
    { value: "caixa", label: "Caixa" },
  ];

  const emptyForm = { description: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), category: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const getTypeFromCategory = (cat: string): string => {
    if (cat.startsWith("receita")) return "entrada";
    return "saida";
  };


  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [transactions, typeFilter, statusFilter]);

  const totalEntradas = filtered.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = filtered.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);

  const save = () => {
    const type = getTypeFromCategory(form.category);
    upsertTx.mutate(
      { description: form.description, amount: parseFloat(form.amount) || 0, date: form.date, type, category: form.category || null, status: "confirmado", notes: form.notes || null } as any,
      { onSuccess: () => { setDialogOpen(false); setForm(emptyForm); } },
    );
  };

  // CSV Import (Sicoob pattern: date;description;doc;value;balance)
  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const rows: CSVRow[] = [];
      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(";");
        if (cols.length < 4) continue;
        const dateStr = cols[0].trim();
        const desc = cols[1].trim();
        const valStr = cols[3].replace(/\./g, "").replace(",", ".").trim();
        const val = parseFloat(valStr);
        if (isNaN(val) || !desc) continue;
        // Parse DD/MM/YYYY to YYYY-MM-DD
        const parts = dateStr.split("/");
        const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
        rows.push({ date: isoDate, description: desc, amount: Math.abs(val), type: val >= 0 ? "entrada" : "saida" });
      }
      setCsvRows(rows);
      setCsvDialogOpen(true);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  };

  const importCSV = () => {
    bulkInsert.mutate(
      csvRows.map((r) => ({ ...r, source: "csv_import" })),
      { onSuccess: () => { setCsvDialogOpen(false); setCsvRows([]); } },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FinMonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="entrada">Entradas</SelectItem>
              <SelectItem value="saida">Saídas</SelectItem>
            </SelectContent>
          </Select>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} className="hidden" />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" /> Importar CSV</Button>
          <Button size="sm" onClick={() => { setForm(emptyForm); setDialogOpen(true); }}><Plus className="mr-1 h-4 w-4" /> Novo</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <ArrowUpCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="text-lg font-bold">R$ {totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <ArrowDownCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="text-lg font-bold">R$ {totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${totalEntradas - totalSaidas >= 0 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
              {totalEntradas - totalSaidas >= 0 ? "+" : "−"}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className="text-lg font-bold">R$ {Math.abs(totalEntradas - totalSaidas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-center">Categoria</TableHead>
              <TableHead className="text-center">Origem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.type === "entrada" ? <ArrowUpCircle className="h-4 w-4 text-success" /> : <ArrowDownCircle className="h-4 w-4 text-destructive" />}</TableCell>
                <TableCell className="text-sm">{t.date}</TableCell>
                <TableCell className="font-medium">{t.description}</TableCell>
                <TableCell className={`text-right font-medium ${t.type === "entrada" ? "text-success" : "text-destructive"}`}>
                  {t.type === "entrada" ? "+" : "−"} R$ {Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{TRANSACTION_CATEGORIES.find(c => c.value === t.category)?.label ?? t.category ?? "—"}</TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{t.source === "csv_import" ? "CSV" : "Manual"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem lançamentos neste período</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* New transaction dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Descrição *</Label><Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label>Categoria *</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={!form.description || !form.category || upsertTx.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV preview dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={setCsvDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Pré-visualização — {csvRows.length} lançamentos</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvRows.slice(0, 50).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{r.date}</TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell className="text-right text-sm">R$ {r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center"><Badge variant={r.type === "entrada" ? "default" : "secondary"}>{r.type}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {csvRows.length > 50 && <p className="text-xs text-muted-foreground">Mostrando 50 de {csvRows.length}</p>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={importCSV} disabled={bulkInsert.isPending}>Importar {csvRows.length} lançamentos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
