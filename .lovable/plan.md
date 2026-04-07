

## Remover botão de lixeira do card no Kanban

### O que será feito
Remover o botão de lixeira (🗑️) que aparece fixo ao lado do avatar do responsável no `PmTaskCard`. A opção de excluir continuará disponível pelo menu de três pontinhos (⋯) no hover do card.

### Alteração

**Arquivo:** `src/features/gestao/components/PmTaskCard.tsx`

- Remover as linhas 155–163 (o bloco `{/* Trash button next to avatar */}` com o `<button>` contendo o ícone `Trash2`).
- O `AlertDialog` de confirmação de exclusão permanece, pois é usado pelo menu dropdown e pelo `handleDelete`.

