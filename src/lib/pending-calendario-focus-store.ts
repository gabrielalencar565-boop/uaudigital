// Cross-component store for a pending "open this publication in the Cronograma"
// request. Mirrors pending-appeal-store.ts: the request may be set before the
// Cronograma (CalendarioPublicacaoPanel, mounted inside GestaoPanel) exists yet —
// e.g. it's opened from a task dialog on a completely different tab — so a
// fire-and-forget CustomEvent alone isn't enough. Consumers read the pending
// value on mount and subscribe for later updates.

export type CalendarioFocusRequest = { clientId: string; cycleStart: string; publicationId: string };

let pending: CalendarioFocusRequest | null = null;
const listeners = new Set<(value: CalendarioFocusRequest | null) => void>();

export function setPendingCalendarioFocus(value: CalendarioFocusRequest | null) {
  pending = value;
  listeners.forEach((l) => l(pending));
}

export function getPendingCalendarioFocus(): CalendarioFocusRequest | null {
  return pending;
}

export function subscribePendingCalendarioFocus(cb: (value: CalendarioFocusRequest | null) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
