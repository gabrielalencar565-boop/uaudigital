import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Bell, BellRing, CalendarClock, ChevronDown, Clapperboard, ListChecks, MessageSquareWarning, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { useCargos } from "@/hooks/use-cargos";
import {
  DEFAULT_AUDIENCE, NOTIFICATION_TYPES, fillTemplate, useNotificationSettings, useNotificationTemplates, useSaveNotificationTemplate, useSetNotificationEnabled,
  type NotificationAudience, type NotificationKey, type NotificationType,
} from "@/features/configuracoes/hooks/use-notification-settings";

const ICONS: Record<NotificationKey, typeof Bell> = {
  unscheduled_posts: CalendarClock,
  client_reply: MessageSquareWarning,
  capture_request: Clapperboard,
  mention: AtSign,
  task_assigned: ListChecks,
};

/** How the notification looks on a phone: title, "from Fluxo" line and the text. */
function Preview({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/40 bg-muted/30 p-3">
      <img src="/branding/fluxo-app-icon.png" alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1 text-[13px] leading-snug">
        <p className="truncate font-semibold">{title || " "}</p>
        <p className="text-muted-foreground">from Fluxo</p>
        {body && <p className="break-words">{body}</p>}
      </div>
      <span className="shrink-0 text-[11px] text-muted-foreground">agora</span>
    </div>
  );
}

function NotificationRow({ type, enabled, template, toggling, onToggle }: {
  type: NotificationType;
  enabled: boolean;
  template: ({ title: string | null; body: string | null } & NotificationAudience) | undefined;
  toggling: boolean;
  onToggle: (v: boolean) => void;
}) {
  const save = useSaveNotificationTemplate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(template?.title ?? type.defaultTitle);
  const [body, setBody] = useState(template?.body ?? type.defaultBody);
  const [testing, setTesting] = useState(false);
  const cargos = (useCargos().data ?? []).map((c) => c.label);
  const ROLES: { key: "admin" | "member"; label: string }[] = [{ key: "admin", label: "Administradores" }, { key: "member", label: "Membros" }];
  const saved = template ?? { title: null, body: null, ...DEFAULT_AUDIENCE };
  // Selection shown in the chips: "Todos" means every role and every cargo
  const savedRoles = saved.audience_all ? ROLES.map((r) => r.key) : saved.allowed_roles;
  const savedCargos = saved.audience_all ? cargos : saved.allowed_cargos;
  const [roles, setRoles] = useState<string[]>(savedRoles);
  const [selCargos, setSelCargos] = useState<string[]>(savedCargos);
  const bodyRef = useRef<HTMLInputElement>(null);
  const savedTitle = template?.title ?? type.defaultTitle;
  const savedBody = template?.body ?? type.defaultBody;
  useEffect(() => { setTitle(savedTitle); setBody(savedBody); }, [savedTitle, savedBody]);
  const savedRolesKey = savedRoles.join("|");
  const savedCargosKey = savedCargos.join("|");
  useEffect(() => { setRoles(savedRoles); setSelCargos(savedCargos); }, [savedRolesKey, savedCargosKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const everyone = roles.length === ROLES.length && cargos.every((c) => selCargos.includes(c));
  const nobody = roles.length === 0 && selCargos.length === 0;
  const toggleAll = () => {
    if (everyone) { setRoles([]); setSelCargos([]); }
    else { setRoles(ROLES.map((r) => r.key)); setSelCargos(cargos); }
  };
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const sameList = (a: string[], b: string[]) => [...a].sort().join("|") === [...b].sort().join("|");
  const audienceDirty = !sameList(roles, savedRoles) || !sameList(selCargos, savedCargos);
  const audience: NotificationAudience = everyone
    ? DEFAULT_AUDIENCE
    : { audience_all: false, allowed_roles: roles as ("admin" | "member")[], allowed_cargos: selCargos };

  const dirty = title !== savedTitle || body !== savedBody || audienceDirty;
  const customized = savedTitle !== type.defaultTitle || savedBody !== type.defaultBody;
  const Icon = ICONS[type.key];
  const preview = useMemo(() => ({ title: fillTemplate(title, type.sample), body: fillTemplate(body, type.sample) }), [title, body, type.sample]);

  const persist = (nextTitle: string, nextBody: string, message: string) =>
    save.mutateAsync({
      key: type.key,
      title: nextTitle === type.defaultTitle ? null : nextTitle,
      body: nextBody === type.defaultBody ? null : nextBody,
      audience,
    }).then(() => toast.success(message)).catch((e: any) => toast.error(e?.message ?? "Não foi possível salvar"));

  const sendTest = async () => {
    setTesting(true);
    try {
      if (dirty) await save.mutateAsync({ key: type.key, title: title === type.defaultTitle ? null : title, body: body === type.defaultBody ? null : body, audience });
      const { error } = await (supabase as any).rpc("send_test_push", { p_key: type.key });
      if (error) throw error;
      toast.success("Teste enviado para os seus aparelhos.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar o teste.");
    } finally {
      setTesting(false);
    }
  };

  const insertVariable = (name: string) => {
    const el = bodyRef.current;
    const token = `{${name}}`;
    if (!el) { setBody((b) => `${b}${token}`); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  };

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-3 px-5 py-4">
          <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", enabled ? "bg-primary/10 text-primary" : "bg-muted/60 text-muted-foreground")}><Icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{type.title}</span>
                {customized && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-400">Mensagem editada</span>}
              </span>
              <span className="block text-xs text-muted-foreground">{type.description}</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          </button>
          <Switch checked={enabled} disabled={toggling} onCheckedChange={onToggle} aria-label={`Ligar ou desligar: ${type.title}`} />
        </div>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-border/30 bg-muted/10 px-5 py-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mensagem no celular e no computador</p>
                <div className="space-y-1.5">
                  <Label htmlFor={`t-${type.key}`}>Título</Label>
                  <Input id={`t-${type.key}`} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`b-${type.key}`}>Texto</Label>
                  <Input id={`b-${type.key}`} ref={bodyRef} value={body} maxLength={120} onChange={(e) => setBody(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">Clique para colocar no texto o que muda a cada aviso:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {type.variables.map((v) => (
                      <button key={v.name} type="button" title={v.hint} onClick={() => insertVariable(v.name)} className="rounded-full border border-border/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-accent/40 hover:text-foreground">
                        {`{${v.name}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Como fica</p>
                <Preview title={preview.title} body={preview.body} />
                <p className="text-[11px] text-muted-foreground">Dica: deixe o Texto vazio e coloque tudo no título para o aviso ficar com só 2 linhas (título e "from Fluxo", que é do próprio celular).</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quem recebe</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button type="button" aria-pressed={everyone} onClick={toggleAll} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", everyone ? "border-primary/60 bg-primary/15 text-primary" : "border-border/50 text-muted-foreground hover:bg-accent/40")}>
                  Todos
                </button>
                <span className="mx-1 h-4 w-px bg-border/60" />
                {ROLES.map((r) => (
                  <button key={r.key} type="button" aria-pressed={roles.includes(r.key)} onClick={() => toggle(roles, setRoles, r.key)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition", roles.includes(r.key) ? "border-primary/60 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-accent/40")}>
                    {r.label}
                  </button>
                ))}
              </div>
              {cargos.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-1 text-[11px] text-muted-foreground">Cargos:</span>
                  {cargos.map((c) => (
                    <button key={c} type="button" aria-pressed={selCargos.includes(c)} onClick={() => toggle(selCargos, setSelCargos, c)} className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition", selCargos.includes(c) ? "border-primary/60 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-accent/40")}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {everyone ? "Todo mundo que tiver motivo para receber este aviso." : nobody ? "Escolha pelo menos um grupo, ou clique em Todos." : "Só quem é de um dos grupos marcados (função ou cargo) recebe."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" className="rounded-full" disabled={!dirty || nobody || save.isPending || !title.trim()} onClick={() => persist(title, body, "Mensagem salva")}>
                {save.isPending ? "Salvando…" : "Salvar"}
              </Button>
              {(customized || dirty) && (
                <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground" disabled={save.isPending} onClick={() => { setTitle(type.defaultTitle); setBody(type.defaultBody); if (customized) void persist(type.defaultTitle, type.defaultBody, "Mensagem padrão restaurada"); }}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
                </Button>
              )}
              <Button variant="outline" size="sm" className="ml-auto gap-1.5 rounded-full" disabled={testing || !title.trim()} onClick={sendTest}>
                <Send className="h-3.5 w-3.5" /> {testing ? "Enviando…" : "Enviar este teste para mim"}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

// Settings → Notificações (admins): one switch per type and, opening a type, the message that goes out.
// Each person can also turn types off for themselves (photo menu → Notificações push).
export function AdminNotificacoesPanel() {
  const settingsQ = useNotificationSettings();
  const templatesQ = useNotificationTemplates();
  const set = useSetNotificationEnabled();

  return (
    <section className="overflow-hidden rounded-2xl border border-border/40 bg-card">
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted/60 text-muted-foreground"><BellRing className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Avisos do sistema</p>
          <p className="text-xs text-muted-foreground">Ligue ou desligue cada tipo e, ao abrir, edite a mensagem. Os avisos chegam no sininho e no celular ou computador. Cada pessoa também pode desligar os seus no menu da foto → Notificações push.</p>
        </div>
      </div>
      <ul className="divide-y divide-border/30 border-t border-border/30">
        {NOTIFICATION_TYPES.map((t) => (
          <NotificationRow
            key={t.key}
            type={t}
            enabled={settingsQ.data?.[t.key] ?? true}
            template={templatesQ.data?.[t.key]}
            toggling={settingsQ.isLoading || set.isPending}
            onToggle={(enabled) =>
              set.mutate({ key: t.key, enabled }, {
                onSuccess: () => toast.success(enabled ? "Notificação ligada" : "Notificação desligada"),
                onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar"),
              })
            }
          />
        ))}
      </ul>
    </section>
  );
}
