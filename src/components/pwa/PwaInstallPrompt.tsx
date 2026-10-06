import { useState, useEffect, useCallback } from "react";
import { X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/use-pwa-install";

// Floating "install the app" banner (production only, once a day). The name and icon come from this domain's own
// manifest, so it is always the app the person is looking at — Fluxo — not any one agency.
export function PwaInstallPrompt() {
  const { canPrompt, needsManualSteps, install } = usePwaInstall();
  const [dismissed, setDismissed] = useState(false);
  const [recentlyDismissed, setRecentlyDismissed] = useState(true);

  useEffect(() => {
    const last = Number(localStorage.getItem("pwa-install-dismissed") ?? 0);
    setRecentlyDismissed(!!last && Date.now() - last < 24 * 60 * 60 * 1000);
  }, []);

  const handleInstall = useCallback(async () => {
    await install();
    setDismissed(true);
  }, [install]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  }, []);

  if (__VERCEL_ENV__ !== "production") return null;
  if (dismissed || recentlyDismissed) return null;
  if (!canPrompt && !needsManualSteps) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300 sm:bottom-6">
      <div className="rounded-2xl border bg-card p-4 shadow-lg flex items-start gap-3">
        <img src="/icons/icon-192x192.png" alt="" className="h-10 w-10 shrink-0 rounded-xl mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground">Instalar o Fluxo</p>
          {needsManualSteps ? (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Toque em{" "}
              <Share className="inline h-3.5 w-3.5 -mt-0.5 text-primary" />{" "}
              <strong>Compartilhar</strong> e depois em{" "}
              <strong>"Adicionar à Tela de Início"</strong>
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground truncate">Acesse rápido na tela inicial</p>
              <Button size="sm" onClick={handleInstall} className="mt-2 w-full">
                Instalar
              </Button>
            </>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
