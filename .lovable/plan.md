

## Correção: Dropdown da tarefa aparecendo atrás dos cards no Kanban

### Problema
No Kanban (Gestão), ao clicar no menu de opções (três pontos) de um card na coluna "Captação", o dropdown fica por trás das outras colunas/cards. Isso acontece porque cada coluna do Kanban cria um novo stacking context via `animation` CSS, e o `DropdownMenuContent` não tem z-index definido.

### Solução
Adicionar `z-index` elevado ao `DropdownMenuContent` dentro do `PmTaskCard.tsx` e ao `AlertDialogContent` de confirmação de exclusão.

### Arquivo alterado
**`src/features/gestao/components/PmTaskCard.tsx`**
- Linha 173: Adicionar `className="... z-[200]"` ao `DropdownMenuContent` para garantir que o menu flutue acima de todas as colunas do Kanban
- O `AlertDialogContent` já usa portal, então não precisa de ajuste

