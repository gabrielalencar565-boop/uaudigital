import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle, Save, Send, RefreshCw, Megaphone, Clock, Trophy, Pencil,
  Settings2, MessageSquareText, Users, History, ChevronRight, ArrowLeft, Zap,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { WhatsAppPreferencesCard } from "@/features/configuracoes/WhatsAppPreferencesCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Settings = {
  enabled: boolean;
  provider: "evolution" | "zapi";
  base_url: string | null;
  instance_name: string | null;
  api_key_secret: string;
  zapi_client_token_secret: string | null;
  default_country_code: string;
  msg_new_task_intro: string;
  msg_deadline_today_intro: string;
  msg_deadline_tomorrow_intro: string;
  msg_deadline_overdue_intro: string;
  msg_xp_rank_intro: string;
  msg_broadcast_intro: string;
};

const DEFAULT_SETTINGS: Settings = {
  enabled: false,
  provider: "evolution",
  base_url: "",
  instance_name: "",
  api_key_secret: "WHATSAPP_API_KEY",
  zapi_client_token_secret: "WHATSAPP_ZAPI_CLIENT_TOKEN",
  default_country_code: "55",
  msg_new_task_intro: "🆕 Nova tarefa atribuída:",
  msg_deadline_today_intro: "⏰ Prazo hoje:",
  msg_deadline_tomorrow_intro: "⏰ Prazo amanhã:",
  msg_deadline_overdue_intro: "⚠️ Prazo atrasado:",
  msg_xp_rank_intro: "🏆 Ranking do mês:",
  msg_broadcast_intro: "📣 Aviso da equipe:",
};

function digitsOnly(v: string) {
  return v.replace(/\D/g, "");
}

type SubTab = "provedor" | "mensagens" | "teste" | "aviso" | "colaboradores" | "disparos" | "historico";

type CardDef = {
  key: SubTab;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const CARDS: CardDef[] = [
  { key: "provedor", title: "Provedor", description: "Configure Evolution/Z-API, URL base, instância e DDI padrão.", icon: Settings2 },
  { key: "mensagens", title: "Mensagens", description: "Personalize as frases iniciais das notificações (nova tarefa, prazos, ranking e avisos).", icon: MessageSquareText },
  { key: "teste", title: "Enviar teste", description: "Dispare uma mensagem para um número ou para você mesmo e valide a integração.", icon: Send },
  { key: "aviso", title: "Aviso para a equipe", description: "Mensagem em massa para todos os colaboradores que aceitam avisos.", icon: Megaphone },
  { key: "colaboradores", title: "Colaboradores", description: "Cadastre números e preferências de WhatsApp de cada colaborador.", icon: Users },
  { key: "disparos", title: "Disparos automáticos", description: "Execute lembretes de prazo e ranking XP manualmente.", icon: Zap },
  { key: "historico", title: "Histórico de envios", description: "Acompanhe os últimos 30 envios e seus status.", icon: History },
];

export function AdminWhatsAppPanel() {
  const qc = useQueryClient();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [subTab, setSubTab] = useState<SubTab | null>(null);

  // Test / broadcast inputs
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Teste de notificação WhatsApp 🚀");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [sending, setSending] = useState(false);

  // Admin edit dialog
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState<string>("");

  useEffect(() => {
    supabase
      .from("whatsapp_settings" as any)
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings({ ...DEFAULT_SETTINGS, ...(data as any) });
      });
  }, []);

  const logQ = useQuery({
    queryKey: ["whatsapp_send_log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_send_log" as any)
        .select("id, user_id, phone_e164, notification_type, status, message, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      return (data ?? []) as any[];
    },
    refetchInterval: subTab === "historico" ? 10000 : false,
    enabled: subTab === "historico",
  });

  const usersQ = useQuery({
    queryKey: ["whatsapp_users_admin"],
    queryFn: async () => {
      const { data: tm } = await supabase
        .from("team_members")
        .select("user_id, display_name, role_title")
        .order("display_name");
      const ids = (tm ?? []).map((t: any) => t.user_id);
      const { data: prefs } = ids.length
        ? await supabase
            .from("user_whatsapp_preferences" as any)
            .select("user_id, phone_e164, enabled, notify_new_task, notify_deadline, notify_late, notify_company, notify_xp_rank, updated_at")
            .in("user_id", ids)
        : { data: [] as any[] };
      const byId = new Map((prefs ?? []).map((p: any) => [p.user_id, p]));
      return (tm ?? []).map((t: any) => ({ ...t, ...(byId.get(t.user_id) || {}) }));
    },
    enabled: subTab === "colaboradores",
  });

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("whatsapp_settings" as any)
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) toast.error(error.message);
    else toast.success("Configuração salva");
    setSaving(false);
  };

  const callDispatch = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-dispatch", { body });
    if (error) throw error;
    if (data?.error) throw new Error(String(data.error));
    return data;
  };

  const sendTest = async () => {
    setSending(true);
    try {
      const phone = digitsOnly(testPhone);
      if (!phone) throw new Error("Informe um número");
      await callDispatch({ action: "send", phone, type: "manual", message: testMessage });
      toast.success("Mensagem de teste enviada");
      qc.invalidateQueries({ queryKey: ["whatsapp_send_log"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha no envio"); } finally { setSending(false); }
  };

  const sendTestToMe = async () => {
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth?.user?.id;
      if (!userId) throw new Error("Sessão não encontrada");
      await callDispatch({ action: "send", userId, type: "manual", message: testMessage });
      toast.success("Mensagem enviada para o seu WhatsApp");
      qc.invalidateQueries({ queryKey: ["whatsapp_send_log"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha (verifique se você cadastrou seu número em Configurações)"); } finally { setSending(false); }
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setSending(true);
    try {
      const r = await callDispatch({ action: "broadcast", message: broadcastMsg });
      toast.success(`Aviso enfileirado para ${r.enqueued ?? 0} usuários`);
      setBroadcastMsg("");
      qc.invalidateQueries({ queryKey: ["whatsapp_send_log"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha no envio"); } finally { setSending(false); }
  };

  const processNow = async () => {
    try {
      const r = await callDispatch({ action: "process_outbox", limit: 100 });
      toast.success(`Fila processada (${r.processed ?? 0} enviados)`);
      qc.invalidateQueries({ queryKey: ["whatsapp_send_log"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  };

  const runDeadlines = async () => {
    try {
      const r = await callDispatch({ action: "cron_deadlines" });
      toast.success(`Lembretes de prazo: ${r.enqueued ?? 0} enfileirados`);
      qc.invalidateQueries({ queryKey: ["whatsapp_send_log"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  };

  const runXpRanking = async () => {
    try {
      const r = await callDispatch({ action: "cron_xp_ranking" });
      toast.success(`Ranking XP: ${r.enqueued ?? 0} enviados`);
      qc.invalidateQueries({ queryKey: ["whatsapp_send_log"] });
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  };

  const activeCard = subTab ? CARDS.find((c) => c.key === subTab) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {subTab && (
          <Button variant="ghost" size="icon" onClick={() => setSubTab(null)} aria-label="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {activeCard ? activeCard.title : "WhatsApp"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {activeCard ? activeCard.description : "Escolha uma seção para configurar a integração de WhatsApp."}
          </p>
        </div>
      </div>

      {!subTab && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSubTab(c.key)}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-foreground">{c.title}</div>
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>
            );
          })}
        </div>
      )}

      {subTab === "provedor" && (
        <Card>
          <CardHeader>
            <CardTitle>Provedor de WhatsApp</CardTitle>
            <CardDescription>Configure Evolution API ou Z-API. As chaves devem ser cadastradas como segredos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <div className="font-medium">Integração ativa</div>
                <p className="text-xs text-muted-foreground">Quando desligado, nenhuma mensagem é enviada.</p>
              </div>
              <Switch checked={settings.enabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Provedor</Label>
                <Select value={settings.provider} onValueChange={(v) => setSettings((s) => ({ ...s, provider: v as Settings["provider"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="evolution">Evolution API</SelectItem>
                    <SelectItem value="zapi">Z-API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>DDI padrão</Label>
                <Input value={settings.default_country_code} onChange={(e) => setSettings((s) => ({ ...s, default_country_code: digitsOnly(e.target.value) || "55" }))} />
              </div>
              <div className="space-y-2">
                <Label>URL base</Label>
                <Input placeholder={settings.provider === "zapi" ? "https://api.z-api.io" : "https://evo.minhaempresa.com"} value={settings.base_url ?? ""} onChange={(e) => setSettings((s) => ({ ...s, base_url: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{settings.provider === "zapi" ? "Instance ID" : "Nome da instância"}</Label>
                <Input value={settings.instance_name ?? ""} onChange={(e) => setSettings((s) => ({ ...s, instance_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Segredo da API key</Label>
                <Input value={settings.api_key_secret} onChange={(e) => setSettings((s) => ({ ...s, api_key_secret: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Nome do segredo das edge functions onde está a API key.</p>
              </div>
              {settings.provider === "zapi" && (
                <div className="space-y-2">
                  <Label>Nome do segredo do Client-Token (Supabase Secret)</Label>
                  <Input value={settings.zapi_client_token_secret ?? ""} onChange={(e) => setSettings((s) => ({ ...s, zapi_client_token_secret: e.target.value }))} placeholder="WHATSAPP_ZAPI_CLIENT_TOKEN" />
                  <p className="text-xs text-muted-foreground">Informe o nome do secret cadastrado no Supabase. Não cole o token da Z-API diretamente aqui.</p>
                </div>
              )}
            </div>

            <Button onClick={saveSettings} variant="brand" className="gap-2" disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar configuração"}
            </Button>
          </CardContent>
        </Card>
      )}

      {subTab === "mensagens" && (
        <Card>
          <CardHeader>
            <CardTitle>Mensagens automáticas</CardTitle>
            <CardDescription>
              Personalize a frase inicial de cada tipo de notificação. Após a frase, o sistema acrescenta automaticamente os detalhes (título da tarefa, cliente, prazo, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <IntroField
              label="Nova tarefa atribuída"
              hint="Enviado quando uma tarefa é atribuída a um colaborador. Depois desta frase aparece: «Título · Cliente · Prazo»."
              example={(v) => `${v || "🆕 Nova tarefa atribuída:"} Criar carrossel\nCliente: Acme\nPrazo: 27/06/2026`}
              value={settings.msg_new_task_intro}
              onChange={(v) => setSettings((s) => ({ ...s, msg_new_task_intro: v }))}
            />
            <IntroField
              label="Prazo hoje"
              hint="Lembrete enviado para tarefas que vencem no dia."
              example={(v) => `${v || "⏰ Prazo hoje:"} Editar vídeo\nVencimento: 12/06/2026`}
              value={settings.msg_deadline_today_intro}
              onChange={(v) => setSettings((s) => ({ ...s, msg_deadline_today_intro: v }))}
            />
            <IntroField
              label="Prazo amanhã"
              hint="Lembrete enviado para tarefas que vencem no dia seguinte."
              example={(v) => `${v || "⏰ Prazo amanhã:"} Aprovar legenda\nVencimento: 13/06/2026`}
              value={settings.msg_deadline_tomorrow_intro}
              onChange={(v) => setSettings((s) => ({ ...s, msg_deadline_tomorrow_intro: v }))}
            />
            <IntroField
              label="Prazo atrasado"
              hint="Lembrete enviado para tarefas vencidas há 1 dia ou mais."
              example={(v) => `${v || "⚠️ Prazo atrasado:"} Postar reels\nVencimento: 10/06/2026`}
              value={settings.msg_deadline_overdue_intro}
              onChange={(v) => setSettings((s) => ({ ...s, msg_deadline_overdue_intro: v }))}
            />
            <IntroField
              label="Ranking XP do mês"
              hint="Mensagem para o Top 3 de desempenho do mês."
              example={(v) => `${v || "🏆 Ranking do mês:"} 🥇 você está em 1º lugar com 84.0 pontos. Continue assim!`}
              value={settings.msg_xp_rank_intro}
              onChange={(v) => setSettings((s) => ({ ...s, msg_xp_rank_intro: v }))}
            />
            <IntroField
              label="Aviso para a equipe (broadcast)"
              hint="Prefixo aplicado antes do texto digitado em 'Aviso para a equipe'."
              example={(v) => `${v || "📣 Aviso da equipe:"}\nReunião geral às 14h.`}
              value={settings.msg_broadcast_intro}
              onChange={(v) => setSettings((s) => ({ ...s, msg_broadcast_intro: v }))}
            />

            <Button onClick={saveSettings} variant="brand" className="gap-2" disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar mensagens"}
            </Button>
          </CardContent>
        </Card>
      )}

      {subTab === "teste" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Enviar teste</CardTitle>
            <CardDescription>Envia uma mensagem para um número específico para validar a integração.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Número de destino</Label>
              <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="(11) 99999-8888" />
            </div>
            <div className="space-y-1">
              <Label>Mensagem</Label>
              <Textarea rows={3} value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={sendTest} disabled={sending} variant="brand" className="gap-2">
                <Send className="h-4 w-4" /> Enviar para número
              </Button>
              <Button onClick={sendTestToMe} disabled={sending} variant="outline" className="gap-2">
                <Send className="h-4 w-4" /> Testar para mim
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {subTab === "aviso" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Aviso para a equipe</CardTitle>
            <CardDescription>
              Envia uma mensagem para todos os colaboradores que aceitam avisos. A frase inicial configurada em "Mensagens" é adicionada automaticamente antes do texto.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={4} value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} placeholder="Escreva o aviso..." />
            <Button onClick={sendBroadcast} disabled={sending || !broadcastMsg.trim()} variant="brand" className="gap-2">
              <Megaphone className="h-4 w-4" /> Enviar aviso
            </Button>
          </CardContent>
        </Card>
      )}

      {subTab === "colaboradores" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Colaboradores</CardTitle>
              <CardDescription>Cadastre ou edite o número e as preferências de WhatsApp de cada colaborador.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => usersQ.refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            {(usersQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum colaborador encontrado.</p>
            ) : (
              <div className="space-y-2">
                {(usersQ.data ?? []).map((u: any) => {
                  const hasPrefs = u.phone_e164 != null || u.enabled != null;
                  return (
                    <div key={u.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{u.display_name ?? u.user_id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {u.role_title ?? "—"} • {u.phone_e164 ?? <span className="italic">sem número</span>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {!hasPrefs && <Badge variant="secondary">Não cadastrado</Badge>}
                        {hasPrefs && !u.enabled && <Badge variant="secondary">Desativado</Badge>}
                        {u.notify_new_task && <Badge variant="outline">Tarefas</Badge>}
                        {u.notify_deadline && <Badge variant="outline">Prazos</Badge>}
                        {u.notify_late && <Badge variant="outline">Atrasadas</Badge>}
                        {u.notify_company && <Badge variant="outline">Avisos</Badge>}
                        <Button size="sm" variant="ghost" className="gap-1 ml-1"
                          onClick={() => { setEditUserId(u.user_id); setEditUserName(u.display_name ?? "Colaborador"); }}>
                          <Pencil className="h-3.5 w-3.5" /> Editar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {subTab === "disparos" && (
        <Card>
          <CardHeader>
            <CardTitle>Disparos automáticos</CardTitle>
            <CardDescription>Execute manualmente os jobs. Para automação completa, agende um cron chamando estas ações.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runDeadlines} className="gap-2">
              <Clock className="h-4 w-4" /> Lembretes de prazo (hoje/amanhã/atrasadas)
            </Button>
            <Button variant="outline" onClick={runXpRanking} className="gap-2">
              <Trophy className="h-4 w-4" /> Ranking XP do mês (Top 3)
            </Button>
          </CardContent>
        </Card>
      )}

      {subTab === "historico" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Histórico de envios</CardTitle>
              <CardDescription>Últimos 30 envios.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={processNow} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Processar fila agora
            </Button>
          </CardHeader>
          <CardContent>
            {(logQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>
            ) : (
              <div className="space-y-2">
                {(logQ.data ?? []).map((l: any) => (
                  <div key={l.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={l.status === "sent" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>
                          {l.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{l.notification_type}</span>
                        <span className="text-xs text-muted-foreground">{l.phone_e164 ?? "—"}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(l.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-foreground/90">{l.message}</p>
                    {l.error_message && <p className="mt-1 text-xs text-destructive">Erro: {l.error_message}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editUserId} onOpenChange={(o) => !o && setEditUserId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" /> WhatsApp · {editUserName}
            </DialogTitle>
            <DialogDescription>Edite o número e as preferências deste colaborador.</DialogDescription>
          </DialogHeader>
          {editUserId && (
            <WhatsAppPreferencesCard
              bare
              userId={editUserId}
              onSaved={() => { setEditUserId(null); qc.invalidateQueries({ queryKey: ["whatsapp_users_admin"] }); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IntroField({
  label, hint, value, onChange, example,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  example: (v: string) => string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div>
        <Label className="text-sm font-semibold">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Frase inicial..." />
      <div className="rounded-md bg-muted/50 p-2.5 text-xs whitespace-pre-wrap text-muted-foreground">
        <span className="font-medium text-foreground">Pré-visualização: </span>
        {example(value)}
      </div>
    </div>
  );
}
