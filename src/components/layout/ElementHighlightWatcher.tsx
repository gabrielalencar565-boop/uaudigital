import { useEffect } from "react";
import { getPendingHighlight, setPendingHighlight, subscribePendingHighlight } from "@/lib/pending-highlight-store";

// Montado uma vez no shell do app (ver UauSidebarShell.tsx): consome um pedido pendente de
// "rola até esse elemento e destaca ele" — vindo de uma atualização/aviso cujo CTA aponta
// pra um elemento específico. A troca de aba já foi disparada por quem chamou
// setPendingHighlight (uau:switch-tab), mas o painel de destino pode levar um instante pra
// montar (import lazy) — por isso tenta algumas vezes em vez de checar só uma.
export function ElementHighlightWatcher() {
  useEffect(() => {
    const consume = (selector: string | null) => {
      if (!selector) return;
      let attempts = 0;
      const tryFind = () => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("uau-highlight-pulse");
          window.setTimeout(() => el.classList.remove("uau-highlight-pulse"), 3000);
          setPendingHighlight(null);
          return;
        }
        attempts++;
        if (attempts < 20) {
          window.setTimeout(tryFind, 150);
        } else {
          // Elemento não apareceu (pode ter sido removido/renomeado desde que o CTA foi
          // criado) — desiste em silêncio, sem travar o pedido pendente pra sempre.
          setPendingHighlight(null);
        }
      };
      tryFind();
    };

    consume(getPendingHighlight());
    return subscribePendingHighlight(consume);
  }, []);

  return null;
}
