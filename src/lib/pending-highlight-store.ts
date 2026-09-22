// Store genérico pra "depois de trocar de aba, ache esse elemento e chame atenção pra ele"
// — usado por atualizações/avisos cujo botão "ao clicar, levar para" aponta pra um elemento
// específico escolhido com o seletor de elemento (ElementPicker), não só pra uma aba.
// Independente do pending-meu-painel-action-store.ts (que é específico do botão
// "Personalizar meu painel" e do efeito de degradê dele) — esse aqui é o caso genérico, com
// um destaque visual mais simples (anel pulsando) que funciona em cima de qualquer elemento.

let pendingSelector: string | null = null;
const listeners = new Set<(selector: string | null) => void>();

export function setPendingHighlight(selector: string | null) {
  pendingSelector = selector;
  listeners.forEach((l) => l(pendingSelector));
}

export function getPendingHighlight(): string | null {
  return pendingSelector;
}

export function subscribePendingHighlight(cb: (selector: string | null) => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
