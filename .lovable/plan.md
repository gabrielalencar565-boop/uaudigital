## Objetivo

Permitir criar novas "etapas" no painel **Admin → Pontuação**, junto da tabela "Critérios por etapa" (Planejamento, Captação, PDF, Alterações, Agendamento). Essas novas etapas são **periódicas/avulsas** — só servem para configurar pontuação manualmente, **não aparecem** no Kanban, na Agenda, no Magic Number nem no fluxo de tarefas.

## Como funciona hoje

- A tabela "Critérios por etapa" lê de `scoring_config`, filtrando por uma lista fixa: `["planejamento", "captacao", "pdf", "alteracoes", "agendamento"]`.
- As "etiquetas" (já criáveis) usam `stage` com prefixo `tag_...` e aparecem em outra tabela.
- O fluxo do Kanban/Magic/Agenda usa `PM_STAGES` em `pm-constants.ts` (hardcoded) e o enum `stage_type` no banco. Não vamos mexer em nada disso.

## Solução

Usar um novo prefixo `custom_` em `scoring_config.stage` para identificar etapas periódicas. Isso isola completamente do fluxo (que valida via enum `stage_type`) e do sistema de etiquetas (`tag_`).

### 1. UI — `AdminPontuacaoPanel.tsx`

No card "Critérios por etapa", adicionar:

- Um bloco "Nova etapa periódica" (similar ao de etiquetas) com:
  - Input para nome (ex: "Reunião semanal", "Relatório mensal")
  - Botão "Criar"
- Cada etapa periódica criada aparece na mesma tabela, ao final, com:
  - Mesmas colunas: Pontos base, Penalidade atraso, Usa quantidade, Multiplicador extra
  - Botão de **remover** (lixeira) — só aparece em etapas `custom_*`, não nas fixas
- Badge visual "Periódica" para diferenciar das fixas

A lista `magicStages` passa a incluir também todas as linhas cujo `stage` começa com `custom_`.

### 2. Criação

```text
Nome digitado → normalizado (lowercase, sem acento, _ no lugar de espaço) → "custom_<slug>"
INSERT em scoring_config:
  stage = "custom_reuniao_semanal"
  label = "Reunião semanal"
  base_points = 1, late_penalty = -1, uses_quantity = false, extra_demand_multiplier = 1.5
```

Validação: bloquear duplicatas pelo `stage` gerado.

### 3. Remoção

DELETE da linha em `scoring_config` onde `stage = 'custom_xxx'`. Como o prefixo `custom_` nunca é usado em `pm_tasks.stage` nem em `tasks.stage` (que é enum), não há risco de quebrar tarefas existentes.

### 4. O que NÃO muda

- `pm-constants.ts` (`PM_STAGES`, `STAGE_FLOW_NEXT`) — intacto.
- Enum `stage_type` no banco — intacto.
- Kanban, Agenda, Magic Number, criação de tarefas — não veem essas etapas.
- Triggers de pontuação (`recompute_metas_prazos`, `pm_sync_stage_completion`) — continuam funcionando; etapas `custom_*` simplesmente não terão tarefas vinculadas, então não geram pontuação automática.

### 5. Como serão usadas (esclarecimento)

Como essas etapas não entram no fluxo, a pontuação delas **não será aplicada automaticamente**. Elas servirão como **referência de configuração** — caso futuramente seja preciso lançar pontos manualmente para um colaborador (ex: "fez a reunião semanal"), os valores ficam definidos aqui. Se você quiser também um botão para **lançar manualmente** essa pontuação para um usuário/mês, me avise — seria um próximo passo (criar uma tela de "lançamento manual" que insere em `tasks` usando o `base_points` configurado).

## Arquivos alterados

- `src/features/admin/AdminPontuacaoPanel.tsx` — adicionar bloco de criação, remoção e listagem das etapas periódicas na tabela existente.

Sem migrações de schema. Sem mudanças no fluxo.
