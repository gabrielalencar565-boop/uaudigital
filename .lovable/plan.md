

## Plano: Vincular tarefa existente ao concluir etapa no Dialog

### Problema
Ao clicar "Concluir" no dialog de detalhes da tarefa e avançar para a próxima etapa, o sistema não verifica se já existe uma tarefa na agenda (pm_tasks com status "concluido") do mesmo cliente na etapa de destino. Essa verificação já funciona no drag-and-drop do Kanban, mas falta no fluxo de conclusão via botão.

### Solução
Adicionar a mesma lógica de verificação/vinculação no `TaskContentView` dentro de `PmTaskDetailDialog.tsx`:

1. **Importar `LinkOrDateDialog`** no `PmTaskDetailDialog.tsx`
2. **Adicionar estado** para controlar o dialog de vinculação (`linkDialogOpen`, `linkExistingTask`, `pendingNextStage`)
3. **Modificar `advanceStage`**: Antes de executar o avanço, fazer query em `pm_tasks` para verificar se existe tarefa concluída do mesmo `client_id` + etapa de destino. Se existir, abrir o `LinkOrDateDialog` em vez de avançar diretamente
4. **Implementar callback `handleLinkChoice`**: Quando o usuário escolhe vincular ou selecionar data, chamar o avanço original com a `due_date` escolhida

### Arquivo editado
- `src/features/gestao/components/PmTaskDetailDialog.tsx` - adicionar verificação de tarefa existente antes de avançar etapa, reutilizando o `LinkOrDateDialog` já criado

### Fluxo
```text
Usuário clica "Concluir"
  → handleConcluido determina nextStage
  → advanceStage verifica pm_tasks existentes (mesmo client_id + nextStage + concluido)
  → Se existe: abre LinkOrDateDialog
    → "Vincular": usa due_date da tarefa existente
    → "Selecionar data": usuário escolhe
  → Se não existe: avança normalmente (comportamento atual)
```

