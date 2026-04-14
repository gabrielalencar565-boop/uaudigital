

## Ajuste de posicionamento do popover de correção

### Problema
O popover de sugestão está usando `top: anchorRect.top - 44` (offset fixo de 44px), o que faz ele cobrir parcialmente a palavra. Precisa aparecer **acima** da palavra sem sobrepô-la.

### Solução
No `SpellSuggestionPopover.tsx`, calcular a posição dinâmica com base na altura real do popover usando um `useEffect` + `ref.current.offsetHeight`, garantindo um gap entre o popover e a palavra.

### Alteração em `SpellSuggestionPopover.tsx`

1. Após o popover renderizar, usar `useLayoutEffect` para medir sua altura real e reposicionar
2. Calcular `top = anchorRect.top - popoverHeight - 8` (8px de gap)
3. Centralizar horizontalmente: `left = anchorRect.left + anchorRect.width / 2 - popoverWidth / 2`
4. Clampar para não sair da tela: `Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8))`
5. Se não couber acima, posicionar abaixo: `top = anchorRect.bottom + 8`

Resultado: o popover aparece flutuando **acima** da palavra com um pequeno espaço, sem cobri-la.

