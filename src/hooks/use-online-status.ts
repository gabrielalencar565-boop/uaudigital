import { useCallback, useEffect, useRef, useState } from "react";

const PROBE_INTERVAL_MS = 8000;
const PROBE_TIMEOUT_MS = 5000;

async function reach(url: string, init: RequestInit): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(url, { ...init, cache: "no-store", signal: ctrl.signal });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

// navigator.onLine só sabe se há rede local (Wi-Fi conectado sem internet continua "online"),
// então a conexão é confirmada de verdade: o próprio site e, se falhar, o backend.
async function probeInternet(): Promise<boolean> {
  if (await reach(`${window.location.origin}/favicon.ico?t=${Date.now()}`, { method: "HEAD" })) return true;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return supabaseUrl ? reach(`${supabaseUrl}/auth/v1/health`, { method: "GET", mode: "no-cors" }) : false;
}

/** Estado real da internet: reage na hora aos eventos do navegador e confere de tempos em tempos. */
export function useConnectivity(): { online: boolean; checking: boolean; recheck: () => Promise<boolean> } {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [checking, setChecking] = useState(false);
  const running = useRef(false);

  const recheck = useCallback(async () => {
    if (running.current) return online;
    running.current = true;
    setChecking(true);
    try {
      const ok = navigator.onLine ? await probeInternet() : false;
      setOnline(ok);
      return ok;
    } finally {
      running.current = false;
      setChecking(false);
    }
  }, [online]);

  useEffect(() => {
    const check = () => { if (document.visibilityState === "visible") void recheck(); };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", check);
    window.addEventListener("offline", goOffline);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    const id = window.setInterval(check, PROBE_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", check);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(id);
    };
  }, [recheck]);

  return { online, checking, recheck };
}
