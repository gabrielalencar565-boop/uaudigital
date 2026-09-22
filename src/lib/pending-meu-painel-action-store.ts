// Cross-component store for a pending "do this when Meu Painel mounts" request — e.g. a
// "Novidades" banner clicked from a completely different tab needs to scroll to and
// highlight the "Personalizar meu painel" button, but MeuPainelPanel might not exist yet
// when the click happens (it only mounts after the tab switch finishes). Mirrors
// pending-calendario-focus-store.ts: consumers read the pending value on mount and
// subscribe for later updates.

export type MeuPainelPendingAction = "highlight_personalize";

let pending: MeuPainelPendingAction | null = null;
const listeners = new Set<(value: MeuPainelPendingAction | null) => void>();

export function setPendingMeuPainelAction(value: MeuPainelPendingAction | null) {
  pending = value;
  listeners.forEach((l) => l(pending));
}

export function getPendingMeuPainelAction(): MeuPainelPendingAction | null {
  return pending;
}

export function subscribePendingMeuPainelAction(cb: (value: MeuPainelPendingAction | null) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
