import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeamMembers } from "@/features/data/queries";
import { freelaUau, useDeleteFinFreela, useSaveFinFreela, type FinFreela } from "../hooks/use-financial-data";

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
  const [operacional, setOperacional] = useState("");
  const [quem, setQuem] = useState<string>("");
  const [nomeFora, setNomeFora] = useState("");
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
      setOperacional(String(freela.operacional_valor).replace(".", ","));
      setQuem(freela.operacional_user_id ?? (freela.operacional_nome ? OUTRO : ""));
      setNomeFora(freela.operacional_nome ?? "");
      setDate(freela.date);
      setPago(freela.status === "pago");
    } else {
      setContratante(""); setServico(""); setTotal(""); setOperacional(""); setQuem(""); setNomeFora("");
      setDate(defaultDate); setPago(false);
    }
  }, [open, freela, defaultDate]);

  const totalN = num(total);
  const opN = num(operacional);
  const uau = Math.max(0, totalN - opN);
  const pct = totalN > 0 ? Math.round((uau / totalN) * 100) : 0;

  const submit = () => {
    if (!contratante.trim()) return setErro("Diga quem contratou.");
    if (!servico.trim()) return setErro("Descreva o serviço.");
    if (!(totalN > 0)) return setErro("Informe o valor total.");
    if (opN < 0 || opN > totalN) return setErro("A parte do operacional não pode passar do valor total.");
    if (!date) return setErro("Informe a data.");
    if (quem === OUTRO && !nomeFora.trim()) return setErro("Escreva o nome de quem fez.");
    const member = (membersQ.data ?? []).find((m) => m.user_id === quem);
    save.mutate(
      {
        ...(freela ? { id: freela.id } : {}),
        contratante: contratante.trim(),
        servico: servico.trim(),
        total: totalN,
        operacional_valor: opN,
        operacional_user_id: member ? member.user_id : null,
        operacional_nome: quem === OUTRO ? nomeFora.trim() : null,
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-violet-500" />Quem fez</Label>
                <Select value={quem || undefined} onValueChange={(v) => { setQuem(v); setErro(""); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Escolher…" /></SelectTrigger>
                  <SelectContent className="z-[150]">
                    {(membersQ.data ?? []).map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
                    <SelectItem value={OUTRO}>Outra pessoa (de fora)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Parte do operacional (R$)</Label>
                <Input inputMode="decimal" value={operacional} onChange={(e) => { setOperacional(e.target.value); setErro(""); }} placeholder="0,00" className="h-9" />
              </div>
            </div>
            {quem === OUTRO && (
              <Input value={nomeFora} onChange={(e) => { setNomeFora(e.target.value); setErro(""); }} placeholder="Nome de quem fez (de fora)" className="h-9" />
            )}
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
