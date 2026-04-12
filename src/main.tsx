import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Defensive hardening against DOM-mangling extensions (ex.: Google Translate).
// Goal: prevent full app crashes/white screens by keeping root stable.
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

const ensureNoTranslateGuards = () => {
  try {
    // IMPORTANT: manter isso idempotente. Em alguns navegadores, setAttribute/classList.add
    // dentro de um MutationObserver pode gerar loops de mutação e travar a renderização.
    const setAttrIfNeeded = (el: Element | null | undefined, name: string, value: string) => {
      if (!el) return;
      try {
        if ((el as any).getAttribute?.(name) !== value) (el as any).setAttribute?.(name, value);
      } catch {
        // ignore
      }
    };

    const addClassIfMissing = (el: Element | null | undefined, cls: string) => {
      if (!el) return;
      try {
        if (!(el as any).classList?.contains?.(cls)) (el as any).classList?.add?.(cls);
      } catch {
        // ignore
      }
    };

    setAttrIfNeeded(document.documentElement, "translate", "no");
    setAttrIfNeeded(document.body, "translate", "no");
    setAttrIfNeeded(rootEl, "translate", "no");

    addClassIfMissing(document.documentElement, "notranslate");
    addClassIfMissing(document.body, "notranslate");
    addClassIfMissing(rootEl, "notranslate");

    // Add the standard meta flag dynamically (avoids editing index.html).
    const head = document.head;
    if (head && !head.querySelector('meta[name="google"][content="notranslate"]')) {
      const meta = document.createElement("meta");
      meta.name = "google";
      meta.content = "notranslate";
      head.appendChild(meta);
    }
  } catch {
    // Never block rendering.
  }
};

ensureNoTranslateGuards();

// If an extension mutates/removes attributes/classes, restore them.
try {
  let scheduled = false;
  const mo = new MutationObserver(() => {
    // Throttle para evitar tempestade de mutações (principalmente em iOS)
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureNoTranslateGuards();
    });
  });
  mo.observe(document.documentElement, { attributes: true, childList: false, subtree: false });
  mo.observe(rootEl, { attributes: true, childList: false, subtree: false });
} catch {
  // ignore
}

createRoot(rootEl).render(<App />);

// Register service worker only in production (not in iframe/preview)
(() => {
  if (!("serviceWorker" in navigator)) return;
  const isInIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
  const isPreview =
    window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com");

  if (isPreview || isInIframe) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
})();
