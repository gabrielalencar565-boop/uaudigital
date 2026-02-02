import { useEffect, useState } from "react";

/**
 * Retorna um Date "vivo" e força re-render periódica.
 * Útil para telas que precisam acompanhar virada de dia/mês sem refresh.
 */
export function useNow(options?: { intervalMs?: number }) {
  const intervalMs = options?.intervalMs ?? 60_000; // 1 min
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}
