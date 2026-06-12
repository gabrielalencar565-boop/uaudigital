import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Power, Calendar, Zap, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { TRIGGERS, WEEKDAYS, AUDIENCES, getTrigger, renderTemplate, type TriggerVar } from "./automation-catalog";
import { useWhatsappAutomations, useUpsertAutomation, useDeleteAutomation, useToggleAutomation, type WhatsappAutomation, type AutomationInput } from "./use-whatsapp-automations";

const EMPTY: AutomationInput = {
  name: "",
  trigger_type: "event",
  trigger_key: "task_assigned",
  schedule_time: null,
  schedule_days: [0, 1, 2, 3, 4, 5, 6],
  message_template: "",
  audience: "assignee",
  group_phone: null,
  enabled: true,
};

export function AutomationsCenter() {
  const { data: list = [], isLoading } = useWhatsappAutomations();
  const upsert = useUpsertAutomation();
  const toggle = useToggleAutomation();
  const del = useDeleteAutomation();

  const [editing, setEditing] = useState<{ open: boolean; current?: WhatsappAutomation }>({ open: false });
  const [deleting, setDeleting] = useState<WhatsappAutomation | null>(null);
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");

  const filtered = useMemo(() => {
    if (filter === "enabled") return list.filter((a) => a.enabled);
    if (filter === "disabled") return list.filter((a) => !a.enabled);
    return list;
  }, [list, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Central de Automações</h2>
          <p className="text-sm text-muted-foreground">Crie, edite, ative ou desative notificações automáticas do WhatsApp.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="enabled">Apenas ativas</SelectItem>
              <SelectItem value="disabled">Apenas inativas</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="brand" className="gap-2" onClick={() => setEditing({ open: true })}>
            <Plus className="h-4 w-4" /> Nova Automação
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma automação. Clique em "Nova Automação" para criar a primeira.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((a) => (
            <AutomationCard
              key={a.id}
              automation={a}
              onToggle={(enabled) => toggle.mutate({ id: a.id, enabled })}
              onEdit={() => setEditing({ open: true, current: a })}
              onDelete={() => setDeleting(a)}
            />
          ))}
        </div>
      )}

      <AutomationEditor
        open={editing.open}
        current={editing.current}
        onClose={() => setEditing({ open: false })}
        onSave={async (input) => {
          try {
            await upsert.mutateAsync(editing.current ? { ...input, id: editing.current.id } : input);
            toast.success(editing.current ? "Automação atualizada" : "Automação criada");
            setEditing({ open: false });
          } catch (e: any) {
            toast.error(e?.message || "Erro ao salvar automação");
          }
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir automação?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" será removida permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await del.mutateAsync(deleting.id);
                  toast.success("Automação excluída");
                  setDeleting(null);
                } catch (e: any) { toast.error(e?.message || "Erro ao excluir"); }
              }}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AutomationCard({ automation, onToggle, onEdit, onDelete }: {
  automation: WhatsappAutomation;
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const trig = getTrigger(automation.trigger_key);
  const Icon = automation.trigger_type === "schedule" ? Clock : Zap;
  return (
    <Card className={automation.enabled ? "" : "opacity-60"}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold truncate">{automation.name}</h3>
              <Badge variant={automation.enabled ? "default" : "secondary"} className="shrink-0">
                {automation.enabled ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {trig?.label ?? automation.trigger_key}
              {automation.trigger_type === "schedule" && automation.schedule_time && (
                <> · <Calendar className="inline h-3 w-3" /> {automation.schedule_time}</>
              )}
            </p>
          </div>
          <Switch checked={automation.enabled} onCheckedChange={onToggle} />
        </div>

        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
          {automation.message_template}
        </div>

        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AutomationEditor({ open, current, onClose, onSave }: {
  open: boolean;
  current?: WhatsappAutomation;
  onClose: () => void;
  onSave: (input: AutomationInput) => void | Promise<void>;
}) {
  const initial: AutomationInput = current ? {
    name: current.name,
    description: current.description,
    trigger_type: current.trigger_type,
    trigger_key: current.trigger_key,
    schedule_time: current.schedule_time,
    schedule_days: current.schedule_days ?? [0, 1, 2, 3, 4, 5, 6],
    message_template: current.message_template,
    audience: current.audience,
    group_phone: current.group_phone ?? null,
    enabled: current.enabled,
  } : EMPTY;

  const [form, setForm] = useState<AutomationInput>(initial);

  // Reset when dialog opens
  useEffect(() => { if (open) setForm(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, current?.id]);

  const trig = getTrigger(form.trigger_key);
  const availableVars = trig?.vars ?? [];
  const preview = renderTemplate(form.message_template, availableVars);

  const insertVar = (v: TriggerVar) =>
    setForm((s) => ({ ...s, message_template: (s.message_template || "") + `{${v}}` }));

  const handleTriggerChange = (key: string) => {
    const t = getTrigger(key);
    setForm((s) => ({
      ...s,
      trigger_key: key,
      trigger_type: t?.type ?? "event",
      schedule_time: t?.type === "schedule" ? (s.schedule_time ?? t.defaultTime ?? "08:00") : null,
      schedule_days: t?.type === "schedule" ? (s.schedule_days ?? [0, 1, 2, 3, 4, 5, 6]) : null,
      name: s.name || t?.label || "",
    }));
  };

  const toggleDay = (d: number) => {
    setForm((s) => {
      const days = new Set(s.schedule_days ?? []);
      if (days.has(d)) days.delete(d); else days.add(d);
      return { ...s, schedule_days: Array.from(days).sort() };
    });
  };

  const eventTriggers = TRIGGERS.filter((t) => t.type === "event");
  const scheduleTriggers = TRIGGERS.filter((t) => t.type === "schedule");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{current ? "Editar automação" : "Nova automação"}</DialogTitle>
          <DialogDescription>Configure quando e como o WhatsApp deve ser enviado.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} placeholder="Ex.: Agenda diária" />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de gatilho</Label>
            <Select value={form.trigger_key} onValueChange={handleTriggerChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Eventos</SelectLabel>
                  {eventTriggers.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Horário programado</SelectLabel>
                  {scheduleTriggers.map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {trig && <p className="text-xs text-muted-foreground">{trig.description}</p>}
          </div>

          {form.trigger_type === "schedule" && (
            <>
              <div className="space-y-1.5">
                <Label>Horário</Label>
                <Input type="time" value={form.schedule_time ?? ""} onChange={(e) => setForm((s) => ({ ...s, schedule_time: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Fuso: America/São_Paulo. Executado em janelas de 5 minutos.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Dias da semana</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((d) => {
                    const active = (form.schedule_days ?? []).includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDay(d.value)}
                        className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                          active ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        }`}
                        title={d.label}
                      >{d.short}</button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Audiência</Label>
            <Select value={form.audience} onValueChange={(v) => setForm((s) => ({ ...s, audience: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{AUDIENCES.find((a) => a.value === form.audience)?.description}</p>
          </div>

          {form.audience === "group" && (
            <div className="space-y-1.5 rounded-md border border-border bg-muted/30 p-3">
              <Label>ID do grupo do WhatsApp</Label>
              <Input
                value={form.group_phone ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, group_phone: e.target.value }))}
                placeholder="Ex.: 120363154123456789-1714567890"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Cole o ID do grupo (formato Z-API). Você encontra na aba <strong>Conversar</strong> abrindo o grupo desejado,
                ou no painel da Z-API. Aceita também com sufixo <code>@g.us</code>.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Mensagem</Label>
            <Textarea
              rows={6}
              value={form.message_template}
              onChange={(e) => setForm((s) => ({ ...s, message_template: e.target.value }))}
              placeholder="🌞 Bom dia, {primeiro_nome}!..."
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Variáveis disponíveis:</span>
              {availableVars.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVar(v)}
                  className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono hover:bg-muted/70 transition-colors"
                  title={`Inserir {${v}}`}
                >{`{${v}}`}</button>
              ))}
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
              <span className="font-medium text-foreground">Pré-visualização: </span>
              {preview || <em>(mensagem vazia)</em>}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <Label className="text-sm">Automação ativa</Label>
              <p className="text-xs text-muted-foreground">Desative para pausar o envio sem excluir a regra.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm((s) => ({ ...s, enabled: v }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            variant="brand"
            disabled={!form.name.trim() || !form.message_template.trim()}
            onClick={() => onSave(form)}
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
