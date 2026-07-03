// Cross-component store for a pending "open appeal review" request.
// Used so that when the notifications bell asks to open an appeal, the
// AdminDeadlineReport (which may not be mounted yet) can consume it
// once it mounts — instead of relying on a fire-and-forget CustomEvent.

export type PendingAppeal = { pmTaskId: string; userId: string };

let pending: PendingAppeal | null = null;
const listeners = new Set<(value: PendingAppeal | null) => void>();

export function setPendingAppeal(value: PendingAppeal | null) {
  pending = value;
  listeners.forEach((l) => l(pending));
}

export function getPendingAppeal(): PendingAppeal | null {
  return pending;
}

export function subscribePendingAppeal(cb: (value: PendingAppeal | null) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
