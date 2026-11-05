// Ordem das subtarefas. A ordem de exibição é a ordem de criação (created_at crescente) e quem avança de etapa já clona as
// subtarefas nessa ordem, então reordenar é redistribuir os mesmos horários de criação entre as subtarefas da lista.

/** Move `dragId` para antes/depois de `targetId`. Devolve a nova lista, ou null quando nada mudaria. */
export function moveItem<T extends { id: string }>(list: T[], dragId: string, targetId: string, after: boolean): T[] | null {
  if (dragId === targetId) return null;
  const dragged = list.find((x) => x.id === dragId);
  if (!dragged || !list.some((x) => x.id === targetId)) return null;
  const without = list.filter((x) => x.id !== dragId);
  const at = without.findIndex((x) => x.id === targetId) + (after ? 1 : 0);
  const next = [...without.slice(0, at), dragged, ...without.slice(at)];
  return next.every((x, i) => x.id === list[i].id) ? null : next;
}

/** Os horários da lista (em ms) em ordem crescente e sem repetição: dois iguais viram dois horários 1 ms distintos, para a ordem não empatar. */
export function reorderStamps(ms: number[]): number[] {
  const sorted = [...ms].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) if (sorted[i] <= sorted[i - 1]) sorted[i] = sorted[i - 1] + 1;
  return sorted;
}

/** Para a lista já na nova ordem: o horário (ms) que cada subtarefa passa a ter. */
export function newStampsFor(ordered: Array<{ created_at: string }>): number[] {
  return reorderStamps(ordered.map((t) => Date.parse(t.created_at)));
}
