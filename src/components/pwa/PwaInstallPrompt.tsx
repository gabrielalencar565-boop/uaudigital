import { useState, useEffect, useCallback } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    ("standalone" in window.navigator && (window.navigator as any).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show in iframe / preview
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }
    if (
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com")
    )
      return;

    // Already installed
    if (isInStandaloneMode()) return;

    // Check dismissed state from localStorage (show once per day)
    const lastDismissed = localStorage.getItem("pwa-install-dismissed");
    if (lastDismissed) {
      const diff = Date.now() - Number(lastDismissed);
      if (diff < 24 * 60 * 60 * 1000) return;
    }

    // iOS: show manual instructions
    if (isIos()) {
      setShowIosBanner(true);
      return;
    }

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("PWA install:", outcome);
    setDeferredPrompt(null);
    setDismissed(true);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setShowIosBanner(false);
    setDeferredPrompt(null);
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
  }, []);

  if (dismissed) return null;
  if (!deferredPrompt && !showIosBanner) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] w-[90vw] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300 sm:bottom-6">
      <div className="rounded-2xl border bg-card p-4 shadow-lg flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary mt-0.5">
          {showIosBanner ? <Share className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-card-foreground">Instalar Uau Digital</p>
          {showIosBanner ? (
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
