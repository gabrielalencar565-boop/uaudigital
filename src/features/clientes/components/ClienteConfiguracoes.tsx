import { useEffect, useState } from "react";
import { AlertTriangle, BarChart3, CalendarDays, Copy, ExternalLink, Instagram, Link2, Plug, RefreshCw, StickyNote, Unplug } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useConnectInstagram, useDisconnectInstagram, useInstagramConnections } from "@/features/calendario/hooks/use-instagram";
import { reportUrl, useConnectWithInsights, useReportLink, useSaveReportLink } from "@/features/resultados/hooks/use-resultados";
import { useClientDetails, useSaveClientNotes } from "../hooks/use-client-data";

function Card({ icon: Icon, title, description, children }: { icon: typeof Instagram; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/40 bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><Icon className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right font-medium">{children}</span>
    </div>
  );
}

function InstagramCard({ clientId }: { clientId: string }) {
  const canManage = usePermission("action_instagram_connect");
  const connectionsQ = useInstagramConnections(clientId);
  const connect = useConnectInstagram();
  const connectInsights = useConnectWithInsights();
  const disconnect = useDisconnectInstagram();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const conn = (connectionsQ.data ?? []).find((c) => c.client_id === clientId) ?? null;
  const active = conn?.status === "active";
  const expires = conn?.token_expires_at ? parseISO(conn.token_expires_at) : null;
  const expired = !!expires && isPast(expires);

  const go = (url: string) => { window.location.href = url; };
  const startConnect = () => connect.mutate({ clientId }, { onSuccess: go });
  const startInsights = () => connectInsights.mutate({ clientId }, { onSuccess: go });

  const status = active && !expired
    ? { label: "Conectado", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" }
    : conn && conn.status !== "revoked"
      ? { label: expired ? "Token expirado" : "Com problema", className: "bg-destructive/15 text-destructive" }
      : { label: "Não conectado", className: "bg-muted text-muted-foreground" };

  return (
    <Card icon={Instagram} title="Instagram" description="Conta usada para agendar publicações e puxar as métricas.">
      <div className="flex items-center justify-between rounded-xl bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{conn?.instagram_username ? `@${conn.instagram_username}` : "Nenhuma conta conectada"}</p>
          {conn?.facebook_page_name && <p className="truncate text-xs text-muted-foreground">Página: {conn.facebook_page_name}</p>}
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", status.className)}>{status.label}</span>
      </div>

      {conn && (
        <div className="divide-y divide-border/40">
          <Row label="Tipo de login">{conn.auth_provider === "instagram_login" ? "Instagram" : "Facebook"}</Row>
          {expires && (
            <Row label={expired ? "Expirou" : "Renova em"}>
              {expired ? format(expires, "dd/MM/yyyy") : formatDistanceToNowStrict(expires, { locale: ptBR })}
            </Row>
          )}
        </div>
      )}

      {conn?.last_error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span className="min-w-0 break-words">{conn.last_error}</span>
        </div>
      )}

      {!canManage ? (
        <p className="text-xs text-muted-foreground">Você não tem permissão para conectar contas. Peça a um administrador.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!active || expired ? (
            <Button className="gap-1.5 rounded-full" disabled={connect.isPending} onClick={startConnect}>
              <Plug className="h-4 w-4" /> {conn ? "Reconectar Instagram" : "Conectar Instagram"}
            </Button>
          ) : (
            <>
              <Button variant="outline" className="gap-1.5 rounded-full" disabled={connectInsights.isPending} onClick={startInsights}>
                <RefreshCw className="h-4 w-4" /> Reconectar com métricas
              </Button>
              <Button variant="ghost" className="gap-1.5 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDisconnect(true)}>
                <Unplug className="h-4 w-4" /> Desconectar
              </Button>
            </>
          )}
        </div>
      )}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar o Instagram?</AlertDialogTitle>
            <AlertDialogDescription>O cliente deixará de publicar automaticamente no Instagram até ser conectado de novo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate({ clientId })}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function LinksCard({ clientId }: { clientId: string }) {
  const linkQ = useReportLink(clientId);
  const save = useSaveReportLink();
  const link = linkQ.data;
  const url = link ? reportUrl(link.token) : "";

  return (
    <Card icon={Link2} title="Links para o cliente" description="Páginas abertas que o cliente acessa sem precisar de login.">
      <div className="space-y-3 rounded-xl bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium"><BarChart3 className="h-4 w-4 text-violet-500" /> Relatório de resultados</span>
          {link ? (
            <Switch checked={link.enabled} onCheckedChange={(enabled) => save.mutate({ clientId, periodDays: link.period_days, enabled })} />
          ) : (
            <Button size="sm" className="h-8 rounded-full" disabled={save.isPending} onClick={() => save.mutate({ clientId, periodDays: 30 })}>Criar link</Button>
          )}
        </div>
        {link && (
          <div className="flex items-center gap-2">
            <Input readOnly value={url} className="h-8 text-xs" />
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copiado!"); }}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" asChild>
              <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
            </Button>
          </div>
        )}
        {link && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => save.mutate({ clientId, periodDays: link.period_days, enabled: link.enabled, regenerate: true })}
          >
            <RefreshCw className="h-3 w-3" /> Gerar novo link (invalida o anterior)
          </button>
        )}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" /> O link de aprovação do cronograma fica no botão flutuante da aba Cronograma.
      </p>
    </Card>
  );
}

function ContractCard({ clientId }: { clientId: string }) {
  const q = useClientDetails(clientId);
  const d = q.data;
  const start = d?.contract_start ? parseISO(d.contract_start) : null;
  return (
    <Card icon={CalendarDays} title="Contrato" description="Dados do plano. Para alterar, use Configurações → Clientes.">
      <div className="divide-y divide-border/40">
        <Row label="Plano">{d?.plan_name ?? "—"}</Row>
        <Row label="Início do contrato">{start ? format(start, "dd/MM/yyyy") : "—"}</Row>
        <Row label="Tempo de casa">{start ? formatDistanceToNowStrict(start, { locale: ptBR }) : "—"}</Row>
      </div>
      {d?.services && d.services.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {d.services.map((s) => <span key={s} className="rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-500">{s}</span>)}
        </div>
      )}
    </Card>
  );
}

function NotesCard({ clientId }: { clientId: string }) {
  const q = useClientDetails(clientId);
  const save = useSaveClientNotes(clientId);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (q.data && !loaded) { setValue(q.data.notes ?? ""); setLoaded(true); }
  }, [q.data, loaded]);
  const dirty = (q.data?.notes ?? "") !== value;

  return (
    <Card icon={StickyNote} title="Observações internas" description="Só a equipe vê. Bom para tom de voz, preferências e cuidados com o cliente.">
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={5} placeholder="Ex.: prefere posts com pouca arte, aprova por WhatsApp…" className="rounded-xl" />
      <div className="flex justify-end">
        <Button className="rounded-full" disabled={!dirty || save.isPending} onClick={() => save.mutate(value)}>Salvar</Button>
      </div>
    </Card>
  );
}

export function ClienteConfiguracoes({ clientId }: { clientId: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InstagramCard clientId={clientId} />
      <LinksCard clientId={clientId} />
      <ContractCard clientId={clientId} />
      <NotesCard clientId={clientId} />
    </div>
  );
}
