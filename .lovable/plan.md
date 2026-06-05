## Objetivo
Deixar **apenas um** caminho para encerrar contrato na tabela de clientes em Configurações: o botão "Encerrar contrato" (ícone ⊗). O botão Pausar/Retomar (⏸/▶) será removido.

## Mudanças
Arquivo: `src/features/admin/AdminClientesPanel.tsx`

1. Remover o `<Button>` Pausar/Retomar da coluna de ações da tabela (mantém apenas Editar, Encerrar e Excluir).
2. Remover a função `handleToggleActive` e o hook `useToggleClientActive` que ficam sem uso.
3. Remover imports não utilizados (`Pause`, `Play`).
4. Ajustar a badge da coluna Status para não exibir mais "Pausado desde …" (só Ativo ou Encerrado), já que não há mais ação de pausar pelo painel.
