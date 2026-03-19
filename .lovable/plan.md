

## Plano de Implementação

### Resumo
Quatro mudanças principais: (1) corrigir a exclusão de tarefas para zerar pontos corretamente, (2) reestruturar a navegação para que "Tarefas" seja a aba principal com Kanban e o antigo "Projetos" vire sub-aba "Painel de Squads", (3) permitir criar tarefas simplificadas na Agenda, (4) ao avançar etapa no Kanban, detectar tarefas existentes na agenda do mesmo cliente/etapa e oferecer vincular ou selecionar data.

---

### 1. Corrigir exclusão de tarefas zerando pontos

**Problema**: `useDeletePmTask` faz soft-delete dos registros em `tasks` com pattern `pm:{id}:%`, mas o trigger `tasks_sync_metas_prazos` precisa recalcular para TODOS os usuários que tinham registros naquela tarefa, não apenas o assignee principal.

**Solução**:
- Na função `useDeletePmTask`, antes de soft-deletar, buscar todos os `assigned_user_id` distintos dos registros `tasks` com pattern `pm:{id}:%` 
- Após o soft-delete, chamar `recompute_all_scores` para cada usuário afetado via RPC
- Alternativa mais robusta: criar uma migration que atualize o trigger `tasks_sync_metas_prazos` para também detectar mudanças em `deleted_at` (isso já foi feito na migration anterior, mas precisa verificar se está funcionando corretamente com os registros que possuem o sufixo `:user_id`)

**Arquivos**: `src/features/gestao/hooks/use-pm-data.ts`, possível nova migration SQL

---

### 2. Reestruturar navegação: Tarefas como aba principal

**Mudança na sidebar** (`UauSidebarShell.tsx`):
- Renomear o grupo "Projetos" para "Tarefas"
- O `landingTab` do grupo passa a ser `"tarefas"` (Kanban) em vez de `"visao_geral_projetos"`
- Mover o antigo "Visão Geral" (VisaoGeralTab/ProjetosPanel) para dentro do grupo como sub-item com nome "Painel de Squads"

**Nav atualizada**:
```text
Tarefas (grupo)
  ├── Kanban        (landingTab, aba principal)
  ├── Agenda
  ├── Cronograma
  ├── Painel de Squads  (antigo "visao_geral_projetos")
  └── Fluxos
```

**Arquivos**: `src/components/layout/UauSidebarShell.tsx`, `src/pages/Index.tsx`

---

### 3. Criar tarefa simplificada na Agenda

**Mudança**: Adicionar botão "+" nos dias da agenda dentro de `GestaoPanel` (AgendaCalendarView) que abre um dialog simplificado.

**Campos do dialog simplificado**:
- Cliente (obrigatório)
- Etapa (select das 8 etapas)
- Membro responsável
- Data (pré-preenchida com o dia clicado)
- Demanda extra (checkbox)

**Implementação**:
- Criar componente `AgendaQuickCreateDialog` dentro de `src/features/gestao/components/`
- Reutilizar `useCreatePmTask` para criar a tarefa
- Título gerado automaticamente: `[NomeCliente] - {etapa}`
- A tarefa é criada como `pm_task` normal (não draft), com `due_date` preenchido

**Arquivos**: novo `AgendaQuickCreateDialog.tsx`, edição em `GestaoPanel.tsx` (AgendaCalendarView)

---

### 4. Vincular tarefa existente ao avançar etapa

**Contexto**: Ao avançar uma etapa no Kanban (via advanceStage ou drag-and-drop), se já existir uma tarefa na agenda (`pm_tasks` com `status_global = "concluido"`) para o mesmo `client_id` e a mesma etapa de destino, mostrar um dialog com 2 opções:

- **Vincular tarefa**: A tarefa herda a `due_date` da tarefa existente na agenda e avança normalmente
- **Selecionar data**: O usuário escolhe uma data manualmente (comportamento atual)

**Implementação**:
- Criar componente `LinkOrDateDialog` com as duas opções
- No `PmTaskDetailDialog` (advanceStage) e no `PmKanbanBoard` (handleDragEnd): antes de avançar, fazer query para verificar se existe tarefa concluída do mesmo cliente na etapa de destino
- Se existir, abrir o dialog; se não, usar o fluxo atual (pedir data ou usar transitionDates)

**Arquivos**: novo `LinkOrDateDialog.tsx`, edição em `PmTaskDetailDialog.tsx` e `PmKanbanBoard.tsx`

---

### Ordem de execução
1. Fix de exclusão (migration + hook)
2. Reestruturação da navegação (sidebar + Index)
3. Dialog de criação rápida na Agenda
4. Dialog de vinculação ao avançar etapa

