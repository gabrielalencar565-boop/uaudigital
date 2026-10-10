import { useEffect, useState } from "react";
import { BellRing, Send, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/use-role";
import {
  NOTIFICATION_TYPES, useMyNotificationAudience, useMyNotificationPrefs, useNotificationSettings, useSetMyNotificationPref,
} from "@/features/configuracoes/hooks/use-notification-settings";
import { useSession } from "@/hooks/use-session";
import {
  getPushSubscriptionState,
  isPushSupported,
  isSubscribedOnThisDevice,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-notifications";

function PushNotificationsPanel() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const { isAdmin } = useRole(user?.id);
  const agencyOn = useNotificationSettings().data;
  const myPrefs = useMyNotificationPrefs().data;
  const inAudience = useMyNotificationAudience().data;
  const setPref = useSetMyNotificationPref();
  const [testing, setTesting] = useState<"local" | "server" | null>(null);
  const [permission, setPermission] = useState<"granted" | "denied" | "default" | "unsupported">("default");

  useEffect(() => {
    (async () => {
      setPermission(await getPushSubscriptionState());
      setEnabled(await isSubscribedOnThisDevice());
      setLoading(false);
    })();
  }, []);

  const handleToggle = async (next: boolean) => {
    if (!user?.id) return;
    setBusy(true);
    try {
      if (next) {
        await subscribeToPush(user.id);
        toast.success("Notificações push ativadas neste dispositivo!");
      } else {
        await unsubscribeFromPush();
        toast.success("Notificações push desativadas neste dispositivo.");
      }
      setEnabled(next);
      setPermission(await getPushSubscriptionState());
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao alterar notificações push");
    } finally {
      setBusy(false);
    }
  };

  // 1) shows a notification straight from this device (no server): tells if the phone/computer displays them at all
  const testHere = async () => {
    setTesting("local");
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Teste neste aparelho 📲", { body: "Se você viu isto, o aparelho mostra notificações.", icon: "/icons/icon-192x192.png" });
    } catch (e: any) {
      toast.error(e?.message ?? "Este aparelho não conseguiu mostrar a notificação.");
    } finally {
      setTesting(null);
    }
  };
  // 2) asks the server to push to all of the person's devices: tells if the whole path works
  const testPush = async () => {
    setTesting("server");
    try {
      const { error } = await (supabase as any).rpc("send_test_push");
      if (error) throw error;
      toast.success("Teste enviado. Em alguns segundos deve chegar nos seus aparelhos.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar o teste.");
    } finally {
      setTesting(null);
    }
  };

  if (permission === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Este navegador não suporta notificações push. Tente pelo Chrome, Edge ou pelo app instalado na tela inicial.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
        <div className="min-w-0 pr-4">
          <div className="text-sm font-medium">Ativar neste dispositivo</div>
          <div className="text-xs text-muted-foreground">
            Tarefa atribuída a você, menções em comentários, respostas de clientes, posts sem agendar e pedidos de gravação —
            chegam mesmo com o app fechado. Quais tipos ficam ligados é definido pelos administradores em Configurações → Notificações.
          </div>
        </div>
        <Switch checked={enabled} disabled={loading || busy} onCheckedChange={handleToggle} />
      </div>
      <div className="space-y-1 rounded-lg border border-border/60 p-3">
        <div className="text-sm font-medium">Quais avisos você quer receber</div>
        <p className="pb-1 text-xs text-muted-foreground">Vale para o sininho e para o celular. Os que a administração desligou aparecem apagados.</p>
        {NOTIFICATION_TYPES.filter((t) => !t.adminOnly || isAdmin).map((t) => {
          const outOfAudience = inAudience ? inAudience[t.key] === false : false;
          const offByAgency = (agencyOn ? agencyOn[t.key] === false : false) || outOfAudience;
          return (
            <div key={t.key} className="flex items-center justify-between gap-3 py-1.5">
              <div className={cn("min-w-0", offByAgency && "opacity-50")}>
                <div className="text-sm">{t.title}</div>
                {(outOfAudience || offByAgency) && <div className="text-[11px] text-muted-foreground">{outOfAudience ? "Não é enviado para a sua função ou cargo" : "Desligado pela administração"}</div>}
              </div>
              <Switch
                checked={!offByAgency && (myPrefs?.[t.key] ?? true)}
                disabled={offByAgency || setPref.isPending}
                onCheckedChange={(v) => setPref.mutate({ key: t.key, enabled: v }, { onError: (e: any) => toast.error(e?.message ?? "Não foi possível salvar") })}
              />
            </div>
          );
        })}
      </div>
      {enabled && (
        <div className="space-y-2 rounded-lg border border-border/60 p-3">
          <div className="text-sm font-medium">Testar</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" disabled={testing !== null} onClick={testHere}>
              <Smartphone className="h-3.5 w-3.5" /> {testing === "local" ? "Mostrando…" : "Testar neste aparelho"}
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" disabled={testing !== null} onClick={testPush}>
              <Send className="h-3.5 w-3.5" /> {testing === "server" ? "Enviando…" : "Enviar notificação de teste"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            O primeiro mostra um aviso direto no aparelho; se ele não aparecer, o problema é do aparelho (permissão ou modo Não perturbar).
            O segundo vem do servidor, como os avisos de verdade, e chega em todos os seus aparelhos.
          </p>
        </div>
      )}
      {permission === "denied" && (
        <p className="text-xs text-destructive">
          Notificações foram bloqueadas nas configurações do navegador — permita o site pra poder ativar.
        </p>
      )}
    </div>
  );
}

export function PushNotificationsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notificações push
          </DialogTitle>
          <DialogDescription>
            Receba avisos do sistema mesmo com o app fechado.
          </DialogDescription>
        </DialogHeader>
        <PushNotificationsPanel />
      </DialogContent>
    </Dialog>
  );
}
