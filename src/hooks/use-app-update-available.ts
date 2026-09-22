import { useEffect, useRef, useState } from "react";

// Detecta um novo deploy comparando o HTML servido em "/" com o que foi carregado quando a
// aba abriu — o Vite muda os nomes dos arquivos com hash a cada build, então o conteúdo de
// index.html muda sempre que uma nova versão vai pro ar. Sem precisar de nenhuma infra nova
// (service worker, endpoint de versão) — só um fetch leve e cacheado por HTTP normalmente.
const CHECK_INTERVAL_MS = 5 * 60_000;

async function fetchIndexHtml(): Promise<string | null> {
  try {
    const res = await fetch("/", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export function useAppUpdateAvailable() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    // Não faz sentido checar update em dev (HMR já cuida disso, e o HTML muda a cada request)
    if (import.meta.env.DEV) return;

    let cancelled = false;

    const check = async () => {
      const html = await fetchIndexHtml();
      if (!html || cancelled) return;
      if (baselineRef.current === null) {
        baselineRef.current = html;
        return;
      }
      if (html !== baselineRef.current) setUpdateAvailable(true);
    };

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, []);

  return { updateAvailable, reload: () => window.location.reload() };
}
