## Objetivo

Permitir que duas tarefas que saíram divergentes no estágio PDF (uma Design e outra Vídeo do mesmo cliente/mês) sejam combinadas em uma única tarefa, a partir do dialog de detalhes da tarefa.

## Fluxo de uso

1. Usuário abre uma tarefa em estágio `pdf`.
2. Se existir outra tarefa PDF do mesmo cliente/mês com `post_type` complementar (Vídeo↔Design), aparece um botão "Unir com Vídeo/Design" no cabeçalho do dialog (ao lado das outras ações).
3. Ao clicar, abre confirmação mostrando a tarefa-alvo, e ao confirmar a fusão acontece. O dialog fecha e o kanban atualiza.

## Regras de fusão (mantém a mais antiga)

- A tarefa "principal" é a de `created_at` mais antigo entre as duas; a outra é a "secundária".
- Subtarefas, anexos e comentários da secundária são reapontados para a principal (`UPDATE pm_subtasks/pm_attachments/pm_comments SET task_id = principal WHERE task_id = secundaria`).
- Responsáveis: principal vira união — `assignee_id` da principal mantido, `watchers` recebe `assignee + watchers` da secundária (dedupe, removendo o próprio assignee).
- `post_type` da principal vira `"design_video"` (ou mantém os dois? — implementação: usar string `"design_video"` e atualizar `inferPmPostType` para aceitar; badge passa a renderizar "PDF" sem variante específica).
- `tags` da principal recebe união das duas listas (dedupe).
- `due_date`: mantém a mais cedo entre as duas.
- Secundária é soft-deleted (`deleted_at = now()`).
- Log de auditoria em `pm_activity_log` com `action = "merge_pdf_tasks"` e metadata `{ kept_id, removed_id }`.
- Performance: disparar `recompute_metas_prazos` para os assignees envolvidos no mês corrente para refletir a remoção da tarefa duplicada.

## Restrições / validações

- Botão só aparece quando:
  - `stage_current === "pdf"` em ambas
  - mesmo `client_id`
  - mesmo mês de `due_date`
  - `post_type` complementares (uma `design`, outra `video`)
  - nenhuma delas concluída (`status_global !== "concluido"`)
  - nenhuma `deleted_at`
- Se houver mais de uma candidata, lista todas em um pequeno select dentro do popover de confirmação (raro, mas seguro).

## Arquivos a modificar

- `src/features/gestao/components/PmTaskDetailDialog.tsx`
  - Adicionar memo `mergeCandidates` (busca via lista de tarefas já carregada por `usePmTasks` no provedor) e botão "Unir com Vídeo/Design" + dialog de confirmação.
  - Função `handleMergePdfTasks(targetId)` que executa as queries Supabase descritas (na ordem: UPDATE subtasks → attachments → comments → UPDATE principal → soft-delete secundária → recompute → invalidate queries).
- `src/features/gestao/hooks/use-pm-data.ts`
  - Exportar mutation `useMergePdfTasks` reutilizável que encapsula a lógica acima e faz `qc.invalidateQueries` em `["pm_tasks"]`, `["pm_child_tasks"]`, `["pm_child_tasks_all"]`, `["pm_attachments_batch"]`, `["pm_comments"]`.
- `src/features/gestao/utils/infer-pm-post-type.ts` (opcional)
  - Reconhecer `post_type === "design_video"` retornando `null` (ou novo tipo `"mixed"`) sem quebrar lugares existentes.
- `src/features/gestao/components/PmTaskCard.tsx`
  - Quando `post_type === "design_video"` na PDF, renderizar abreviação `PDF` (sem variante DSG/VDO).

## Detalhes técnicos

- Para encontrar candidatas no dialog, usar o cache de `usePmTasks` (já carrega a lista filtrada por mês). Não fazer nova query.
- Toda mutação acontece em transação client-side sequencial; em erro parcial, mostrar toast e re-invalidar para reconciliar com Realtime.
- Respeitar a regra do projeto: DELETE/soft-delete por último apenas após confirmar UPDATEs (aqui invertemos da regra usual de "DELETE first" porque precisamos preservar referências FK até reapontar; soft-delete apenas marca `deleted_at`, não quebra FK).
- Após sucesso: `toast.success("Tarefas unidas em uma só")`, fechar dialog, reabrir opcionalmente na principal.

## Fora do escopo

- Não cria nova tarefa combinada (mantém a mais antiga).
- Não suporta unir em Revisão/Alterações/Agendamento (apenas PDF).
- Não desfaz a união automaticamente (reverter exige split manual normal do fluxo).
