

## Problema
Ao clicar em uma palavra com erro no título, o `stopPropagation` no `handleErrorClick` não impede o `onClick` do `<span>` pai (que envolve todos os segmentos), porque ambos estão no mesmo elemento DOM hierárquico. Resultado: o popover aparece MAS o título também entra em modo de edição.

## Solução
Separar os handlers: o `onClick` (que ativa modo edição) deve ser aplicado apenas nos segmentos de texto **sem erro**, não no wrapper geral. Os segmentos com erro terão apenas o handler do popover.

## Alteração

**`src/features/gestao/components/SpellCheckText.tsx`**

- Remover `onClick={onClick}` do `<span>` wrapper pai (linha 81)
- Adicionar `onClick={onClick}` apenas nos segmentos de texto normal (não-erro), nas linhas 53 e 76
- Manter `stopPropagation` nos segmentos de erro como segurança extra

Assim, clicar em "Aniversario" (erro) → só abre o popover. Clicar em qualquer outra parte do título → entra em modo edição normalmente.

