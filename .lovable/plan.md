

## Problema

Ao clicar em "Vincular tarefa", o sistema executa sequencialmente:
1. `executeSplitTask` (insere subtarefas no banco, copia anexos)
2. `processSplitQueue` (consulta banco para próxima etapa)

Só depois de tudo isso terminar é que o próximo diálogo aparece. O delay vem de aguardar as operações de banco antes de mostrar a UI.

## Solução

Tornar o fluxo não-bloqueante: ao vincular, disparar `executeSplitTask` em background e avançar imediatamente para o próximo item da fila (Design).

### Alterações em `PmTaskDetailDialog.tsx`

1. **Nos callbacks `onLink` e `onSelectDate` do `LinkOrDateDialog`**: Em vez de `await executeSplitTask(...)` seguido de `await processSplitQueue(...)`, disparar `executeSplitTask` como fire-and-forget (`void executeSplitTask(...)`) e chamar `processSplitQueue` imediatamente sem esperar a execução terminar.

2. **No `processSplitQueue` (quando não encontra tarefa existente)**: Mesmo ajuste — disparar `executeSplitTask` em background e avançar para o próximo split sem aguardar.

3. **Garantir consistência**: O `invalidatePmTaskQueries()` já é chamado dentro de `executeSplitTask` ao final, então os dados serão atualizados quando terminar. O `finalizePlanejamentoCompletion` no final da fila também invalida queries.

### Resultado esperado
- Ao clicar "Vincular tarefa" para Vídeo, o diálogo de Design aparece instantaneamente
- As operações de banco rodam em paralelo sem bloquear a UI

