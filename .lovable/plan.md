

## Diagnóstico

Dois bugs identificados ao concluir tarefa de Planejamento:

1. **Dialog de Design não aparece**: Após vincular a tarefa de Vídeo, o `LinkOrDateDialog` chama `onLink()` e depois `onClose()`. O `onLink` do pai já fecha o dialog (`setLinkDialogOpen(false)`) e limpa estados, depois chama `processSplitQueue` para Design. Quando `processSplitQueue` encontra tarefa existente de Design e tenta reabrir o dialog (`setLinkDialogOpen(true)`), o React não consegue distinguir a mudança porque `onClose()` do `LinkOrDateDialog` também roda quase simultaneamente, causando um conflito de state que impede o dialog de reabrir.

2. **Tarefa não fica concluída**: Como o dialog de Design nunca aparece, o `processSplitQueue` fica "preso" esperando interação do usuário. O `finalizePlanejamentoCompletion` (que marca como concluído) só roda quando TODOS os splits são processados, então nunca é chamado.

## Plano de Correção

### 1. Remover `onClose()` duplicado no `LinkOrDateDialog`

No `LinkOrDateDialog.tsx`, as funções `handleLink` e `handleSelectDate` chamam tanto o callback (`onLink`/`onSelectDate`) quanto `onClose()`. Mas o pai já gerencia o fechamento. Remover o `onClose()` de dentro de `handleLink` e `handleSelectDate` para que apenas o pai controle o estado do dialog.

### 2. Não fechar/limpar estados antes de processar splits restantes

No `PmTaskDetailDialog.tsx`, dentro do `onLink` callback (linha ~1598-1607):
- **Antes**: `setLinkDialogOpen(false); setLinkExistingTask(null); setPendingSplit(null);` era chamado ANTES de `processSplitQueue`
- **Depois**: Só limpar esses estados se NÃO houver mais splits. Deixar `processSplitQueue` decidir se reabre o dialog ou fecha tudo.

Mesma correção no `onSelectDate` callback (linha ~1609-1618).

### 3. Fechar dialog só quando a fila estiver vazia

No final de `processSplitQueue`, quando `splits.length === 0`, adicionar fechamento explícito do dialog:
```
setLinkDialogOpen(false);
setLinkExistingTask(null);
setPendingSplit(null);
```

Isso garante que o dialog só fecha após TODOS os splits (Vídeo + Design) serem processados e o `finalizePlanejamentoCompletion` ser chamado.

### Arquivos alterados
- `src/features/gestao/components/LinkOrDateDialog.tsx` — remover `onClose()` de dentro de `handleLink` e `handleSelectDate`
- `src/features/gestao/components/PmTaskDetailDialog.tsx` — reestruturar callbacks `onLink`/`onSelectDate` para não fechar dialog prematuramente; fechar no final de `processSplitQueue`

