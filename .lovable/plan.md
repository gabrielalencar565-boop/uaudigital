## Sincronização automática do Magic Number com status do cliente

### 1. Estender `sync_client_to_modules()` — desativar cycles por status

Após o bloco que garante o `magic2_clients`/`magic2_client_links`, adicionar lógica que recalcula `magic2_cycles.is_active` para o cliente:

- Para cada cycle (year, month) ligado ao cliente via `magic2_client_links`:
  - Calcular o "alvo" do mês: `target = year*12 + (month-1)`.
  - Marcar `is_active = false` se:
    - `ended_at` definido e `(ey*12 + em-1) <= target`, **ou**
    - `paused_from` definido e `(py*12 + pm-1) <= target` e (`resumed_from` nulo ou `(ry*12 + rm-1) > target`).
  - Caso contrário: `is_active = true` (reativar quando o cliente volta).
- Implementar em SQL puro com um `UPDATE ... FROM` sobre `magic2_cycles c JOIN magic2_client_links l`.

### 2. Trigger: adicionar colunas faltantes ao `UPDATE OF`

Recriar o trigger `clients_sync_modules` incluindo `paused_from, resumed_from, ended_at` na cláusula `UPDATE OF`, para que mudanças nessas datas disparem a sincronização.

### 3. Cascata na exclusão de cliente

Adicionar um trigger `BEFORE DELETE ON public.clients` que apaga:
```sql
DELETE FROM magic2_cycle_stages WHERE cycle_id IN (SELECT id FROM magic2_cycles WHERE client_id IN (SELECT magic2_client_id FROM magic2_client_links WHERE agenda_client_id = OLD.id));
DELETE FROM magic2_cycles WHERE client_id IN (SELECT magic2_client_id FROM magic2_client_links WHERE agenda_client_id = OLD.id);
DELETE FROM magic2_clients WHERE id IN (SELECT magic2_client_id FROM magic2_client_links WHERE agenda_client_id = OLD.id);
DELETE FROM magic2_client_links WHERE agenda_client_id = OLD.id;
```
Isso garante que excluir um cliente o remove imediatamente do Magic Number.

### 4. Backfill imediato

Na mesma migration, rodar um UPDATE que aplica a regra (item 1) a todos os clientes existentes — para limpar os clientes pausados/encerrados que hoje estão visíveis indevidamente. E rodar um DELETE-cascade dos órfãos (`magic2_client_links` apontando para `clients` inexistentes).

### Arquivos afetados
- Nova migration SQL: redefine `sync_client_to_modules()`, recria o trigger com novas colunas, adiciona trigger de delete-cascade, executa backfill.
- Nenhuma mudança no frontend — o filtro `c.is_active` que já existe passa a refletir o status corretamente.
