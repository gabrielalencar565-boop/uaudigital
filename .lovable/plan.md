# Fase 1 — Cadastro único de Cliente

Objetivo: criar **uma única tela** em Configurações → "Clientes" onde o admin cadastra/edita tudo do cliente. As tabelas existentes (`clients`, `financial_clients`, `magic2_clients`) continuam separadas, mas passam a ser sincronizadas automaticamente a partir de `clients`.

Sem migração de dados duplicados existentes — você revisa manualmente depois.

---

## 1. Schema (migration)

Adicionar colunas em `public.clients`:

| Coluna | Tipo | Default | Descrição |
|---|---|---|---|
| `manager_id` | uuid | null | Gestor responsável (FK lógica → auth.users) |
| `plan_name` | text | null | Plano contratado (ex.: Essencial, Pro) |
| `monthly_value` | numeric(12,2) | 0 | Valor mensal do contrato |
| `contract_start` | date | CURRENT_DATE | Início do contrato |
| `services` | text[] | '{}' | Serviços contratados (Social Media, Vídeo, Design, Tráfego…) |
| `participates_magic` | boolean | true | Entra no Magic Number |
| `participates_ranking` | boolean | true | Entra no Ranking |
| `has_goals` | boolean | false | Possui Metas |

Sem migração de dados existentes — clientes antigos ficam com defaults.

---

## 2. Trigger de sincronização

Criar `public.sync_client_to_modules()` (AFTER INSERT/UPDATE em `clients`):

- **Financial**: se não existir `financial_clients` com mesmo `id`, criar; se existir, atualizar `name`, `monthly_value`, `contract_start`, `is_active`. (Usa o **mesmo UUID** para amarrar — simples e sem busca por nome.)
- **Magic2**: se `participates_magic = true` e não existir link em `magic2_client_links`, chamar `magic2_ensure_client_link(NEW.id)`. Se passar para `false`, **não** apaga (evita perda de histórico) — só deixa de criar ciclos novos. Já existe lógica que checa o link.
- **Soft-disable**: quando `is_active` vira `false`, propaga `is_active=false` para `financial_clients`.

Único cuidado: `financial_clients.id` hoje é gerado independente. Vou ajustar o trigger pra usar `clients.id` como chave do registro financeiro **apenas para novos clientes criados via cadastro único** (`ON CONFLICT (id) DO UPDATE`). Clientes financeiros legados ficam como estão.

---

## 3. UI — nova tela "Clientes" em Configurações

Substituir o atual `AdminClientesPanel` por uma versão expandida:

**Tabela**:
- Colunas: Status • Nome • Gestor • Plano • Valor mensal • Squads • Módulos (badges: Magic, Ranking, Metas) • Ações
- Filtros: ativos/pausados, com/sem Magic, com/sem Metas

**Dialog "Novo / Editar Cliente"** com seções:
1. **Identificação** — Nome, Gestor (select de team_members), Status
2. **Contrato** — Plano, Valor mensal, Data início, Meses de contrato
3. **Operação** — Squads (já existe), Serviços (multi-select chips)
4. **Módulos ativos** — switches: Magic Number, Ranking, Metas
5. **Observações** — notes

Ao salvar: 1 único `upsert` em `clients` → trigger cuida do resto.

---

## 4. Limpeza / depreciação suave

- `FinClientesTab` continua existindo (pra editar clientes financeiros legados), mas ganha um aviso no topo: *"Novos clientes devem ser criados em Configurações → Clientes."*
- Magic Number: o card "Criar cliente" continua, mas usa o mesmo cadastro novo (link).

Não removo nada agora — só centralizo a porta de entrada.

---

## 5. Fora de escopo (próximas fases)

- Metas automáticas
- Estrutura padrão de relatórios
- Merge de duplicados existentes (você faz manual)
- Migração de IDs de `financial_clients` legados para casar com `clients`

---

## Arquivos a editar

- **Migration nova** — colunas + trigger + grants
- `src/features/admin/AdminClientesPanel.tsx` — expandir dialog + tabela
- `src/features/data/queries.ts` — `useCreateClient` e novo `useUpdateClient` aceitando os novos campos
- `src/features/financeiro/components/FinClientesTab.tsx` — banner informativo (curto)

Posso seguir?
