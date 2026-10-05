import { useRef, useState } from "react";
import { AlertTriangle, Camera, Instagram, Plug, RefreshCw, Trash2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useConnectInstagram, useDisconnectInstagram, useInstagramConnections } from "@/features/calendario/hooks/use-instagram";
import { useConnectWithInsights } from "@/features/resultados/hooks/use-resultados";
import { brandGradientCss } from "@/lib/brand-gradient";
import { useClients } from "@/features/data/queries";
import { toGridThumbUrl } from "@/features/calendario/components/CalendarioPublicacaoPanel";
import { useUpdateClientPhoto } from "../hooks/use-client-data";

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

function PhotoCard({ clientId }: { clientId: string }) {
  const clientsQ = useClients();
  const client = (clientsQ.data ?? []).find((c) => c.id === clientId);
  const update = useUpdateClientPhoto(clientId);
  const inputRef = useRef<HTMLInputElement>(null);
  const logo = client?.logo_url ?? null;

  const pick = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A foto passa de 5 MB."); return; }
    update.mutate(file);
  };

  return (
    <Card icon={Camera} title="Foto do cliente" description="Aparece na lista de clientes, no topo desta página e nos relatórios.">
      <div className="flex items-center gap-4">
        <span className="shrink-0 rounded-full p-[2.5px]" style={{ background: brandGradientCss(135) }}>
          <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-card text-xl font-bold ring-2 ring-card">
            {logo ? <img src={toGridThumbUrl(logo)} alt="" className="h-full w-full object-cover" /> : (client?.name.trim().charAt(0).toUpperCase() ?? "?")}
          </span>
        </span>
        <div className="space-y-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full" disabled={update.isPending} onClick={() => inputRef.current?.click()}>
              {update.isPending ? "Enviando…" : logo ? "Trocar foto" : "Adicionar foto"}
            </Button>
            {logo && (
              <Button variant="ghost" size="sm" className="gap-1.5 rounded-full text-muted-foreground hover:text-destructive" disabled={update.isPending} onClick={() => update.mutate(null)}>
                <Trash2 className="h-3.5 w-3.5" /> Remover
              </Button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">JPG ou PNG quadrado, até 5 MB.</p>
        </div>
      </div>
    </Card>
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

export function ClienteConfiguracoes({ clientId }: { clientId: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <PhotoCard clientId={clientId} />
      <InstagramCard clientId={clientId} />
    </div>
  );
}
