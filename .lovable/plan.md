

## Correção: Excluir tarefas apagadas da verificação de vínculo

### Problema
Ao arrastar uma tarefa no Kanban, a query que verifica se já existe uma tarefa na mesma etapa/cliente/mês não exclui tarefas com soft-delete (`deleted_at IS NOT NULL`). Isso faz o diálogo "Tarefa existente encontrada" aparecer para tarefas que já foram apagadas.

### Correção
Adicionar `.is("deleted_at", null)` na query em `PmKanbanBoard.tsx` (linha ~215), para ignorar tarefas apagadas.

### Arquivo editado
- `src/features/gestao/components/PmKanbanBoard.tsx` — adicionar filtro `.is("deleted_at", null)` na query de verificação de tarefas existentes

