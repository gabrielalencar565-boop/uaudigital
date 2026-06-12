import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Paperclip, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PROPOSAL_STATUS, fmtCurrency, fmtDateTime, type CrmProposalStatus } from "../crm-constants";
import { useCrmProposals, useCreateProposal, useUpdateProposal, useDeleteProposal, uploadProposalFile } from "../hooks/use-crm-proposals";

interface Props { leadId: string }

export function LeadProposalsList({ leadId }: Props) {
  const { data: items = [] } = useCrmProposals(leadId);
  const create = useCreateProposal();
  const update = useUpdateProposal();
  const del = useDeleteProposal();
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const add = async () => {
    setUploading(true);
    try {
      let arquivo: { url: string; nome: string } | null = null;
      if (pendingFile) arquivo = await uploadProposalFile(leadId, pendingFile);
      await create.mutateAsync({
        lead_id: leadId,
        valor: valor ? Number(valor) : null,
        observacoes: obs || null,
        status: "rascunho",
        arquivo_url: arquivo?.url ?? null,
        arquivo_nome: arquivo?.nome ?? null,
      });
      setValor(""); setObs(""); setPendingFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Proposta criada");
    } catch (e: any) { toast.error(e?.message ?? "Erro"); }
    finally { setUploading(false); }
  };

  const markSent = async (id: string) => {
    await update.mutateAsync({ id, patch: { status: "enviada", enviada_em: new Date().toISOString() } });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/50 p-3 space-y-2 bg-muted/20">
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Valor (R$)" type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="h-9" />
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5 mr-1" />{pendingFile ? pendingFile.name.slice(0, 18) : "Anexo"}
            </Button>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <Textarea placeholder="Observações" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
        <Button size="sm" onClick={add} disabled={uploading}><Plus className="h-4 w-4 mr-1" />Adicionar proposta</Button>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <div className="text-center text-sm text-muted-foreground py-6">Sem propostas</div>}
        {items.map((p) => {
          const st = PROPOSAL_STATUS.find((s) => s.value === p.status);
          return (
            <div key={p.id} className="rounded-md border border-border/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{fmtCurrency(Number(p.valor) || 0)}</div>
                <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", st?.color)}>{st?.label}</span>
              </div>
              {p.enviada_em && <div className="text-[11px] text-muted-foreground">Enviada em {fmtDateTime(p.enviada_em)}</div>}
              {p.observacoes && <div className="text-xs">{p.observacoes}</div>}
              <div className="flex items-center gap-2">
                <Select value={p.status} onValueChange={(v) => update.mutate({ id: p.id, patch: { status: v as CrmProposalStatus } })}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{PROPOSAL_STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
                {p.status === "rascunho" && <Button size="sm" variant="outline" onClick={() => markSent(p.id)}>Marcar enviada</Button>}
                {p.arquivo_url && (
                  <a href={p.arquivo_url} target="_blank" rel="noopener" className="ml-auto inline-flex items-center text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3 mr-1" />{p.arquivo_nome ?? "anexo"}
                  </a>
                )}
                <Button variant="ghost" size="icon" onClick={() => del.mutate(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
