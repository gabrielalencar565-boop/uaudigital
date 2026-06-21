## Problema

O `LateAppealDialog` foi integrado apenas em **Meu Painel** e **Agenda**. Mas o botão verde "Concluir" que aparece nos prints é da tela de **Gestão de Tarefas** (`PmTaskDetailDialog`), que não foi conectada — por isso clicar em "Concluir" numa tarefa atrasada não abre o diálogo de justificativa.

## Correção (pontual, sem refatorar)

Conectar o `LateAppealDialog` no `src/features/gestao/components/PmTaskDetailDialog.tsx`:

1. **Estado local** `lateAppeal` com `{ open, pendingAction }`.
2. **Helper `runWithLateCheck(action)`**: se `isTaskLate(task.due_date)` e a tarefa ainda não está concluída e o usuário atual é o `assignee_id` (ou está em `watchers`), abre o diálogo guardando `action` como `pendingAction`. Caso contrário executa `action()` direto.
3. **Wrap nos 3 botões "Concluir" da tarefa pai e das subtarefas** (linhas ~2033, ~2021, ~2084) — passar o `onClick` atual por dentro do `runWithLateCheck`.
4. **Renderizar `<LateAppealDialog>`** no final do dialog, executando `pendingAction()` no `onConfirm` (que faz o complete normal, com ou sem justificativa salva em `task_appeals`).

Sem mudanças de regra de pontuação, layout, fluxo de etapas ou banco — apenas plugar o diálogo já existente no ponto de entrada que estava faltando.

## Arquivos

- `src/features/gestao/components/PmTaskDetailDialog.tsx` (edição)
