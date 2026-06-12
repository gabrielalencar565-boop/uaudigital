import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Save, MessageCircle, ClipboardList, FileText, History, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateLead, useDeleteLead, useLeadActivity, type CrmLead } from "../hooks/use-crm-leads";
import {
  STAGES,
  STAGE_LABEL,
  LOSS_LABEL,
  ORIGEM_OPTIONS,
  SEGMENTO_OPTIONS,
  fmtCurrency,
  fmtDateTime,
  type CrmStage,
} from "../crm-constants";
import { LossReasonDialog } from "./LossReasonDialog";
import { LeadTasksList } from "./LeadTasksList";
import { LeadProposalsList } from "./LeadProposalsList";
import { LeadWhatsAppThread } from "./LeadWhatsAppThread";

interface Props {
  lead: CrmLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: { user_id: string; display_name: string; avatar_url: string | null }[];
}

export function LeadDetailSheet({ lead, open, onOpenChange, members }: Props) {
  const update = useUpdateLead();
  const del = useDeleteLead();
  const activity = useLeadActivity(lead?.id ?? null);
  const [form, setForm] = useState<Partial<CrmLead>>({});
  const [showLoss, setShowLoss] = useState(false);
  const [pendingStage, setPendingStage] = useState<CrmStage | null>(null);

  useEffect(() => {
    if (lead) setForm(lead);
  }, [lead]);

  if (!lead) return null;

  const setField = (k: keyof CrmLead, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    try {
      await update.mutateAsync({ id: lead.id, patch: form });
      toast.success("Lead atualizado");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  };

  const changeStage = async (newStage: CrmStage) => {
    if (newStage === "perdido") {
      setPendingStage(newStage);
      setShowLoss(true);
      return;
    }
    try {
      await update.mutateAsync({ id: lead.id, patch: { stage: newStage, loss_reason: null } });
      setForm((f) => ({ ...f, stage: newStage, loss_reason: null }));
      toast.success("Etapa atualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  const remove = async () => {
    if (!confirm("Excluir este lead permanentemente?")) return;
    try {
      await del.mutateAsync(lead.id);
      toast.success("Lead excluído");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="truncate text-xl">{lead.nome}</SheetTitle>
                <SheetDescription className="flex items-center gap-2 mt-1">
                  {lead.empresa && <span>{lead.empresa}</span>}
                  {lead.telefone && <span className="text-xs">{lead.telefone}</span>}
                </SheetDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={remove} title="Excluir">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Select value={form.stage ?? lead.stage} onValueChange={(v) => changeStage(v as CrmStage)}>
                <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lead.loss_reason && <Badge variant="outline" className="text-rose-500 border-rose-500/40">Perda: {LOSS_LABEL[lead.loss_reason]}</Badge>}
              {lead.valor_estimado != null && Number(lead.valor_estimado) > 0 && (
                <Badge variant="secondary">{fmtCurrency(Number(lead.valor_estimado))}</Badge>
              )}
            </div>
          </SheetHeader>

          <Tabs defaultValue="resumo" className="mt-2">
            <TabsList className="grid grid-cols-6 h-auto">
              <TabsTrigger value="resumo" className="text-xs"><User className="h-3.5 w-3.5 mr-1" />Resumo</TabsTrigger>
              <TabsTrigger value="qualif" className="text-xs">Qualif.</TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs"><MessageCircle className="h-3.5 w-3.5 mr-1" />WhatsApp</TabsTrigger>
              <TabsTrigger value="tasks" className="text-xs"><ClipboardList className="h-3.5 w-3.5 mr-1" />Tarefas</TabsTrigger>
              <TabsTrigger value="proposals" className="text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Propostas</TabsTrigger>
              <TabsTrigger value="history" className="text-xs"><History className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo" className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome"><Input value={form.nome ?? ""} onChange={(e) => setField("nome", e.target.value)} /></Field>
                <Field label="Telefone"><Input value={form.telefone ?? ""} onChange={(e) => setField("telefone", e.target.value)} /></Field>
                <Field label="Empresa"><Input value={form.empresa ?? ""} onChange={(e) => setField("empresa", e.target.value)} /></Field>
                <Field label="Cidade"><Input value={form.cidade ?? ""} onChange={(e) => setField("cidade", e.target.value)} /></Field>
                <Field label="Segmento">
                  <Select value={form.segmento ?? ""} onValueChange={(v) => setField("segmento", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{SEGMENTO_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Origem">
                  <Select value={form.origem ?? ""} onValueChange={(v) => setField("origem", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{ORIGEM_OPTIONS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Interesse"><Input value={form.interesse ?? ""} onChange={(e) => setField("interesse", e.target.value)} /></Field>
                <Field label="Valor estimado (R$)">
                  <Input type="number" step="0.01" value={form.valor_estimado ?? ""} onChange={(e) => setField("valor_estimado", e.target.value ? Number(e.target.value) : null)} />
                </Field>
                <Field label="Responsável" className="col-span-2">
                  <Select value={form.responsavel_id ?? "none"} onValueChange={(v) => setField("responsavel_id", v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Observações">
                <Textarea rows={4} value={form.observacoes ?? ""} onChange={(e) => setField("observacoes", e.target.value)} />
              </Field>
              <Button onClick={save} className="w-full"><Save className="h-4 w-4 mr-2" />Salvar alterações</Button>
            </TabsContent>

            <TabsContent value="qualif" className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Já investe em marketing?">
                  <Select value={form.ja_investe_marketing == null ? "" : form.ja_investe_marketing ? "yes" : "no"}
                    onValueChange={(v) => setField("ja_investe_marketing", v === "yes" ? true : v === "no" ? false : null)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Orçamento aproximado (R$)">
                  <Input type="number" step="0.01" value={form.orcamento_aproximado ?? ""} onChange={(e) => setField("orcamento_aproximado", e.target.value ? Number(e.target.value) : null)} />
                </Field>
                <Field label="Urgência">
                  <Select value={form.urgencia ?? ""} onValueChange={(v) => setField("urgencia", v as any)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Potencial de fechamento">
                  <Select value={form.potencial_fechamento ?? ""} onValueChange={(v) => setField("potencial_fechamento", v as any)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixo">Baixo</SelectItem>
                      <SelectItem value="medio">Médio</SelectItem>
                      <SelectItem value="alto">Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Nível de interesse (1-5)" className="col-span-2">
                  <Input type="number" min={1} max={5} value={form.nivel_interesse ?? ""} onChange={(e) => setField("nivel_interesse", e.target.value ? Number(e.target.value) : null)} />
                </Field>
              </div>
              <Field label="Principal problema">
                <Textarea rows={4} value={form.principal_problema ?? ""} onChange={(e) => setField("principal_problema", e.target.value)} />
              </Field>
              <Button onClick={save} className="w-full"><Save className="h-4 w-4 mr-2" />Salvar qualificação</Button>
            </TabsContent>

            <TabsContent value="whatsapp" className="pt-4">
              <LeadWhatsAppThread lead={lead} />
            </TabsContent>

            <TabsContent value="tasks" className="pt-4">
              <LeadTasksList leadId={lead.id} members={members} />
            </TabsContent>

            <TabsContent value="proposals" className="pt-4">
              <LeadProposalsList leadId={lead.id} />
            </TabsContent>

            <TabsContent value="history" className="pt-4 space-y-2">
              {(activity.data ?? []).length === 0 && <div className="text-center text-sm text-muted-foreground py-8">Sem atividade registrada</div>}
              {(activity.data ?? []).map((a) => (
                <div key={a.id} className="rounded-md border border-border/50 p-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{prettyAction(a.action, a.payload)}</span>
                    <span className="text-muted-foreground">{fmtDateTime(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <LossReasonDialog
        open={showLoss}
        onCancel={() => { setShowLoss(false); setPendingStage(null); }}
        onConfirm={async (reason) => {
          if (!pendingStage) return;
          try {
            await update.mutateAsync({ id: lead.id, patch: { stage: pendingStage, loss_reason: reason } });
            setForm((f) => ({ ...f, stage: pendingStage, loss_reason: reason }));
            toast.success("Lead marcado como perdido");
          } catch (e: any) {
            toast.error(e?.message ?? "Erro");
          } finally {
            setShowLoss(false);
            setPendingStage(null);
          }
        }}
      />
    </>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function prettyAction(action: string, payload: any) {
  if (action === "created") return `Lead criado em ${STAGE_LABEL[(payload?.stage ?? "novo_lead") as CrmStage] ?? payload?.stage}`;
  if (action === "stage_changed") return `Etapa: ${STAGE_LABEL[payload?.from as CrmStage] ?? payload?.from} → ${STAGE_LABEL[payload?.to as CrmStage] ?? payload?.to}`;
  if (action === "responsavel_changed") return `Responsável alterado`;
  return action;
}
