import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WEBHOOK_URL, useCloudStatus, useDisconnectCloud, useSaveCloud } from "../hooks/use-whatsapp-cloud";
import { Lab } from "./BuilderBits";
import { Panel } from "./ui-bits";

function CopyLine({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <Lab label={label}>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md bg-muted/50 px-2 py-2 text-xs">{value}</code>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => navigator.clipboard?.writeText(value).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}>
          {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar
        </Button>
      </div>
    </Lab>
  );
}

function WhatsAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = useCloudStatus().data;
  const save = useSaveCloud();
  const disconnect = useDisconnectCloud();
  const [f, setF] = useState({ phone_number_id: "", waba_id: "", access_token: "", app_secret: "" });
  const [confirmOff, setConfirmOff] = useState(false);
  const connected = !!status?.connected;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = () => save.mutate(f, {
    onSuccess: (r) => {
      setF({ phone_number_id: "", waba_id: "", access_token: "", app_secret: "" });
      toast.success(r.subscribed === false ? "Conectado. Falta ligar o webhook na Meta (passo 3)." : "WhatsApp conectado");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>WhatsApp (API oficial da Meta)</DialogTitle>
            <DialogDescription>
              {connected ? `Conectado: ${status?.display_phone ?? ""} ${status?.verified_name ? `· ${status.verified_name}` : ""}` : "Conecte o número do CRM para receber e enviar mensagens dos leads."}
            </DialogDescription>
          </DialogHeader>

          <ol className="min-w-0 space-y-3 text-sm [&>li]:min-w-0">
            <li>
              <b>1. Na Meta</b> (developers.facebook.com → seu app → WhatsApp → Configuração da API): copie o <b>ID do número de telefone</b> e o <b>ID da conta do WhatsApp Business</b>.
              Em Business Settings → Usuários do sistema, crie um usuário com as permissões <i>whatsapp_business_messaging</i> e <i>whatsapp_business_management</i> e gere um <b>token permanente</b>.
              A <b>chave secreta do app</b> fica em Configurações do app → Básico.
            </li>
            <li className="space-y-2">
              <b>2. Cole aqui</b> e clique em {connected ? "Atualizar conexão" : "Conectar"}. O Fluxo confere os dados com a Meta antes de salvar.
              <div className="grid gap-2 sm:grid-cols-2">
                <Lab label="ID do número de telefone"><Input value={f.phone_number_id} onChange={set("phone_number_id")} placeholder={status?.phone_number_id ?? "123456789012345"} autoComplete="off" /></Lab>
                <Lab label="ID da conta do WhatsApp Business"><Input value={f.waba_id} onChange={set("waba_id")} placeholder={status?.waba_id ?? "opcional, mas recomendado"} autoComplete="off" /></Lab>
              </div>
              <Lab label="Token de acesso permanente"><Input type="password" value={f.access_token} onChange={set("access_token")} autoComplete="new-password" /></Lab>
              <Lab label="Chave secreta do app"><Input type="password" value={f.app_secret} onChange={set("app_secret")} autoComplete="new-password" /></Lab>
            </li>
            <li className="space-y-2">
              <b>3. De volta à Meta</b> (WhatsApp → Configuração → Webhook): informe a URL e o token de verificação abaixo e assine o campo <b>messages</b>.
              {connected ? (
                <>
                  <CopyLine label="URL de retorno" value={WEBHOOK_URL} />
                  <CopyLine label="Token de verificação" value={status?.verify_token ?? ""} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground">A URL e o token de verificação aparecem aqui assim que o passo 2 for concluído.</p>
              )}
            </li>
          </ol>
          <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            O token e a chave secreta ficam guardados só no servidor e nunca voltam para esta tela. Dentro de 24h da última mensagem do lead dá para responder livremente; depois disso a Meta só aceita modelos aprovados.
            {status?.last_error && <span className="mt-1 block text-amber-600 dark:text-amber-400">Último erro da Meta: {status.last_error}</span>}
          </p>

          <DialogFooter className="gap-2 sm:justify-between">
            {connected ? <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmOff(true)}>Desconectar</Button> : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={submit} disabled={save.isPending || !f.phone_number_id || !f.access_token || !f.app_secret}>{save.isPending ? "Conferindo…" : connected ? "Atualizar conexão" : "Conectar"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar o WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>As mensagens guardadas continuam aqui, mas o CRM para de receber e de enviar até você conectar de novo. As automações ativas não conseguirão enviar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate(undefined, { onSuccess: () => toast("WhatsApp desconectado"), onError: (e) => toast.error(e.message) })}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CanaisConectados() {
  const status = useCloudStatus();
  const [open, setOpen] = useState(false);
  const connected = !!status.data?.connected;
  return (
    <Panel title="Canais conectados">
      <ul className="divide-y divide-border/30 text-sm">
        <li className="flex items-center justify-between gap-2 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <i className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            <span className="truncate">WhatsApp{connected && status.data?.display_phone ? ` · ${status.data.display_phone}` : ""}</span>
          </span>
          <Button size="sm" variant={connected ? "outline" : "default"} onClick={() => setOpen(true)}>{connected ? "Gerenciar" : "Conectar"}</Button>
        </li>
        <li className="flex items-center justify-between gap-2 py-2"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-pink-500/50" />Instagram Direct</span><span className="text-xs text-muted-foreground">Em breve</span></li>
        <li className="flex items-center justify-between gap-2 py-2"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-sky-500/50" />E-mail</span><span className="text-xs text-muted-foreground">Em breve</span></li>
      </ul>
      <WhatsAppDialog open={open} onClose={() => setOpen(false)} />
    </Panel>
  );
}
