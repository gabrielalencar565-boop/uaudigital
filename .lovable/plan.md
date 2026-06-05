## Objetivo

Permitir marcar clientes que **não devem aparecer no módulo Financeiro** (ex.: "Uau Digital", que é a própria agência). Eles continuam normais em Agenda, Magic Number, Tarefas, etc. — só ficam ocultos das receitas/dashboards financeiros.

## Mudanças

### 1. Banco
- Migration: adicionar coluna `appears_in_financial boolean NOT NULL DEFAULT true` em `public.clients`.
- Marcar `Uau Digital` como `false` por padrão (já que o usuário citou esse caso).

### 2. UI — Configurações do cliente (`AdminClientesPanel.tsx`)
- Na seção "Operação" do dialog de criar/editar cliente, adicionar um switch:
  **"Aparecer no Financeiro"** (default ligado).
- Quando desligado:
  - Ao salvar: remover o cliente de `financial_clients` e suas linhas em `financial_revenues` (igual ao fluxo de exclusão).
- Quando religado:
  - Recria o registro em `financial_clients` (mesmo id, nome, valor, contract_start, contract_months, due_day).

### 3. Hooks de criação (`useCreateClient` / handleCreate)
- Respeitar a flag: se `appears_in_financial = false`, **não** propagar para o Financeiro (hoje o trigger/lógica espelha automaticamente — precisa pular esse passo).

### 4. Listagem em Configurações
- Mostrar um badge discreto "Oculto do Financeiro" na linha dos clientes com a flag desligada (opcional, ajuda a identificar).

## Detalhes técnicos

- Coluna: `clients.appears_in_financial boolean default true`.
- O Financeiro já lê de `financial_clients` — basta garantir que clientes ocultos não tenham linha lá.
- Não mexer em Agenda/Magic Number/Tarefas — eles continuam usando `clients` normalmente.
- Para `Uau Digital`: além da flag, executar limpeza imediata em `financial_clients` e `financial_revenues` do seu id.
