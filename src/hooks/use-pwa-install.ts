import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// The browser fires `beforeinstallprompt` once, early; keep the event at module level so any component that mounts
// later (the login page button, the install banner) can still use it.
let stashedPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    stashedPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    stashedPrompt = null;
    notify();
  });
}

export function isIos() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    ("standalone" in window.navigator && Boolean((window.navigator as unknown as { standalone?: boolean }).standalone)) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

function inIframe() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Install-the-app state for the current domain (the manifest is always the one served by this origin). */
export function usePwaInstall() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  const installed = isStandalone();
  const ios = isIos();
  const canPrompt = !!stashedPrompt && !installed && !inIframe();
  // iOS never offers a prompt; the only way is Share → "Adicionar à Tela de Início"
  const needsManualSteps = ios && !installed && !inIframe();

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    if (!stashedPrompt) return "unavailable";
    const prompt = stashedPrompt;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    stashedPrompt = null;
    notify();
    return outcome;
  }, []);

  return { canPrompt, needsManualSteps, available: canPrompt || needsManualSteps, installed, install };
}
