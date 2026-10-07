import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { Loader2, Sparkles, Plus, Upload, ArrowUpCircle, ArrowDownCircle, Eye, Pencil, Trash2, FileSpreadsheet, Check, X, DollarSign, TrendingUp, TrendingDown, ArrowUp, ArrowDown, ChevronsUpDown, Undo2, Redo2 } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useFinTransactions, useUpsertFinTransaction, useDeleteFinTransaction, useBulkInsertTransactions, useFinAllTransactions, fetchCategorizationHistory, type FinTransaction } from "../hooks/use-financial-data";
import { parseStatementCsv, decodeText } from "../utils/parse-statement";
import { buildHistoryIndex, categoryFromHistory, categoriesForType, pickExamples, type CatSource } from "../utils/categorize";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { FinMonthYearSelector } from "./FinMonthYearSelector";
import { FinMetricCard } from "./FinMetricCard";
import { toast } from "sonner";

type CSVRow = {
  date: string; description: string; amount: number; type: "entrada" | "saida";
  // filled by the automatic categorization (history first, then AI); "pendente" = AI still working on it
  category?: string | null; catSource?: CatSource | "pendente"; confidence?: "alta" | "media" | "baixa";
};

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

const getTypeFromCategory = (cat: string): string => {
  if (cat === "caixa") return "caixa";
  return cat.startsWith("receita") ? "entrada" : "saida";
};

const formatDayMonth = (dateStr: string) => {
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dateStr;
};

type EditingCell = { txId: string; field: "date" | "description" | "amount" | "category" } | null;

function InlineDateCell({ tx, isEditing, onStartEdit, onSave }: { tx: FinTransaction; isEditing: boolean; onStartEdit: () => void; onSave: (val: string) => void }) {
  const [val, setVal] = useState(tx.date);
  if (!isEditing) return <span className="cursor-pointer hover:underline decoration-dotted underline-offset-4 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>{formatDayMonth(tx.date)}</span>;
  return <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><DatePickerInline value={val} onChange={(v) => { setVal(v); onSave(v); }} /></div>;
}

function InlineTextCell({ tx, isEditing, onStartEdit, onSave }: { tx: FinTransaction; isEditing: boolean; onStartEdit: () => void; onSave: (val: string) => void }) {
  const [val, setVal] = useState(tx.description);
  if (!isEditing) return <span className="cursor-pointer hover:underline decoration-dotted underline-offset-4 font-medium" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>{tx.description}</span>;
  return <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><Input value={val} onChange={e => setVal(e.target.value)} className="h-7 text-xs" autoFocus onKeyDown={e => { if (e.key === "Enter") onSave(val); if (e.key === "Escape") onSave(tx.description); }} onBlur={() => onSave(val)} /></div>;
}

function InlineAmountCell({ tx, isEditing, onStartEdit, onSave }: { tx: FinTransaction; isEditing: boolean; onStartEdit: () => void; onSave: (val: number) => void }) {
  const [val, setVal] = useState(String(tx.amount));
  const isCaixa = tx.category === "caixa" || tx.type === "caixa";
  const colorClass = isCaixa ? "text-primary" : tx.type === "entrada" ? "text-success" : "text-destructive";
  const prefix = isCaixa ? "" : tx.type === "entrada" ? "+ " : "− ";
  if (!isEditing) return (
    <span className={`cursor-pointer hover:underline decoration-dotted underline-offset-4 font-semibold ${colorClass}`} onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>
      {prefix}R$ {Number(tx.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
    </span>
  );
  return <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}><Input type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)} className="h-7 w-28 text-xs text-right" autoFocus onKeyDown={e => { if (e.key === "Enter") onSave(parseFloat(val) || tx.amount); if (e.key === "Escape") onSave(tx.amount); }} onBlur={() => onSave(parseFloat(val) || tx.amount)} /></div>;
}

function InlineCategoryCell({ tx, isEditing, onStartEdit, onSave }: { tx: FinTransaction; isEditing: boolean; onStartEdit: () => void; onSave: (val: string) => void }) {
  const label = TRANSACTION_CATEGORIES.find(c => c.value === tx.category)?.label ?? tx.category ?? "—";
  if (!isEditing) return <Badge variant="secondary" className="cursor-pointer text-[10px] font-medium hover:bg-accent" onClick={(e) => { e.stopPropagation(); onStartEdit(); }}>{label}</Badge>;
  return (
    <div onClick={e => e.stopPropagation()}>
      <Select defaultValue={tx.category ?? ""} onValueChange={(v) => onSave(v)}>
        <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>{TRANSACTION_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

type SortField = "date" | "amount" | "category";
type SortDir = "asc" | "desc";
type UndoEntry = { tx: FinTransaction; field: string; oldValue: any; newValue: any };

export function FinLancamentosTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Undo / Redo stacks
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  const txQ = useFinTransactions(year, month);
  const allTxQ = useFinAllTransactions(year);
  const upsertTx = useUpsertFinTransaction();
  const deleteTx = useDeleteFinTransaction();
  const bulkInsert = useBulkInsertTransactions();

  const transactions = txQ.data ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<FinTransaction | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const categorizeRun = useRef(0);
  // preview rows whose full description is open (click toggles; hover shows it in a tooltip)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const toggleRow = (i: number) => setExpandedRows((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const aiExamples = useRef<Array<{ description: string; category: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);

  const emptyForm = { description: "", amount: "", date: format(new Date(), "yyyy-MM-dd"), category: "", notes: "" };
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    let list = transactions.filter((t) => {
      if (typeFilter !== "all" && t.type !== typeFilter && !(t.category === "caixa")) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
    if (sortField) {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortField === "date") cmp = a.date.localeCompare(b.date);
        else if (sortField === "amount") cmp = Number(a.amount) - Number(b.amount);
        else if (sortField === "category") cmp = (a.category ?? "").localeCompare(b.category ?? "");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [transactions, typeFilter, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "desc") setSortDir("asc");
      else { setSortField(null); setSortDir("desc"); }
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="inline ml-1 h-3 w-3 text-muted-foreground/50" />;
    return sortDir === "desc" ? <ArrowDown className="inline ml-1 h-3 w-3 text-primary" /> : <ArrowUp className="inline ml-1 h-3 w-3 text-primary" />;
  };

  const totalEntradas = filtered.filter((t) => t.type === "entrada" || t.description?.toLowerCase().includes("caixa inicial")).reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = filtered.filter((t) => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const saldoMes = totalEntradas - totalSaidas;

  // Previous month comparison
  const allTxs = allTxQ.data ?? [];
  const prevMonthTxs = useMemo(() => {
    const pm = month - 1;
    if (pm < 1) return [];
    return allTxs.filter(t => t.type !== "caixa" && t.category !== "caixa" && new Date(t.date).getMonth() + 1 === pm);
  }, [allTxs, month]);
  const prevEntradas = prevMonthTxs.filter(t => t.type === "entrada").reduce((s, t) => s + Number(t.amount), 0);
  const prevSaidas = prevMonthTxs.filter(t => t.type === "saida").reduce((s, t) => s + Number(t.amount), 0);
  const varEntradas = prevEntradas > 0 ? ((totalEntradas - prevEntradas) / prevEntradas) * 100 : null;
  const varSaidas = prevSaidas > 0 ? ((totalSaidas - prevSaidas) / prevSaidas) * 100 : null;

  // Caixa final from transactions with category "caixa" (not "inicial")
  const caixaFinalTx = useMemo(() => {
    return transactions.find((t) => (t.category === "caixa" || t.type === "caixa") && !t.description?.toLowerCase().includes("inicial"));
  }, [transactions]);
  const caixaFinal = caixaFinalTx ? Number(caixaFinalTx.amount) : null;

  // Caixa inicial = transaction with description "Caixa Inicial" in current month
  const caixaInicialTx = useMemo(() => {
    return transactions.find((t) =>
      t.description?.toLowerCase().includes("caixa inicial")
    );
  }, [transactions]);
  const caixaInicial = caixaInicialTx ? Number(caixaInicialTx.amount) : null;

  // Previous month's caixa final value (to auto-seed caixa inicial)
  const prevCaixaFinalValue = useMemo(() => {
    const pm = month - 1;
    const py = pm < 1 ? year - 1 : year;
    const prevM = pm < 1 ? 12 : pm;
    const prevCaixaFinal = allTxs.find((t) => {
      if (t.category !== "caixa" && t.type !== "caixa") return false;
      if (t.description?.toLowerCase().includes("inicial")) return false;
      const d = new Date(t.date);
      return d.getMonth() + 1 === prevM && d.getFullYear() === py;
    });
    return prevCaixaFinal ? Number(prevCaixaFinal.amount) : null;
  }, [allTxs, month, year]);

  // Auto-seed: create "Caixa Inicial" on 1st day when prev month has caixa final but current month has no caixa inicial
  const seededRef = useRef<string>("");
  useEffect(() => {
    const key = `${year}-${month}`;
    if (seededRef.current === key) return;
    if (txQ.isLoading || allTxQ.isLoading) return;
    seededRef.current = key;
    if (caixaInicialTx) return; // already exists
    if (prevCaixaFinalValue == null) return; // no prev caixa final
    const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
    upsertTx.mutate({
      description: "Caixa Inicial",
      amount: prevCaixaFinalValue,
      date: firstDay,
      type: "entrada",
      category: "caixa",
      status: "confirmado",
      source: "auto",
    } as any);
  }, [year, month, caixaInicialTx, prevCaixaFinalValue, txQ.isLoading, allTxQ.isLoading]);

  const openNew = () => { setEditingTx(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (tx: FinTransaction) => {
    if (editingCell) return;
    setEditingTx(tx);
    setForm({ description: tx.description, amount: String(tx.amount), date: tx.date, category: tx.category ?? "", notes: tx.notes ?? "" });
    setDialogOpen(true);
  };

  const save = () => {
    const type = getTypeFromCategory(form.category);
    upsertTx.mutate(
      { ...(editingTx ? { id: editingTx.id } : {}), description: form.description, amount: parseFloat(form.amount) || 0, date: form.date, type, category: form.category || null, status: "confirmado", notes: form.notes || null } as any,
      { onSuccess: () => { setDialogOpen(false); setForm(emptyForm); setEditingTx(null); } },
    );
  };

  const inlineSave = useCallback((tx: FinTransaction, field: string, value: any) => {
    setEditingCell(null);
    const updates: any = { id: tx.id, description: tx.description, amount: tx.amount, date: tx.date, type: tx.type, category: tx.category, status: tx.status, notes: tx.notes };
    const oldValue = field === "category" ? tx.category : (tx as any)[field];
    if (field === "category") { updates.category = value; updates.type = getTypeFromCategory(value); } else { updates[field] = value; }
    if (value === oldValue && field !== "category") return;
    setUndoStack(prev => [...prev, { tx, field, oldValue, newValue: value }]);
    setRedoStack([]);
    upsertTx.mutate(updates);
  }, [upsertTx]);

  const applyUndoRedo = useCallback((entry: UndoEntry, valueToApply: any) => {
    const updates: any = { id: entry.tx.id, description: entry.tx.description, amount: entry.tx.amount, date: entry.tx.date, type: entry.tx.type, category: entry.tx.category, status: entry.tx.status, notes: entry.tx.notes };
    if (entry.field === "category") { updates.category = valueToApply; updates.type = getTypeFromCategory(valueToApply); } else { updates[entry.field] = valueToApply; }
    upsertTx.mutate(updates);
  }, [upsertTx]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const entry = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setRedoStack(prev => [...prev, entry]);
    applyUndoRedo(entry, entry.oldValue);
    toast.info("Ação desfeita");
  }, [undoStack, applyUndoRedo]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const entry = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    setUndoStack(prev => [...prev, entry]);
    applyUndoRedo(entry, entry.newValue);
    toast.info("Ação refeita");
  }, [redoStack, applyUndoRedo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  const parseXlsx = async (data: ArrayBuffer): Promise<CSVRow[]> => {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(data, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const rows: CSVRow[] = [];
    let headerIdx = -1, colDate = -1, colDesc = -1, colValor = -1;
    for (let i = 0; i < Math.min(raw.length, 10); i++) {
      const cells = raw[i].map((c: any) => String(c).trim().toUpperCase());
      const dateCol = cells.findIndex(c => c === "DATA");
      const descCol = cells.findIndex(c => c === "DESCRIÇÃO" || c === "DESCRICAO" || c === "HISTORICO" || c === "HISTÓRICO");
      const valCol = cells.findIndex(c => c === "VALOR" || c === "QUANTIA" || c === "AMOUNT");
      if (dateCol >= 0 && descCol >= 0 && valCol >= 0) { headerIdx = i; colDate = dateCol; colDesc = descCol; colValor = valCol; break; }
    }
    if (headerIdx >= 0) {
      for (let i = headerIdx + 1; i < raw.length; i++) {
        const cells = raw[i]; if (!cells || cells.length < Math.max(colDate, colDesc, colValor) + 1) continue;
        const desc = String(cells[colDesc] ?? "").trim(); let valorRaw = cells[colValor];
        if (!desc || desc.toUpperCase().includes("SALDO")) continue;
        let numVal: number;
        if (typeof valorRaw === "number") { numVal = valorRaw; } else { const valStr = String(valorRaw).replace(/[D|C]/g, "").replace(/\s/g, ""); numVal = parseFloat(valStr.replace(/\./g, "").replace(",", ".")); }
        if (isNaN(numVal) || numVal === 0) continue;
        const type: "entrada" | "saida" = numVal > 0 ? "entrada" : "saida";
        let isoDate = "";
        if (typeof cells[colDate] === "number") { const excelDate = XLSX.SSF.parse_date_code(cells[colDate]); if (excelDate) isoDate = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`; }
        if (!isoDate) { const parts = String(cells[colDate] ?? "").trim().split("/"); if (parts.length === 3) isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`; else if (parts.length === 2) isoDate = `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`; }
        if (!isoDate) continue;
        rows.push({ date: isoDate, description: desc, amount: Math.abs(numVal), type });
      }
      return rows;
    }
    let currentDate = "";
    for (let i = 0; i < raw.length; i++) {
      const cells = raw[i].map((c: any) => String(c).trim());
      if (!cells[0] && !cells[2] && !cells[3]) continue;
      if (cells[0] === "DATA" || cells[0] === "EXTRATO CONTA CORRENTE") continue;
      if (cells[0] && /^\d{2}\/\d{2}\/\d{4}$/.test(cells[0])) currentDate = cells[0];
      const historico = cells[2] || ""; const valorStr = cells[3] || "";
      if (!valorStr || historico.includes("SALDO DO DIA")) continue;
      const cleanVal = valorStr.replace(/[D|C]/g, "").replace(/\s/g, "").replace("-", "");
      const numVal = parseFloat(cleanVal.replace(/\./g, "").replace(",", "."));
      if (isNaN(numVal) || numVal === 0) continue;
      const isCredit = valorStr.includes("C");
      const parts = currentDate.split("/");
      const isoDate = parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : currentDate;
      rows.push({ date: isoDate, description: historico, amount: numVal, type: isCredit ? "entrada" : "saida" });
    }
    return rows;
  };

  const parseOfx = (buf: ArrayBuffer): CSVRow[] => {
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("\ufffd")) text = new TextDecoder("windows-1252").decode(buf);
    const rows: CSVRow[] = [];
    const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, "i"))?.[1]?.trim() ?? "";
    for (const m of text.matchAll(/<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi)) {
      const block = m[1];
      const dt = tag(block, "DTPOSTED");
      const amount = parseFloat(tag(block, "TRNAMT").replace(",", "."));
      const description = tag(block, "MEMO") || tag(block, "NAME");
      if (!/^\d{8}/.test(dt) || isNaN(amount) || amount === 0 || !description) continue;
      rows.push({ date: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`, description, amount: Math.abs(amount), type: amount > 0 ? "entrada" : "saida" });
    }
    return rows;
  };

  // Opens the preview with the lines already categorized from the agency's history, then asks the AI about the rest.
  const openPreview = async (parsed: CSVRow[]) => {
    const run = ++categorizeRun.current;
    let history: Awaited<ReturnType<typeof fetchCategorizationHistory>> = [];
    try { history = await fetchCategorizationHistory(); } catch { /* without history everything goes to the AI */ }
    const index = buildHistoryIndex(history);
    const rows: CSVRow[] = parsed.map((r) => {
      const cat = categoryFromHistory(index, r.description, r.type);
      return cat ? { ...r, category: cat, catSource: "historico" as const } : { ...r, category: null, catSource: "pendente" as const };
    });
    setExpandedRows(new Set());
    setCsvRows(rows);
    setCsvDialogOpen(true);

    aiExamples.current = pickExamples(history);
    await classifyWithAi(rows.map((r, k) => (r.catSource === "pendente" ? k : -1)).filter((k) => k >= 0), rows, run);
  };

  // Asks the AI about the given line indexes, in parallel batches; lines it can't resolve stay "revisar" for manual choice.
  const classifyWithAi = async (idxs: number[], source: CSVRow[], run: number) => {
    if (idxs.length === 0) return;
    const CHUNK = 40, PARALLEL = 3;
    const chunks: number[][] = [];
    for (let k = 0; k < idxs.length; k += CHUNK) chunks.push(idxs.slice(k, k + CHUNK));
    let failed = 0;
    const doChunk = async (chunk: number[]) => {
      let results: Array<{ id: number; category: string; confidence: "alta" | "media" | "baixa" }> = [];
      try {
        const { data, error } = await supabase.functions.invoke("finance-categorize", {
          body: { items: chunk.map((k) => ({ id: k, description: source[k].description, type: source[k].type, amount: source[k].amount })), examples: aiExamples.current },
        });
        if (!error && Array.isArray((data as any)?.results)) results = (data as any).results;
      } catch { /* leaves them for manual review */ }
      if (categorizeRun.current !== run) return; // preview was closed or replaced meanwhile
      if (results.length === 0) failed += chunk.length;
      const byId = new Map(results.map((x) => [x.id, x]));
      setCsvRows((prev) => prev.map((row, k) => {
        if (!chunk.includes(k) || (row.catSource !== "pendente" && row.catSource !== "revisar")) return row;
        const hit = byId.get(k);
        return hit && categoriesForType(row.type).includes(hit.category)
          ? { ...row, category: hit.category, catSource: "ia", confidence: hit.confidence }
          : { ...row, category: null, catSource: "revisar" };
      }));
    };
    const queue = [...chunks];
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) await doChunk(c);
    }));
    if (failed > 0 && categorizeRun.current === run) toast.error(`A IA não conseguiu classificar ${failed} linha${failed > 1 ? "s" : ""}. Escolha na lista ou tente de novo.`);
  };

  const retryAi = () => {
    const run = ++categorizeRun.current;
    const idxs = csvRows.map((r, k) => (r.catSource === "revisar" ? k : -1)).filter((k) => k >= 0);
    setCsvRows((prev) => prev.map((row) => (row.catSource === "revisar" ? { ...row, catSource: "pendente" } : row)));
    void classifyWithAi(idxs, csvRows, run);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const lower = file.name.toLowerCase();
    const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls");
    if (lower.endsWith(".ofx")) {
      const reader = new FileReader();
      reader.onload = (ev) => { const parsed = parseOfx(ev.target?.result as ArrayBuffer); if (parsed.length === 0) { toast.error("Nenhum lançamento encontrado."); return; } void openPreview(parsed); };
      reader.readAsArrayBuffer(file);
    } else if (isXlsx) {
      const reader = new FileReader();
      reader.onload = async (ev) => { const parsed = await parseXlsx(ev.target?.result as ArrayBuffer); if (parsed.length === 0) { toast.error("Nenhum lançamento encontrado."); return; } void openPreview(parsed); };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const rows = parseStatementCsv(decodeText(ev.target?.result as ArrayBuffer));
        if (rows.length === 0) { toast.error("Nenhum lançamento encontrado."); return; }
        void openPreview(rows);
      };
      reader.readAsArrayBuffer(file);
    }
    e.target.value = "";
  };

  const importCSV = () => {
    bulkInsert.mutate(
      csvRows.map((r) => ({ date: r.date, description: r.description, amount: r.amount, type: r.type, category: r.category ?? null, source: "xlsx_import" })),
      { onSuccess: () => { categorizeRun.current++; setCsvDialogOpen(false); setCsvRows([]); } },
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
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.ofx" onChange={handleFileImport} className="hidden" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleUndo} disabled={undoStack.length === 0} title="Desfazer (Ctrl+Z)"><Undo2 className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleRedo} disabled={redoStack.length === 0} title="Refazer (Ctrl+Shift+Z)"><Redo2 className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="mr-1 h-4 w-4" /> Importar</Button>
          <Button size="sm" onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Novo</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.1s" }}>
        <FinMetricCard title="Entradas" value={totalEntradas} tone="success" variation={varEntradas} icon={<ArrowUpCircle className="h-4 w-4" />} />
        <FinMetricCard title="Saídas" value={totalSaidas} tone="danger" variation={varSaidas} icon={<ArrowDownCircle className="h-4 w-4" />} />
        <FinMetricCard title="Saldo do Mês" value={Math.abs(saldoMes)} prefix={saldoMes < 0 ? "-R$" : "R$"} tone={saldoMes >= 0 ? "success" : "danger"} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      {/* Table */}
      <Card className="opacity-0" style={{ animation: "fadeUp 0.5s ease-out forwards", animationDelay: "0.15s" }}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 w-10" />
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("date")}>Data<SortIcon field="date" /></th>
                  <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("amount")}>Valor<SortIcon field="amount" /></th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("category")}>Categoria<SortIcon field="category" /></th>
                  <th className="px-4 py-3 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Origem</th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b last:border-0 hover:bg-accent/30 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center ${t.category === "caixa" ? "bg-primary/10" : t.type === "entrada" ? "bg-success/10" : "bg-destructive/10"}`}>
                        {t.category === "caixa" ? <DollarSign className="h-3.5 w-3.5 text-primary" /> : t.type === "entrada" ? <ArrowUpCircle className="h-3.5 w-3.5 text-success" /> : <ArrowDownCircle className="h-3.5 w-3.5 text-destructive" />}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <InlineDateCell tx={t} isEditing={editingCell?.txId === t.id && editingCell?.field === "date"} onStartEdit={() => setEditingCell({ txId: t.id, field: "date" })} onSave={(val) => inlineSave(t, "date", val)} />
                    </td>
                    <td className="px-4 py-2.5">
                      <InlineTextCell tx={t} isEditing={editingCell?.txId === t.id && editingCell?.field === "description"} onStartEdit={() => setEditingCell({ txId: t.id, field: "description" })} onSave={(val) => inlineSave(t, "description", val)} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <InlineAmountCell tx={t} isEditing={editingCell?.txId === t.id && editingCell?.field === "amount"} onStartEdit={() => setEditingCell({ txId: t.id, field: "amount" })} onSave={(val) => inlineSave(t, "amount", val)} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <InlineCategoryCell tx={t} isEditing={editingCell?.txId === t.id && editingCell?.field === "category"} onStartEdit={() => setEditingCell({ txId: t.id, field: "category" })} onSave={(val) => inlineSave(t, "category", val)} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant="outline" className="text-[9px]">{t.source === "csv_import" ? "CSV" : t.source === "xlsx_import" ? "XLSX" : "Manual"}</Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir lançamento?</AlertDialogTitle><AlertDialogDescription>"{t.description}" será removido.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteTx.mutate(t.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-12">Sem lançamentos neste período</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New transaction dialog */}
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
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{TRANSACTION_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={save} disabled={!form.description || !form.category || upsertTx.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statement preview: categories suggested from the history and the AI, reviewed here before saving */}
      <Dialog open={csvDialogOpen} onOpenChange={(o) => { setCsvDialogOpen(o); if (!o) { categorizeRun.current++; } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> Pré-visualização — {csvRows.length} lançamentos</DialogTitle></DialogHeader>
          {(() => {
            const count = (src: string) => csvRows.filter((r) => r.catSource === src).length;
            const pending = count("pendente");
            const review = csvRows.filter((r) => !r.category && r.catSource !== "pendente").length;
            return (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{count("historico")} pelo histórico</span>
                <span>{count("ia")} pela IA</span>
                {pending > 0 && <span className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" /> IA analisando {pending}…</span>}
                {review > 0 && <span className="text-amber-500">{review} sem categoria, escolha abaixo</span>}
                {csvRows.some((r) => r.catSource === "revisar") && pending === 0 && (
                  <button type="button" onClick={retryAi} className="flex items-center gap-1 text-primary hover:underline"><Sparkles className="h-3 w-3" /> Tentar a IA de novo</button>
                )}
              </p>
            );
          })()}
          <div className="max-h-[55vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-center">Tipo</TableHead><TableHead>Categoria</TableHead></TableRow></TableHeader>
              <TableBody>
                {csvRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{formatDayMonth(r.date)}</TableCell>
                    <TableCell className={`max-w-[260px] cursor-pointer text-sm ${expandedRows.has(i) ? "whitespace-normal break-words" : "truncate"}`} onClick={() => toggleRow(i)}>
                      {expandedRows.has(i) ? r.description : (
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild><span className="block truncate">{r.description}</span></TooltipTrigger>
                          <TooltipContent side="top" align="start" className="max-w-md break-words text-xs leading-relaxed">{r.description}</TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">R$ {r.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-center"><Badge variant={r.type === "entrada" ? "default" : "secondary"}>{r.type}</Badge></TableCell>
                    <TableCell>
                      {r.catSource === "pendente" ? (
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> analisando…</span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={r.category ?? ""}
                            onValueChange={(v) => setCsvRows((prev) => prev.map((row, k) => (k === i ? { ...row, category: v, catSource: "manual" } : row)))}
                          >
                            <SelectTrigger className={`h-7 w-44 text-xs ${r.category ? "" : "border-amber-500/60"}`}><SelectValue placeholder="Escolher…" /></SelectTrigger>
                            <SelectContent>
                              {TRANSACTION_CATEGORIES.filter((c) => categoriesForType(r.type).includes(c.value)).map((c) => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {r.catSource === "ia" && (
                            <span title={`Sugerido pela IA (confiança ${r.confidence ?? "baixa"})`} className={r.confidence === "alta" ? "text-primary" : "text-amber-500"}>
                              <Sparkles className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={importCSV} disabled={bulkInsert.isPending || csvRows.some((r) => r.catSource === "pendente")}>Importar {csvRows.length} lançamentos</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
