

## Plano: Recuperar tarefa e adicionar busca na lixeira

### Contexto
O usuário quer:
1. Recuperar uma tarefa específica da lixeira (provavelmente o "Instituto Trid - Vídeo - Abril" ou subtarefas relacionadas mencionadas antes)
2. Adicionar campo de busca/pesquisa na lixeira de tarefas

### Investigação necessária
Preciso identificar:
- Qual lixeira tem busca atualmente (`TaskTrashPanel` na agenda? `SubtaskTrashDialog` em gestão? Lixeira do Kanban?)
- Qual tarefa exatamente recuperar (preciso perguntar ao usuário)

### Mudanças propostas

**1. Adicionar busca na lixeira de subtarefas (`SubtaskTrashDialog.tsx`)**
- Adicionar `<Input>` com ícone de busca no topo do dialog
- Estado local `searchQuery` que filtra `items` por `title` (case-insensitive)
- Mostrar contagem filtrada vs total

**2. Adicionar busca na lixeira principal de tarefas (Kanban — provavelmente em `PmKanbanBoard.tsx` ou um componente de trash de pm_tasks)**
- Verificar se existe um `TaskTrashDialog` para tarefas pai
- Aplicar o mesmo padrão de busca

**3. Recuperar a tarefa específica**
- Preciso saber QUAL tarefa recuperar — o usuário não especificou claramente

### Pergunta ao usuário
Antes de implementar, preciso confirmar qual tarefa recuperar e em qual lixeira adicionar a busca (subtarefas? tarefas principais? ambas?).

