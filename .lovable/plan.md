## Objetivo

1. **Sync automático** — ao salvar valor de contrato em Configurações, refletir imediatamente no Financeiro (criar/atualizar `financial_clients`).
2. **Sync de nomes** — renomear registros em `financial_clients` para bater 100% com `clients.name`.
3. **Histórico imutável por timeline** — pausar/retornar cliente afeta apenas do mês informado em diante. Meses anteriores preservam faturamento, metas, ranking e Magic Number.

---

## 1. Schema — novos campos em `clients`

Adicionar:
- `paused_from` (date, nullable) — primeiro mês em que cliente fica pausado (use sempre o dia 1).
- `resumed_from` (date, nullable) — mês de retorno opcional.
- `ended_at` (date, nullable) — encerramento definitivo.
- `started_at` (date, nullable, default = `contract_start`) — data de entrada para checagem histórica.

Função SQL helper:
```sql
public.client_status_at(p_client uuid, p_year int, p_month int) returns text
-- retorna 'ativo' | 'pausado' | 'encerrado' | 'fora_periodo'
```

Regra:
- `fora_periodo` se mês < `started_at`.
- `encerrado` se `ended_at` <= primeiro dia do mês.
- `pausado` se `paused_from` <= mês e (`resumed_from` é null OU `resumed_from` > mês).
- senão `ativo`.

Sync espelhado em `financial_clients` (mesmos campos).

---

## 2. Sync Configurações → Financeiro

No `handleEdit`/`handleCreate` (`AdminClientesPanel.tsx`):
- Após salvar `clients`, **sempre** fazer `upsert` em `financial_clients` com `id` igual ao do client, propagando: `name`, `monthly_value`, `contract_months`, `contract_start`, `is_active`, `paused_from`, `resumed_from`, `ended_at`.
- Remover dependência do `normalizeClientName` para lookup; passar a usar `id` como chave canônica (já corrigido em mensagens anteriores, agora reforçado: trigger DB garante).

Migration de dados:
- Para cada `clients` sem `financial_clients` com mesmo id → inserir.
- Atualizar `financial_clients.name = clients.name` por id match.
- Mover revenues remanescentes do registro antigo (por nome) para o id correto e remover duplicatas.

Trigger DB (alternativa robusta):
```sql
create trigger sync_client_to_financial
after insert or update on public.clients
for each row execute function public.sync_client_to_financial();
```
Função copia campos relevantes para `financial_clients` via upsert por id.

---

## 3. UI Configurações — bloco "Status do contrato"

Adicionar no formulário do cliente:
- Status atual (badge calculado: Ativo / Pausado desde MM/AAAA / Encerrado em MM/AAAA).
- Botão **Pausar cliente** → dialog com seletor mês/ano de início da pausa (obrigatório) e mês/ano de retorno (opcional).
- Botão **Retomar** (se pausado) → seletor de mês/ano de retorno.
- Botão **Encerrar contrato** → seletor mês/ano.
- Substituir o checkbox `is_active` por esse fluxo (mantendo `is_active` como espelho de "status atual != encerrado/pausado" para retrocompat).

---

## 4. Aplicar status histórico nos módulos

Substituir filtros do tipo `is_active = true` por checagem timeline usando `client_status_at(client_id, year, month) = 'ativo'`. Locais:

- **Financeiro**
  - `use-financial-data.ts` — `revenues` previstas, MRR, faturamento previsto do mês exibido.
  - `FinVisaoAnualTab`, `FinFluxoCaixaTab`, `FinReceitasDespesasTab`.
- **Metas** — `features/metas` / hooks de meta mensal.
- **Ranking** — `magic`, `magic2`, performance rankings que iteram clientes.
- **Magic Number** — `MagicPanel`, `MagicChecklistTable`, `use-magic2*`.
- **Gestão / PMs** — `GestaoPanel`, `PmKanbanBoard`, `PmClientView` (apenas onde lista clientes "atuais"; não tocar em dados de tarefas históricas).

**Regra de ouro:** ao consultar mês passado, usar status daquele mês. Nunca apagar registros históricos. Receitas de meses anteriores à pausa permanecem visíveis e contabilizadas.

---

## 5. Detalhes técnicos

- Para cada hook que carrega clientes por mês, passar `(year, month)` e filtrar in-memory após buscar `clients` + campos novos. Evita N+1 e dispensa view.
- Helper TS `getClientStatusAt(client, year, month)` espelhando a função SQL — usado em toda UI.
- Realtime: incluir novos campos em `clients` (já replicado, só verificar payload).
- Performance scores e revenues continuam por (year, month) com `client_id`; nada apagado.

---

## 6. Entregáveis nesta tarefa

1. Migration: novos campos + função `client_status_at` + trigger `sync_client_to_financial` + backfill (`financial_clients.name = clients.name`, mover revenues órfãs, dedupe).
2. Helper TS `client-status.ts`.
3. UI de pausa/retorno/encerramento em `AdminClientesPanel`.
4. Refactor de filtros `is_active` → `getClientStatusAt` nos módulos listados.
5. Sync automático valor/contract/nome de Configurações → Financeiro (via trigger + chamada explícita no save).

Confirma para eu seguir?