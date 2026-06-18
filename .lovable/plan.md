# Sistema de Recursos para tarefas atrasadas

Quando o colaborador marcar uma tarefa atrasada como concluída, abre um modal oferecendo abrir um recurso (justificativa) antes do desconto de pontos. Admin/planejador revisam no Relatório → Detalhamento por Colaborador.

## 1. Banco (nova tabela `task_appeals`)

Campos principais:
- `task_id` (uuid) — id da `tasks` (Agenda) OU `pm_tasks` (Gestão)
- `task_source` ('agenda' | 'pm')
- `user_id` (autor)
- `reason` (texto, obrigatório)
- `status` ('pendente' | 'aprovado' | 'recusado')
- `reviewed_by`, `reviewed_at`, `review_note`
- timestamps padrão

RLS:
- Colaborador: insere/lê os próprios
- Admin/planejador: lê todos e atualiza status

Trigger em `tasks` (Agenda):
- Quando há `task_appeals` com status `pendente` ou `aprovado` para o `task_id`, a função de cálculo de pontos (`recompute_metas_prazos` e correlatas) ignora penalidade de atraso daquela tarefa. Recurso `recusado` ou ausente → desconto normal.

Mesma lógica aplicada na fonte de pontos do PM (penalidade de atraso por tag/etapa).

## 2. Frontend — Modal de confirmação

Novo componente `LateCompletionAppealDialog`:
- Título: "Tarefa concluída com atraso"
- Mensagem conforme spec
- Botões: **Abrir recurso** | **Concluir mesmo assim**
- Ao clicar em "Abrir recurso": textarea obrigatório "Justifique o motivo do atraso" com placeholder da spec, botão Enviar
- Após enviar: insere em `task_appeals` (status pendente) e marca tarefa como concluída

Disparo do modal (apenas quando `due_date < hoje` no momento do complete):
- Agenda: `MeuPainelPanel.onToggleComplete` (e re-uso em DayView, AgendaPanel)
- Gestão/PM: ao concluir tarefa pai/subtarefa atrasada (PmTaskDetailDialog, PmTaskCard, PmSubtaskList)
- Magic2: fora do escopo desta etapa

Se "Concluir mesmo assim" → fluxo atual sem mudança.

## 3. Indicadores visuais nos cards

Badge nos cards de tarefa (Meu Painel, Agenda, Gestão):
- 🟡 "Recurso pendente"
- 🟢 "Recurso aprovado"
- 🔴 "Recurso recusado"
- ⚫ "Concluída com atraso" (sem recurso)

## 4. Área de análise — Relatório → Detalhamento por Colaborador

Em `AdminDeadlineReport.tsx`:
- Nova coluna/seção "Recurso" na tabela de detalhamento por colaborador
- Mostra badge de status; se pendente, botões **Aprovar** / **Recusar** (admin/planejador)
- Ao aprovar/recusar: atualiza `task_appeals`, dispara recompute de pontos do mês
- Filtro opcional "Somente com recurso pendente" no topo

## 5. Detalhes técnicos

- Hook `useTaskAppeal(taskId, source)` para ler status + mutações create/approve/reject
- `useCompleteTaskWithAppealCheck` para encapsular a lógica do modal e reusar entre Agenda/PM
- Realtime na tabela `task_appeals` para refletir mudanças entre colaborador e gestor
- O cálculo de pontos passa a consultar `task_appeals` via JOIN/EXISTS antes de aplicar penalidade

## Fora do escopo
- Magic2 e Cleaning
- Notificações WhatsApp dos recursos (pode ser fase 2)
- Histórico/auditoria visual além do `reviewed_at`/`reviewed_by`

Confirma para eu implementar?
