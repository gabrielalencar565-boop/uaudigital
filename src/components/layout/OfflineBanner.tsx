import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectivity } from "@/hooks/use-online-status";

// Aviso global de conexão: bloqueia a tela enquanto a internet estiver fora e, quando volta, confirma por alguns segundos.
export function OfflineBanner() {
  const { online, checking, recheck } = useConnectivity();
  const [stillOffline, setStillOffline] = useState(false);
  const wasOffline = useRef(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setRestored(false);
      return;
    }
    setStillOffline(false);
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setRestored(true);
    const t = window.setTimeout(() => setRestored(false), 3500);
    return () => window.clearTimeout(t);
  }, [online]);

  const retry = async () => {
    setStillOffline(false);
    if (!(await recheck())) setStillOffline(true);
  };

  if (online && !restored) return null;

  if (online) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-[4.5rem] z-[90] flex justify-center px-4">
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 shadow-lg dark:bg-emerald-950 dark:text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Conexão restaurada
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/85 px-6 backdrop-blur-sm"
    >
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <WifiOff className="h-9 w-9 text-red-500" />
        <h2 className="text-lg font-semibold">Você está sem internet</h2>
        <p className="text-sm text-muted-foreground">Conecte-se para continuar usando o Fluxo. Assim que a conexão voltar, esta tela some sozinha.</p>
        {stillOffline && <p className="text-sm text-red-600 dark:text-red-400">Ainda sem conexão. Verifique o Wi-Fi ou os dados do celular.</p>}
        <Button type="button" className="mt-2 rounded-full px-6" onClick={() => void retry()} disabled={checking}>
          {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Tentar de novo
        </Button>
      </div>
    </div>
  );
}
