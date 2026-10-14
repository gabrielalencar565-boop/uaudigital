import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { useComercial } from "../ComercialContext";
import { useCreateActivity, useCreateLead, useUpdateLead, useWinLead } from "../hooks/use-comercial";
import { ACTIVITY_TYPES, addDays, brl, LOSS_REASONS, SERVICES, SIZES, SOURCES, isOpenStage, type Lead } from "../lib/rules";

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function ServiceChecks({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-4">
      {SERVICES.map((s) => (
        <label key={s} className="flex items-center gap-2 text-sm">
          <Checkbox checked={value.includes(s)} onCheckedChange={(c) => onChange(c === true ? [...value, s] : value.filter((x) => x !== s))} />
          {s}
        </label>
      ))}
    </div>
  );
}

// ───────────── novo lead ─────────────

const digits8 = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "").slice(-8);
const handle = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase().replace(/^@/, "");

export function NovoLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { stages, leads, team, today, openLead } = useComercial();
  const { user } = useSession();
  const create = useCreateLead();
  const firsts = useMemo(() => stages.filter((s) => s.type === "open").sort((a, b) => a.position - b.position).slice(0, 2), [stages]);

  const blank = { name: "", company: "", phone: "", instagram: "", email: "", segment: "", source: "WhatsApp", owner: "", stage: "", value: "", services: [] as string[] };
  const [f, setF] = useState(blank);
  const [forced, setForced] = useState(false);
  const set = (p: Partial<typeof blank>) => setF((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    if (!open) return;
    setForced(false);
    setF({ ...blank, owner: team.find((m) => m.user_id === user?.id)?.user_id ?? team[0]?.user_id ?? "", stage: (firsts[1] ?? firsts[0])?.id ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dup = useMemo<Lead | undefined>(() => {
    const p = digits8(f.phone);
    const ig = handle(f.instagram);
    const em = f.email.trim().toLowerCase();
    return leads.find((l) => (p.length >= 8 && digits8(l.phone) === p) || (ig && handle(l.instagram) === ig) || (em && l.email?.toLowerCase() === em));
  }, [f.phone, f.instagram, f.email, leads]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dup && !forced) { setForced(true); return; }
    const firstStage = f.stage === firsts[0]?.id;
    create.mutate(
      {
        lead: {
          name: f.name.trim(), company: f.company.trim() || null, phone: f.phone.trim() || null, instagram: f.instagram.trim() || null, email: f.email.trim() || null,
          segment: f.segment.trim() || null, source: f.source, owner_id: f.owner || null, stage_id: f.stage, value: Number(f.value) || 0, services: f.services, size: SIZES[1],
        },
        firstAction: { type: firstStage ? "Primeira abordagem" : "Follow-up", title: firstStage ? "Fazer a primeira abordagem" : "Responder e puxar reunião", due_date: today },
      },
      { onSuccess: () => { toast.success("Lead criado, com a primeira ação pra hoje"); onClose(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Novo lead</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome"><Input value={f.name} onChange={(e) => set({ name: e.target.value })} required autoFocus placeholder="Nome do contato" /></Field>
            <Field label="Empresa"><Input value={f.company} onChange={(e) => set({ company: e.target.value })} placeholder="Nome da empresa" /></Field>
            <Field label="WhatsApp"><Input value={f.phone} onChange={(e) => { set({ phone: e.target.value }); setForced(false); }} placeholder="(99) 9...." /></Field>
            <Field label="Instagram"><Input value={f.instagram} onChange={(e) => { set({ instagram: e.target.value }); setForced(false); }} placeholder="@perfil" /></Field>
            <Field label="E-mail"><Input type="email" value={f.email} onChange={(e) => { set({ email: e.target.value }); setForced(false); }} placeholder="nome@empresa.com" /></Field>
            <Field label="Segmento"><Input value={f.segment} onChange={(e) => set({ segment: e.target.value })} placeholder="Ex.: Saúde, Varejo" /></Field>
            <Field label="Origem">
              <Select value={f.source} onValueChange={(v) => set({ source: v, ...(v === "Prospecção ativa" && firsts[0] ? { stage: firsts[0].id } : {}) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Responsável">
              <Select value={f.owner} onValueChange={(v) => set({ owner: v })}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Etapa inicial">
              <Select value={f.stage} onValueChange={(v) => set({ stage: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{firsts.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Valor mensal estimado (R$)"><Input type="number" min={0} value={f.value} onChange={(e) => set({ value: e.target.value })} /></Field>
          </div>
          <Field label="Serviços de interesse"><ServiceChecks value={f.services} onChange={(v) => set({ services: v })} /></Field>
          {dup && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              Já existe um lead com esse contato: <b>{dup.name}</b>{dup.company ? ` (${dup.company})` : ""}.
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" onClick={() => { onClose(); openLead(dup.id); }}>Abrir o existente</Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || !f.stage}>{dup && forced ? "Criar mesmo assim" : "Criar lead"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── nova atividade ─────────────

export function NovaAtividadeDialog({ open, leadId, onClose }: { open: boolean; leadId?: string; onClose: () => void }) {
  const { leads, team, today, stageOf, leadOf } = useComercial();
  const { user } = useSession();
  const create = useCreateActivity();
  const lead = leadId ? leadOf(leadId) : undefined;
  const openLeads = useMemo(() => leads.filter((l) => isOpenStage(stageOf(l.stage_id))), [leads, stageOf]);

  const [pickedLead, setPickedLead] = useState("");
  const [type, setType] = useState<string>("Follow-up");
  const [owner, setOwner] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(addDays(1, today));

  useEffect(() => {
    if (!open) return;
    setPickedLead(leadId ?? openLeads[0]?.id ?? "");
    setType("Follow-up");
    setOwner(lead?.owner_id ?? team.find((m) => m.user_id === user?.id)?.user_id ?? team[0]?.user_id ?? "");
    setTitle("");
    setDate(addDays(1, today));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId]);

  const placeholder = ({ "Reunião": "Ex.: Reunião de apresentação às 15h", "Enviar proposta": "Ex.: Enviar proposta revisada", "Ligação": "Ex.: Ligar para tirar dúvidas" } as Record<string, string>)[type] ?? "Ex.: Mandar mensagem perguntando sobre a proposta";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const id = leadId ?? pickedLead;
    if (!id) return;
    create.mutate({ lead_id: id, owner_id: owner || null, type, title: title.trim(), due_date: date }, { onSuccess: () => { toast.success("Atividade agendada"); onClose(); } });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{lead ? `Próxima ação: ${lead.name}` : "Nova atividade"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!leadId && (
            <Field label="Lead">
              <Select value={pickedLead} onValueChange={setPickedLead}>
                <SelectTrigger><SelectValue placeholder="Escolha o lead" /></SelectTrigger>
                <SelectContent>{openLeads.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}{l.company ? ` · ${l.company}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Responsável">
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="O que fazer"><Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus placeholder={placeholder} /></Field>
          <Field label="Quando">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <div className="flex flex-wrap gap-2 pt-1">
              {([[0, "Hoje"], [1, "Amanhã"], [3, "Em 3 dias"], [7, "Em 1 semana"]] as const).map(([d, t]) => (
                <Button key={t} type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setDate(addDays(d, today))}>{t}</Button>
              ))}
            </div>
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending || !(leadId ?? pickedLead) || !title.trim()}>Agendar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── perdido ─────────────

export function PerdaDialog({ lead, stageId, onClose }: { lead: Lead | null; stageId: string | null; onClose: () => void }) {
  const update = useUpdateLead();
  const [reason, setReason] = useState<string>(LOSS_REASONS[0]);
  useEffect(() => { if (lead) setReason(LOSS_REASONS[0]); }, [lead]);
  return (
    <Dialog open={!!lead && !!stageId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Por que não fechou?</DialogTitle>
          <DialogDescription>O motivo aparece nos relatórios e mostra onde as vendas mais se perdem.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {LOSS_REASONS.map((r) => (
            <label key={r} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/50 px-3 py-2 text-sm transition", reason === r && "border-primary bg-primary/5")}>
              <input type="radio" name="loss" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[hsl(var(--primary))]" />
              {r}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="destructive"
            disabled={update.isPending}
            onClick={() => lead && stageId && update.mutate({ id: lead.id, patch: { stage_id: stageId, loss_reason: reason } }, { onSuccess: () => { toast("Negócio marcado como perdido"); onClose(); } })}
          >
            Marcar como perdido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────── ganho + onboarding ─────────────

export function GanhoDialog({ lead, stageId, onClose }: { lead: Lead | null; stageId: string | null; onClose: () => void }) {
  const { team, today } = useComercial();
  const win = useWinLead();
  const [f, setF] = useState({ value: "", setup: "0", months: "6", start: today, videos: "4", artes: "12", approver: "", services: [] as string[], at: "", sm: "", tr: "" });
  const set = (p: Partial<typeof f>) => setF((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    if (!lead) return;
    const first = team[0]?.user_id ?? "";
    setF({ value: String(lead.value || ""), setup: String(lead.setup || 0), months: "6", start: today, videos: "4", artes: "12", approver: lead.name, services: lead.services, at: lead.owner_id ?? first, sm: first, tr: first });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  const squadSelect = (key: "at" | "sm" | "tr", label: string) => (
    <Field label={label}>
      <Select value={f[key]} onValueChange={(v) => set({ [key]: v } as Partial<typeof f>)}>
        <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
        <SelectContent>{team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!lead || !stageId) return;
    win.mutate(
      {
        leadId: lead.id, stageId, value: Number(f.value) || 0, setup: Number(f.setup) || 0, months: Number(f.months) || 6, start: f.start,
        videos: Number(f.videos) || 0, artes: Number(f.artes) || 0, approver: f.approver, services: f.services,
        squad: { atendimento_id: f.at, social_media_id: f.sm, trafego_id: f.tr },
      },
      { onSuccess: () => { toast.success(`${lead.company || lead.name} entrou no onboarding`); onClose(); } },
    );
  };

  return (
    <Dialog open={!!lead && !!stageId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Venda fechada: {lead?.company || lead?.name}</DialogTitle>
          <DialogDescription>Confira os dados do contrato. O cliente entra no onboarding com as tarefas já distribuídas para a equipe.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Valor mensal (R$)"><Input type="number" min={0} value={f.value} onChange={(e) => set({ value: e.target.value })} required /></Field>
            <Field label="Implantação (R$)"><Input type="number" min={0} value={f.setup} onChange={(e) => set({ setup: e.target.value })} /></Field>
            <Field label="Vigência (meses)"><Input type="number" min={1} value={f.months} onChange={(e) => set({ months: e.target.value })} /></Field>
          </div>
          <Field label="Serviços contratados"><ServiceChecks value={f.services} onChange={(v) => set({ services: v })} /></Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Início"><Input type="date" value={f.start} onChange={(e) => set({ start: e.target.value })} /></Field>
            <Field label="Vídeos por mês"><Input type="number" min={0} value={f.videos} onChange={(e) => set({ videos: e.target.value })} /></Field>
            <Field label="Artes por mês"><Input type="number" min={0} value={f.artes} onChange={(e) => set({ artes: e.target.value })} /></Field>
          </div>
          <Field label="Contato de aprovação"><Input value={f.approver} onChange={(e) => set({ approver: e.target.value })} /></Field>
          <div className="space-y-2 rounded-xl border border-border/50 p-3">
            <h4 className="text-sm font-semibold">Squad do cliente</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {squadSelect("at", "Atendimento")}
              {squadSelect("sm", "Social media")}
              {squadSelect("tr", "Tráfego")}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Valor ao fechar: {brl(Number(f.value))}/mês + {brl(Number(f.setup))} de implantação.</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={win.isPending || !f.at || !f.sm || !f.tr}>Confirmar venda e iniciar onboarding</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
