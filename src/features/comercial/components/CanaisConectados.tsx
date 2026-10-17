import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { WEBHOOK_URL, ZAPI_WEBHOOK_BASE, useCloudDiagnosis, useDisconnectZapi, useSaveZapi, useZapiLive, useZapiStatus, useCloudStatus, useDisconnectCloud, useRegisterCloudNumber, useRequestCloudCode, useSaveCloud, useVerifyCloudCode } from "../hooks/use-whatsapp-cloud";
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

/** Pergunta à Meta como está o número e a assinatura do webhook; oferece ativar o número na API quando ele ainda não está online. */
function ConnectionCheck() {
  const diagnose = useCloudDiagnosis();
  const register = useRegisterCloudNumber();
  const requestCode = useRequestCloudCode();
  const verifyCode = useVerifyCloudCode();
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState(false);
  const d = diagnose.data;
  const online = d?.phone.status === "CONNECTED";
  const run = () => diagnose.mutate(undefined, { onError: (e) => toast.error(e.message) });
  return (
    <div className="space-y-2 rounded-lg border border-border/50 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <b>Verificar conexão</b>
        <Button size="sm" variant="outline" onClick={run} disabled={diagnose.isPending}>{diagnose.isPending ? "Consultando…" : "Consultar a Meta"}</Button>
      </div>
      {d && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>Número: <b className={online ? "text-emerald-500" : "text-amber-500"}>{d.phone.status ?? "sem informação"}</b>{d.phone.platform_type ? ` · ${d.phone.platform_type}` : ""}{d.phone.code_verification_status ? ` · verificação: ${d.phone.code_verification_status}` : ""}</li>
          <li>Webhook do app: <b className={d.subscribed_apps?.length ? "text-emerald-500" : "text-amber-500"}>{d.subscribed_apps === null ? "sem informação" : d.subscribed_apps.length ? `assinado (${d.subscribed_apps.join(", ")})` : "não assinado"}</b></li>
        </ul>
      )}
      {d && !online && (
        <div className="space-y-2 rounded-md bg-amber-500/10 p-2 text-xs">
          <p>O número ainda não está ativo na API, então a Meta não entrega as mensagens dos leads aqui. Ativar faz o número <b>parar de funcionar no aplicativo do WhatsApp no celular</b>.</p>
          {d.phone.code_verification_status !== "VERIFIED" && (
            <div className="space-y-1.5">
              <p><b>1.</b> Peça o código de verificação (chega no celular desse número):</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={requestCode.isPending} onClick={() => requestCode.mutate("SMS", { onSuccess: () => toast.success("Código enviado por SMS"), onError: (e) => toast.error(e.message) })}>Enviar por SMS</Button>
                <Button size="sm" variant="outline" disabled={requestCode.isPending} onClick={() => requestCode.mutate("VOICE", { onSuccess: () => toast.success("A Meta vai ligar com o código"), onError: (e) => toast.error(e.message) })}>Receber ligação</Button>
              </div>
              <div className="flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código de 6 números" inputMode="numeric" className="h-8 max-w-[10rem]" />
                <Button size="sm" variant="outline" disabled={code.length !== 6 || verifyCode.isPending} onClick={() => verifyCode.mutate(code, { onSuccess: () => { toast.success("Número verificado"); setCode(""); run(); }, onError: (e) => toast.error(e.message) })}>Confirmar código</Button>
              </div>
            </div>
          )}
          <p><b>{d.phone.code_verification_status !== "VERIFIED" ? "2." : "1."}</b> Escolha um PIN de 6 números (guarde: ele protege o número) e ative:</p>
          <div className="flex gap-2">
            <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="PIN de 6 números" inputMode="numeric" className="h-8 max-w-[10rem]" />
            <Button size="sm" disabled={pin.length !== 6 || register.isPending} onClick={() => setConfirm(true)}>Ativar número na API</Button>
          </div>
        </div>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ativar o número na API?</AlertDialogTitle>
            <AlertDialogDescription>O número passa a receber e enviar só pelo Fluxo e deixa de funcionar no aplicativo do WhatsApp do celular. As conversas antigas do aplicativo não são trazidas para cá.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => register.mutate(pin, { onSuccess: () => { toast.success("Número ativado na API"); setPin(""); run(); }, onError: (e) => toast.error(e.message) })}>Ativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
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
          {connected && <ConnectionCheck />}
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

/** WhatsApp não oficial (Z-API): sem janela de 24h, mas a Meta não aprova esse uso e o número pode ser banido. */
function ZapiDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const status = useZapiStatus().data;
  const save = useSaveZapi();
  const disconnect = useDisconnectZapi();
  const live = useZapiLive();
  const [f, setF] = useState({ instance_id: "", instance_token: "", client_token: "" });
  const [confirmOff, setConfirmOff] = useState(false);
  const connected = !!status?.connected;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const webhookUrl = status?.webhook_key ? `${ZAPI_WEBHOOK_BASE}?k=${status.webhook_key}` : "";
  const l = live.data;

  const submit = () => save.mutate(f, {
    onSuccess: (r) => {
      setF({ instance_id: "", instance_token: "", client_token: "" });
      toast.success(r.connected ? "Z-API conectado" : "Dados salvos. Falta escanear o QR code (passo 3).");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>WhatsApp por QR code (Z-API)</DialogTitle>
            <DialogDescription>
              {connected ? `Conectado${status?.connected_phone ? `: +${status.connected_phone}` : ""}` : "Conecte o número do CRM sem a janela de 24h da API oficial."}
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            Esse modo funciona como o WhatsApp Web e a Meta não o aprova: o número pode ser <b>bloqueado</b> sem aviso, principalmente com envio em massa ou automático. Prefira um chip separado do número principal da agência.
          </p>

          <ol className="min-w-0 space-y-3 text-sm [&>li]:min-w-0">
            <li>
              <b>1. No Z-API</b> (app.z-api.io): crie uma instância para este número e copie o <b>ID da instância</b>, o <b>token da instância</b> e o <b>Client-Token</b> (Segurança → token da conta).
            </li>
            <li className="space-y-2">
              <b>2. Cole aqui</b> e clique em {connected ? "Atualizar conexão" : "Conectar"}.
              <div className="grid gap-2 sm:grid-cols-2">
                <Lab label="ID da instância"><Input value={f.instance_id} onChange={set("instance_id")} placeholder={status?.instance_id ?? "3C9A..."} autoComplete="off" /></Lab>
                <Lab label="Token da instância"><Input type="password" value={f.instance_token} onChange={set("instance_token")} autoComplete="new-password" /></Lab>
              </div>
              <Lab label="Client-Token (token da conta)"><Input type="password" value={f.client_token} onChange={set("client_token")} autoComplete="new-password" /></Lab>
            </li>
            <li className="space-y-2">
              <b>3. De volta ao Z-API:</b> em <i>Webhooks e configurações gerais</i>, cole a URL abaixo nos campos <b>Ao receber</b>, <b>Ao enviar</b> e <b>Receber status da mensagem</b>, e ative a opção de notificar também as mensagens enviadas pelo celular.
              {connected ? <CopyLine label="URL do webhook" value={webhookUrl} /> : <p className="text-xs text-muted-foreground">A URL aparece aqui assim que o passo 2 for concluído.</p>}
            </li>
            {connected && (
              <li className="space-y-2">
                <b>4. Escaneie o QR code</b> com o WhatsApp do celular do número (Aparelhos conectados → Conectar um aparelho).
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => live.mutate(undefined, { onError: (e) => toast.error(e.message) })} disabled={live.isPending}>{live.isPending ? "Consultando…" : "Verificar / mostrar QR code"}</Button>
                  {l && <span className={`text-xs font-medium ${l.connected ? "text-emerald-500" : "text-amber-500"}`}>{l.connected ? "Celular conectado" : "Celular ainda não conectado"}</span>}
                </div>
                {l && !l.connected && l.qr && <img src={l.qr} alt="QR code do WhatsApp" className="h-48 w-48 rounded-md bg-white p-2" />}
                {l && !l.connected && !l.qr && <p className="text-xs text-muted-foreground">Não consegui buscar o QR code aqui. Abra a instância no painel do Z-API e escaneie por lá.</p>}
              </li>
            )}
          </ol>
          <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">Os tokens ficam guardados só no servidor e nunca voltam para esta tela. Enquanto o Z-API estiver conectado, ele é usado para enviar e receber no CRM.</p>

          <DialogFooter className="gap-2 sm:justify-between">
            {connected ? <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmOff(true)}>Desconectar</Button> : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={submit} disabled={save.isPending || !f.instance_id || !f.instance_token}>{save.isPending ? "Conferindo…" : connected ? "Atualizar conexão" : "Conectar"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar o Z-API?</AlertDialogTitle>
            <AlertDialogDescription>As mensagens guardadas continuam aqui, mas o CRM para de receber e de enviar por este canal. A instância no Z-API continua existindo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnect.mutate(undefined, { onSuccess: () => toast("Z-API desconectado"), onError: (e) => toast.error(e.message) })}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CanaisConectados() {
  const status = useCloudStatus();
  const [open, setOpen] = useState(false);
  const [openZapi, setOpenZapi] = useState(false);
  const zapi = useZapiStatus();
  const zConnected = !!zapi.data?.connected;
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
        <li className="flex items-center justify-between gap-2 py-2">
          <span className="flex min-w-0 items-center gap-2">
            <i className={`h-2 w-2 shrink-0 rounded-full ${zConnected ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            <span className="truncate">WhatsApp por QR code (Z-API){zConnected && zapi.data?.connected_phone ? ` · +${zapi.data.connected_phone}` : ""}</span>
          </span>
          <Button size="sm" variant={zConnected ? "outline" : "default"} onClick={() => setOpenZapi(true)}>{zConnected ? "Gerenciar" : "Conectar"}</Button>
        </li>
        <li className="flex items-center justify-between gap-2 py-2"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-pink-500/50" />Instagram Direct</span><span className="text-xs text-muted-foreground">Em breve</span></li>
        <li className="flex items-center justify-between gap-2 py-2"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-sky-500/50" />E-mail</span><span className="text-xs text-muted-foreground">Em breve</span></li>
      </ul>
      <WhatsAppDialog open={open} onClose={() => setOpen(false)} />
      <ZapiDialog open={openZapi} onClose={() => setOpenZapi(false)} />
    </Panel>
  );
}
