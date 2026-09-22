// Mirrors pending-meu-painel-action-store.ts: a notification click (e.g. "novo problema
// relatado") needs to land on a specific sub-view inside the Ajuda tab, but AjudaPanel might
// not be mounted yet when the click happens (it only mounts after the tab switch finishes).

export type AjudaPendingView = "problemas_reportados" | "minhas_solicitacoes";

let pending: AjudaPendingView | null = null;
const listeners = new Set<(value: AjudaPendingView | null) => void>();

export function setPendingAjudaView(value: AjudaPendingView | null) {
  pending = value;
  listeners.forEach((l) => l(pending));
}

export function getPendingAjudaView(): AjudaPendingView | null {
  return pending;
}

export function subscribePendingAjudaView(cb: (value: AjudaPendingView | null) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
