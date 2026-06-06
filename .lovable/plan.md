# Plano: Sincronização automática de XP

Vou conectar o sistema de XP/Recompensas ao sistema de desempenho existente, criando lançamentos automáticos para ranking, squads, vídeo destaque e atrasos de tarefas.

## 1. Estrutura no banco

### Tabela `xp_monthly_processing`
Controla quais meses já foram processados (evita pontuação duplicada).
- `year`, `month`, `criterion` (rank_1, rank_2, squad_destaque), `processed_at`
- Único por (year, month, criterion)

### Tabela `xp_task_penalties`
Registra penalidades de atraso já aplicadas (1x por tarefa).
- `task_id`, `user_id`, `xp_deducted`, `applied_at`
- Único por (task_id, user_id)

### Tabela `xp_video_destaque`
Vídeo destaque do mês (1 por mês).
- `year`, `month`, `pm_task_id`, `selected_by`, `selected_at`
- Único por (year, month)

### Tabela `xp_settings`
Configurações:
- `rank_1_xp` (default 100)
- `rank_2_xp` (default 70)
- `squad_destaque_xp` (default 60)
- `video_destaque_xp` (default 60)
- `task_late_penalty` (default -10)
- `video_destaque_roles` (text[]) — cargos elegíveis
- `late_penalize_all_assignees` (bool) — todos ou só principal

### Extensão de `xp_history`
Adicionar coluna `auto_generated` (bool) e `source_ref` (text) para rastreamento.

## 2. Funções no banco

### `xp_process_monthly_rankings(year, month)`
- Busca `performance_scores` do mês
- Em caso de empate: ordena por tarefas concluídas, depois por menos atrasos
- Insere XP para 1º e 2º lugar
- Marca em `xp_monthly_processing`

### `xp_process_squad_destaque(year, month)`
- Calcula média por squad (usa `squad_members`)
- Identifica squad vencedor
- Insere XP para todos os membros ativos

### `xp_apply_task_late_penalty(task_id)`
- Trigger ao detectar atraso (job diário + trigger em UPDATE de tasks/pm_tasks)
- Verifica se já existe em `xp_task_penalties`
- Aplica -10 XP conforme configuração (todos ou principal)

### `xp_apply_video_destaque(pm_task_id, year, month)`
- Identifica responsáveis (assignee + watchers) filtrados pelos cargos configurados
- Distribui 60 XP para cada um

## 3. Cron jobs (pg_cron)

- **Fechamento mensal** (dia 1 às 00:05): chama `xp_process_monthly_rankings` e `xp_process_squad_destaque` para o mês anterior
- **Verificação de atrasos** (diário às 06:00): varre tarefas vencidas não concluídas e aplica penalidades

## 4. UI

### Admin > Configurações de XP (`RecompensasPanel`)
- Nova aba "Sincronização Automática" com:
  - Valores de XP por critério (editáveis)
  - Toggle "Penalizar todos os responsáveis" vs "Apenas principal"
  - Multi-select de cargos elegíveis para Vídeo Destaque
  - Botão "Processar mês manualmente" (admin)

### Admin > Vídeo Destaque
- Novo painel/seção: seletor de mês + lista de tarefas de vídeo concluídas
- Botão "Marcar como destaque do mês"
- Mostra responsáveis que receberão XP

### Histórico de XP
- Já existe, mostrar badge "Auto" para lançamentos automáticos

## 5. Notificações

- Após cada lançamento automático, inserir notificação para o usuário usando o sistema existente (`notifications` table)

## Detalhes técnicos

- Todas as funções `SECURITY DEFINER` com `search_path = public`
- RLS: admin pode ver/editar tudo; usuários veem apenas seu próprio histórico
- Cron via `pg_cron` + `pg_net` (já presentes no projeto)
- Realtime já configurado em `xp_history` para atualização instantânea

Posso prosseguir com a implementação?