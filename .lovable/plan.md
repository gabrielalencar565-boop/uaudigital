## Mudanças no AdminClientesPanel

### 1. Remover toggle "Aparecer no Financeiro"
- Remover a seção "Visibilidade" com o Switch do dialog de criar/editar.
- Remover o campo `appears_in_financial` do `clientSchema` / `emptyDefaults`.
- Remover o badge "Oculto do Financeiro" da listagem.

### 2. Nova regra: `due_day = 0` significa oculto do Financeiro
- No campo "Dia de pagamento" permitir valor `0` com helper text: "Use 0 para não aparecer no Financeiro (cliente interno)."
- Nos handlers `handleCreate` / `handleEdit`:
  - Se `due_day === 0` → DELETE de `financial_revenues` + `financial_clients` (mesma lógica que hoje usa o toggle off).
  - Se `due_day > 0` → upsert normal em `financial_clients` propagando `due_day`, `contract_months`, `ended_at`, etc.

### 3. Trigger no banco
- Atualizar `sync_client_to_modules()`: trocar a condição `appears_in_financial = false` por `due_day = 0 OR due_day IS NULL` para sincronizar (delete vs upsert).
- Manter a coluna `appears_in_financial` no banco por compatibilidade, mas deixar de ler/escrever no app (ou dropar — confirmar). **Vou dropar a coluna** para evitar confusão.
- Para clientes que hoje têm `appears_in_financial = false` (ex.: Uau Digital), setar `due_day = 0` antes de dropar a coluna.

### 4. Edição de cliente encerrado — UI simplificada
Quando `ended_at IS NOT NULL` no dialog de edição, esconder todos os outros campos (plano, valor, serviços, squad, etc.) e mostrar apenas:
- Nome (read-only)
- **Data de encerramento** — três selects lado a lado: Dia / Mês / Ano (padrão do projeto, já usado em outras telas).
- **Motivo do encerramento** (`end_reason`) — textarea.
- Botão "Reativar contrato" que limpa `ended_at` + `end_reason` e volta a mostrar o form completo.

Para clientes ativos, manter o form atual com todos os campos.

### 5. Date picker dia/mês/ano
Reusar o padrão de 3 selects (Dia, Mês, Ano) já usado em `Profile editing` para o campo `ended_at` no modo encerrado, com auto-clamp do dia conforme mês/ano.

## Arquivos afetados
- `src/features/admin/AdminClientesPanel.tsx` (UI + handlers)
- Migration: atualizar trigger `sync_client_to_modules` + UPDATE em clientes com `appears_in_financial=false` para `due_day=0` + DROP COLUMN `appears_in_financial`.
