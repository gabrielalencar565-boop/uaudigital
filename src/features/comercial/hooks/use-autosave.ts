import { useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "pending" | "saved";

/**
 * Grava o rascunho do editor sozinho, logo depois de a pessoa parar de mexer, e de novo ao sair da tela (nada se perde se ela voltar
 * antes do tempo). O primeiro valor (o que veio do servidor) nunca é regravado.
 */
export function useAutosave<T>(value: T | null, save: (v: T) => void, delay = 700): SaveState {
  const latest = useRef<T | null>(value);
  const lastSaved = useRef<string | null>(null);
  const saveRef = useRef(save);
  const [state, setState] = useState<SaveState>("idle");
  latest.current = value;
  saveRef.current = save;

  useEffect(() => {
    if (value == null) return;
    const s = JSON.stringify(value);
    if (lastSaved.current === null) { lastSaved.current = s; return; }
    if (s === lastSaved.current) return;
    setState("pending");
    const t = setTimeout(() => { lastSaved.current = s; saveRef.current(value); setState("saved"); }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  useEffect(() => () => {
    const v = latest.current;
    if (v != null && lastSaved.current !== null && JSON.stringify(v) !== lastSaved.current) saveRef.current(v);
  }, []);

  return state;
}
