import { useState, useRef, useMemo, useCallback } from "react";
import { Plus, Upload, ArrowUpCircle, ArrowDownCircle, Eye, Pencil, Trash2, FileSpreadsheet, Check, X, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker, DatePickerInline } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useFinTransactions, useUpsertFinTransaction, useDeleteFinTransaction, useBulkInsertTransactions, useFinAllTransactions, useFinOpeningBalances, useUpsertOpeningBalance, type FinTransaction } from "../hooks/use-financial-data";
import { format } from "date-fns";
import { FinMonthYearSelector } from "./FinMonthYearSelector";
import * as XLSX from "xlsx";
import { toast } from "sonner";

type CSVRow = { date: string; description: string; amount: number; type: "entrada" | "saida" };

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
];

const getTypeFromCategory = (cat: string): string => {
  if (cat.startsWith("receita")) return "entrada";
  return "saida";
};

const formatDayMonth = (dateStr: string) => {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
};

// ── Inline editable cell components ──

type EditingCell = { txId: string; field: "date" | "description" | "amount" | "category" } | null;

function InlineDateCell({ tx, isEditing, onStartEdit, onSave }: {
  tx: FinTransaction; isEditing: boolean; onStartEdit: () => void; onSave: (val: string) => void;
}) {
  const [val, setVal] = useState(tx.date);
  if (!isEditing) return (
    <span className="cursor-pointer hover:underline decoration-dotted underline-offset-4" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
      {formatDayMonth(tx.date)}
    </span>
  );
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <DatePickerInline value={val} onChange={(v) => { setVal(v); onSave(v); }} />
    </div>
  );
}

function InlineTextCell({ tx, isEditing, onStartEdit, onSave }: {
  tx: FinTransaction; isEditing: boolean; onStartEdit: () => void; onSave: (val: string) => void;
}) {
  const [val, setVal] = useState(tx.description);
  if (!isEditing) return (
    <span className="cursor-pointer hover:underline decoration-dotted underline-offset-4 font-medium" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
      {tx.description}
    </span>
  );
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <Input value={val} onChange={e => setVal(e.target.value)} className="h-7 text-xs" autoFocus
        onKeyDown={e => { if (e.key === "Enter") onSave(val); if (e.key === "Escape") onSave(tx.description); }}
        onBlur={() => onSave(val)} />
    </div>
  );
}

function InlineAmountCell({ tx, isEditing, onStartEdit, onSave }: {
  tx: FinTransaction; isEditing: boolean; onStartEdit: () => void; onSave: (val: number) => void;
}) {
  const [val, setVal] = useState(String(tx.amount));
  if (!isEditing) return (
    <span className={`cursor-pointer hover:underline decoration-dotted underline-offset-4 font-medium ${tx.type === "entrada" ? "text-success" : "text-destructive"}`}
      onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
      {tx.type === "entrada" ? "+" : "−"} R$ {Number(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
    </span>
  );
  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <Input type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)} className="h-7 w-28 text-xs text-right" autoFocus
        onKeyDown={e => { if (e.key === "Enter") onSave(parseFloat(val) || tx.amount); if (e.key === "Escape") onSave(tx.amount); }}
        onBlur={() => onSave(parseFloat(val) || tx.amount)} />
    </div>
  );
}

function InlineCategoryCell({ tx, isEditing, onStartEdit, onSave }: {
  tx: FinTransaction; isEditing: boolean; onStartEdit: () => void; onSave: (val: string) => void;
}) {
  const label = TRANSACTION_CATEGORIES.find(c => c.value === tx.category)?.label ?? tx.category ?? "—";
  if (!isEditing) return (
    <span className="cursor-pointer hover:underline decoration-dotted underline-offset-4 text-xs text-muted-foreground" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
      {label}
    </span>
  );
  return (
    <div onClick={e => e.stopPropagation()}>
      <Select defaultValue={tx.category ?? ""} onValueChange={(v) => onSave(v)}>
        <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          {TRANSACTION_CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Main component ──

export function FinLancamentosTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const txQ = useFinTransactions(year, month);
  const allTxQ = useFinAllTransactions(year);
  const upsertTx = useUpsertFinTransaction();
  const deleteTx = useDeleteFinTransaction();
  const bulkInsert = useBulkInsertTransactions();
  const balancesQ = useFinOpeningBalances(year);
  const upsertBalance = useUpsertOpeningBalance();

  const transactions = txQ.data ?? [];
  const balances = balancesQ.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinTransaction | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editingCaixa, setEditingCaixa] = useState(false);
  const [caixaInput, setCaixaInput] = useState("");

  const emptyForm = { description: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), category: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  // Filter out any legacy "caixa" transactions from display
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type === "caixa" || t.category === "caixa") return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [transactions, typeFilter, statusFilter]);

  const totalEntradas = filtered.filter((t) => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = filtered.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);

  // Caixa Final from financial_opening_balances (manual value)
  const currentBalance = balances.find(b => b.month === month);
  const caixaFinal = currentBalance ? Number(currentBalance.amount) : null;

  const saveCaixaFinal = () => {
    const val = parseFloat(caixaInput);
    if (isNaN(val)) return;
    upsertBalance.mutate(
      { year, month, amount: val, ...(currentBalance ? { id: currentBalance.id } : {}) },
      { onSuccess: () => { setEditingCaixa(false); } }
    );
  };

  const openNew = () => {
    setEditingTx(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (tx: FinTransaction) => {
    // Don't open dialog if we're inline editing
    if (editingCell) return;
    setEditingTx(tx);
    setForm({
      description: tx.description,
      amount: String(tx.amount),
      date: tx.date,
      category: tx.category ?? "",
      notes: tx.notes ?? "",
    });
    setDialogOpen(true);
  };

  const save = () => {
    const type = getTypeFromCategory(form.category);
    upsertTx.mutate(
      {
        ...(editingTx ? { id: editingTx.id } : {}),
        description: form.description,
        amount: parseFloat(form.amount) || 0,
        date: form.date,
        type,
        category: form.category || null,
        status: "confirmado",
        notes: form.notes || null,
      } as any,
      { onSuccess: () => { setDialogOpen(false); setForm(emptyForm); setEditingTx(null); } },
    );
  };

  // Inline save for individual fields
  const inlineSave = useCallback((tx: FinTransaction, field: string, value: any) => {
    setEditingCell(null);
    const updates: any = {
      id: tx.id,
      description: tx.description,
      amount: tx.amount,
      date: tx.date,
      type: tx.type,
      category: tx.category,
      status: tx.status,
      notes: tx.notes,
    };

    if (field === "category") {
      updates.category = value;
      updates.type = getTypeFromCategory(value);
    } else {
      updates[field] = value;
    }

    // Skip if nothing changed
    if (updates[field] === (tx as any)[field] && field !== "category") return;

    upsertTx.mutate(updates);
  }, [upsertTx]);

  // ── XLSX parser (supports multiple formats) ──
  const parseXlsx = (data: ArrayBuffer): CSVRow[] => {
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    const rows: CSVRow[] = [];

    // Detect format by looking for header row
    let headerIdx = -1;
    let colDate = -1, colDesc = -1, colValor = -1;

    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const cells = raw[i].map((c: any) => String(c).trim().toUpperCase());
      const dateCol = cells.findIndex(c => c === "DATA");
      const descCol = cells.findIndex(c => c === "DESCRIÇÃO" || c === "DESCRICAO" || c === "HISTORICO" || c === "HISTÓRICO");
      const valCol = cells.findIndex(c => c === "VALOR" || c === "QUANTIA" || c === "AMOUNT");
      if (dateCol >= 0 && descCol >= 0 && valCol >= 0) {
        headerIdx = i;
        colDate = dateCol;
        colDesc = descCol;
        colValor = valCol;
        break;
      }
    }

    // Format A: 3-column (DATA, DESCRIÇÃO, VALOR) — simple numeric values
    if (headerIdx >= 0) {
      for (let i = headerIdx + 1; i < raw.length; i++) {
        const cells = raw[i];
        if (!cells || cells.length < Math.max(colDate, colDesc, colValor) + 1) continue;

        let dateRaw = String(cells[colDate] ?? "").trim();
        const desc = String(cells[colDesc] ?? "").trim();
        let valorRaw = cells[colValor];

        if (!desc || desc.toUpperCase().includes("SALDO")) continue;

        // Parse value — can be number or string with comma
        let numVal: number;
        if (typeof valorRaw === "number") {
          numVal = valorRaw;
        } else {
          const valStr = String(valorRaw).replace(/[D|C]/g, "").replace(/\s/g, "");
          numVal = parseFloat(valStr.replace(/\./g, "").replace(",", "."));
        }
        if (isNaN(numVal) || numVal === 0) continue;

        const type: "entrada" | "saida" = numVal > 0 ? "entrada" : "saida";
        const amount = Math.abs(numVal);

        // Parse date: dd/mm, dd/mm/yyyy, or Excel serial number
        let isoDate = "";
        if (typeof cells[colDate] === "number") {
          // Excel serial date
          const excelDate = XLSX.SSF.parse_date_code(cells[colDate]);
          if (excelDate) {
            isoDate = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
          }
        }
        if (!isoDate) {
          // Try dd/mm/yyyy or dd/mm
          const parts = dateRaw.split("/");
          if (parts.length === 3) {
            isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else if (parts.length === 2) {
            // dd/mm — use selected year
            isoDate = `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
          }
        }
        if (!isoDate) continue;

        rows.push({ date: isoDate, description: desc, amount, type });
      }
      return rows;
    }

    // Format B (legacy Sicoob): date in col 0 (dd/mm/yyyy), historico in col 2, value in col 3 with C/D suffix
    let currentDate = "";
    for (let i = 0; i < raw.length; i++) {
      const cells = raw[i].map((c: any) => String(c).trim());
      if (!cells[0] && !cells[2] && !cells[3]) continue;
      if (cells[0] === "DATA" || cells[0] === "EXTRATO CONTA CORRENTE") continue;

      if (cells[0] && /^\d{2}\/\d{2}\/\d{4}$/.test(cells[0])) {
        currentDate = cells[0];
      }

      const historico = cells[2] || "";
      const valorStr = cells[3] || "";

      if (!valorStr || historico.includes("SALDO DO DIA")) continue;
      if (!cells[0] && !valorStr) continue;

      const cleanVal = valorStr.replace(/[D|C]/g, "").replace(/\s/g, "").replace("-", "");
      const numVal = parseFloat(cleanVal.replace(/\./g, "").replace(",", "."));
      if (isNaN(numVal) || numVal === 0) continue;

      const isCredit = valorStr.includes("C");
      const type: "entrada" | "saida" = isCredit ? "entrada" : "saida";

      const parts = currentDate.split("/");
      const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : currentDate;

      rows.push({ date: isoDate, description: historico, amount: numVal, type });
    }

    return rows;
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    if (isXlsx) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = ev.target?.result as ArrayBuffer;
        const parsed = parseXlsx(data);
        if (parsed.length === 0) {
          toast.error("Nenhum lançamento encontrado no arquivo.");
          return;
        }
        setCsvRows(parsed);
        setCsvDialogOpen(true);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const lines = text.split("\n").filter(Boolean);
        const rows: CSVRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(";");
          if (cols.length < 4) continue;
          const dateStr = cols[0].trim();
          const desc = cols[1].trim();
          const valStr = cols[3].replace(/\./g, "").replace(",", ".").trim();
          const val = parseFloat(valStr);
          if (isNaN(val) || !desc) continue;
          const parts = dateStr.split("/");
          const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : dateStr;
          rows.push({ date: isoDate, description: desc, amount: Math.abs(val), type: val >= 0 ? "entrada" : "saida" });
        }
        setCsvRows(rows);
        setCsvDialogOpen(true);
      };
      reader.readAsText(file, "utf-8");
    }
    e.target.value = "";
  };

  const isXlsxImport = csvRows.length > 0 && csvRows[0]?.description !== undefined;

  const importCSV = () => {
    bulkInsert.mutate(
      csvRows.map((r) => ({ ...r, source: isXlsxImport ? "xlsx_import" : "csv_import" })),
      { onSuccess: () => { setCsvDialogOpen(false); setCsvRows([]); } },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0s" }}>
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
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileImport} className="hidden" />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="mr-1 h-4 w-4" /> Importar</Button>
          <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Novo</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <ArrowUpCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="text-xl font-bold">R$ {totalEntradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <ArrowDownCircle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="text-xl font-bold">R$ {totalSaidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${totalEntradas - totalSaidas >= 0 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
              {totalEntradas - totalSaidas >= 0 ? "+" : "−"}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo do Mês</p>
              <p className="text-xl font-bold">R$ {Math.abs(totalEntradas - totalSaidas).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${caixaFinal >= 0 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
              $
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Caixa Final</p>
              <p className={`text-xl font-bold ${caixaFinal >= 0 ? "text-success" : "text-destructive"}`}>
                {caixaFinal < 0 ? "-" : ""}R$ {Math.abs(caixaFinal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
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
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => (
              <TableRow key={t.id} className="hover:bg-accent/30">
                <TableCell>{t.type === "entrada" ? <ArrowUpCircle className="h-4 w-4 text-success" /> : <ArrowDownCircle className="h-4 w-4 text-destructive" />}</TableCell>
                <TableCell className="text-sm">
                  <InlineDateCell tx={t}
                    isEditing={editingCell?.txId === t.id && editingCell?.field === "date"}
                    onStartEdit={() => setEditingCell({ txId: t.id, field: "date" })}
                    onSave={(val) => inlineSave(t, "date", val)} />
                </TableCell>
                <TableCell>
                  <InlineTextCell tx={t}
                    isEditing={editingCell?.txId === t.id && editingCell?.field === "description"}
                    onStartEdit={() => setEditingCell({ txId: t.id, field: "description" })}
                    onSave={(val) => inlineSave(t, "description", val)} />
                </TableCell>
                <TableCell className="text-right">
                  <InlineAmountCell tx={t}
                    isEditing={editingCell?.txId === t.id && editingCell?.field === "amount"}
                    onStartEdit={() => setEditingCell({ txId: t.id, field: "amount" })}
                    onSave={(val) => inlineSave(t, "amount", val)} />
                </TableCell>
                <TableCell className="text-center">
                  <InlineCategoryCell tx={t}
                    isEditing={editingCell?.txId === t.id && editingCell?.field === "category"}
                    onStartEdit={() => setEditingCell({ txId: t.id, field: "category" })}
                    onSave={(val) => inlineSave(t, "category", val)} />
                </TableCell>
                <TableCell className="text-center text-xs text-muted-foreground">{t.source === "csv_import" ? "CSV" : t.source === "xlsx_import" ? "XLSX" : "Manual"}</TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                          <AlertDialogDescription>"{t.description}" será removido permanentemente.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTx.mutate(t.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem lançamentos neste período</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* New transaction dialog (kept for "Novo" button) */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingTx ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Data</Label><DatePicker value={form.date} onChange={(v) => setForm((p) => ({ ...p, date: v }))} className="w-full" /></div>
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
                    <TableCell className="text-sm">{formatDayMonth(r.date)}</TableCell>
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
