## Problema

A multi-seleção de subtarefas (com checkboxes, atalhos `Delete`/`Esc` e barra de ações em massa) só foi implementada em `PmSubtaskList.tsx`, usado nas etapas que renderizam a lista padrão. Porém as etapas **PDF, Agendamento e Entrega** (junto com Planejamento) usam o componente `PmPlanningSubtasks.tsx`, que tem layout dividido em seções **Vídeo / Design** — e esse componente **não possui** a funcionalidade de multi-seleção.

Resultado: ao abrir uma tarefa de PDF, não aparece checkbox para selecionar várias subtarefas e excluí-las em massa.

## Solução

Replicar a mesma lógica de multi-seleção já existente em `PmSubtaskList.tsx` dentro de `PmPlanningSubtasks.tsx`, **compartilhando o estado entre as duas seções (Vídeo e Design)** para que o usuário possa selecionar subtarefas de qualquer seção e excluir todas de uma vez.

## Mudanças em `src/features/gestao/components/PmPlanningSubtasks.tsx`

### 1. Estado compartilhado no componente pai `PmPlanningSubtasks`
- Adicionar `selectedIds: Set<string>` e `bulkConfirmOpen: boolean` no componente raiz (não dentro de `PlanningSection`), para que a seleção seja global entre as duas seções.
- Adicionar helpers: `toggleSelect(id)`, `selectAll()` (todas as childTasks), `clearSelection()`, `handleBulkDelete()`.
- Adicionar `useEffect` com listener de teclado:
  - `Escape` → `clearSelection()`
  - `Delete` / `Backspace` → abre `bulkConfirmOpen` (se houver seleção)
- Passar `selectedIds`, `toggleSelect`, e callbacks como props para cada `PlanningSection`.

### 2. Barra flutuante de seleção (no topo do componente)
Renderizar acima das duas seções quando `selectedIds.size > 0`:
- Texto "X selecionada(s)"
- Botão "Selecionar todas" (se ainda houver não selecionadas)
- Botão "Limpar"
- Botão destrutivo "Excluir" → abre `bulkConfirmOpen`
- Mesma estética do que existe em `PmSubtaskList.tsx`

### 3. AlertDialog de exclusão em massa (compartilhado, no topo)
- Texto: "Excluir N subtarefa(s)?"
- Action chama `handleBulkDelete` que faz `updateTask.mutate({ id, deleted_at, deleted_by })` para cada id selecionado, depois `clearSelection()`.
- Mesmas proteções de propagação de evento já aplicadas (`onPointerDown stopPropagation`, `z-[200]`).

### 4. Atualizações em `PlanningSection` (cada seção Vídeo/Design)
- Receber `selectedIds`, `toggleSelect`, `bulkConfirmOpen` via props.
- No header da seção (ou fora, ao lado), adicionar checkbox "Selecionar todas desta seção" — opcional; o principal é o do componente pai.
- Em cada linha de subtarefa:
  - Adicionar um `<Checkbox>` à esquerda (antes do círculo de etapa), seguindo o mesmo padrão do `PmSubtaskList`:
    - Visível quando há seleção ativa, ou no hover (`opacity-0 group-hover:opacity-100`); sempre visível se a linha está selecionada.
    - `onCheckedChange={() => toggleSelect(sub.id)}` com `onClick stopPropagation` para não abrir a subtarefa.
  - No `onClick` da linha, manter o guard existente e adicionar `bulkConfirmOpen` na condição de bloqueio:
    ```tsx
    if (deletingId || bulkConfirmOpen) { e.preventDefault(); e.stopPropagation(); return; }
    ```
  - Quando `isSelected`, aplicar destaque visual leve na linha (ex: `bg-primary/5`).

### 5. Manter intactos
- O AlertDialog de exclusão **individual** (`deletingId`) permanece como está em cada seção, sem alteração.
- Toda a lógica existente de adicionar subtarefa, mudar etapa, atribuir responsável, lixeira, etc.

## Resultado esperado

Ao abrir uma tarefa de **PDF** (ou Agendamento, Entrega, Planejamento):
- Hover em qualquer subtarefa (de Vídeo ou Design) mostra um checkbox.
- Ao selecionar uma ou mais, aparece a barra flutuante com contador e botões de ação em massa.
- `Delete`/`Backspace` abre o diálogo de confirmação para excluir todas as selecionadas.
- `Esc` limpa a seleção.
- Funciona igual ao já implementado em `PmSubtaskList.tsx`, com a diferença de que a seleção é compartilhada entre as seções Vídeo e Design.

## Arquivos afetados
- `src/features/gestao/components/PmPlanningSubtasks.tsx` (única alteração)