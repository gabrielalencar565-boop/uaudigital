import { useEffect, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useComercial } from "../ComercialContext";
import {
  useAddNote, useDeleteLead, useLeadNotes, useSetActivityDone, useUpdateClient, useUpdateClientTask, useUpdateLead,
} from "../hooks/use-comercial";
import { brl, diffDays, isOpenStage, NOTE_KINDS, ONBOARDING_STAGES, openActivities, SERVICES, shortDate, SIZES, SOURCES, waLink, type Lead } from "../lib/rules";

const NONE = "__none__";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

/** Campo de texto que só grava ao sair dele, e só se mudou. */
function TextField({ label, value, onSave, type = "text", disabled }: { label: string; value: string | null | undefined; onSave: (v: string) => void; type?: string; disabled?: boolean }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => setV(value ?? ""), [value]);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== (value ?? "")) onSave(v); }}
        className="h-9"
      />
    </div>
  );
}

// ───────────── gaveta do lead ─────────────

export function LeadDrawer({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const { leads, stages, acts, team, today, stageOf, leadOf, moveLead, newActivity, goto } = useComercial();
  const lead = leadId ? leadOf(leadId) : undefined;
  const update = useUpdateLead();
  const del = useDeleteLead();
  const setDone = useSetActivityDone();
  const addNote = useAddNote();
  const notesQ = useLeadNotes(leadId);
  const [noteText, setNoteText] = useState("");
  const [noteKind, setNoteKind] = useState<string>("WhatsApp");
  const [tagDraft, setTagDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { setNoteText(""); setTagDraft(""); }, [leadId]);

  const stage = lead ? stageOf(lead.stage_id) : undefined;
  const open = isOpenStage(stage);
  const save = (patch: Partial<Lead>) => lead && update.mutate({ id: lead.id, patch });
  const allTags = [...new Set(["Prioritário", "Tráfego pago", "Indicação de cliente", ...leads.flatMap((l) => l.tags)])];

  const reopen = () => {
    if (!lead) return;
    const lastOpen = [...stages].filter((s) => s.type === "open").sort((a, b) => b.position - a.position)[0];
    if (lastOpen) update.mutate({ id: lead.id, patch: { stage_id: lastOpen.id } }, { onSuccess: () => toast(`Negócio reaberto em ${lastOpen.name}`) });
  };

  const addTag = () => {
    const t = tagDraft.trim();
    if (!lead || !t || lead.tags.includes(t)) return setTagDraft("");
    save({ tags: [...lead.tags, t] });
    setTagDraft("");
  };

  const submitNote = () => {
    const text = noteText.trim();
    if (!lead || !text) return;
    addNote.mutate({ leadId: lead.id, kind: noteKind, text }, { onSuccess: () => setNoteText("") });
  };

  const pendingActs = lead ? openActivities(lead.id, acts) : [];
  const wa = waLink(lead?.phone);

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {!lead ? (
          <SheetHeader><SheetTitle>Lead</SheetTitle><SheetDescription>Lead não encontrado.</SheetDescription></SheetHeader>
        ) : (
          <div className="space-y-5 pb-6">
            <SheetHeader className="text-left">
              <SheetTitle>{lead.name}</SheetTitle>
              <SheetDescription>{[lead.role, lead.company].filter(Boolean).join(" · ") || "Sem empresa informada"}</SheetDescription>
            </SheetHeader>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Etapa</Label>
                <Select value={lead.stage_id} onValueChange={(v) => v !== lead.stage_id && moveLead(lead, v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{[...stages].sort((a, b) => a.position - b.position).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Responsável</Label>
                <Select value={lead.owner_id ?? NONE} onValueChange={(v) => save({ owner_id: v === NONE ? null : v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sem responsável</SelectItem>
                    {team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {open && (
              <div className="space-y-2 rounded-xl border border-border/50 p-3">
                <h4 className="text-sm font-semibold">Próximas ações</h4>
                {pendingActs.length === 0 ? (
                  <span className="inline-flex rounded-md border border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">sem próxima ação</span>
                ) : (
                  pendingActs.map((a) => {
                    const d = diffDays(a.due_date, today);
                    return (
                      <div key={a.id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={false} onCheckedChange={() => setDone.mutate({ id: a.id, done: true })} aria-label="Concluir" />
                        <span className="min-w-0 flex-1 truncate"><b>{a.type}</b> · {a.title}</span>
                        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium", d < 0 ? "bg-red-500/10 text-red-500" : d === 0 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>
                          {d === 0 ? "hoje" : shortDate(a.due_date)}
                        </span>
                      </div>
                    );
                  })
                )}
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => newActivity(lead.id)}><Plus className="h-3.5 w-3.5" /> Agendar ação</Button>
              </div>
            )}

            <Section title="Negócio">
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField label="Valor mensal (R$)" type="number" value={lead.value ? String(lead.value) : ""} onSave={(v) => save({ value: Number(v) || 0 })} />
                <TextField label="Implantação (R$)" type="number" value={lead.setup ? String(lead.setup) : ""} onSave={(v) => save({ setup: Number(v) || 0 })} />
                <TextField label="Previsão de fechamento" type="date" value={lead.close_by} onSave={(v) => save({ close_by: v || null })} />
              </div>
              <p className="text-xs text-muted-foreground">
                Probabilidade pela etapa: {stage?.probability ?? 0}% · Valor ponderado {brl((lead.value * (stage?.probability ?? 0)) / 100)}/mês
                {lead.loss_reason ? ` · Motivo da perda: ${lead.loss_reason}` : ""}
              </p>
            </Section>

            <Section title="Serviços de interesse">
              <div className="flex flex-wrap gap-4">
                {SERVICES.map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={lead.services.includes(s)} onCheckedChange={(c) => save({ services: c === true ? [...lead.services, s] : lead.services.filter((x) => x !== s) })} />
                    {s}
                  </label>
                ))}
              </div>
            </Section>

            <Section title="Etiquetas">
              <div className="flex flex-wrap items-center gap-1.5">
                {lead.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {t}
                    <button type="button" aria-label={`Remover ${t}`} onClick={() => save({ tags: lead.tags.filter((x) => x !== t) })}><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <Input
                  value={tagDraft}
                  list="comercial-tags"
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  onBlur={addTag}
                  placeholder="+ etiqueta"
                  className="h-7 w-32 text-xs"
                />
                <datalist id="comercial-tags">{allTags.map((t) => <option key={t} value={t} />)}</datalist>
              </div>
            </Section>

            <Section title="Contato e empresa">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Nome" value={lead.name} onSave={(v) => v.trim() && save({ name: v.trim() })} />
                <TextField label="Cargo" value={lead.role} onSave={(v) => save({ role: v.trim() || null })} />
                <TextField label="Empresa" value={lead.company} onSave={(v) => save({ company: v.trim() || null })} />
                <TextField label="Segmento" value={lead.segment} onSave={(v) => save({ segment: v.trim() || null })} />
                <TextField label="WhatsApp" value={lead.phone} onSave={(v) => save({ phone: v.trim() || null })} />
                <TextField label="E-mail" value={lead.email} onSave={(v) => save({ email: v.trim() || null })} />
                <TextField label="Instagram" value={lead.instagram} onSave={(v) => save({ instagram: v.trim() || null })} />
                <TextField label="Site" value={lead.site} onSave={(v) => save({ site: v.trim() || null })} />
                <TextField label="Cidade" value={lead.city} onSave={(v) => save({ city: v.trim() || null })} />
                <div className="space-y-1.5">
                  <Label className="text-xs">Porte</Label>
                  <Select value={lead.size ?? NONE} onValueChange={(v) => save({ size: v === NONE ? null : v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>Não informado</SelectItem>{SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Origem</Label>
                  <Select value={lead.source} onValueChange={(v) => save({ source: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <TextField label="Cadastrado em" value={format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })} onSave={() => {}} disabled />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => { onClose(); goto("chat"); }}><MessageCircle className="h-3.5 w-3.5" /> Abrir conversas</Button>
                {wa && <Button asChild size="sm" variant="outline" className="h-8 gap-1"><a href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></Button>}
              </div>
            </Section>

            <Section title="Histórico">
              <div className="space-y-2">
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={2} placeholder="O que rolou nesse contato?" className="resize-y" />
                <div className="flex gap-2">
                  <Select value={noteKind} onValueChange={setNoteKind}>
                    <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{NOTE_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" className="h-9" onClick={submitNote} disabled={!noteText.trim() || addNote.isPending}>Adicionar</Button>
                </div>
              </div>
              <ul className="space-y-2 pt-2">
                {(notesQ.data ?? []).map((n) => {
                  const system = n.kind === "Sistema" || n.kind === "Automação";
                  return (
                    <li key={n.id} className={cn("rounded-lg border-l-2 px-3 py-1.5 text-sm", system ? "border-border bg-muted/30 text-muted-foreground" : n.kind === "Atividade" ? "border-primary/50 bg-primary/5" : "border-emerald-500/50 bg-card")}>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">{format(new Date(n.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                        <span className="font-medium uppercase tracking-wide">{n.kind}</span>
                      </div>
                      <div>{n.text}</div>
                    </li>
                  );
                })}
                {notesQ.isSuccess && (notesQ.data ?? []).length === 0 && <li className="text-xs text-muted-foreground">Nada registrado ainda.</li>}
              </ul>
            </Section>

            <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">
              {!open && <Button variant="outline" onClick={reopen}>Reabrir negócio</Button>}
              <Button variant="ghost" className="ml-auto gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /> Excluir lead</Button>
            </div>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir este lead?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {lead.name} sai do funil junto com as atividades, o histórico e, se houver, o onboarding. Isso não pode ser desfeito.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => del.mutate(lead.id, { onSuccess: () => { toast("Lead excluído"); onClose(); } })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ───────────── gaveta do cliente em onboarding ─────────────

export function ClientDrawer({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const { clients, clientTasks, team, leadOf, openLead, memberOf } = useComercial();
  const client = clientId ? clients.find((c) => c.id === clientId) : undefined;
  const lead = client ? leadOf(client.lead_id) : undefined;
  const updateClient = useUpdateClient();
  const updateTask = useUpdateClientTask();
  const tasks = client ? clientTasks.filter((t) => t.client_id === client.id).sort((a, b) => a.position - b.position) : [];
  const patch = (p: Parameters<typeof updateClient.mutate>[0]["patch"]) => client && updateClient.mutate({ id: client.id, patch: p });

  return (
    <Sheet open={!!clientId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {!client || !lead ? (
          <SheetHeader><SheetTitle>Onboarding</SheetTitle><SheetDescription>Cliente não encontrado.</SheetDescription></SheetHeader>
        ) : (
          <div className="space-y-5 pb-6">
            <SheetHeader className="text-left">
              <SheetTitle>{lead.company || lead.name}</SheetTitle>
              <SheetDescription>{lead.name} · cliente desde {shortDate(client.start_date)}</SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label className="text-xs">Etapa</Label>
              <Select value={client.onboarding_stage} onValueChange={(v) => patch({ onboarding_stage: v as typeof client.onboarding_stage })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ONBOARDING_STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <Section title="Contrato">
              <div className="grid gap-3 sm:grid-cols-3">
                <TextField label="Valor mensal" value={brl(client.value)} onSave={() => {}} disabled />
                <TextField label="Implantação" value={brl(client.setup)} onSave={() => {}} disabled />
                <TextField label="Vigência" value={`${client.months} meses`} onSave={() => {}} disabled />
                <TextField label="Vídeos/mês" type="number" value={String(client.videos)} onSave={(v) => patch({ videos: Number(v) || 0 })} />
                <TextField label="Artes/mês" type="number" value={String(client.artes)} onSave={(v) => patch({ artes: Number(v) || 0 })} />
                <TextField label="Aprovação" value={client.approver} onSave={(v) => patch({ approver: v.trim() || null })} />
              </div>
              <div className="flex flex-wrap gap-1.5">{client.services.map((s) => <span key={s} className="rounded-md bg-muted px-2 py-0.5 text-xs">{s}</span>)}</div>
            </Section>

            <Section title="Squad">
              <div className="flex flex-wrap gap-1.5">
                {([["atendimento_id", "Atendimento"], ["social_media_id", "Social media"], ["trafego_id", "Tráfego"]] as const).map(([k, label]) => (
                  <span key={k} className="rounded-md bg-muted px-2 py-0.5 text-xs">{label}: {memberOf(client.squad?.[k])?.display_name ?? "—"}</span>
                ))}
              </div>
            </Section>

            <Section title="Checklist de implantação">
              <ul className="divide-y divide-border/30">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 py-2">
                    <Checkbox checked={t.done} onCheckedChange={(c) => updateTask.mutate({ id: t.id, patch: { done: c === true } })} id={`ot-${t.id}`} />
                    <label htmlFor={`ot-${t.id}`} className={cn("min-w-0 flex-1 text-sm", t.done && "text-muted-foreground line-through")}>{t.title}</label>
                    <Select value={t.owner_id ?? NONE} onValueChange={(v) => updateTask.mutate({ id: t.id, patch: { owner_id: v === NONE ? null : v } })}>
                      <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sem responsável</SelectItem>
                        {team.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.display_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </li>
                ))}
              </ul>
            </Section>

            <Button variant="outline" onClick={() => { onClose(); openLead(lead.id); }}>Ver histórico comercial</Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
