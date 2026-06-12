
# Central de Automações WhatsApp

Transforma a aba "Mensagens Automáticas" em um centro onde o admin cria, edita, ativa/desativa e exclui automações sem alterar código. Cada automação tem um **gatilho** (evento ou horário), filtros opcionais, mensagem com variáveis e canal (WhatsApp).

---

## 1. Modelo de dados

Nova tabela `public.whatsapp_automations`:

| campo | descrição |
|---|---|
| `name` | nome legível ("Agenda diária") |
| `trigger_type` | `event` ou `schedule` |
| `trigger_key` | identifica o gatilho (ex.: `task_assigned`, `task_completed`, `task_overdue`, `deadline_today`, `deadline_tomorrow`, `xp_gain`, `xp_level_up`, `xp_top3`, `xp_first`, `daily_agenda`, `daily_summary`, `weekly_summary`, `performance_report`) |
| `schedule_time` | `HH:MM` (apenas para `schedule`) |
| `schedule_days` | array de dias da semana 0-6 (apenas `schedule`) |
| `message_template` | texto com placeholders `{...}` |
| `channel` | `whatsapp` (extensível no futuro) |
| `enabled` | boolean |
| `audience` | `assignee` (default), `all_team`, `top_3`, `admins`, `role:<role>` |
| `filters` | jsonb livre (ex.: `{"min_xp": 100}`) para futura expansão |
| `last_run_at`, `created_at`, `updated_at`, `created_by` | meta |

RLS: somente admin lê/escreve. Service role total.

**Seed inicial**: migrar as 6 mensagens atuais de `whatsapp_settings` para registros em `whatsapp_automations` (um por gatilho), preservando os textos personalizados. Mantemos as colunas atuais por compatibilidade na migração, sem removê-las imediatamente.

---

## 2. Variáveis suportadas

Centralizadas num helper compartilhado (DB + edge). Cada gatilho expõe um subconjunto:

| variável | disponível em |
|---|---|
| `{nome}`, `{primeiro_nome}` | todos |
| `{tarefa}`, `{cliente}`, `{prazo}` | gatilhos de tarefa |
| `{xp}`, `{nivel}`, `{ranking}` | gatilhos de XP |
| `{tarefas_do_dia}` | lista formatada (linhas `- Título · Cliente · 14h`) |
| `{tarefas_atrasadas}` | lista formatada |
| `{tarefas_concluidas}` | lista formatada |
| `{total_tarefas_dia}` | número |

Variáveis desconhecidas são removidas silenciosamente (já implementado em `apply_msg_template`).

---

## 3. Runtime

### Eventos
- **Trigger `task_assigned`**: já temos `pm_tasks_whatsapp_notify_assignee`. Reescrever para iterar todas as automações ativas com `trigger_key = 'task_assigned'` e enfileirar usando o template de cada uma.
- **Outros eventos de tarefa/XP**: adicionar triggers em `pm_tasks` e `user_xp_events` que invocam uma função genérica `whatsapp_dispatch_event(_key, _vars jsonb, _user_id)` que percorre as automações do tipo e enfileira em `whatsapp_outbox`.

### Horários
- Cron único `whatsapp_automations_tick` rodando a cada 5 min em `pg_cron` → chama edge function `whatsapp-dispatch` com `action: "run_schedules"`.
- A edge:
  1. Lê automações `schedule` ativas cujo `schedule_time` cai na janela atual (timezone São Paulo) e dia da semana bate.
  2. Para cada audiência, monta variáveis (incluindo `{tarefas_do_dia}` etc.) e enfileira mensagens.
  3. Marca `last_run_at` para evitar duplicação no mesmo slot.
  4. Chama `processOutbox` no fim.

Os crons antigos (`cron_deadlines`, `cron_xp_ranking`) ficam como automações pré-seeded e seus blocos hardcoded são removidos — o runtime único cobre tudo.

---

## 4. UI — Central de Automações

Substitui o card "Mensagens automáticas" por:

- Header com botão **"Nova Automação"** + filtro Ativas/Inativas.
- Lista (cards) mostrando: nome, badge de status, ícone do tipo de gatilho, horário (se schedule), preview da mensagem truncada, ações (ativar/desativar, editar, excluir).
- **Editor (Dialog)**:
  - Nome
  - Tipo de gatilho (select agrupado: Eventos / Horário programado)
  - Se `schedule`: horário (input time) + chips de dias da semana
  - Audiência (select)
  - Textarea para mensagem + chips clicáveis das variáveis disponíveis para o gatilho selecionado
  - Pré-visualização ao vivo com dados mockados
  - Switch "Ativa"
  - Botões Salvar / Excluir

As 6 mensagens pré-cadastradas aparecem na lista após o seed; o admin pode editá-las ou duplicá-las.

---

## 5. Detalhes técnicos

- **Helper compartilhado** `applyTemplate` já existe na edge; replicar no DB via `apply_msg_template` (já criado). Não precisa duplicar.
- **Catálogo de gatilhos** vive em um único arquivo TS `src/features/admin/whatsapp/automation-catalog.ts`, consumido pelo formulário e exportado para o futuro Cloud (descrição, variáveis suportadas, ícone, categoria). Adicionar novos gatilhos = adicionar entrada no catálogo + handler correspondente.
- **Catch-all silencioso**: se um gatilho dispara e nenhuma automação ativa existe, nada acontece (sem erro).
- **Sem alteração de schema em `whatsapp_settings`** — campos `msg_*` continuam existindo mas deixam de ser lidos após o seed. Podemos remover em migração futura.

---

## 6. Entregáveis

1. Migração: tabela `whatsapp_automations` (+ GRANT/RLS), função `whatsapp_dispatch_event`, triggers para `task_assigned`, `task_completed`/`task_overdue` (via `pm_tasks` update), `xp_level_up`/`xp_top3`/`xp_first`/`xp_gain` (via `user_xp_events`), cron `*/5 * * * *` chamando `run_schedules`, e seed das 6 automações atuais.
2. Edge function: novo handler `run_schedules`, refator de `cronDeadlines` e `cronXpRanking` para usarem o catálogo (ou removidos), helper para construir as variáveis de agenda do dia por usuário.
3. UI: `AdminWhatsAppPanel` → substituir aba "mensagens" por `AutomationsCenter` (lista + dialog editor + catálogo de variáveis).
4. Hooks: `use-whatsapp-automations.ts` (list/create/update/delete/toggle via supabase).

---

## Confirmações antes de implementar

- Posso **migrar** as 6 mensagens atuais para a nova tabela (mantendo o texto), e a partir daí o runtime passa a ler de `whatsapp_automations`? As colunas `msg_*` ficam órfãs até remoção posterior.
- Confirmar fuso para a janela do scheduler: **America/Sao_Paulo** (assumido pelo memory core).
- O gatilho `xp_gain` dispara em **qualquer ganho de XP** registrado em `user_xp_events` — ok?
