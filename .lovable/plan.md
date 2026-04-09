

## Plan: Unificar botão Concluído/Desconcluir e remover Reverter

### Objetivo
Quando a tarefa estiver concluída, o mesmo botão verde "Concluído" muda para mostrar "Concluído ✓" com opção de clicar para desconcluir. O botão "Reverter" separado será removido.

### Alterações em `src/features/gestao/components/PmTaskDetailDialog.tsx`

1. **Botão unificado (linhas ~1366-1476)**: Quando `isDone`, o botão verde muda o texto para "Concluído" com ícone de check, e ao clicar executa a lógica de desconcluir (reverter para etapa anterior). Remove o Badge "Entregue" e o botão separado "Desconcluir".

2. **Remover botão "Reverter" (linhas 1485-1490)**: Eliminar completamente o bloco do botão "Reverter".

### Resultado visual
- Tarefa não concluída: botão verde "Concluído >" (comportamento atual)
- Tarefa concluída: mesmo botão verde com check "Concluído", ao clicar desconcluí a tarefa
- Sem botão "Reverter" em nenhum estado

### Arquivo editado
- `src/features/gestao/components/PmTaskDetailDialog.tsx`

