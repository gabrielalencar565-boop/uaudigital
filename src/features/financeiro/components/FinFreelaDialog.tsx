import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/features/data/queries";
import { Plus, X } from "lucide-react";
import { freelaUau, useDeleteFinFreela, useSaveFinFreela, type FinFreela, type FinOperacional } from "../hooks/use-financial-data";

const OUTRO = "__outro__";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** "1.234,56" / "1234.56" / "800" → número */
const num = (s: string) => {
  const t = s.trim().replace(/[^\d,.-]/g, "");
  if (!t) return 0;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
};

export function FinFreelaDialog({ open, onClose, freela, defaultDate }: { open: boolean; onClose: () => void; freela: FinFreela | null; defaultDate: string }) {
  const membersQ = useTeamMembers();
  const save = useSaveFinFreela();
  const del = useDeleteFinFreela();
  const [contratante, setContratante] = useState("");
  const [servico, setServico] = useState("");
  const [total, setTotal] = useState("");
  type Linha = { key: number; quem: string; nome: string; valor: string };
  const novaLinha = (key: number): Linha => ({ key, quem: "", nome: "", valor: "" });
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha(1)]);
  const [date, setDate] = useState(defaultDate);
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (!open) return;
    setErro("");
    if (freela) {
      setContratante(freela.contratante);
      setServico(freela.servico);
      setTotal(String(freela.total).replace(".", ","));
      const lista: FinOperacional[] = freela.operacionais.length > 0
        ? freela.operacionais
        : (freela.operacional_user_id || freela.operacional_nome || freela.operacional_valor > 0)
          ? [{ user_id: freela.operacional_user_id, nome: freela.operacional_nome, valor: freela.operacional_valor }]
          : [];
      setLinhas(lista.length > 0
        ? lista.map((o, i) => ({ key: i + 1, quem: o.user_id ?? (o.nome ? OUTRO : ""), nome: o.nome ?? "", valor: o.valor ? String(o.valor).replace(".", ",") : "" }))
        : [novaLinha(1)]);
      setDate(freela.date);
      setPago(freela.status === "pago");
    } else {
      setContratante(""); setServico(""); setTotal(""); setLinhas([novaLinha(1)]);
      setDate(defaultDate); setPago(false);
    }
  }, [open, freela, defaultDate]);

  const totalN = num(total);
  const opN = linhas.reduce((sum, l) => sum + num(l.valor), 0);
  const setLinha = (key: number, patch: Partial<Linha>) => { setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l))); setErro(""); };
  const uau = Math.max(0, totalN - opN);
  const pct = totalN > 0 ? Math.round((uau / totalN) * 100) : 0;

  const submit = () => {
    if (!contratante.trim()) return setErro("Diga quem contratou.");
    if (!servico.trim()) return setErro("Descreva o serviço.");
    if (!(totalN > 0)) return setErro("Informe o valor total.");
    if (opN < 0 || opN > totalN) return setErro("A parte do operacional não pode passar do valor total.");
    if (!date) return setErro("Informe a data.");
    if (linhas.some((l) => l.quem === OUTRO && !l.nome.trim())) return setErro("Escreva o nome de quem fez (de fora).");
    const pessoas: FinOperacional[] = linhas
      .filter((l) => l.quem || num(l.valor) > 0)
      .map((l) => ({ user_id: l.quem && l.quem !== OUTRO ? l.quem : null, nome: l.quem === OUTRO ? l.nome.trim() : null, valor: num(l.valor) }));
    const primeira = pessoas[0];
    save.mutate(
      {
        ...(freela ? { id: freela.id } : {}),
        contratante: contratante.trim(),
        servico: servico.trim(),
        total: totalN,
        operacional_valor: opN,
        operacional_user_id: primeira?.user_id ?? null,
        operacional_nome: primeira?.nome ?? null,
        operacionais: pessoas,
        date,
        status: pago ? "pago" : "pendente",
        paid_at: pago ? (freela?.paid_at ?? format(new Date(), "yyyy-MM-dd")) : null,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{freela ? "Editar freela" : "Novo freela"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Quem contratou</Label>
            <Input value={contratante} onChange={(e) => { setContratante(e.target.value); setErro(""); }} placeholder="Ex.: Padaria Estrela" />
          </div>
          <div className="space-y-1.5">
            <Label>Serviço</Label>
            <Input value={servico} onChange={(e) => { setServico(e.target.value); setErro(""); }} placeholder="Ex.: Logo + 2 variações" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <Input inputMode="decimal" value={total} onChange={(e) => { setTotal(e.target.value); setErro(""); }} placeholder="800,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 p-3">
            <p className="text-xs text-muted-foreground">Divisão do valor</p>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div className="bg-violet-500" style={{ width: `${totalN > 0 ? Math.min(100, (opN / totalN) * 100) : 0}%` }} />
              <div className="bg-emerald-500" style={{ width: `${totalN > 0 ? pct : 0}%` }} />
            </div>
            <Label className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-violet-500" />Quem fez e quanto cada um recebe</Label>
            <div className="space-y-2">
              {linhas.map((l) => (
                <div key={l.key} className="space-y-1.5 rounded-lg border border-border/40 p-2">
                  <div className="flex items-center gap-2">
                    <Select value={l.quem || undefined} onValueChange={(v) => setLinha(l.key, { quem: v })}>
                      <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Escolher pessoa…" /></SelectTrigger>
                      <SelectContent className="z-[150]">
                        {(membersQ.data ?? []).map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
                        <SelectItem value={OUTRO}>Outra pessoa (de fora)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input inputMode="decimal" value={l.valor} onChange={(e) => setLinha(l.key, { valor: e.target.value })} placeholder="R$ 0,00" className="h-9 w-28 text-right" aria-label="Valor desta pessoa" />
                    {linhas.length > 1 && (
                      <button type="button" onClick={() => setLinhas((prev) => prev.filter((x) => x.key !== l.key))} className="text-muted-foreground hover:text-destructive" aria-label="Remover pessoa" title="Remover pessoa"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                  {l.quem === OUTRO && (
                    <Input value={l.nome} onChange={(e) => setLinha(l.key, { nome: e.target.value })} placeholder="Nome de quem fez (de fora)" className="h-9" />
                  )}
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => setLinhas((prev) => [...prev, novaLinha(Math.max(...prev.map((x) => x.key)) + 1)])}>
                <Plus className="h-3.5 w-3.5" /> Adicionar pessoa
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total do operacional</span><span>{brl(opN)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Uau (calculado)</span>
              <b className="font-semibold">{brl(uau)} · {pct}%</b>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} className="h-4 w-4 accent-primary" />
            Já foi recebido
          </label>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {freela ? (
            <Button type="button" variant="ghost" className="text-destructive" disabled={del.isPending} onClick={() => { if (window.confirm("Remover este freela?")) del.mutate(freela.id, { onSuccess: onClose }); }}>
              Remover
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={submit} disabled={save.isPending}>Salvar freela</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
