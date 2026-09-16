import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
            Tarefa atribuída a você, menções em comentários, e um resumo diário de tarefas vencendo/atrasadas —
            chegam mesmo com o app fechado.
          </div>
        </div>
        <Switch checked={enabled} disabled={loading || busy} onCheckedChange={handleToggle} />
      </div>
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
