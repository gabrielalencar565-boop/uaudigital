import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Instagram, DollarSign, Moon, MessageCircle, Loader2 } from "lucide-react";
import {
  useCrmLeadAutomations,
  useUpsertCrmLeadAutomation,
  type CrmLeadAutomation,
  type CrmWelcomeScenario,
} from "../hooks/use-crm-lead-automations";

const VARS = ["{primeiro_nome}", "{nome_empresa}", "{origem}", "{servico_interesse}"];

const META: Record<CrmWelcomeScenario, { label: string; description: string; icon: typeof MessageCircle; tint: string }> = {
  padrao: {
    label: "Mensagem padrão",
    description: "Enviada para qualquer novo lead identificado no WhatsApp quando nenhuma das condições especiais se aplica.",
    icon: MessageCircle,
    tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
  },
  instagram: {
    label: "Lead vindo do Instagram",
    description: "Usada quando a origem do lead é Instagram ou a mensagem cita Instagram/Direct.",
    icon: Instagram,
    tint: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30",
  },
  orcamento: {
    label: "Lead pedindo orçamento",
    description: "Disparada quando o lead menciona orçamento, preço, valor ou investimento.",
    icon: DollarSign,
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  fora_horario: {
    label: "Fora do horário comercial",
    description: "Tem prioridade máxima. Usa o horário configurado abaixo para detectar quando responder de forma assíncrona.",
    icon: Moon,
    tint: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  },
};

const WEEKDAYS = [
  { value: 1, short: "S" }, { value: 2, short: "T" }, { value: 3, short: "Q" },
  { value: 4, short: "Q" }, { value: 5, short: "S" }, { value: 6, short: "S" }, { value: 7, short: "D" },
];

function preview(template: string) {
  return template
    .replace(/\{primeiro_nome\}/g, "Maria")
    .replace(/\{nome_empresa\}/g, "Acme")
    .replace(/\{origem\}/g, "Instagram")
    .replace(/\{servico_interesse\}/g, "tráfego pago");
}

export function ComercialAutomacoesTab() {
  const { data: list = [], isLoading } = useCrmLeadAutomations();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Mensagem automática de boas-vindas</h2>
        <p className="text-sm text-muted-foreground">
          Configure as mensagens enviadas automaticamente quando um novo lead é identificado no WhatsApp.
          O sistema escolhe um cenário por prioridade: <strong>fora do horário</strong> &gt;{" "}
          <strong>orçamento</strong> &gt; <strong>Instagram</strong> &gt; <strong>padrão</strong>.
          Mensagens não são enviadas para clientes, equipe, fornecedores, conversas em atendimento manual,
          nem para contatos que já receberam outra automação no período de cooldown.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(["fora_horario", "orcamento", "instagram", "padrao"] as CrmWelcomeScenario[]).map((s) => {
            const item = list.find((a) => a.scenario === s);
            if (!item) return null;
            return <AutomationCard key={s} item={item} />;
          })}
        </div>
      )}
    </div>
  );
}

function AutomationCard({ item }: { item: CrmLeadAutomation }) {
  const meta = META[item.scenario];
  const Icon = meta.icon;
  const upsert = useUpsertCrmLeadAutomation();
  const [form, setForm] = useState<CrmLeadAutomation>(item);
  const dirty = JSON.stringify(form) !== JSON.stringify(item);

  useEffect(() => { setForm(item); }, [item]);

  const toggleDay = (d: number) => {
    const set = new Set(form.business_days);
    if (set.has(d)) set.delete(d); else set.add(d);
    setForm({ ...form, business_days: Array.from(set).sort() });
  };

  const insertVar = (v: string) =>
    setForm({ ...form, message_template: (form.message_template || "") + v });

  const save = async () => {
    try {
      await upsert.mutateAsync(form);
      toast.success("Automação atualizada");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    }
  };

  return (
    <Card className={form.enabled ? "" : "opacity-70"}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`rounded-md border p-2 ${meta.tint}`}><Icon className="h-4 w-4" /></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{meta.label}</h3>
              <Badge variant={form.enabled ? "default" : "secondary"}>{form.enabled ? "Ativa" : "Inativa"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
          </div>
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
        </div>

        <div className="space-y-1.5">
          <Label>Mensagem</Label>
          <Textarea
            rows={5}
            value={form.message_template}
            onChange={(e) => setForm({ ...form, message_template: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">Variáveis:</span>
            {VARS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVar(v)}
                className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[11px] font-mono hover:bg-muted/70"
              >{v}</button>
            ))}
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-xs whitespace-pre-wrap text-muted-foreground">
            <span className="font-medium text-foreground">Pré-visualização: </span>
            {preview(form.message_template) || <em>(vazio)</em>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Cooldown (dias)</Label>
            <Input
              type="number" min={0}
              value={form.cooldown_days}
              onChange={(e) => setForm({ ...form, cooldown_days: Number(e.target.value) || 0 })}
            />
            <p className="text-[11px] text-muted-foreground">Não reenvia se o contato recebeu uma automação nesse período.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Follow-up (minutos)</Label>
            <Input
              type="number" min={1}
              value={form.followup_minutes}
              onChange={(e) => setForm({ ...form, followup_minutes: Number(e.target.value) || 10 })}
            />
            <p className="text-[11px] text-muted-foreground">Cria tarefa para o responsável responder neste prazo.</p>
          </div>
        </div>

        {item.scenario === "fora_horario" && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
            <Label className="text-xs">Horário comercial</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Início</Label>
                <Input type="time" value={form.business_hours_start?.slice(0, 5) ?? "09:00"}
                  onChange={(e) => setForm({ ...form, business_hours_start: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Fim</Label>
                <Input type="time" value={form.business_hours_end?.slice(0, 5) ?? "18:00"}
                  onChange={(e) => setForm({ ...form, business_hours_end: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Dias úteis</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((d) => {
                  const active = form.business_days.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`h-8 w-8 rounded-md border text-xs font-medium ${
                        active ? "bg-primary text-primary-foreground border-primary"
                               : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >{d.short}</button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" variant="brand" disabled={!dirty || upsert.isPending} onClick={save}>
            {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
