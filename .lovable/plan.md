
## Plano de Refatoração - Fluxo de Tarefas e Subtarefas

### Fase 1: Migration (Banco de Dados)
- Criar função `pm_resync_correction(_pm_task_id, _completed_stage)` que:
  - Remove registros de pontuação antigos para a tarefa+etapa
  - Re-sincroniza com a distribuição atual de responsáveis
  - Recalcula pontos de etiquetas
  - Recomputa scores para usuários afetados (antigos e novos)

### Fase 2: Persistência de Subtarefas (PmTaskDetailDialog.tsx)
- **`transferChildren` → `cloneChildrenToNewTask`**: Em vez de MOVER subtarefas para a nova tarefa, CLONAR:
  1. Marcar subtarefas originais como `concluido` (ficam no snapshot)
  2. Criar cópias das subtarefas na nova tarefa (com novos responsáveis)
  3. Copiar (não mover) anexos para a nova tarefa
- Aplicar mesma lógica no `executeSplitTask` (planejamento → design/vídeo)
- Simplificar `handleAlteracao` e `handleReturnFromAlteracao` (não precisa mais mover filhos)

### Fase 3: Modo Visualização Bloqueada (PmTaskDetailDialog.tsx)
- Detectar `isCompletedSnapshot` = `status_global === "concluido" && stage !== "entrega" && !parent_task_id`
- Quando snapshot concluído:
  - Título não editável
  - Propriedades bloqueadas (cliente, data, etapa, demanda extra)
  - Descrição somente leitura
  - Não permitir adicionar/remover subtarefas
  - Não permitir marcar/desmarcar conclusão

### Fase 4: Edição Controlada (Admin + Planejador)
- Botão "Corrigir responsável / pontuação" visível para admin/planejador
- Quando ativado, permite editar:
  - Responsável da subtarefa
  - Etiquetas da subtarefa
- Ao salvar, chama `pm_resync_correction` para recalcular pontuação

### Fase 5: PmSubtaskList.tsx
- Adicionar props `readOnly` e `correctionMode`
- `readOnly`: esconde botões de adicionar/excluir, desabilita toggle de conclusão
- `correctionMode`: permite editar responsável e etiquetas mesmo em readOnly

### Fase 6: UI
- Badge "Etapa concluída" no topo da tarefa snapshot
- Subtarefas com aparência levemente desativada (opacity)
- Campos editáveis destacados (responsável/etiqueta) no modo correção

### Fase 7: Histórico
- Registrar no `pm_activity_log` alterações de responsável e etiqueta com before/after
- Incluir: subtarefa, responsável anterior, novo responsável, etiqueta anterior, nova etiqueta, quem alterou, data/hora

### Arquivos afetados:
1. `supabase/migrations/` - Nova função `pm_resync_correction`
2. `src/features/gestao/components/PmTaskDetailDialog.tsx` - Clonagem, modo bloqueado, botão correção
3. `src/features/gestao/components/PmSubtaskList.tsx` - Props readOnly/correctionMode
4. `src/features/gestao/hooks/use-pm-data.ts` - Hook para chamar pm_resync_correction
